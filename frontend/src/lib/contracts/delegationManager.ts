/**
 * DelegationManager Contract Interaction Module
 * Handles delegation, revocation, and dead-end management
 */

import { ethers, type Provider, type Signer } from 'ethers';
import { DELEGATION_MANAGER_ABI } from './abis';
import { getContractAddresses } from './addresses';

export interface Delegation {
  delegator: string;
  delegate: string;
  topicId: number;
  timestamp: number;
  depth: number;
}

export interface DeadEndStatus {
  active: boolean;
  declaredAt: number;
}

/**
 * Get DelegationManager contract instance
 */
function getDelegationManagerContract(
  providerOrSigner: Provider | Signer,
  chainId: number
): ethers.Contract {
  const addresses = getContractAddresses(chainId);

  if (!addresses.delegationManager) {
    throw new Error('DelegationManager address not configured');
  }

  return new ethers.Contract(
    addresses.delegationManager,
    DELEGATION_MANAGER_ABI,
    providerOrSigner
  );
}

/**
 * Delegate vote to another address
 */
export async function delegate(
  signer: Signer,
  chainId: number,
  topicId: number,
  delegateAddress: string
): Promise<string> {
  const contract = getDelegationManagerContract(signer, chainId);

  try {
    const tx = await contract.delegate(topicId, delegateAddress);
    const receipt = await tx.wait();
    return receipt.hash;
  } catch (error: any) {
    console.error('Error delegating vote:', error);

    // Parse custom errors
    if (error.message.includes('CannotSelfDelegate')) {
      throw new Error('Cannot delegate to yourself');
    } else if (error.message.includes('TopicNotActive')) {
      throw new Error('Topic is not active');
    } else if (error.message.includes('DelegateIsDeadEnd')) {
      throw new Error('Delegate has declared themselves as a dead-end');
    } else if (error.message.includes('CreatesCycle')) {
      throw new Error('This delegation would create a cycle');
    } else if (error.message.includes('ExceedsMaxDepth')) {
      throw new Error('This delegation would exceed maximum depth (7 levels)');
    }

    throw new Error(error.message || 'Failed to delegate vote');
  }
}

/**
 * Revoke delegation for a topic
 */
export async function revoke(
  signer: Signer,
  chainId: number,
  topicId: number
): Promise<string> {
  const contract = getDelegationManagerContract(signer, chainId);

  try {
    const tx = await contract.revoke(topicId);
    const receipt = await tx.wait();
    return receipt.hash;
  } catch (error: any) {
    console.error('Error revoking delegation:', error);
    throw new Error(error.message || 'Failed to revoke delegation');
  }
}

/**
 * Declare yourself as a dead-end (prevent others from delegating to you)
 */
export async function declareDeadEnd(
  signer: Signer,
  chainId: number,
  topicId: number
): Promise<string> {
  const contract = getDelegationManagerContract(signer, chainId);

  try {
    const tx = await contract.declareDeadEnd(topicId);
    const receipt = await tx.wait();
    return receipt.hash;
  } catch (error: any) {
    console.error('Error declaring dead-end:', error);
    throw new Error(error.message || 'Failed to declare dead-end');
  }
}

/**
 * Revoke dead-end declaration
 */
export async function revokeDeadEnd(
  signer: Signer,
  chainId: number,
  topicId: number
): Promise<string> {
  const contract = getDelegationManagerContract(signer, chainId);

  try {
    const tx = await contract.revokeDeadEnd(topicId);
    const receipt = await tx.wait();
    return receipt.hash;
  } catch (error: any) {
    console.error('Error revoking dead-end:', error);
    throw new Error(error.message || 'Failed to revoke dead-end');
  }
}

/**
 * Get delegation for a specific delegator and topic
 */
export async function getDelegation(
  provider: Provider,
  chainId: number,
  delegator: string,
  topicId: number
): Promise<Delegation | null> {
  const contract = getDelegationManagerContract(provider, chainId);

  try {
    const delegation = await contract.getDelegation(delegator, topicId);

    // If delegate is zero address, no delegation exists
    if (delegation.delegate === ethers.ZeroAddress) {
      return null;
    }

    return {
      delegator: delegation.delegator,
      delegate: delegation.delegate,
      topicId: Number(delegation.topicId),
      timestamp: Number(delegation.timestamp),
      depth: Number(delegation.depth)
    };
  } catch (error) {
    console.error('Error fetching delegation:', error);
    return null;
  }
}

/**
 * Get terminal delegate (final recipient of voting power)
 */
export async function getTerminalDelegate(
  provider: Provider,
  chainId: number,
  delegator: string,
  topicId: number
): Promise<string> {
  const contract = getDelegationManagerContract(provider, chainId);

  try {
    const terminal = await contract.getTerminalDelegate(delegator, topicId);
    return terminal;
  } catch (error) {
    console.error('Error fetching terminal delegate:', error);
    return delegator; // Return self as fallback
  }
}

/**
 * Get delegation depth (length of chain)
 */
export async function getDelegationDepth(
  provider: Provider,
  chainId: number,
  delegator: string,
  topicId: number
): Promise<number> {
  const contract = getDelegationManagerContract(provider, chainId);

  try {
    const depth = await contract.getDelegationDepth(delegator, topicId);
    return Number(depth);
  } catch (error) {
    console.error('Error fetching delegation depth:', error);
    return 0;
  }
}

/**
 * Check if address is a dead-end for a topic
 */
export async function isDeadEnd(
  provider: Provider,
  chainId: number,
  address: string,
  topicId: number
): Promise<DeadEndStatus> {
  const contract = getDelegationManagerContract(provider, chainId);

  try {
    const [active, declaredAt] = await contract.isDeadEnd(address, topicId);

    return {
      active,
      declaredAt: Number(declaredAt)
    };
  } catch (error) {
    console.error('Error checking dead-end status:', error);
    return { active: false, declaredAt: 0 };
  }
}

/**
 * Get all delegations for a topic (for graph visualization)
 */
export async function getAllDelegationsForTopic(
  provider: Provider,
  chainId: number,
  topicId: number
): Promise<Array<{ delegator: string; delegate: string }>> {
  const contract = getDelegationManagerContract(provider, chainId);

  try {
    const [delegators, delegates] = await contract.getAllDelegationsForTopic(topicId);

    return delegators.map((delegator: string, index: number) => ({
      delegator,
      delegate: delegates[index]
    }));
  } catch (error) {
    console.error('Error fetching all delegations:', error);
    return [];
  }
}

/**
 * Get full delegation chain for a delegator
 */
export async function getDelegationChain(
  provider: Provider,
  chainId: number,
  delegator: string,
  topicId: number
): Promise<string[]> {
  const contract = getDelegationManagerContract(provider, chainId);

  try {
    const chain = await contract.getDelegationChain(delegator, topicId);
    return chain;
  } catch (error) {
    console.error('Error fetching delegation chain:', error);
    return [delegator];
  }
}

/**
 * Get all delegators for a specific topic
 * This is used to build the delegation graph
 */
export async function getTopicDelegators(
  provider: Provider,
  chainId: number,
  topicId: number
): Promise<string[]> {
  const contract = getDelegationManagerContract(provider, chainId);

  try {
    const delegators = await contract.getTopicDelegators(topicId);
    return delegators;
  } catch (error) {
    console.error('Error fetching topic delegators:', error);
    return [];
  }
}
