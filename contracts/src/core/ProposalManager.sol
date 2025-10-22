// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IProposalManager} from "../interfaces/IProposalManager.sol";
import {ITopicRegistry} from "../interfaces/ITopicRegistry.sol";
import {IDelegationManager} from "../interfaces/IDelegationManager.sol";
import {IVotePowerVerifier} from "../interfaces/IVotePowerVerifier.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ProposalManager
 * @notice Manages proposals and voting with delegated voting power
 * @dev Integrates with DelegationManager to use terminal delegate voting power
 */
contract ProposalManager is IProposalManager, ReentrancyGuard {
    // State variables
    ITopicRegistry public immutable topicRegistry;
    IDelegationManager public immutable delegationManager;
    IVotePowerVerifier public immutable votePowerVerifier;

    uint256 public constant MIN_VOTING_PERIOD = 100;      // ~20 minutes on Gnosis
    uint256 public constant MAX_VOTING_PERIOD = 100800;   // ~2 weeks on Gnosis
    uint256 public constant QUORUM_PERCENTAGE = 10;       // 10% quorum

    uint256 private _proposalCount;

    mapping(uint256 => Proposal) private _proposals;
    mapping(uint256 => mapping(address => Receipt)) private _receipts;
    mapping(uint256 => uint256[]) private _topicProposals;
    mapping(uint256 => mapping(address => bool)) private _hasVoted;
    mapping(uint256 => address[]) private _proposalVoters; // Track all voters for dynamic tallying

    /**
     * @notice Constructor
     * @param topicRegistry_ Address of TopicRegistry contract
     * @param delegationManager_ Address of DelegationManager contract
     * @param votePowerVerifier_ Address of VotePowerVerifier contract
     */
    constructor(
        address topicRegistry_,
        address delegationManager_,
        address votePowerVerifier_
    ) {
        topicRegistry = ITopicRegistry(topicRegistry_);
        delegationManager = IDelegationManager(delegationManager_);
        votePowerVerifier = IVotePowerVerifier(votePowerVerifier_);
    }

    /**
     * @notice Create a new proposal
     * @param params Proposal parameters
     * @return proposalId The ID of the created proposal
     */
    function createProposal(ProposalParams calldata params)
        external
        override
        nonReentrant
        returns (uint256 proposalId)
    {
        // Validate topic
        (bool exists, bool active) = topicRegistry.isTopicActive(params.topicId);
        if (!exists || !active) revert InvalidTopic();

        // Validate voting period
        if (params.votingPeriod < MIN_VOTING_PERIOD || params.votingPeriod > MAX_VOTING_PERIOD) {
            revert InvalidVotingPeriod();
        }

        // Check proposer has voting power
        address terminal = delegationManager.getTerminalDelegate(msg.sender, params.topicId);
        if (terminal == address(0)) revert InsufficientVotingPower();

        // Get topic threshold
        ITopicRegistry.Topic memory topic = topicRegistry.getTopic(params.topicId);

        // Create proposal
        proposalId = ++_proposalCount;

        uint256 startBlock = block.number;
        uint256 endBlock = startBlock + params.votingPeriod;

        _proposals[proposalId] = Proposal({
            id: proposalId,
            topicId: params.topicId,
            proposer: msg.sender,
            title: params.title,
            descriptionCID: params.descriptionCID,
            forVotes: 0,
            againstVotes: 0,
            abstainVotes: 0,
            startBlock: startBlock,
            endBlock: endBlock,
            status: ProposalStatus.Active,
            executed: false
        });

        _topicProposals[params.topicId].push(proposalId);

        emit ProposalCreated(
            proposalId,
            params.topicId,
            msg.sender,
            params.title,
            startBlock,
            endBlock
        );
    }

    /**
     * @notice Cast a vote on a proposal
     * @param proposalId The proposal to vote on
     * @param choice The vote choice (For/Against/Abstain)
     */
    function castVote(uint256 proposalId, VoteChoice choice)
        external
        override
        nonReentrant
    {
        Proposal storage proposal = _proposals[proposalId];

        // Check proposal is active
        if (proposal.status != ProposalStatus.Active) revert ProposalNotActive();
        if (block.number > proposal.endBlock) revert ProposalNotActive();

        // Check hasn't voted
        if (_hasVoted[proposalId][msg.sender]) revert AlreadyVoted();

        // Get voting power (only terminal delegates can vote)
        address terminal = delegationManager.getTerminalDelegate(msg.sender, proposal.topicId);

        // Only terminal delegates have voting power
        // If user delegated their vote, they can't vote directly
        uint256 votes;
        if (terminal == msg.sender) {
            // This user is a terminal delegate, get their aggregated power
            // Try to get cached voting power from VotePowerVerifier
            (uint256 cachedPower, , ) = votePowerVerifier.getVotingPower(msg.sender, proposal.topicId);

            // Fallback: Calculate voting power from delegation chains if enclave data unavailable
            if (cachedPower > 0) {
                votes = cachedPower;
            } else {
                // Use on-chain delegation graph calculation as fallback
                votes = delegationManager.calculateVotingPower(msg.sender, proposal.topicId);
            }
        } else {
            revert InsufficientVotingPower();
        }

        // Record vote (don't store votes count, will be calculated dynamically)
        _hasVoted[proposalId][msg.sender] = true;
        _receipts[proposalId][msg.sender] = Receipt({
            hasVoted: true,
            choice: choice,
            votes: 0 // Will be calculated dynamically
        });

        // Track voter for dynamic tallying
        _proposalVoters[proposalId].push(msg.sender);

        emit VoteCast(proposalId, msg.sender, choice, votes, terminal);
    }

    /**
     * @notice Calculate current vote tallies for a proposal dynamically
     * @param proposalId The proposal to calculate tallies for
     * @return forVotes Total votes for
     * @return againstVotes Total votes against
     * @return abstainVotes Total abstain votes
     */
    function calculateVoteTallies(uint256 proposalId)
        public
        view
        returns (uint256 forVotes, uint256 againstVotes, uint256 abstainVotes)
    {
        Proposal memory proposal = _proposals[proposalId];
        address[] memory voters = _proposalVoters[proposalId];

        for (uint256 i = 0; i < voters.length; i++) {
            address voter = voters[i];
            Receipt memory receipt = _receipts[proposalId][voter];

            if (!receipt.hasVoted) {
                continue;
            }

            // Calculate current voting power for this voter
            uint256 currentVotes = 0;
            address terminal = delegationManager.getTerminalDelegate(voter, proposal.topicId);

            if (terminal == voter) {
                // Get cached voting power from VotePowerVerifier
                (uint256 cachedPower, , ) = votePowerVerifier.getVotingPower(voter, proposal.topicId);

                // Fallback: Calculate voting power from delegation chains if enclave data unavailable
                if (cachedPower > 0) {
                    currentVotes = cachedPower;
                } else {
                    // Use on-chain delegation graph calculation as fallback
                    currentVotes = delegationManager.calculateVotingPower(voter, proposal.topicId);
                }
            }

            // Add votes to appropriate tally
            if (receipt.choice == VoteChoice.For) {
                forVotes += currentVotes;
            } else if (receipt.choice == VoteChoice.Against) {
                againstVotes += currentVotes;
            } else {
                abstainVotes += currentVotes;
            }
        }

        return (forVotes, againstVotes, abstainVotes);
    }

    /**
     * @notice Execute a successful proposal
     * @param proposalId The proposal to execute
     */
    function execute(uint256 proposalId) external override nonReentrant {
        Proposal storage proposal = _proposals[proposalId];

        // Check voting ended
        if (block.number <= proposal.endBlock) revert VotingNotEnded();

        // Check not already executed
        if (proposal.executed) revert ProposalAlreadyExecuted();

        // Calculate current vote tallies dynamically
        (uint256 forVotes, uint256 againstVotes, uint256 abstainVotes) = calculateVoteTallies(proposalId);

        // Update proposal with final tallies
        proposal.forVotes = forVotes;
        proposal.againstVotes = againstVotes;
        proposal.abstainVotes = abstainVotes;

        // Check if proposal passed
        if (forVotes <= againstVotes) {
            proposal.status = ProposalStatus.Failed;
            revert ProposalFailed();
        }

        // Mark as succeeded and executed
        proposal.status = ProposalStatus.Succeeded;
        proposal.executed = true;

        emit ProposalExecuted(proposalId);
    }

    /**
     * @notice Cancel a proposal (only proposer)
     * @param proposalId The proposal to cancel
     */
    function cancel(uint256 proposalId) external override {
        Proposal storage proposal = _proposals[proposalId];

        if (proposal.proposer != msg.sender) revert NotProposer();
        if (proposal.executed) revert ProposalAlreadyExecuted();

        proposal.status = ProposalStatus.Cancelled;

        emit ProposalCancelled(proposalId);
    }

    // View Functions

    function getProposal(uint256 proposalId) external view override returns (Proposal memory) {
        Proposal memory proposal = _proposals[proposalId];

        // If proposal is still active, calculate current vote tallies dynamically
        if (proposal.status == ProposalStatus.Active || !proposal.executed) {
            (uint256 forVotes, uint256 againstVotes, uint256 abstainVotes) = calculateVoteTallies(proposalId);
            proposal.forVotes = forVotes;
            proposal.againstVotes = againstVotes;
            proposal.abstainVotes = abstainVotes;
        }

        return proposal;
    }

    function getReceipt(uint256 proposalId, address voter)
        external
        view
        override
        returns (Receipt memory)
    {
        return _receipts[proposalId][voter];
    }

    function getProposalStatus(uint256 proposalId)
        external
        view
        override
        returns (ProposalStatus)
    {
        Proposal memory proposal = _proposals[proposalId];

        // Update status based on current block
        if (proposal.status == ProposalStatus.Active && block.number > proposal.endBlock) {
            // Voting ended, determine outcome
            if (proposal.forVotes > proposal.againstVotes) {
                return ProposalStatus.Succeeded;
            } else {
                return ProposalStatus.Failed;
            }
        }

        return proposal.status;
    }

    function proposalCount() external view override returns (uint256) {
        return _proposalCount;
    }

    function getProposalsByTopic(uint256 topicId)
        external
        view
        override
        returns (uint256[] memory)
    {
        return _topicProposals[topicId];
    }

    function hasVoted(uint256 proposalId, address voter)
        external
        view
        override
        returns (bool)
    {
        return _hasVoted[proposalId][voter];
    }

    function getVotingPower(uint256 proposalId, address account)
        external
        view
        override
        returns (uint256)
    {
        Proposal memory proposal = _proposals[proposalId];
        address terminal = delegationManager.getTerminalDelegate(account, proposal.topicId);

        // Only terminal delegates have voting power
        if (terminal == account) {
            // Get cached voting power from VotePowerVerifier
            (uint256 cachedPower, , ) = votePowerVerifier.getVotingPower(account, proposal.topicId);

            // Fallback: Calculate voting power from delegation chains if enclave data unavailable
            if (cachedPower > 0) {
                return cachedPower;
            } else {
                // Use on-chain delegation graph calculation as fallback
                return delegationManager.calculateVotingPower(account, proposal.topicId);
            }
        }

        return 0;
    }
}
