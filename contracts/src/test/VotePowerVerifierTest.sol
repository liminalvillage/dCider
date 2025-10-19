// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IVotePowerVerifier} from "../interfaces/IVotePowerVerifier.sol";
import {AttestationLib} from "../libraries/AttestationLib.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

/**
 * @title VotePowerVerifierTest
 * @notice TEST VERSION with threshold=1 for MVP testing
 * @dev ⚠️ DO NOT USE IN PRODUCTION - Only for testing weighted voting
 */
contract VotePowerVerifierTest is IVotePowerVerifier, AccessControl, ReentrancyGuard {
    using EnumerableSet for EnumerableSet.AddressSet;

    // ============ Constants ============

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    uint256 public constant override ATTESTATION_THRESHOLD = 1; // ⚠️ TEST: Lowered from 3
    uint256 public constant override MAX_BLOCK_AGE = 100;

    // ============ State Variables ============

    EnumerableSet.AddressSet private _operators;
    mapping(address => EnclaveOperator) private _operatorDetails;
    mapping(uint256 => bool) private _usedNonces;
    mapping(uint256 => mapping(address => VotingPower)) private _votingPowerCache;
    mapping(uint256 => bytes32) private _lastAttestationHash;

    // ============ Constructor ============

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // ============ External Functions ============

    function submitAttestation(
        Attestation calldata attestation,
        address[] calldata addresses,
        uint256[] calldata powers
    ) external override nonReentrant {
        if (addresses.length != powers.length) {
            revert ArrayLengthMismatch();
        }

        if (_usedNonces[attestation.nonce]) {
            revert NonceAlreadyUsed(attestation.nonce);
        }

        if (!AttestationLib.verifyBlockFreshness(
            attestation.blockNumber,
            block.number,
            MAX_BLOCK_AGE
        )) {
            revert BlockNumberTooOld(attestation.blockNumber, block.number);
        }

        bytes32 expectedHash = AttestationLib.calculateResultHash(addresses, powers);

        if (expectedHash != attestation.resultHash) {
            revert ResultHashMismatch();
        }

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

        address[] memory activeOps = new address[](activeCount);
        for (uint256 i = 0; i < activeCount; i++) {
            activeOps[i] = authorizedOps[i];
        }

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

        _usedNonces[attestation.nonce] = true;

        _updateVotingPowerCache(attestation.topicId, addresses, powers, attestation.resultHash);

        for (uint256 i = 0; i < signers.length; i++) {
            _operatorDetails[signers[i]].attestationCount++;
        }

        emit AttestationAccepted(attestation.resultHash, block.timestamp);
        emit VotingPowerUpdated(attestation.topicId, attestation.resultHash, block.timestamp);
    }

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

    function verifySignature(bytes32 resultHash, bytes calldata signature)
        external
        pure
        override
        returns (bool valid, address recoveredAddress)
    {
        address signer = AttestationLib.recoverSigner(resultHash, signature);

        if (signer == address(0)) {
            return (false, address(0));
        }

        return (true, signer);
    }

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

    function removeOperator(address operatorAddress)
        external
        override
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (!_operators.contains(operatorAddress)) {
            revert("Operator does not exist");
        }

        // No threshold check in test version - can remove freely

        _operators.remove(operatorAddress);
        _revokeRole(OPERATOR_ROLE, operatorAddress);

        delete _operatorDetails[operatorAddress];

        emit OperatorRemoved(operatorAddress);
    }

    // ============ Internal Functions ============

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
}
