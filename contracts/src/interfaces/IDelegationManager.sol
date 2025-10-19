// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IDelegationManager
 * @notice Interface for managing topic-specific voting power delegation
 * @dev Core contract for Liquid Democracy Engine delegation logic
 */
interface IDelegationManager {
    // ============ Structs ============

    struct Delegation {
        address delegator;
        address delegate;
        uint256 topicId;
        uint256 timestamp;
        uint8 depth;
    }

    struct DeadEndDeclaration {
        address delegate;
        uint256 topicId;
        bool active;
        uint256 declaredAt;
    }

    // ============ Events ============

    event Delegated(
        address indexed delegator,
        address indexed delegate,
        uint256 indexed topicId,
        uint256 timestamp
    );

    event Revoked(
        address indexed delegator,
        uint256 indexed topicId,
        uint256 timestamp
    );

    event DeadEndDeclared(
        address indexed delegate,
        uint256 indexed topicId,
        uint256 timestamp
    );

    event DeadEndRevoked(
        address indexed delegate,
        uint256 indexed topicId,
        uint256 timestamp
    );

    // ============ Errors ============

    error CannotSelfDelegate();
    error CreatesCycle();
    error ExceedsMaxDepth();
    error TopicNotActive();
    error DelegateIsDeadEnd();
    error NoDelegationExists();

    // ============ Functions ============

    /**
     * @notice Delegate voting power on a topic to another address
     * @param topicId Topic ID to delegate
     * @param delegate Address to delegate voting power to
     */
    function delegate(uint256 topicId, address delegate) external;

    /**
     * @notice Revoke delegation and reclaim voting power
     * @param topicId Topic ID to revoke delegation for
     */
    function revoke(uint256 topicId) external;

    /**
     * @notice Declare dead-end status to prevent further delegation
     * @param topicId Topic ID to declare dead-end for
     */
    function declareDeadEnd(uint256 topicId) external;

    /**
     * @notice Revoke dead-end declaration
     * @param topicId Topic ID to revoke dead-end for
     */
    function revokeDeadEnd(uint256 topicId) external;

    /**
     * @notice Get delegation info for address on topic
     * @param delegator Address to query
     * @param topicId Topic ID
     * @return Delegation struct
     */
    function getDelegation(address delegator, uint256 topicId)
        external
        view
        returns (Delegation memory);

    /**
     * @notice Check if address is dead-end for topic
     * @param delegate Address to check
     * @param topicId Topic ID
     * @return isDeadEnd Whether address is dead-end
     * @return declaredAt Timestamp of declaration (0 if not dead-end)
     */
    function isDeadEnd(address delegate, uint256 topicId)
        external
        view
        returns (bool isDeadEnd, uint256 declaredAt);

    /**
     * @notice Get delegation chain depth for address
     * @param user Address to check
     * @param topicId Topic ID
     * @return depth Chain depth (0-7)
     */
    function getDelegationDepth(address user, uint256 topicId)
        external
        view
        returns (uint8 depth);

    /**
     * @notice Get terminal delegate (final recipient in chain)
     * @param delegator Address to check
     * @param topicId Topic ID
     * @return terminal Terminal delegate address
     */
    function getTerminalDelegate(address delegator, uint256 topicId)
        external
        view
        returns (address terminal);

    /**
     * @notice Get full delegation chain
     * @param delegator Starting address
     * @param topicId Topic ID
     * @return chain Array of addresses in delegation chain
     */
    function getDelegationChain(address delegator, uint256 topicId)
        external
        view
        returns (address[] memory chain);

    /**
     * @notice Get all delegations for a topic (for graph export)
     * @param topicId Topic ID
     * @return delegators Array of delegator addresses
     * @return delegates Array of corresponding delegate addresses
     */
    function getAllDelegationsForTopic(uint256 topicId)
        external
        view
        returns (address[] memory delegators, address[] memory delegates);
}
