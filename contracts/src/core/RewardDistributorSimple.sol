// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IRewardDistributor} from "../interfaces/IRewardDistributor.sol";
import {IVotePowerVerifier} from "../interfaces/IVotePowerVerifier.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title RewardDistributorSimple
 * @notice Simplified reward distributor for initial deployment
 * @dev This is a simplified version without Superfluid dependencies for easier deployment
 *      The full Superfluid integration is in RewardDistributor.sol
 */
contract RewardDistributorSimple is IRewardDistributor, AccessControl, ReentrancyGuard {
    // ============ Constants ============

    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    uint256 private constant SECONDS_PER_MONTH = 30 days;

    // ============ State Variables ============

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
     * @notice Initialize RewardDistributorSimple
     * @param _votePowerVerifier Vote power verifier contract address
     */
    constructor(address _votePowerVerifier) {
        if (_votePowerVerifier == address(0)) {
            revert("Invalid address");
        }

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
            _closeAllStreams(topicId);
            return;
        }

        int96 poolFlowRate = _topicPoolFlowRate[topicId];
        if (poolFlowRate == 0) {
            revert InvalidFlowRate();
        }

        int96 totalNewFlowRate = 0;

        for (uint256 i = 0; i < votingPowerMapping.length; i++) {
            address delegate = votingPowerMapping[i].delegate;
            uint256 power = votingPowerMapping[i].power;

            if (power == 0) {
                _closeStream(topicId, delegate);
                continue;
            }

            int96 newFlowRate = int96(int256((uint256(uint96(poolFlowRate)) * power) / totalVotingPower));

            if (newFlowRate > 0) {
                _updateStream(topicId, delegate, newFlowRate);
                totalNewFlowRate += newFlowRate;
            }
        }

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
        flowRate = int96(int256((uint256(uint96(poolFlowRate)) * votingPower) / totalVotingPower));
        tokensPerMonth = uint256(uint96(flowRate)) * SECONDS_PER_MONTH;
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

        _topicPoolFlowRate[topicId] = newPoolFlowRate;
        emit PoolFlowRateUpdated(topicId, newPoolFlowRate);
    }

    /**
     * @inheritdoc IRewardDistributor
     */
    function fundPool(uint256, uint256) external override onlyRole(ADMIN_ROLE) {
        // Simplified version - no actual funding needed
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

    // ============ Internal Functions ============

    function _updateStream(uint256 topicId, address delegate, int96 newFlowRate) internal {
        RewardStream storage stream = _rewardStreams[topicId][delegate];
        int96 oldFlowRate = stream.flowRate;

        if (!stream.active) {
            stream.delegate = delegate;
            stream.topicId = topicId;
            stream.flowRate = newFlowRate;
            stream.active = true;
            stream.lastUpdated = block.timestamp;
            _addDelegate(topicId, delegate);
            emit FlowCreated(delegate, topicId, newFlowRate);
        } else if (oldFlowRate != newFlowRate) {
            uint256 timeDelta = block.timestamp - stream.lastUpdated;
            uint256 accrued = uint256(uint96(oldFlowRate)) * timeDelta;
            stream.totalStreamed += accrued;
            stream.flowRate = newFlowRate;
            stream.lastUpdated = block.timestamp;
            emit FlowUpdated(delegate, topicId, oldFlowRate, newFlowRate);
        }
    }

    function _closeStream(uint256 topicId, address delegate) internal {
        RewardStream storage stream = _rewardStreams[topicId][delegate];

        if (!stream.active) return;

        uint256 timeDelta = block.timestamp - stream.lastUpdated;
        uint256 accrued = uint256(uint96(stream.flowRate)) * timeDelta;
        stream.totalStreamed += accrued;
        stream.flowRate = 0;
        stream.active = false;
        stream.lastUpdated = block.timestamp;
        _removeDelegate(topicId, delegate);
        emit FlowDeleted(delegate, topicId);
    }

    function _closeAllStreams(uint256 topicId) internal {
        address[] memory delegates = _activeDelegates[topicId];
        for (uint256 i = 0; i < delegates.length; i++) {
            _closeStream(topicId, delegates[i]);
        }
    }

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

    function _addDelegate(uint256 topicId, address delegate) internal {
        if (!_delegateExists[topicId][delegate]) {
            _delegateIndex[topicId][delegate] = _activeDelegates[topicId].length;
            _activeDelegates[topicId].push(delegate);
            _delegateExists[topicId][delegate] = true;
        }
    }

    function _removeDelegate(uint256 topicId, address delegate) internal {
        if (!_delegateExists[topicId][delegate]) return;

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
