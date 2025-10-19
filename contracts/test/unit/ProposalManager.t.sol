// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {ProposalManager} from "../../src/core/ProposalManager.sol";
import {TopicRegistry} from "../../src/core/TopicRegistry.sol";
import {DelegationManager} from "../../src/core/DelegationManager.sol";
import {VotePowerVerifier} from "../../src/core/VotePowerVerifier.sol";
import {IProposalManager} from "../../src/interfaces/IProposalManager.sol";

contract ProposalManagerTest is Test {
    ProposalManager public proposalManager;
    TopicRegistry public topicRegistry;
    DelegationManager public delegationManager;
    VotePowerVerifier public votePowerVerifier;

    address public owner = address(this);
    address public alice = address(0x1);
    address public bob = address(0x2);
    address public charlie = address(0x3);

    uint256 public topicId = 1;
    uint256 public votingPeriod = 1000; // blocks

    event ProposalCreated(
        uint256 indexed proposalId,
        uint256 indexed topicId,
        address indexed proposer,
        string title,
        uint256 startBlock,
        uint256 endBlock
    );

    event VoteCast(
        uint256 indexed proposalId,
        address indexed voter,
        IProposalManager.VoteChoice choice,
        uint256 votes,
        address indexed delegate
    );

    function setUp() public {
        // Deploy contracts
        topicRegistry = new TopicRegistry();
        delegationManager = new DelegationManager(address(topicRegistry));
        votePowerVerifier = new VotePowerVerifier();
        proposalManager = new ProposalManager(
            address(topicRegistry),
            address(delegationManager),
            address(votePowerVerifier)
        );

        // Create a topic
        topicRegistry.createTopic("Climate Policy", "QmTest", 10);

        // Fund test accounts
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        vm.deal(charlie, 100 ether);
    }

    function test_CreateProposal() public {
        IProposalManager.ProposalParams memory params = IProposalManager.ProposalParams({
            topicId: topicId,
            title: "Reduce Carbon Emissions by 50%",
            descriptionCID: "QmProposal1",
            votingPeriod: votingPeriod
        });

        vm.prank(alice);
        uint256 proposalId = proposalManager.createProposal(params);

        assertEq(proposalId, 1);

        IProposalManager.Proposal memory proposal = proposalManager.getProposal(proposalId);
        assertEq(proposal.id, 1);
        assertEq(proposal.topicId, topicId);
        assertEq(proposal.proposer, alice);
        assertEq(proposal.title, "Reduce Carbon Emissions by 50%");
        assertEq(proposal.forVotes, 0);
        assertEq(proposal.againstVotes, 0);
        assertTrue(uint8(proposal.status) == uint8(IProposalManager.ProposalStatus.Active));
    }

    function test_CreateProposal_EmitsEvent() public {
        IProposalManager.ProposalParams memory params = IProposalManager.ProposalParams({
            topicId: topicId,
            title: "Test Proposal",
            descriptionCID: "QmTest",
            votingPeriod: votingPeriod
        });

        vm.expectEmit(true, true, true, false);
        emit ProposalCreated(1, topicId, alice, "Test Proposal", 0, 0);

        vm.prank(alice);
        proposalManager.createProposal(params);
    }

    function test_CreateProposal_RevertsForInactiveTopic() public {
        // Deactivate topic
        topicRegistry.setTopicActive(topicId, false);

        IProposalManager.ProposalParams memory params = IProposalManager.ProposalParams({
            topicId: topicId,
            title: "Test",
            descriptionCID: "QmTest",
            votingPeriod: votingPeriod
        });

        vm.prank(alice);
        vm.expectRevert(IProposalManager.InvalidTopic.selector);
        proposalManager.createProposal(params);
    }

    function test_CreateProposal_RevertsForInvalidVotingPeriod() public {
        IProposalManager.ProposalParams memory params = IProposalManager.ProposalParams({
            topicId: topicId,
            title: "Test",
            descriptionCID: "QmTest",
            votingPeriod: 50 // Too short
        });

        vm.prank(alice);
        vm.expectRevert(IProposalManager.InvalidVotingPeriod.selector);
        proposalManager.createProposal(params);
    }

    function test_CastVote_For() public {
        // Create proposal
        vm.prank(alice);
        uint256 proposalId = createTestProposal();

        // Alice votes (she's a terminal delegate since no delegation)
        vm.prank(alice);
        proposalManager.castVote(proposalId, IProposalManager.VoteChoice.For);

        IProposalManager.Proposal memory proposal = proposalManager.getProposal(proposalId);
        assertEq(proposal.forVotes, 1);
        assertEq(proposal.againstVotes, 0);
        assertEq(proposal.abstainVotes, 0);
    }

    function test_CastVote_Against() public {
        vm.prank(alice);
        uint256 proposalId = createTestProposal();

        vm.prank(alice);
        proposalManager.castVote(proposalId, IProposalManager.VoteChoice.Against);

        IProposalManager.Proposal memory proposal = proposalManager.getProposal(proposalId);
        assertEq(proposal.forVotes, 0);
        assertEq(proposal.againstVotes, 1);
    }

    function test_CastVote_Abstain() public {
        vm.prank(alice);
        uint256 proposalId = createTestProposal();

        vm.prank(alice);
        proposalManager.castVote(proposalId, IProposalManager.VoteChoice.Abstain);

        IProposalManager.Proposal memory proposal = proposalManager.getProposal(proposalId);
        assertEq(proposal.abstainVotes, 1);
    }

    function test_CastVote_EmitsEvent() public {
        vm.prank(alice);
        uint256 proposalId = createTestProposal();

        vm.expectEmit(true, true, true, true);
        emit VoteCast(proposalId, alice, IProposalManager.VoteChoice.For, 1, alice);

        vm.prank(alice);
        proposalManager.castVote(proposalId, IProposalManager.VoteChoice.For);
    }

    function test_CastVote_RevertsIfAlreadyVoted() public {
        vm.prank(alice);
        uint256 proposalId = createTestProposal();

        vm.prank(alice);
        proposalManager.castVote(proposalId, IProposalManager.VoteChoice.For);

        vm.prank(alice);
        vm.expectRevert(IProposalManager.AlreadyVoted.selector);
        proposalManager.castVote(proposalId, IProposalManager.VoteChoice.Against);
    }

    function test_CastVote_RevertsIfDelegated() public {
        // Alice delegates to Bob
        vm.prank(alice);
        delegationManager.delegate(topicId, bob);

        vm.prank(bob);
        uint256 proposalId = createTestProposal();

        // Alice can't vote because she delegated
        vm.prank(alice);
        vm.expectRevert(IProposalManager.InsufficientVotingPower.selector);
        proposalManager.castVote(proposalId, IProposalManager.VoteChoice.For);

        // But Bob can vote
        vm.prank(bob);
        proposalManager.castVote(proposalId, IProposalManager.VoteChoice.For);

        IProposalManager.Proposal memory proposal = proposalManager.getProposal(proposalId);
        assertEq(proposal.forVotes, 1);
    }

    function test_Execute_SuccessfulProposal() public {
        vm.prank(alice);
        uint256 proposalId = createTestProposal();

        // Alice votes for
        vm.prank(alice);
        proposalManager.castVote(proposalId, IProposalManager.VoteChoice.For);

        // Fast forward past voting period
        vm.roll(block.number + votingPeriod + 1);

        // Execute
        proposalManager.execute(proposalId);

        IProposalManager.Proposal memory proposal = proposalManager.getProposal(proposalId);
        assertTrue(proposal.executed);
        assertTrue(uint8(proposal.status) == uint8(IProposalManager.ProposalStatus.Succeeded));
    }

    function test_Execute_RevertsIfVotingNotEnded() public {
        vm.prank(alice);
        uint256 proposalId = createTestProposal();

        vm.prank(alice);
        proposalManager.castVote(proposalId, IProposalManager.VoteChoice.For);

        vm.expectRevert(IProposalManager.VotingNotEnded.selector);
        proposalManager.execute(proposalId);
    }

    function test_Execute_RevertsIfProposalFailed() public {
        vm.prank(alice);
        uint256 proposalId = createTestProposal();

        // More against votes than for
        vm.prank(alice);
        proposalManager.castVote(proposalId, IProposalManager.VoteChoice.Against);

        vm.roll(block.number + votingPeriod + 1);

        vm.expectRevert(IProposalManager.ProposalFailed.selector);
        proposalManager.execute(proposalId);
    }

    function test_Cancel_ByProposer() public {
        vm.prank(alice);
        uint256 proposalId = createTestProposal();

        vm.prank(alice);
        proposalManager.cancel(proposalId);

        IProposalManager.Proposal memory proposal = proposalManager.getProposal(proposalId);
        assertTrue(uint8(proposal.status) == uint8(IProposalManager.ProposalStatus.Cancelled));
    }

    function test_Cancel_RevertsIfNotProposer() public {
        vm.prank(alice);
        uint256 proposalId = createTestProposal();

        vm.prank(bob);
        vm.expectRevert(IProposalManager.NotProposer.selector);
        proposalManager.cancel(proposalId);
    }

    function test_GetProposalsByTopic() public {
        vm.prank(alice);
        uint256 proposal1 = createTestProposal();

        vm.prank(bob);
        uint256 proposal2 = createTestProposal();

        uint256[] memory proposals = proposalManager.getProposalsByTopic(topicId);

        assertEq(proposals.length, 2);
        assertEq(proposals[0], proposal1);
        assertEq(proposals[1], proposal2);
    }

    function test_GetVotingPower_TerminalDelegate() public {
        vm.prank(alice);
        uint256 proposalId = createTestProposal();

        // Alice has voting power (she's a terminal delegate)
        uint256 power = proposalManager.getVotingPower(proposalId, alice);
        assertEq(power, 1);
    }

    function test_GetVotingPower_DelegatedUser() public {
        // Alice delegates to Bob
        vm.prank(alice);
        delegationManager.delegate(topicId, bob);

        vm.prank(bob);
        uint256 proposalId = createTestProposal();

        // Alice has no voting power (she delegated)
        uint256 alicePower = proposalManager.getVotingPower(proposalId, alice);
        assertEq(alicePower, 0);

        // Bob has voting power (he's a terminal delegate)
        uint256 bobPower = proposalManager.getVotingPower(proposalId, bob);
        assertEq(bobPower, 1);
    }

    // Helper function
    function createTestProposal() internal returns (uint256) {
        IProposalManager.ProposalParams memory params = IProposalManager.ProposalParams({
            topicId: topicId,
            title: "Test Proposal",
            descriptionCID: "QmTest",
            votingPeriod: votingPeriod
        });

        return proposalManager.createProposal(params);
    }
}
