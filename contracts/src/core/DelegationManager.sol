// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IDelegationManager} from "../interfaces/IDelegationManager.sol";
import {ITopicRegistry} from "../interfaces/ITopicRegistry.sol";
import {DelegationGraph} from "../libraries/DelegationGraph.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title DelegationManager
 * @notice Core contract for managing topic-specific voting power delegation
 * @dev Implements delegation, revocation, and dead-end declaration logic
 */
contract DelegationManager is IDelegationManager, ReentrancyGuard {
    // ============ State Variables ============

    /// @notice Reference to TopicRegistry contract
    ITopicRegistry public immutable topicRegistry;

    /// @notice Delegation mapping: topicId => delegator => delegate
    mapping(uint256 => mapping(address => address)) private _delegations;

    /// @notice Dead-end declarations: topicId => delegate => declaration
    mapping(uint256 => mapping(address => DeadEndDeclaration)) private _deadEndDeclarations;

    /// @notice Track all delegators per topic for graph export
    mapping(uint256 => address[]) private _topicDelegators;

    /// @notice Check if address is already in delegators list
    mapping(uint256 => mapping(address => bool)) private _isDelegator;

    // ============ Constructor ============

    /**
     * @param _topicRegistry Address of TopicRegistry contract
     */
    constructor(address _topicRegistry) {
        require(_topicRegistry != address(0), "Invalid registry address");
        topicRegistry = ITopicRegistry(_topicRegistry);
    }

    // ============ External Functions ============

    /**
     * @inheritdoc IDelegationManager
     */
    function delegate(uint256 topicId, address delegate_)
        external
        override
        nonReentrant
    {
        // Validation: Cannot self-delegate
        if (msg.sender == delegate_) {
            revert CannotSelfDelegate();
        }

        // Validation: Topic must be active
        (, bool active) = topicRegistry.isTopicActive(topicId);
        if (!active) {
            revert TopicNotActive();
        }

        // Validation: Delegate cannot be dead-end
        if (_deadEndDeclarations[topicId][delegate_].active) {
            revert DelegateIsDeadEnd();
        }

        // Validation: Check for cycles
        if (DelegationGraph.wouldCreateCycle(_delegations[topicId], msg.sender, delegate_)) {
            revert CreatesCycle();
        }

        // Validation: Check delegation depth
        // We need to ensure that adding this delegation won't cause ANY upstream
        // delegator to exceed the max depth.
        //
        // When msg.sender delegates to delegate_, the new depth through msg.sender becomes:
        // depth(delegate_) + 1
        //
        // For any address A that currently delegates (directly or transitively) to msg.sender,
        // their new depth would be: current_hops_to_msg_sender + 1 + depth(delegate_)
        //
        // To avoid expensive iteration, we check:
        // 1. The direct chain through delegate_ doesn't exceed max
        // 2. If msg.sender is currently a terminal (depth 0), then anyone pointing to them
        //    would have their depth increased by depth(delegate_) + 1

        uint8 delegateDepth = DelegationGraph.calculateDepth(_delegations[topicId], delegate_);

        // Check direct chain depth
        if (delegateDepth + 1 > DelegationGraph.MAX_DELEGATION_DEPTH) {
            revert ExceedsMaxDepth();
        }

        // Check if msg.sender is currently at the end of a long chain
        // If msg.sender currently has depth 0, we need to check if anyone points to them
        // and would exceed the limit
        uint8 currentDelegatorDepth = DelegationGraph.calculateDepth(_delegations[topicId], msg.sender);

        // If msg.sender is changing their delegation (not creating new), we're safe
        // because existing chains remain the same length
        // But if msg.sender wasn't delegating (depth 0), they become part of longer chains

        // Check all existing delegators to see if any would exceed max depth
        address[] memory allDelegators = _topicDelegators[topicId];
        for (uint256 i = 0; i < allDelegators.length; i++) {
            address existingDelegator = allDelegators[i];

            // Skip if this delegator no longer has active delegation
            if (_delegations[topicId][existingDelegator] == address(0)) {
                continue;
            }

            // Check if this delegator's chain goes through msg.sender
            address terminal = DelegationGraph.getTerminalDelegate(_delegations[topicId], existingDelegator);
            if (terminal == msg.sender) {
                // This delegator's chain ends at msg.sender
                // After msg.sender delegates, the chain would be:
                // existingDelegator -> ... -> msg.sender -> delegate_ -> (chain from delegate_)
                uint8 existingDepth = DelegationGraph.calculateDepth(_delegations[topicId], existingDelegator);
                uint8 newTotalDepth = existingDepth + delegateDepth + 1;

                if (newTotalDepth > DelegationGraph.MAX_DELEGATION_DEPTH) {
                    revert ExceedsMaxDepth();
                }
            }
        }

        // Store delegation
        _delegations[topicId][msg.sender] = delegate_;

        // Track delegator for graph export
        if (!_isDelegator[topicId][msg.sender]) {
            _topicDelegators[topicId].push(msg.sender);
            _isDelegator[topicId][msg.sender] = true;
        }

        emit Delegated(msg.sender, delegate_, topicId, block.timestamp);
    }

    /**
     * @inheritdoc IDelegationManager
     */
    function revoke(uint256 topicId) external override nonReentrant {
        address currentDelegate = _delegations[topicId][msg.sender];

        // No-op if no delegation exists
        if (currentDelegate == address(0)) {
            return;
        }

        // Clear delegation
        delete _delegations[topicId][msg.sender];

        emit Revoked(msg.sender, topicId, block.timestamp);
    }

    /**
     * @inheritdoc IDelegationManager
     */
    function declareDeadEnd(uint256 topicId) external override {
        // Validation: Topic must exist
        (, bool active) = topicRegistry.isTopicActive(topicId);
        if (!active) {
            // Topic exists check (active topics exist, inactive exist but are disabled)
            try topicRegistry.getTopic(topicId) {
                // Topic exists
            } catch {
                revert TopicNotActive();
            }
        }

        _deadEndDeclarations[topicId][msg.sender] = DeadEndDeclaration({
            delegate: msg.sender,
            topicId: topicId,
            active: true,
            declaredAt: block.timestamp
        });

        emit DeadEndDeclared(msg.sender, topicId, block.timestamp);
    }

    /**
     * @inheritdoc IDelegationManager
     */
    function revokeDeadEnd(uint256 topicId) external override {
        if (!_deadEndDeclarations[topicId][msg.sender].active) {
            return; // No-op if not currently dead-end
        }

        _deadEndDeclarations[topicId][msg.sender].active = false;

        emit DeadEndRevoked(msg.sender, topicId, block.timestamp);
    }

    /**
     * @inheritdoc IDelegationManager
     */
    function getDelegation(address delegator, uint256 topicId)
        external
        view
        override
        returns (Delegation memory)
    {
        address delegate_ = _delegations[topicId][delegator];

        if (delegate_ == address(0)) {
            // No delegation exists
            return Delegation({
                delegator: delegator,
                delegate: address(0),
                topicId: topicId,
                timestamp: 0,
                depth: 0
            });
        }

        uint8 depth = DelegationGraph.calculateDepth(_delegations[topicId], delegator);

        return Delegation({
            delegator: delegator,
            delegate: delegate_,
            topicId: topicId,
            timestamp: 0, // TODO: Store timestamp in future version if needed
            depth: depth
        });
    }

    /**
     * @inheritdoc IDelegationManager
     */
    function isDeadEnd(address delegate_, uint256 topicId)
        external
        view
        override
        returns (bool isDeadEnd_, uint256 declaredAt)
    {
        DeadEndDeclaration memory declaration = _deadEndDeclarations[topicId][delegate_];
        return (declaration.active, declaration.declaredAt);
    }

    /**
     * @inheritdoc IDelegationManager
     */
    function getDelegationDepth(address user, uint256 topicId)
        external
        view
        override
        returns (uint8 depth)
    {
        return DelegationGraph.calculateDepth(_delegations[topicId], user);
    }

    /**
     * @inheritdoc IDelegationManager
     */
    function getTerminalDelegate(address delegator, uint256 topicId)
        external
        view
        override
        returns (address terminal)
    {
        return DelegationGraph.getTerminalDelegate(_delegations[topicId], delegator);
    }

    /**
     * @inheritdoc IDelegationManager
     */
    function getDelegationChain(address delegator, uint256 topicId)
        external
        view
        override
        returns (address[] memory chain)
    {
        return DelegationGraph.getDelegationChain(_delegations[topicId], delegator);
    }

    /**
     * @inheritdoc IDelegationManager
     */
    function getAllDelegationsForTopic(uint256 topicId)
        external
        view
        override
        returns (address[] memory delegators, address[] memory delegates)
    {
        address[] memory allDelegators = _topicDelegators[topicId];
        uint256 count = 0;

        // Count active delegations
        for (uint256 i = 0; i < allDelegators.length; i++) {
            if (_delegations[topicId][allDelegators[i]] != address(0)) {
                count++;
            }
        }

        // Allocate arrays
        delegators = new address[](count);
        delegates = new address[](count);

        // Populate arrays with active delegations
        uint256 index = 0;
        for (uint256 i = 0; i < allDelegators.length; i++) {
            address delegator = allDelegators[i];
            address delegate_ = _delegations[topicId][delegator];

            if (delegate_ != address(0)) {
                delegators[index] = delegator;
                delegates[index] = delegate_;
                index++;
            }
        }

        return (delegators, delegates);
    }

    /**
     * @notice Get all delegators for a topic (for graph visualization)
     * @param topicId Topic identifier
     * @return Array of all delegator addresses who have active delegations
     */
    function getTopicDelegators(uint256 topicId)
        external
        view
        returns (address[] memory)
    {
        address[] memory allDelegators = _topicDelegators[topicId];
        uint256 count = 0;

        // Count active delegations
        for (uint256 i = 0; i < allDelegators.length; i++) {
            if (_delegations[topicId][allDelegators[i]] != address(0)) {
                count++;
            }
        }

        // Allocate and populate result array
        address[] memory activeDelegators = new address[](count);
        uint256 index = 0;

        for (uint256 i = 0; i < allDelegators.length; i++) {
            address delegator = allDelegators[i];
            if (_delegations[topicId][delegator] != address(0)) {
                activeDelegators[index] = delegator;
                index++;
            }
        }

        return activeDelegators;
    }
}
