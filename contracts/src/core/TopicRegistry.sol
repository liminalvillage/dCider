// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ITopicRegistry} from "../interfaces/ITopicRegistry.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TopicRegistry
 * @notice Central registry for all governance topics
 * @dev Manages topic creation, configuration, and status
 */
contract TopicRegistry is ITopicRegistry, Ownable2Step {
    // ============ State Variables ============

    /// @notice Counter for topic IDs
    uint256 private _topicIdCounter;

    /// @notice Mapping from topic ID to Topic struct
    mapping(uint256 => Topic) private _topics;

    /// @notice Mapping from topic name to existence check (prevents duplicates)
    mapping(string => bool) private _topicNameExists;

    /// @notice Array of all topic IDs for iteration
    uint256[] private _topicIds;

    // ============ Constants ============

    uint256 public constant MAX_NAME_LENGTH = 64;

    // ============ Constructor ============

    constructor() Ownable(msg.sender) {
        _topicIdCounter = 1; // Start IDs at 1
    }

    // ============ External Functions ============

    /**
     * @inheritdoc ITopicRegistry
     */
    function createTopic(
        string calldata name,
        bytes32 descriptionCID,
        uint256 proposalThreshold
    ) external override onlyOwner returns (uint256 topicId) {
        // Validate inputs
        if (bytes(name).length == 0 || bytes(name).length > MAX_NAME_LENGTH) {
            revert InvalidTopicName();
        }

        if (proposalThreshold == 0) {
            revert InvalidProposalThreshold();
        }

        if (_topicNameExists[name]) {
            revert TopicAlreadyExists(name);
        }

        // Create new topic
        topicId = _topicIdCounter++;

        _topics[topicId] = Topic({
            id: topicId,
            name: name,
            descriptionCID: descriptionCID,
            proposalThreshold: proposalThreshold,
            active: true,
            createdAt: block.timestamp,
            admin: msg.sender
        });

        _topicNameExists[name] = true;
        _topicIds.push(topicId);

        emit TopicCreated(topicId, name, msg.sender);

        return topicId;
    }

    /**
     * @inheritdoc ITopicRegistry
     */
    function getTopic(uint256 topicId)
        external
        view
        override
        returns (Topic memory topic)
    {
        if (_topics[topicId].id == 0) {
            revert TopicNotFound(topicId);
        }

        return _topics[topicId];
    }

    /**
     * @inheritdoc ITopicRegistry
     */
    function getAllTopics(bool activeOnly)
        external
        view
        override
        returns (Topic[] memory topics, uint256 count)
    {
        uint256 totalTopics = _topicIds.length;

        // First pass: count matching topics
        count = 0;
        for (uint256 i = 0; i < totalTopics; i++) {
            uint256 topicId = _topicIds[i];
            if (!activeOnly || _topics[topicId].active) {
                count++;
            }
        }

        // Allocate array
        topics = new Topic[](count);

        // Second pass: populate array
        uint256 index = 0;
        for (uint256 i = 0; i < totalTopics; i++) {
            uint256 topicId = _topicIds[i];
            if (!activeOnly || _topics[topicId].active) {
                topics[index] = _topics[topicId];
                index++;
            }
        }

        return (topics, count);
    }

    /**
     * @inheritdoc ITopicRegistry
     */
    function updateTopicThreshold(uint256 topicId, uint256 newThreshold)
        external
        override
        onlyOwner
    {
        if (_topics[topicId].id == 0) {
            revert TopicNotFound(topicId);
        }

        if (newThreshold == 0) {
            revert InvalidProposalThreshold();
        }

        _topics[topicId].proposalThreshold = newThreshold;

        emit TopicUpdated(topicId, "proposalThreshold", _uint256ToString(newThreshold));
    }

    /**
     * @inheritdoc ITopicRegistry
     */
    function setTopicActive(uint256 topicId, bool active)
        external
        override
        onlyOwner
    {
        if (_topics[topicId].id == 0) {
            revert TopicNotFound(topicId);
        }

        _topics[topicId].active = active;

        emit TopicUpdated(topicId, "active", active ? "true" : "false");
    }

    /**
     * @inheritdoc ITopicRegistry
     */
    function isTopicActive(uint256 topicId)
        external
        view
        override
        returns (bool exists, bool active)
    {
        exists = _topics[topicId].id != 0;
        active = exists && _topics[topicId].active;

        return (exists, active);
    }

    /**
     * @inheritdoc ITopicRegistry
     */
    function getTopicCount() external view override returns (uint256 count) {
        return _topicIds.length;
    }

    // ============ Internal Functions ============

    /**
     * @notice Convert uint256 to string
     * @dev Helper for event emission
     * @param value Number to convert
     * @return String representation
     */
    function _uint256ToString(uint256 value) private pure returns (string memory) {
        if (value == 0) {
            return "0";
        }

        uint256 temp = value;
        uint256 digits;

        while (temp != 0) {
            digits++;
            temp /= 10;
        }

        bytes memory buffer = new bytes(digits);

        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }

        return string(buffer);
    }
}
