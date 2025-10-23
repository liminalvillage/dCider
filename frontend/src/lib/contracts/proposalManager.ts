/**
 * ProposalManager Contract Interaction Module
 * Handles proposal creation, voting, and querying
 */

import { ethers, type Provider, type Signer } from 'ethers';
import { getContractAddresses } from './addresses';
import ProposalManagerABI from './ProposalManager.abi.json';

export enum VoteChoice {
  Against = 0,
  For = 1,
  Abstain = 2
}

export enum ProposalStatus {
  Pending = 0,
  Active = 1,
  Succeeded = 2,
  Failed = 3,
  Executed = 4,
  Cancelled = 5
}

export interface Proposal {
  id: number;
  topicId: number;
  proposer: string;
  title: string;
  descriptionCID: string;
  forVotes: number;
  againstVotes: number;
  abstainVotes: number;
  startBlock: number;
  endBlock: number;
  status: ProposalStatus;
  executed: boolean;
}

export interface Receipt {
  hasVoted: boolean;
  choice: VoteChoice;
  votes: number;
}

/**
 * Get ProposalManager contract instance
 */
function getProposalManagerContract(
  providerOrSigner: Provider | Signer,
  chainId: number
): ethers.Contract {
  const addresses = getContractAddresses(chainId);

  if (!addresses.proposalManager) {
    throw new Error('ProposalManager address not configured');
  }

  return new ethers.Contract(
    addresses.proposalManager,
    ProposalManagerABI,
    providerOrSigner
  );
}

/**
 * Create a new proposal
 */
