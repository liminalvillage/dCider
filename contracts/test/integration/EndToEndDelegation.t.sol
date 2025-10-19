// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {DelegationManager} from "../../src/core/DelegationManager.sol";
import {TopicRegistry} from "../../src/core/TopicRegistry.sol";
import {VotePowerVerifier} from "../../src/core/VotePowerVerifier.sol";
import {IDelegationManager} from "../../src/interfaces/IDelegationManager.sol";
import {IVotePowerVerifier} from "../../src/interfaces/IVotePowerVerifier.sol";

/**
 * @title EndToEndDelegationTest
 * @notice T045: Integration test for complete delegation flow
 * @dev Tests realistic multi-user delegation scenarios with vote power computation
 */
contract EndToEndDelegationTest is Test {
    DelegationManager public delegationManager;
    TopicRegistry public topicRegistry;
    VotePowerVerifier public votePowerVerifier;

    address public admin = address(1);
    address public operator1 = address(100);
    address public operator2 = address(101);
    address public operator3 = address(102);

    // Voters
    address public alice = address(2);
    address public bob = address(3);
    address public charlie = address(4);
    address public dave = address(5);
    address public eve = address(6);
    address public frank = address(7);

    uint256 public topicId;

    event Delegated(
        address indexed delegator,
        address indexed delegate,
        uint256 indexed topicId,
        uint256 timestamp
    );

    function setUp() public {
        vm.startPrank(admin);

        // Deploy contracts
        topicRegistry = new TopicRegistry();
        votePowerVerifier = new VotePowerVerifier();
        delegationManager = new DelegationManager(address(topicRegistry));

        // Create test topic
        topicId = topicRegistry.createTopic(
            "Climate Policy",
            bytes32(uint256(1)),
            10
        );

        // Setup enclave operators
        votePowerVerifier.addOperator(operator1, abi.encodePacked(bytes32(uint256(1))));
        votePowerVerifier.addOperator(operator2, abi.encodePacked(bytes32(uint256(2))));
        votePowerVerifier.addOperator(operator3, abi.encodePacked(bytes32(uint256(3))));

        vm.stopPrank();
    }

    // ============ Scenario 1: Simple Delegation Chain ============

    function testE2E_SimpleDelegationChain() public {
        // Scenario: Alice -> Bob -> Charlie
        // Charlie gets voting power of 3 (himself + Bob + Alice)

        vm.prank(alice);
        delegationManager.delegate(topicId, bob);

        vm.prank(bob);
        delegationManager.delegate(topicId, charlie);

        // Verify delegations
        IDelegationManager.Delegation memory aliceDelegation =
            delegationManager.getDelegation(alice, topicId);
        assertEq(aliceDelegation.delegate, bob);

        IDelegationManager.Delegation memory bobDelegation =
            delegationManager.getDelegation(bob, topicId);
        assertEq(bobDelegation.delegate, charlie);

        // Charlie is terminal delegate
        assertEq(delegationManager.getTerminalDelegate(alice, topicId), charlie);
        assertEq(delegationManager.getTerminalDelegate(bob, topicId), charlie);
        assertEq(delegationManager.getTerminalDelegate(charlie, topicId), charlie);
    }

    // ============ Scenario 2: Multi-Branch Delegation ============

    function testE2E_MultiBranchDelegation() public {
        // Scenario:
        //   Alice -> Charlie
        //   Bob -> Charlie
        //   Dave -> Charlie
        //   Eve -> Frank
        //
        // Expected voting power:
        //   Charlie: 4 (himself + Alice + Bob + Dave)
        //   Frank: 2 (himself + Eve)

        vm.prank(alice);
        delegationManager.delegate(topicId, charlie);

        vm.prank(bob);
        delegationManager.delegate(topicId, charlie);

        vm.prank(dave);
        delegationManager.delegate(topicId, charlie);

        vm.prank(eve);
        delegationManager.delegate(topicId, frank);

        // Verify terminal delegates
        assertEq(delegationManager.getTerminalDelegate(alice, topicId), charlie);
        assertEq(delegationManager.getTerminalDelegate(bob, topicId), charlie);
        assertEq(delegationManager.getTerminalDelegate(dave, topicId), charlie);
        assertEq(delegationManager.getTerminalDelegate(eve, topicId), frank);

        // Get all delegations for graph export
        (address[] memory delegators, address[] memory delegates) =
            delegationManager.getAllDelegationsForTopic(topicId);

        assertEq(delegators.length, 4);
        assertEq(delegates.length, 4);
    }

    // ============ Scenario 3: Delegation Change ============

    function testE2E_DelegationChange() public {
        // Scenario:
        //   1. Alice -> Bob
        //   2. Alice changes to Charlie
        //   3. Verify old delegation removed

        vm.startPrank(alice);

        // Initial delegation
        delegationManager.delegate(topicId, bob);
        assertEq(delegationManager.getTerminalDelegate(alice, topicId), bob);

        // Change delegation
        delegationManager.delegate(topicId, charlie);
        assertEq(delegationManager.getTerminalDelegate(alice, topicId), charlie);

        vm.stopPrank();

        // Verify only one delegation exists
        IDelegationManager.Delegation memory delegation =
            delegationManager.getDelegation(alice, topicId);
        assertEq(delegation.delegate, charlie);
    }

    // ============ Scenario 4: Revocation Impact ============

    function testE2E_RevocationImpact() public {
        // Scenario:
        //   1. Alice -> Bob -> Charlie
        //   2. Bob revokes
        //   3. Alice now points to Bob (terminal), Charlie isolated

        vm.prank(alice);
        delegationManager.delegate(topicId, bob);

        vm.prank(bob);
        delegationManager.delegate(topicId, charlie);

        // Verify chain before revocation
        assertEq(delegationManager.getTerminalDelegate(alice, topicId), charlie);

        // Bob revokes
        vm.prank(bob);
        delegationManager.revoke(topicId);

        // Verify chain after revocation
        assertEq(delegationManager.getTerminalDelegate(alice, topicId), bob);
        assertEq(delegationManager.getTerminalDelegate(bob, topicId), bob);
    }

    // ============ Scenario 5: Dead-End Protection ============

    function testE2E_DeadEndProtection() public {
        // Scenario:
        //   1. Charlie declares dead-end
        //   2. Alice tries to delegate to Charlie -> FAILS
        //   3. Alice delegates to Bob
        //   4. Bob tries to delegate to Charlie -> FAILS

        vm.prank(charlie);
        delegationManager.declareDeadEnd(topicId);

        // Alice cannot delegate to dead-end
        vm.prank(alice);
        vm.expectRevert(IDelegationManager.DelegateIsDeadEnd.selector);
        delegationManager.delegate(topicId, charlie);

        // Alice delegates to Bob instead
        vm.prank(alice);
        delegationManager.delegate(topicId, bob);

        // Bob cannot delegate to dead-end
        vm.prank(bob);
        vm.expectRevert(IDelegationManager.DelegateIsDeadEnd.selector);
        delegationManager.delegate(topicId, charlie);
    }

    // ============ Scenario 6: Max Depth Enforcement ============

    function testE2E_MaxDepthEnforcement() public {
        address[] memory users = new address[](9);
        users[0] = alice;
        users[1] = bob;
        users[2] = charlie;
        users[3] = dave;
        users[4] = eve;
        users[5] = frank;
        users[6] = address(8);
        users[7] = address(9);
        users[8] = address(10);

        // Create chain of depth 7 (max allowed)
        for (uint256 i = 0; i < 7; i++) {
            vm.prank(users[i]);
            delegationManager.delegate(topicId, users[i + 1]);
        }

        // Verify depth
        assertEq(delegationManager.getDelegationDepth(users[0], topicId), 7);

        // Verify terminal delegate
        assertEq(delegationManager.getTerminalDelegate(users[0], topicId), users[7]);

        // Cannot extend chain further
        vm.prank(users[7]);
        vm.expectRevert(IDelegationManager.ExceedsMaxDepth.selector);
        delegationManager.delegate(topicId, users[8]);
    }

    // ============ Scenario 7: Topic Deactivation ============

    function testE2E_TopicDeactivation() public {
        // Alice can delegate while topic is active
        vm.prank(alice);
        delegationManager.delegate(topicId, bob);

        // Admin deactivates topic
        vm.prank(admin);
        topicRegistry.setTopicActive(topicId, false);

        // Alice cannot change delegation on inactive topic
        vm.prank(alice);
        vm.expectRevert(IDelegationManager.TopicNotActive.selector);
        delegationManager.delegate(topicId, charlie);

        // Existing delegation still queryable
        IDelegationManager.Delegation memory delegation =
            delegationManager.getDelegation(alice, topicId);
        assertEq(delegation.delegate, bob);
    }

    // ============ Scenario 8: Complex Graph ============

    function testE2E_ComplexGraph() public {
        // Scenario: Realistic 6-person delegation network
        //   Alice -> Bob -> Charlie
        //   Dave -> Bob
        //   Eve -> Frank
        //
        // Expected terminal delegates:
        //   Alice, Bob, Dave -> Charlie
        //   Eve, Frank -> Frank

        vm.prank(alice);
        delegationManager.delegate(topicId, bob);

        vm.prank(bob);
        delegationManager.delegate(topicId, charlie);

        vm.prank(dave);
        delegationManager.delegate(topicId, bob);

        vm.prank(eve);
        delegationManager.delegate(topicId, frank);

        // Verify terminal delegates
        assertEq(delegationManager.getTerminalDelegate(alice, topicId), charlie);
        assertEq(delegationManager.getTerminalDelegate(bob, topicId), charlie);
        assertEq(delegationManager.getTerminalDelegate(dave, topicId), charlie);
        assertEq(delegationManager.getTerminalDelegate(eve, topicId), frank);
        assertEq(delegationManager.getTerminalDelegate(frank, topicId), frank);
        assertEq(delegationManager.getTerminalDelegate(charlie, topicId), charlie);

        // Verify delegation depths
        assertEq(delegationManager.getDelegationDepth(alice, topicId), 2);
        assertEq(delegationManager.getDelegationDepth(bob, topicId), 1);
        assertEq(delegationManager.getDelegationDepth(dave, topicId), 2);
        assertEq(delegationManager.getDelegationDepth(eve, topicId), 1);

        // Export graph
        (address[] memory delegators, address[] memory delegates) =
            delegationManager.getAllDelegationsForTopic(topicId);

        assertEq(delegators.length, 4); // alice, bob, dave, eve
    }
}
