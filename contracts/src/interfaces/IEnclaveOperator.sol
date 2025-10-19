// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IEnclaveOperator
 * @notice Interface for enclave operators to interact with the system
 * @dev Used by off-chain enclave services to submit attestations
 */
interface IEnclaveOperator {
    // ============ Structs ============

    struct ComputationResult {
        uint256 topicId;
        address[] addresses;
        uint256[] powers;
        uint256 blockNumber;
        bytes32 resultHash;
    }

    // ============ Events ============

    event ComputationRequested(
        uint256 indexed topicId,
        uint256 blockNumber
    );

    event ResultSubmitted(
        address indexed operator,
        bytes32 indexed resultHash,
        uint256 topicId
    );

    // ============ Functions ============

    /**
     * @notice Calculate result hash for voting power mapping
     * @param addresses Array of addresses
     * @param powers Array of corresponding voting powers
     * @return resultHash Keccak256 hash of abi.encode(addresses, powers)
     */
    function calculateResultHash(
        address[] calldata addresses,
        uint256[] calldata powers
    ) external pure returns (bytes32 resultHash);

    /**
     * @notice Get latest block number for which delegation state should be read
     * @return blockNumber Current or recent block number
     */
    function getLatestBlockNumber() external view returns (uint256 blockNumber);

    /**
     * @notice Check if computation is needed for topic
     * @param topicId Topic ID
     * @return needed Whether new computation is needed
     * @return lastComputedBlock Block of last computation
     */
    function isComputationNeeded(uint256 topicId)
        external
        view
        returns (bool needed, uint256 lastComputedBlock);
}
