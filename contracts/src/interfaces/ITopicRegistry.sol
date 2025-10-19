// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ITopicRegistry
 * @notice Interface for managing governance topics and their configuration
 * @dev Central registry for all topics with admin controls
 */
interface ITopicRegistry {
    // ============ Structs ============

    struct Topic {
        uint256 id;
        string name;
        bytes32 descriptionCID;
        uint256 proposalThreshold;
        bool active;
        uint256 createdAt;
        address admin;
    }

    // ============ Events ============

    event TopicCreated(
        uint256 indexed topicId,
        string name,
        address indexed admin
    );

    event TopicUpdated(
        uint256 indexed topicId,
        string field,
        string newValue
    );

    // ============ Errors ============

    error TopicNotFound(uint256 topicId);
    error InvalidTopicName();
    error InvalidProposalThreshold();
    error UnauthorizedCaller();
    error TopicAlreadyExists(string name);

    // ============ Functions ============

    /**
     * @notice Create new governance topic (admin only)
     * @param name Topic name (max 64 chars)
     * @param descriptionCID IPFS CID of topic description
     * @param proposalThreshold Min voting power to create proposals
     * @return topicId ID of created topic
     */
    function createTopic(
        string calldata name,
        bytes32 descriptionCID,
        uint256 proposalThreshold
    ) external returns (uint256 topicId);

    /**
     * @notice Get topic details by ID
     * @param topicId Topic ID to query
     * @return topic Topic struct
     */
    function getTopic(uint256 topicId)
        external
        view
        returns (Topic memory topic);

    /**
     * @notice Get all topics (optionally filtered by active status)
     * @param activeOnly If true, return only active topics
     * @return topics Array of all topics
     * @return count Total count of topics returned
     */
    function getAllTopics(bool activeOnly)
        external
        view
        returns (Topic[] memory topics, uint256 count);

    /**
     * @notice Update proposal threshold for topic (admin only)
     * @param topicId Topic ID to update
     * @param newThreshold New proposal threshold value
     */
    function updateTopicThreshold(uint256 topicId, uint256 newThreshold) external;

    /**
     * @notice Activate or deactivate topic (admin only)
     * @param topicId Topic ID to update
     * @param active New active status
     */
    function setTopicActive(uint256 topicId, bool active) external;

    /**
     * @notice Check if topic exists and is active
     * @param topicId Topic ID to check
     * @return exists Whether topic exists
     * @return active Whether topic is active
     */
    function isTopicActive(uint256 topicId)
        external
        view
        returns (bool exists, bool active);

    /**
     * @notice Get total number of topics
     * @return count Total topic count
     */
    function getTopicCount() external view returns (uint256 count);
}
