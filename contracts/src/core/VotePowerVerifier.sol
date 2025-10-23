// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IVotePowerVerifier} from "../interfaces/IVotePowerVerifier.sol";
import {IRewardDistributor} from "../interfaces/IRewardDistributor.sol";
import {AttestationLib} from "../libraries/AttestationLib.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

/**
 * @title VotePowerVerifier
 * @notice Verifies M-of-N enclave attestations and manages voting power cache
 * @dev Implements secure multi-operator attestation verification
 */
contract VotePowerVerifier is IVotePowerVerifier, AccessControl, ReentrancyGuard {
    using EnumerableSet for EnumerableSet.AddressSet;

    // ============ Constants ============

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    uint256 public constant override ATTESTATION_THRESHOLD = 3; // M = 3
    uint256 public constant override MAX_BLOCK_AGE = 100;

    // ============ State Variables ============

    /// @notice Set of authorized operator addresses
    EnumerableSet.AddressSet private _operators;

    /// @notice Mapping from operator address to operator details
    mapping(address => EnclaveOperator) private _operatorDetails;

    /// @notice Mapping from nonce to usage status (replay protection)
    mapping(uint256 => bool) private _usedNonces;

    /// @notice Cached voting power: topic => address => power data
    mapping(uint256 => mapping(address => VotingPower)) private _votingPowerCache;

    /// @notice Last attestation hash per topic
    mapping(uint256 => bytes32) private _lastAttestationHash;

    /// @notice Reward distributor contract (optional)
    IRewardDistributor public rewardDistributor;

    // ============ Events ============

    event RewardDistributorUpdated(address indexed oldDistributor, address indexed newDistributor);

    // ============ Constructor ============

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // ============ External Functions ============

    /**
     * @inheritdoc IVotePowerVerifier
     */
    function submitAttestation(
        Attestation calldata attestation,
        address[] calldata addresses,
        uint256[] calldata powers
    ) external override nonReentrant {
        // Validate input arrays
        if (addresses.length != powers.length) {
            revert ArrayLengthMismatch();
        }

        // Check nonce hasn't been used (replay protection)
        if (_usedNonces[attestation.nonce]) {
            revert NonceAlreadyUsed(attestation.nonce);
        }

        // Verify block freshness
        if (!AttestationLib.verifyBlockFreshness(
            attestation.blockNumber,
            block.number,
            MAX_BLOCK_AGE
        )) {
            revert BlockNumberTooOld(attestation.blockNumber, block.number);
        }

        // Calculate expected result hash
        bytes32 expectedHash = AttestationLib.calculateResultHash(addresses, powers);

        if (expectedHash != attestation.resultHash) {
            revert ResultHashMismatch();
        }

        // Build authorized operators array for verification
        uint256 operatorCount = _operators.length();
        address[] memory authorizedOps = new address[](operatorCount);
        uint256 activeCount = 0;

        for (uint256 i = 0; i < operatorCount; i++) {
            address op = _operators.at(i);
            if (_operatorDetails[op].active) {
                authorizedOps[activeCount] = op;
                activeCount++;
            }
        }

        // Resize array to actual active count
        address[] memory activeOps = new address[](activeCount);
        for (uint256 i = 0; i < activeCount; i++) {
            activeOps[i] = authorizedOps[i];
        }

        // Verify M-of-N signatures
        (bool valid, address[] memory signers) = AttestationLib.verifyMultiSignature(
            attestation.resultHash,
            attestation.signatures,
            activeOps,
            ATTESTATION_THRESHOLD
        );

        if (!valid) {
            revert InsufficientSignatures(attestation.signatures.length, ATTESTATION_THRESHOLD);
        }

        emit AttestationSubmitted(
            attestation.resultHash,
            attestation.topicId,
            attestation.blockNumber,
            signers
        );

        // Mark nonce as used
        _usedNonces[attestation.nonce] = true;

        // Update voting power cache
        _updateVotingPowerCache(attestation.topicId, addresses, powers, attestation.resultHash);

        // Increment attestation count for operators
        for (uint256 i = 0; i < signers.length; i++) {
            _operatorDetails[signers[i]].attestationCount++;
        }

        emit AttestationAccepted(attestation.resultHash, block.timestamp);
        emit VotingPowerUpdated(attestation.topicId, attestation.resultHash, block.timestamp);

        // Trigger reward distribution update if distributor is set
        if (address(rewardDistributor) != address(0)) {
            _triggerRewardUpdate(attestation.topicId, addresses, powers);
        }
    }

    /**
     * @inheritdoc IVotePowerVerifier
     */
    function getVotingPower(address user, uint256 topicId)
        external
        view
        override
        returns (
            uint256 power,
            uint256 lastUpdated,
            bytes32 attestationHash
        )
    {
        VotingPower memory vp = _votingPowerCache[topicId][user];
        return (vp.power, vp.lastUpdated, vp.attestationHash);
    }

    /**
     * @inheritdoc IVotePowerVerifier
     */
    function getOperators()
        external
        view
        override
        returns (
            EnclaveOperator[] memory operators,
            uint256 threshold,
            uint256 totalOperators
        )
    {
        totalOperators = _operators.length();
        operators = new EnclaveOperator[](totalOperators);

        for (uint256 i = 0; i < totalOperators; i++) {
            address opAddr = _operators.at(i);
            operators[i] = _operatorDetails[opAddr];
        }

        threshold = ATTESTATION_THRESHOLD;
        return (operators, threshold, totalOperators);
    }

    /**
     * @inheritdoc IVotePowerVerifier
     */
    function isOperator(address operator)
        external
        view
        override
        returns (bool isOp, bool active)
    {
        isOp = _operators.contains(operator);
        active = isOp && _operatorDetails[operator].active;
        return (isOp, active);
    }

    /**
     * @inheritdoc IVotePowerVerifier
     */
    function verifySignature(bytes32 resultHash, bytes calldata signature)
        external
        pure
        override
        returns (bool valid, address recoveredAddress)
    {
        // Wrap library call to handle potential reverts
        address signer = AttestationLib.recoverSigner(resultHash, signature);

        if (signer == address(0)) {
            return (false, address(0));
        }

        return (true, signer);
    }

    /**
     * @inheritdoc IVotePowerVerifier
     */
    function addOperator(address operatorAddress, bytes calldata enclavePublicKey)
        external
        override
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (operatorAddress == address(0)) {
            revert UnauthorizedCaller();
        }

        if (_operators.contains(operatorAddress)) {
            revert("Operator already exists");
        }

        _operators.add(operatorAddress);
        _grantRole(OPERATOR_ROLE, operatorAddress);

        _operatorDetails[operatorAddress] = EnclaveOperator({
            operatorAddress: operatorAddress,
            enclavePublicKey: enclavePublicKey,
            active: true,
            addedAt: block.timestamp,
            attestationCount: 0
        });

        emit OperatorAdded(operatorAddress, enclavePublicKey);
    }

    /**
     * @inheritdoc IVotePowerVerifier
     */
    function removeOperator(address operatorAddress)
        external
        override
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (!_operators.contains(operatorAddress)) {
            revert("Operator does not exist");
        }

        // Count active operators
        uint256 activeCount = 0;
        uint256 totalOps = _operators.length();
        for (uint256 i = 0; i < totalOps; i++) {
            if (_operatorDetails[_operators.at(i)].active) {
                activeCount++;
            }
        }

        // Cannot remove if it would drop below threshold
        if (activeCount <= ATTESTATION_THRESHOLD) {
            revert CannotRemoveOperator("Would drop below threshold");
        }

        _operators.remove(operatorAddress);
        _revokeRole(OPERATOR_ROLE, operatorAddress);

        delete _operatorDetails[operatorAddress];

        emit OperatorRemoved(operatorAddress);
    }

    /**
     * @notice Set reward distributor contract
     * @param _rewardDistributor Address of reward distributor contract
     */
    function setRewardDistributor(address _rewardDistributor)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        address oldDistributor = address(rewardDistributor);
        rewardDistributor = IRewardDistributor(_rewardDistributor);
        emit RewardDistributorUpdated(oldDistributor, _rewardDistributor);
    }

    // ============ Internal Functions ============

    /**
     * @notice Update voting power cache with new attestation results
     * @param topicId Topic ID
     * @param addresses Array of addresses with voting power
     * @param powers Array of voting power values
     * @param attestationHash Hash of the attestation
     */
    function _updateVotingPowerCache(
        uint256 topicId,
        address[] calldata addresses,
        uint256[] calldata powers,
        bytes32 attestationHash
    ) internal {
        for (uint256 i = 0; i < addresses.length; i++) {
            _votingPowerCache[topicId][addresses[i]] = VotingPower({
                user: addresses[i],
                topicId: topicId,
                power: powers[i],
                lastUpdated: block.timestamp,
                attestationHash: attestationHash
            });
        }

        _lastAttestationHash[topicId] = attestationHash;
    }

    /**
     * @notice Trigger reward distributor update with new voting power
     * @param topicId Topic ID
     * @param addresses Array of addresses with voting power
     * @param powers Array of voting power values
     */
    function _triggerRewardUpdate(
        uint256 topicId,
        address[] calldata addresses,
        uint256[] calldata powers
    ) internal {
        // Calculate total voting power
        uint256 totalVotingPower = 0;
        for (uint256 i = 0; i < powers.length; i++) {
            totalVotingPower += powers[i];
        }

        // Build voting power update array
        IRewardDistributor.VotingPowerUpdate[] memory updates =
            new IRewardDistributor.VotingPowerUpdate[](addresses.length);

        for (uint256 i = 0; i < addresses.length; i++) {
            updates[i] = IRewardDistributor.VotingPowerUpdate({
                delegate: addresses[i],
                power: powers[i]
            });
        }

        // Call reward distributor
        try rewardDistributor.updateFlows(topicId, updates, totalVotingPower) {
            // Success
        } catch {
            // Don't revert entire attestation if reward update fails
            // Log could be added here if needed
        }
    }
}