export async function createProposal(
  signer: Signer,
  chainId: number,
  topicId: number,
  title: string,
  descriptionCID: string,
  votingPeriod: number
): Promise<{ proposalId: number; txHash: string }> {
  const contract = getProposalManagerContract(signer, chainId);

  try {
    const signerAddress = await signer.getAddress();
    const params = {
      topicId,
      title,
      descriptionCID,
      votingPeriod
    };

    console.log('[ProposalManager] Creating proposal:', {
      ...params,
      signerAddress
    });

    // Estimate gas before sending transaction
    let gasLimit;
    try {
      const estimatedGas = await contract.createProposal.estimateGas(params);
      gasLimit = (estimatedGas * 120n) / 100n;
      console.log('[ProposalManager] Gas estimate:', {
        estimated: estimatedGas.toString(),
        withBuffer: gasLimit.toString()
      });
    } catch (gasError: any) {
      console.error('[ProposalManager] Gas estimation failed:', gasError);

      if (gasError.message?.includes('InvalidTopic') || gasError.data?.includes('InvalidTopic')) {
        throw new Error('Topic is not active');
      } else if (gasError.message?.includes('InsufficientVotingPower') || gasError.data?.includes('InsufficientVotingPower')) {
        throw new Error('You need voting power to create proposals');
      } else if (gasError.message?.includes('InvalidVotingPeriod') || gasError.data?.includes('InvalidVotingPeriod')) {
        throw new Error('Voting period must be between 100 and 100800 blocks');
      }

      throw new Error(`Transaction would fail: ${gasError.reason || gasError.message || 'Unknown error'}`);
    }

    const tx = await contract.createProposal(params, { gasLimit });
    console.log('[ProposalManager] Transaction sent:', tx.hash);

    const receipt = await tx.wait();
    console.log('[ProposalManager] Transaction confirmed:', receipt.hash);

    // Parse ProposalCreated event to get ID
    const event = receipt.logs
      .map((log: any) => {
        try {
          return contract.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((parsed: any) => parsed?.name === 'ProposalCreated');

    const proposalId = event ? Number(event.args[0]) : -1;

    return {
      proposalId,
      txHash: receipt.hash
    };
  } catch (error: any) {
    console.error('[ProposalManager] Error creating proposal:', error);

    if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
      throw new Error('Transaction rejected by user');
    } else if (error.code === 'UNKNOWN_ERROR' || error.code === -32603) {
      console.error('[ProposalManager] RPC Error Details:', {
        code: error.code,
        message: error.message,
        data: error.data,
        error: error.error
      });
      throw new Error('Transaction failed on the blockchain. Please check your account balance and try again.');
    }

    if (error.message && !error.message.includes('could not coalesce')) {
      throw error;
    }

    throw new Error('Failed to create proposal. Please try again.');
  }
}

/**
 * Cast a vote on a proposal
 */
export async function castVote(
  signer: Signer,
  chainId: number,
  proposalId: number,
  choice: VoteChoice
): Promise<string> {
  const contract = getProposalManagerContract(signer, chainId);

  try {
    const signerAddress = await signer.getAddress();
    console.log('[ProposalManager] Casting vote:', {
      proposalId,
      choice,
      signerAddress
    });

    // Estimate gas before sending transaction
    let gasLimit;
    try {
      const estimatedGas = await contract.castVote.estimateGas(proposalId, choice);
      gasLimit = (estimatedGas * 120n) / 100n;
      console.log('[ProposalManager] Gas estimate:', {
        estimated: estimatedGas.toString(),
        withBuffer: gasLimit.toString()
      });
    } catch (gasError: any) {
      console.error('[ProposalManager] Gas estimation failed:', gasError);

      if (gasError.message?.includes('ProposalNotActive') || gasError.data?.includes('ProposalNotActive')) {
        throw new Error('Proposal is not active or voting has ended');
      } else if (gasError.message?.includes('AlreadyVoted') || gasError.data?.includes('AlreadyVoted')) {
        throw new Error('You have already voted on this proposal');
      } else if (gasError.message?.includes('InsufficientVotingPower') || gasError.data?.includes('InsufficientVotingPower')) {
        throw new Error('You cannot vote because you delegated your vote');
      }

      throw new Error(`Transaction would fail: ${gasError.reason || gasError.message || 'Unknown error'}`);
    }

    const tx = await contract.castVote(proposalId, choice, { gasLimit });
    console.log('[ProposalManager] Transaction sent:', tx.hash);

    const receipt = await tx.wait();
    console.log('[ProposalManager] Transaction confirmed:', receipt.hash);

    return receipt.hash;
  } catch (error: any) {
    console.error('[ProposalManager] Error casting vote:', error);

    if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
      throw new Error('Transaction rejected by user');
    } else if (error.code === 'UNKNOWN_ERROR' || error.code === -32603) {
      console.error('[ProposalManager] RPC Error Details:', {
        code: error.code,
        message: error.message,
        data: error.data,
        error: error.error
      });
      throw new Error('Transaction failed on the blockchain. Please check your account balance and try again.');
    }

    if (error.message && !error.message.includes('could not coalesce')) {
      throw error;
    }

    throw new Error('Failed to cast vote. Please try again.');
  }
}

/**
 * Execute a successful proposal
 */
export async function executeProposal(
  signer: Signer,
  chainId: number,
  proposalId: number
): Promise<string> {
  const contract = getProposalManagerContract(signer, chainId);

  try {
    const tx = await contract.execute(proposalId);
    const receipt = await tx.wait();
    return receipt.hash;
  } catch (error: any) {
    console.error('Error executing proposal:', error);

    if (error.message.includes('VotingNotEnded')) {
      throw new Error('Voting period has not ended yet');
    } else if (error.message.includes('ProposalFailed')) {
      throw new Error('Proposal did not pass');
    } else if (error.message.includes('ProposalAlreadyExecuted')) {
      throw new Error('Proposal already executed');
    }

    throw new Error(error.message || 'Failed to execute proposal');
  }
}

/**
 * Cancel a proposal (only by proposer)
 */
export async function cancelProposal(
  signer: Signer,
  chainId: number,
  proposalId: number
): Promise<string> {
  const contract = getProposalManagerContract(signer, chainId);

  try {
    const tx = await contract.cancel(proposalId);
    const receipt = await tx.wait();
    return receipt.hash;
  } catch (error: any) {
    console.error('Error cancelling proposal:', error);

    if (error.message.includes('NotProposer')) {
      throw new Error('Only the proposer can cancel this proposal');
    }

    throw new Error(error.message || 'Failed to cancel proposal');
  }
}

/**
 * Get a proposal by ID
 */
export async function getProposal(
  provider: Provider,
  chainId: number,
  proposalId: number
): Promise<Proposal> {
  const contract = getProposalManagerContract(provider, chainId);

  try {
    const proposal = await contract.getProposal(proposalId);

    return {
      id: Number(proposal.id),
      topicId: Number(proposal.topicId),
      proposer: proposal.proposer,
      title: proposal.title,
      descriptionCID: proposal.descriptionCID,
      forVotes: Number(proposal.forVotes),
      againstVotes: Number(proposal.againstVotes),
      abstainVotes: Number(proposal.abstainVotes),
      startBlock: Number(proposal.startBlock),
      endBlock: Number(proposal.endBlock),
      status: Number(proposal.status) as ProposalStatus,
      executed: proposal.executed
    };
  } catch (error: any) {
    console.error('Error fetching proposal:', error);
    throw new Error('Failed to fetch proposal');
  }
}

/**
 * Get all proposals for a topic
 */
export async function getProposalsByTopic(
  provider: Provider,
  chainId: number,
  topicId: number
): Promise<Proposal[]> {
  const contract = getProposalManagerContract(provider, chainId);

  try {
    const proposalIds = await contract.getProposalsByTopic(topicId);

    // Fetch details for each proposal
    const proposals = await Promise.all(
      proposalIds.map((id: bigint) => getProposal(provider, chainId, Number(id)))
    );

    return proposals;
  } catch (error: any) {
    console.error('Error fetching proposals by topic:', error);
    throw new Error('Failed to fetch proposals');
  }
}

/**
 * Get current proposal status
 */
export async function getProposalStatus(
  provider: Provider,
  chainId: number,
  proposalId: number
): Promise<ProposalStatus> {
  const contract = getProposalManagerContract(provider, chainId);

  try {
    const status = await contract.getProposalStatus(proposalId);
    return Number(status) as ProposalStatus;
  } catch (error: any) {
    console.error('Error fetching proposal status:', error);
    throw new Error('Failed to fetch proposal status');
  }
}

/**
 * Check if user has voted
 */
export async function hasVoted(
  provider: Provider,
  chainId: number,
  proposalId: number,
  voter: string
): Promise<boolean> {
  const contract = getProposalManagerContract(provider, chainId);

  try {
    return await contract.hasVoted(proposalId, voter);
  } catch (error: any) {
    console.error('Error checking vote status:', error);
    return false;
  }
}

/**
 * Get voting receipt for a user
 */
export async function getReceipt(
  provider: Provider,
  chainId: number,
  proposalId: number,
  voter: string
): Promise<Receipt> {
  const contract = getProposalManagerContract(provider, chainId);

  try {
    const receipt = await contract.getReceipt(proposalId, voter);

    return {
      hasVoted: receipt.hasVoted,
      choice: Number(receipt.choice) as VoteChoice,
      votes: Number(receipt.votes)
    };
  } catch (error: any) {
    console.error('Error fetching receipt:', error);
    throw new Error('Failed to fetch voting receipt');
  }
}

/**
 * Get voting power for a user on a proposal
 */
export async function getVotingPower(
  provider: Provider,
  chainId: number,
  proposalId: number,
  account: string
): Promise<number> {
  const contract = getProposalManagerContract(provider, chainId);

  try {
    const power = await contract.getVotingPower(proposalId, account);
    return Number(power);
  } catch (error: any) {
    console.error('Error fetching voting power:', error);
    return 0;
  }
}

/**
 * Get total proposal count
 */
export async function getProposalCount(
  provider: Provider,
  chainId: number
): Promise<number> {
  const contract = getProposalManagerContract(provider, chainId);

  try {
    const count = await contract.proposalCount();
    return Number(count);
  } catch (error: any) {
    console.error('Error fetching proposal count:', error);
    return 0;
  }
}

/**
 * Get proposal status label
 */
export function getStatusLabel(status: ProposalStatus): string {
  switch (status) {
    case ProposalStatus.Pending:
      return 'Pending';
    case ProposalStatus.Active:
      return 'Active';
    case ProposalStatus.Succeeded:
      return 'Succeeded';
    case ProposalStatus.Failed:
      return 'Failed';
    case ProposalStatus.Executed:
      return 'Executed';
    case ProposalStatus.Cancelled:
      return 'Cancelled';
    default:
      return 'Unknown';
  }
}

/**
 * Get vote choice label
 */
export function getVoteChoiceLabel(choice: VoteChoice): string {
  switch (choice) {
    case VoteChoice.Against:
      return 'Against';
    case VoteChoice.For:
      return 'For';
    case VoteChoice.Abstain:
      return 'Abstain';
    default:
      return 'Unknown';
  }
}
