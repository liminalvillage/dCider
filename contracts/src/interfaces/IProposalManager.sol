// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IProposalManager
 * @notice Interface for managing proposals and voting
 */
interface IProposalManager {
    // Enums
    enum ProposalStatus {
        Pending,    // Proposal created, voting not started
        Active,     // Voting period active
        Succeeded,  // Vote passed (met quorum and majority)
        Failed,     // Vote failed (didn't meet quorum or majority)
        Executed,   // Proposal executed
        Cancelled   // Proposal cancelled by creator
    }

    enum VoteChoice {
        Against,    // Vote against (0)
        For,        // Vote for (1)
        Abstain     // Abstain from voting (2)
    }

    // Structs
    struct Proposal {
        uint256 id;
        uint256 topicId;
        address proposer;
        string title;
        string descriptionCID;  // IPFS CID for proposal details
        uint256 forVotes;
        uint256 againstVotes;
        uint256 abstainVotes;
        uint256 startBlock;
        uint256 endBlock;
        ProposalStatus status;
        bool executed;
    }

    struct ProposalParams {
        uint256 topicId;
        string title;
        string descriptionCID;
        uint256 votingPeriod;  // In blocks
    }

    struct Receipt {
        bool hasVoted;
        VoteChoice choice;
        uint256 votes;  // Voting power used
    }

    // Events
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
        VoteChoice choice,
        uint256 votes,
        address indexed delegate
    );

    event ProposalExecuted(uint256 indexed proposalId);
    event ProposalCancelled(uint256 indexed proposalId);

    // Errors
    error InvalidTopic();
    error InsufficientVotingPower();
    error ProposalNotActive();
    error ProposalAlreadyExecuted();
    error AlreadyVoted();
    error VotingNotEnded();
    error QuorumNotReached();
    error ProposalFailed();
    error NotProposer();
    error InvalidVotingPeriod();

    // Core Functions
    function createProposal(ProposalParams calldata params) external returns (uint256 proposalId);

    function castVote(uint256 proposalId, VoteChoice choice) external;

    function execute(uint256 proposalId) external;

    function cancel(uint256 proposalId) external;

    // View Functions
    function getProposal(uint256 proposalId) external view returns (Proposal memory);

    function getReceipt(uint256 proposalId, address voter) external view returns (Receipt memory);

    function getProposalStatus(uint256 proposalId) external view returns (ProposalStatus);

    function proposalCount() external view returns (uint256);

    function getProposalsByTopic(uint256 topicId) external view returns (uint256[] memory);

    function hasVoted(uint256 proposalId, address voter) external view returns (bool);

    function getVotingPower(uint256 proposalId, address account) external view returns (uint256);
}
