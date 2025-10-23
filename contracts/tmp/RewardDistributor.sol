// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IRewardDistributor} from "../interfaces/IRewardDistributor.sol";
import {IVotePowerVerifier} from "../interfaces/IVotePowerVerifier.sol";
import {ISuperfluid, ISuperToken, ISuperfluidPool} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol";
import {SuperTokenV1Library} from "@superfluid-finance/ethereum-contracts/contracts/apps/SuperTokenV1Library.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title RewardDistributor
 * @notice Manages Superfluid streaming rewards proportional to voting power
 * @dev Uses Superfluid's distribution pool pattern for efficient multi-recipient streaming
 */
contract RewardDistributor is IRewardDistributor, AccessControl, ReentrancyGuard {
    using SuperTokenV1Library for ISuperToken;

    // ============ Constants ============

    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    uint256 private constant SECONDS_PER_MONTH = 30 days;
    uint256 private constant PRECISION = 1e18;

    // ============ State Variables ============

    /// @notice Superfluid host contract
    ISuperfluid public immutable superfluidHost;

    /// @notice Super Token used for rewards
    ISuperToken public immutable rewardToken;

    /// @notice Vote power verifier contract
    IVotePowerVerifier public immutable votePowerVerifier;

    /// @notice Pool flow rate per topic (tokens/second available)
    mapping(uint256 => int96) private _topicPoolFlowRate;

    /// @notice Active streams: topic => delegate => stream data
    mapping(uint256 => mapping(address => RewardStream)) private _rewardStreams;

    /// @notice Total flow rate distributed per topic
    mapping(uint256 => int96) private _totalDistributed;

    /// @notice Set of delegates receiving rewards per topic
    mapping(uint256 => address[]) private _activeDelegates;

    /// @notice Delegate index in active delegates array
    mapping(uint256 => mapping(address => uint256)) private _delegateIndex;

    /// @notice Whether delegate exists in active array
    mapping(uint256 => mapping(address => bool)) private _delegateExists;

    // ============ Constructor ============

    /**
     * @notice Initialize RewardDistributor
     * @param _superfluidHost Superfluid host address
     * @param _rewardToken Super Token address for rewards
     * @param _votePowerVerifier Vote power verifier contract address
     */
    constructor(
        address _superfluidHost,
        address _rewardToken,
        address _votePowerVerifier
    ) {
        if (_superfluidHost == address(0) || _rewardToken == address(0) || _votePowerVerifier == address(0)) {
            revert("Invalid address");
        }

        superfluidHost = ISuperfluid(_superfluidHost);
        rewardToken = ISuperToken(_rewardToken);
        votePowerVerifier = IVotePowerVerifier(_votePowerVerifier);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(VERIFIER_ROLE, _votePowerVerifier);
    }

    // ============ External Functions ============

    /**
     * @inheritdoc IRewardDistributor
     */
    function updateFlows(
        uint256 topicId,
        VotingPowerUpdate[] calldata votingPowerMapping,
        uint256 totalVotingPower
    ) external override onlyRole(VERIFIER_ROLE) nonReentrant {
        if (totalVotingPower == 0) {
            // No voting power, close all streams for this topic
            _closeAllStreams(topicId);
            return;
        }

        int96 poolFlowRate = _topicPoolFlowRate[topicId];
        if (poolFlowRate == 0) {
            revert InvalidFlowRate();
        }

        // Calculate new flow rates for each delegate
        int96 totalNewFlowRate = 0;

        for (uint256 i = 0; i < votingPowerMapping.length; i++) {
            address delegate = votingPowerMapping[i].delegate;
            uint256 power = votingPowerMapping[i].power;

            if (power == 0) {
                // Close stream if voting power is zero
                _closeStream(topicId, delegate);
                continue;
            }

            // Calculate proportional flow rate: (power / totalPower) * poolFlowRate
            int96 newFlowRate = int96(int256((uint256(uint96(poolFlowRate)) * power) / totalVotingPower));

            if (newFlowRate > 0) {
                _updateStream(topicId, delegate, newFlowRate);
                totalNewFlowRate += newFlowRate;
            }
        }

        // Close streams for delegates not in the new mapping
        _pruneInactiveDelegates(topicId, votingPowerMapping);

        _totalDistributed[topicId] = totalNewFlowRate;
    }

    /**
     * @inheritdoc IRewardDistributor
     */
    function getFlowRate(address delegate, uint256 topicId)
        external
        view
        override
        returns (
            int96 flowRate,
            uint256 totalStreamed,
            uint256 lastUpdated
        )
    {
        RewardStream memory stream = _rewardStreams[topicId][delegate];

        if (stream.active) {
            // Calculate accrued amount since last update
            uint256 timeDelta = block.timestamp - stream.lastUpdated;
            uint256 accrued = uint256(uint96(stream.flowRate)) * timeDelta;
            totalStreamed = stream.totalStreamed + accrued;
        } else {
            totalStreamed = stream.totalStreamed;
        }

        return (stream.flowRate, totalStreamed, stream.lastUpdated);
    }

    /**
     * @inheritdoc IRewardDistributor
     */
    function getPoolFlowRate(uint256 topicId)
        external
        view
        override
        returns (
            int96 poolFlowRate,
            int96 totalDistributed,
            int96 remainingCapacity
        )
    {
        poolFlowRate = _topicPoolFlowRate[topicId];
        totalDistributed = _totalDistributed[topicId];
        remainingCapacity = poolFlowRate - totalDistributed;

        return (poolFlowRate, totalDistributed, remainingCapacity);
    }

    /**
     * @inheritdoc IRewardDistributor
     */
    function estimateMonthlyReward(
        uint256 topicId,
        uint256 votingPower,
        uint256 totalVotingPower
    )
        external
        view
        override
        returns (
            uint256 tokensPerMonth,
            int96 flowRate,
            uint256 sharePercentage
        )
    {
        if (totalVotingPower == 0 || votingPower == 0) {
            return (0, 0, 0);
        }

        int96 poolFlowRate = _topicPoolFlowRate[topicId];

        // Calculate proportional flow rate
        flowRate = int96(int256((uint256(uint96(poolFlowRate)) * votingPower) / totalVotingPower));

        // Calculate monthly reward (flowRate is per second)
        tokensPerMonth = uint256(uint96(flowRate)) * SECONDS_PER_MONTH;

        // Calculate percentage (with 2 decimal precision)
        sharePercentage = (votingPower * 10000) / totalVotingPower;

        return (tokensPerMonth, flowRate, sharePercentage);
    }

    /**
     * @inheritdoc IRewardDistributor
     */
    function setPoolFlowRate(uint256 topicId, int96 newPoolFlowRate)
        external
        override
        onlyRole(ADMIN_ROLE)
    {
        if (newPoolFlowRate < 0) {
            revert InvalidFlowRate();
        }

        int96 oldFlowRate = _topicPoolFlowRate[topicId];
        _topicPoolFlowRate[topicId] = newPoolFlowRate;

        emit PoolFlowRateUpdated(topicId, newPoolFlowRate);

        // If reducing pool flow rate, may need to proportionally reduce active streams
        if (newPoolFlowRate < oldFlowRate && _totalDistributed[topicId] > newPoolFlowRate) {
            _rebalanceStreams(topicId);
        }
    }

    /**
     * @inheritdoc IRewardDistributor
     */
    function fundPool(uint256 topicId, uint256 amount)
        external
        override
        onlyRole(ADMIN_ROLE)
        nonReentrant
    {
        if (amount == 0) {
            revert("Amount must be positive");
        }

        // Transfer Super Tokens to this contract
        bool success = rewardToken.transferFrom(msg.sender, address(this), amount);
        if (!success) {
            revert SuperfluidOperationFailed("Transfer failed");
        }

        // Note: Pool is managed by setting flow rates, not direct funding
        // This function allows topping up the contract balance for streaming
    }

    /**
     * @notice Get all active delegates for a topic
     * @param topicId Topic ID
     * @return delegates Array of active delegate addresses
     */
    function getActiveDelegates(uint256 topicId)
        external
        view
        returns (address[] memory delegates)
    {
        return _activeDelegates[topicId];
    }

    /**
     * @notice Emergency withdraw of tokens (admin only)
     * @param token Token address
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(address token, uint256 amount)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        IERC20(token).transfer(msg.sender, amount);
    }

    // ============ Internal Functions ============

    /**
     * @notice Update or create a reward stream
     * @param topicId Topic ID
     * @param delegate Delegate address
     * @param newFlowRate New flow rate (tokens/second)
     */
    function _updateStream(
        uint256 topicId,
        address delegate,
        int96 newFlowRate
    ) internal {
        RewardStream storage stream = _rewardStreams[topicId][delegate];
        int96 oldFlowRate = stream.flowRate;

        if (!stream.active) {
            // Create new stream
            try rewardToken.createFlow(delegate, newFlowRate) {
                stream.delegate = delegate;
                stream.topicId = topicId;
                stream.flowRate = newFlowRate;
                stream.active = true;
                stream.lastUpdated = block.timestamp;

                _addDelegate(topicId, delegate);

                emit FlowCreated(delegate, topicId, newFlowRate);
            } catch Error(string memory reason) {
                revert SuperfluidOperationFailed(reason);
            }
        } else if (oldFlowRate != newFlowRate) {
            // Update existing stream
            uint256 timeDelta = block.timestamp - stream.lastUpdated;
            uint256 accrued = uint256(uint96(oldFlowRate)) * timeDelta;
            stream.totalStreamed += accrued;

            try rewardToken.updateFlow(delegate, newFlowRate) {
                stream.flowRate = newFlowRate;
                stream.lastUpdated = block.timestamp;

                emit FlowUpdated(delegate, topicId, oldFlowRate, newFlowRate);
            } catch Error(string memory reason) {
                revert SuperfluidOperationFailed(reason);
            }
        }
    }

    /**
     * @notice Close a reward stream
     * @param topicId Topic ID
     * @param delegate Delegate address
     */
    function _closeStream(uint256 topicId, address delegate) internal {
        RewardStream storage stream = _rewardStreams[topicId][delegate];

        if (!stream.active) {
            return;
        }

        // Calculate final accrued amount
        uint256 timeDelta = block.timestamp - stream.lastUpdated;
        uint256 accrued = uint256(uint96(stream.flowRate)) * timeDelta;
        stream.totalStreamed += accrued;

        try rewardToken.deleteFlow(address(this), delegate) {
            stream.flowRate = 0;
            stream.active = false;
            stream.lastUpdated = block.timestamp;

            _removeDelegate(topicId, delegate);

            emit FlowDeleted(delegate, topicId);
        } catch Error(string memory reason) {
            revert SuperfluidOperationFailed(reason);
        }
    }

    /**
     * @notice Close all streams for a topic
     * @param topicId Topic ID
     */
    function _closeAllStreams(uint256 topicId) internal {
        address[] memory delegates = _activeDelegates[topicId];

        for (uint256 i = 0; i < delegates.length; i++) {
            _closeStream(topicId, delegates[i]);
        }
    }

    /**
     * @notice Remove delegates not in the new voting power mapping
     * @param topicId Topic ID
     * @param votingPowerMapping New voting power mapping
     */
    function _pruneInactiveDelegates(
        uint256 topicId,
        VotingPowerUpdate[] calldata votingPowerMapping
    ) internal {
        address[] memory currentDelegates = _activeDelegates[topicId];

        for (uint256 i = 0; i < currentDelegates.length; i++) {
            address delegate = currentDelegates[i];
            bool found = false;

            for (uint256 j = 0; j < votingPowerMapping.length; j++) {
                if (votingPowerMapping[j].delegate == delegate) {
                    found = true;
                    break;
                }
            }

            if (!found) {
                _closeStream(topicId, delegate);
            }
        }
    }

    /**
     * @notice Rebalance streams when pool capacity is reduced
     * @param topicId Topic ID
     */
    function _rebalanceStreams(uint256 topicId) internal {
        int96 poolFlowRate = _topicPoolFlowRate[topicId];
        int96 totalDistributed = _totalDistributed[topicId];

        if (totalDistributed <= poolFlowRate) {
            return;
        }

        // Proportionally reduce all streams
        address[] memory delegates = _activeDelegates[topicId];
        int96 newTotalDistributed = 0;

        for (uint256 i = 0; i < delegates.length; i++) {
            address delegate = delegates[i];
            RewardStream storage stream = _rewardStreams[topicId][delegate];

            if (stream.active) {
                // Calculate proportional reduction
                int96 newFlowRate = int96(
                    int256((uint256(uint96(stream.flowRate)) * uint256(uint96(poolFlowRate))) / uint256(uint96(totalDistributed)))
                );

                _updateStream(topicId, delegate, newFlowRate);
                newTotalDistributed += newFlowRate;
            }
        }

        _totalDistributed[topicId] = newTotalDistributed;
    }

    /**
     * @notice Add delegate to active delegates array
     * @param topicId Topic ID
     * @param delegate Delegate address
     */
    function _addDelegate(uint256 topicId, address delegate) internal {
        if (!_delegateExists[topicId][delegate]) {
            _delegateIndex[topicId][delegate] = _activeDelegates[topicId].length;
            _activeDelegates[topicId].push(delegate);
            _delegateExists[topicId][delegate] = true;
        }
    }

    /**
     * @notice Remove delegate from active delegates array
     * @param topicId Topic ID
     * @param delegate Delegate address
     */
    function _removeDelegate(uint256 topicId, address delegate) internal {
        if (!_delegateExists[topicId][delegate]) {
            return;
        }

        uint256 index = _delegateIndex[topicId][delegate];
        uint256 lastIndex = _activeDelegates[topicId].length - 1;

        if (index != lastIndex) {
            address lastDelegate = _activeDelegates[topicId][lastIndex];
            _activeDelegates[topicId][index] = lastDelegate;
            _delegateIndex[topicId][lastDelegate] = index;
        }

        _activeDelegates[topicId].pop();
        delete _delegateIndex[topicId][delegate];
        delete _delegateExists[topicId][delegate];
    }
}
