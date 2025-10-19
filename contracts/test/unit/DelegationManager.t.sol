// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {DelegationManager} from "../../src/core/DelegationManager.sol";
import {TopicRegistry} from "../../src/core/TopicRegistry.sol";
import {IDelegationManager} from "../../src/interfaces/IDelegationManager.sol";

/**
 * @title DelegationManagerTest
 * @notice Unit tests for DelegationManager contract
 * @dev Following TDD - these tests should FAIL until implementation is complete
 */
contract DelegationManagerTest is Test {
    DelegationManager public delegationManager;
    TopicRegistry public topicRegistry;

    address public admin = address(1);
    address public alice = address(2);
    address public bob = address(3);
    address public charlie = address(4);
    address public dave = address(5);

    uint256 public topicId;

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

    function setUp() public {
        vm.startPrank(admin);

        // Deploy TopicRegistry
        topicRegistry = new TopicRegistry();

        // Deploy DelegationManager
        delegationManager = new DelegationManager(address(topicRegistry));

        // Create test topic
        topicId = topicRegistry.createTopic(
            "Test Topic",
            bytes32(uint256(1)),
            10 // proposalThreshold
        );

        vm.stopPrank();
    }

    // ============ T040: Basic Delegation Tests ============

    function testDelegate_Success() public {
        vm.prank(alice);
        vm.expectEmit(true, true, true, true);
        emit Delegated(alice, bob, topicId, block.timestamp);

        delegationManager.delegate(topicId, bob);

        // Verify delegation was stored
        IDelegationManager.Delegation memory delegation = delegationManager.getDelegation(alice, topicId);
        assertEq(delegation.delegator, alice);
        assertEq(delegation.delegate, bob);
        assertEq(delegation.topicId, topicId);
        assertEq(delegation.depth, 1);
    }

    function testDelegate_CannotSelfDelegate() public {
        vm.prank(alice);
        vm.expectRevert(IDelegationManager.CannotSelfDelegate.selector);
        delegationManager.delegate(topicId, alice);
    }

    function testDelegate_TopicNotActive() public {
        // Deactivate topic
        vm.prank(admin);
        topicRegistry.setTopicActive(topicId, false);

        vm.prank(alice);
        vm.expectRevert(IDelegationManager.TopicNotActive.selector);
        delegationManager.delegate(topicId, bob);
    }

    function testDelegate_OverwritesPreviousDelegation() public {
        // Alice delegates to Bob
        vm.prank(alice);
        delegationManager.delegate(topicId, bob);

        // Alice changes delegation to Charlie
        vm.prank(alice);
        vm.expectEmit(true, true, true, true);
        emit Delegated(alice, charlie, topicId, block.timestamp);
        delegationManager.delegate(topicId, charlie);

        // Verify new delegation
        IDelegationManager.Delegation memory delegation = delegationManager.getDelegation(alice, topicId);
        assertEq(delegation.delegate, charlie);
    }

    // ============ T041: Transitive Delegation Tests ============

    function testDelegate_TransitiveChain() public {
        // Create chain: Alice -> Bob -> Charlie
        vm.prank(alice);
        delegationManager.delegate(topicId, bob);

        vm.prank(bob);
        delegationManager.delegate(topicId, charlie);

        // Verify depths (full chain length from each node)
        assertEq(delegationManager.getDelegationDepth(alice, topicId), 2);
        assertEq(delegationManager.getDelegationDepth(bob, topicId), 1);
        assertEq(delegationManager.getDelegationDepth(charlie, topicId), 0); // Terminal

        // Verify delegations
        IDelegationManager.Delegation memory aliceDelegation = delegationManager.getDelegation(alice, topicId);
        assertEq(aliceDelegation.delegate, bob);

        IDelegationManager.Delegation memory bobDelegation = delegationManager.getDelegation(bob, topicId);
        assertEq(bobDelegation.delegate, charlie);
    }

    function testDelegate_LongTransitiveChain() public {
        // Create chain of length 3: Alice -> Bob -> Charlie -> Dave
        vm.prank(alice);
        delegationManager.delegate(topicId, bob);

        vm.prank(bob);
        delegationManager.delegate(topicId, charlie);

        vm.prank(charlie);
        delegationManager.delegate(topicId, dave);

        // Verify depths
        assertEq(delegationManager.getDelegationDepth(alice, topicId), 3);
        assertEq(delegationManager.getDelegationDepth(bob, topicId), 2);
        assertEq(delegationManager.getDelegationDepth(charlie, topicId), 1);
        assertEq(delegationManager.getDelegationDepth(dave, topicId), 0);
    }

    // ============ T042: Cycle Detection Tests ============

    function testDelegate_PreventsCycle_DirectCycle() public {
        // Alice -> Bob
        vm.prank(alice);
        delegationManager.delegate(topicId, bob);

        // Bob -> Alice should fail (creates cycle)
        vm.prank(bob);
        vm.expectRevert(IDelegationManager.CreatesCycle.selector);
        delegationManager.delegate(topicId, alice);
    }

    function testDelegate_PreventsCycle_IndirectCycle() public {
        // Create chain: Alice -> Bob -> Charlie
        vm.prank(alice);
        delegationManager.delegate(topicId, bob);

        vm.prank(bob);
        delegationManager.delegate(topicId, charlie);

        // Charlie -> Alice should fail (creates cycle)
        vm.prank(charlie);
        vm.expectRevert(IDelegationManager.CreatesCycle.selector);
        delegationManager.delegate(topicId, alice);
    }

    function testDelegate_PreventsCycle_SelfLoop() public {
        vm.prank(alice);
        vm.expectRevert(IDelegationManager.CannotSelfDelegate.selector);
        delegationManager.delegate(topicId, alice);
    }

    // ============ T043: Max Depth Validation Tests ============

    function testDelegate_EnforcesMaxDepth() public {
        address[] memory users = new address[](9);
        users[0] = alice;
        users[1] = bob;
        users[2] = charlie;
        users[3] = dave;
        users[4] = address(6);
        users[5] = address(7);
        users[6] = address(8);
        users[7] = address(9);
        users[8] = address(10);

        // Create chain of depth 7 (max allowed)
        for (uint256 i = 0; i < 7; i++) {
            vm.prank(users[i]);
            delegationManager.delegate(topicId, users[i + 1]);
        }

        // Verify depth of first user is 7
        assertEq(delegationManager.getDelegationDepth(users[0], topicId), 7);

        // Attempting to delegate from user[7] to user[8] should fail (would create depth 8)
        vm.prank(users[7]);
        vm.expectRevert(IDelegationManager.ExceedsMaxDepth.selector);
        delegationManager.delegate(topicId, users[8]);
    }

    function testDelegate_DepthCalculation() public {
        // Single delegation: depth 1
        vm.prank(alice);
        delegationManager.delegate(topicId, bob);
        assertEq(delegationManager.getDelegationDepth(alice, topicId), 1);

        // Add second level: depth 2
        vm.prank(bob);
        delegationManager.delegate(topicId, charlie);
        assertEq(delegationManager.getDelegationDepth(alice, topicId), 2);
        assertEq(delegationManager.getDelegationDepth(bob, topicId), 1);

        // No delegation: depth 0
        assertEq(delegationManager.getDelegationDepth(charlie, topicId), 0);
    }

    // ============ Revocation Tests ============

    function testRevoke_Success() public {
        // Alice delegates to Bob
        vm.prank(alice);
        delegationManager.delegate(topicId, bob);

        // Alice revokes
        vm.prank(alice);
        vm.expectEmit(true, true, true, true);
        emit Revoked(alice, topicId, block.timestamp);
        delegationManager.revoke(topicId);

        // Verify delegation cleared
        IDelegationManager.Delegation memory delegation = delegationManager.getDelegation(alice, topicId);
        assertEq(delegation.delegate, address(0));
        assertEq(delegation.depth, 0);
    }

    function testRevoke_NoOpIfNoDelegation() public {
        // Revoking without delegation should not revert
        vm.prank(alice);
        delegationManager.revoke(topicId);

        // Should still have no delegation
        IDelegationManager.Delegation memory delegation = delegationManager.getDelegation(alice, topicId);
        assertEq(delegation.delegate, address(0));
    }

    // ============ Dead-End Tests ============

    function testDeclareDeadEnd_Success() public {
        vm.prank(alice);
        delegationManager.declareDeadEnd(topicId);

        (bool isDeadEnd, uint256 declaredAt) = delegationManager.isDeadEnd(alice, topicId);
        assertTrue(isDeadEnd);
        assertEq(declaredAt, block.timestamp);
    }

    function testDelegate_CannotDelegateToDeadEnd() public {
        // Bob declares dead-end
        vm.prank(bob);
        delegationManager.declareDeadEnd(topicId);

        // Alice tries to delegate to Bob (should fail)
        vm.prank(alice);
        vm.expectRevert(IDelegationManager.DelegateIsDeadEnd.selector);
        delegationManager.delegate(topicId, bob);
    }

    function testRevokeDeadEnd_Success() public {
        // Declare dead-end
        vm.prank(alice);
        delegationManager.declareDeadEnd(topicId);

        // Revoke dead-end
        vm.prank(alice);
        delegationManager.revokeDeadEnd(topicId);

        (bool isDeadEnd,) = delegationManager.isDeadEnd(alice, topicId);
        assertFalse(isDeadEnd);
    }

    // ============ Graph Export Tests ============

    function testGetAllDelegationsForTopic() public {
        // Create multiple delegations
        vm.prank(alice);
        delegationManager.delegate(topicId, bob);

        vm.prank(bob);
        delegationManager.delegate(topicId, charlie);

        vm.prank(dave);
        delegationManager.delegate(topicId, charlie);

        // Get all delegations
        (address[] memory delegators, address[] memory delegates) =
            delegationManager.getAllDelegationsForTopic(topicId);

        assertEq(delegators.length, 3);
        assertEq(delegates.length, 3);

        // Verify delegations are present (order may vary)
        bool foundAlice = false;
        bool foundBob = false;
        bool foundDave = false;

        for (uint256 i = 0; i < delegators.length; i++) {
            if (delegators[i] == alice && delegates[i] == bob) foundAlice = true;
            if (delegators[i] == bob && delegates[i] == charlie) foundBob = true;
            if (delegators[i] == dave && delegates[i] == charlie) foundDave = true;
        }

        assertTrue(foundAlice, "Alice delegation not found");
        assertTrue(foundBob, "Bob delegation not found");
        assertTrue(foundDave, "Dave delegation not found");
    }
}
