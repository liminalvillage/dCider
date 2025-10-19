// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IVotePowerVerifier
 * @notice Interface for verifying M-of-N enclave attestations and managing voting power cache
 * @dev Handles attestation submission, signature verification, and voting power updates
 */
interface IVotePowerVerifier {
    // ============ Structs ============

    struct EnclaveOperator {
        address operatorAddress;
        bytes enclavePublicKey;
        bool active;
        uint256 addedAt;
        uint256 attestationCount;
    }

    struct Attestation {
        bytes32 resultHash;
        uint256 topicId;
        uint256 blockNumber;
        bytes[] signatures;
        uint256 nonce;
    }

    struct VotingPower {
        address user;
        uint256 topicId;
        uint256 power;
        uint256 lastUpdated;
        bytes32 attestationHash;
    }

    // ============ Events ============

    event AttestationSubmitted(
        bytes32 indexed resultHash,
        uint256 indexed topicId,
        uint256 blockNumber,
        address[] operators
    );

    event AttestationAccepted(
        bytes32 indexed resultHash,
        uint256 timestamp
    );

    event AttestationRejected(
        bytes32 indexed resultHash,
        string reason
    );

    event VotingPowerUpdated(
        uint256 indexed topicId,
        bytes32 attestationHash,
        uint256 timestamp
    );

    event OperatorAdded(
        address indexed operator,
        bytes enclavePublicKey
    );

    event OperatorRemoved(
        address indexed operator
    );

    // ============ Errors ============

    error ArrayLengthMismatch();
    error ResultHashMismatch();
    error InsufficientSignatures(uint256 provided, uint256 required);
    error InvalidOperatorSignature(address recovered);
    error DuplicateOperatorSignature(address operator);
    error NonceAlreadyUsed(uint256 nonce);
    error BlockNumberTooOld(uint256 provided, uint256 current);
    error OperatorNotActive(address operator);
    error CannotRemoveOperator(string reason);
    error UnauthorizedCaller();

    // ============ Constants ============

    /**
     * @notice M value for M-of-N threshold
     * @return Minimum signatures required (3)
     */
    function ATTESTATION_THRESHOLD() external view returns (uint256);

    /**
     * @notice Maximum block age for attestations
     * @return Maximum blocks old (100)
     */
    function MAX_BLOCK_AGE() external view returns (uint256);

    // ============ Functions ============

    /**
     * @notice Submit enclave attestation for voting power computation
     * @param attestation Attestation data with M-of-N signatures
     * @param addresses Array of addresses with voting power
     * @param powers Array of corresponding voting powers
     */
    function submitAttestation(
        Attestation calldata attestation,
        address[] calldata addresses,
        uint256[] calldata powers
    ) external;

    /**
     * @notice Get cached voting power for address on topic
     * @param user Address to query
     * @param topicId Topic ID
     * @return power Current voting power
     * @return lastUpdated Timestamp of last update
     * @return attestationHash Hash of attestation that set this value
     */
    function getVotingPower(address user, uint256 topicId)
        external
        view
        returns (
            uint256 power,
            uint256 lastUpdated,
            bytes32 attestationHash
        );

    /**
     * @notice Get list of all authorized operators
     * @return operators Array of operator details
     * @return threshold M value (signatures required)
     * @return totalOperators N value (total operators)
     */
    function getOperators()
        external
        view
        returns (
            EnclaveOperator[] memory operators,
            uint256 threshold,
            uint256 totalOperators
        );

    /**
     * @notice Check if address is authorized operator
     * @param operator Address to check
     * @return isOperator Whether address is operator
     * @return active Whether operator is active
     */
    function isOperator(address operator)
        external
        view
        returns (bool isOperator, bool active);

    /**
     * @notice Verify ECDSA signature on result hash (view function for testing)
     * @param resultHash Hash to verify
     * @param signature Signature bytes
     * @return valid Whether signature is valid
     * @return recoveredAddress Address recovered from signature
     */
    function verifySignature(bytes32 resultHash, bytes calldata signature)
        external
        view
        returns (bool valid, address recoveredAddress);

    /**
     * @notice Add new enclave operator (admin only)
     * @param operatorAddress Operator's address
     * @param enclavePublicKey TEE enclave public key
     */
    function addOperator(address operatorAddress, bytes calldata enclavePublicKey) external;

    /**
     * @notice Remove enclave operator (admin only)
     * @param operatorAddress Operator to remove
     */
    function removeOperator(address operatorAddress) external;
}
