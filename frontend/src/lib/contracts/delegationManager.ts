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
    const signerAddress = await signer.getAddress();
    console.log('[DelegationManager] Delegating:', {
      topicId,
      delegateAddress,
      signerAddress
    });

    // Estimate gas before sending transaction
    let gasLimit;
    try {
      const estimatedGas = await contract.delegate.estimateGas(topicId, delegateAddress);
      // Add 20% buffer to estimated gas
      gasLimit = (estimatedGas * 120n) / 100n;
      console.log('[DelegationManager] Gas estimate:', {
        estimated: estimatedGas.toString(),
        withBuffer: gasLimit.toString()
      });
    } catch (gasError: any) {
      console.error('[DelegationManager] Gas estimation failed:', gasError);

      // Parse gas estimation errors (these happen before sending the tx)
      if (gasError.message?.includes('CannotSelfDelegate') || gasError.data?.includes('CannotSelfDelegate')) {
        throw new Error('Cannot delegate to yourself');
      } else if (gasError.message?.includes('TopicNotActive') || gasError.data?.includes('TopicNotActive')) {
        throw new Error('Topic is not active');
      } else if (gasError.message?.includes('DelegateIsDeadEnd') || gasError.data?.includes('DelegateIsDeadEnd')) {
        throw new Error('Delegate has declared themselves as a dead-end');
      } else if (gasError.message?.includes('CreatesCycle') || gasError.data?.includes('CreatesCycle')) {
        throw new Error('This delegation would create a cycle');
      } else if (gasError.message?.includes('ExceedsMaxDepth') || gasError.data?.includes('ExceedsMaxDepth')) {
        throw new Error('This delegation would exceed maximum depth (7 levels)');
      }

      // If gas estimation fails for unknown reason, still throw the error
      throw new Error(`Transaction would fail: ${gasError.reason || gasError.message || 'Unknown error'}`);
    }

    // Send transaction with estimated gas
    const tx = await contract.delegate(topicId, delegateAddress, { gasLimit });
    console.log('[DelegationManager] Transaction sent:', tx.hash);

    const receipt = await tx.wait();
    console.log('[DelegationManager] Transaction confirmed:', receipt.hash);

    return receipt.hash;
  } catch (error: any) {
    console.error('[DelegationManager] Error delegating vote:', error);

    // Handle user rejection
    if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
      throw new Error('Transaction rejected by user');
    }

    // Handle account mismatch
    if (error.message?.includes('wrong address') || error.message?.includes('account mismatch')) {
      throw new Error('Account mismatch detected. Please refresh the page and try again.');
    }

    // Handle RPC errors
    if (error.code === 'UNKNOWN_ERROR' || error.code === -32603) {
      // Log full error details for debugging
      console.error('[DelegationManager] RPC Error Details:', {
        code: error.code,
        message: error.message,
        data: error.data,
        error: error.error
      });
      throw new Error('Transaction failed on the blockchain. Please check your account balance and try again.');
    }

    // If error was already formatted, throw it as-is
    if (error.message && !error.message.includes('could not coalesce')) {
      throw error;
    }

    // Default error
    throw new Error('Failed to delegate vote. Please try again.');
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
    const signerAddress = await signer.getAddress();
    console.log('[DelegationManager] Revoking delegation:', {
      topicId,
      signerAddress
    });

    // Estimate gas before sending transaction
    let gasLimit;
    try {
      const estimatedGas = await contract.revoke.estimateGas(topicId);
      // Add 20% buffer to estimated gas
      gasLimit = (estimatedGas * 120n) / 100n;
      console.log('[DelegationManager] Gas estimate:', {
        estimated: estimatedGas.toString(),
        withBuffer: gasLimit.toString()
      });
    } catch (gasError: any) {
      console.error('[DelegationManager] Gas estimation failed:', gasError);
      throw new Error(`Transaction would fail: ${gasError.reason || gasError.message || 'Unknown error'}`);
    }

    const tx = await contract.revoke(topicId, { gasLimit });
    console.log('[DelegationManager] Transaction sent:', tx.hash);

    const receipt = await tx.wait();
    console.log('[DelegationManager] Transaction confirmed:', receipt.hash);

    return receipt.hash;
  } catch (error: any) {
    console.error('[DelegationManager] Error revoking delegation:', error);

    if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
      throw new Error('Transaction rejected by user');
    } else if (error.message?.includes('wrong address') || error.message?.includes('account mismatch')) {
      throw new Error('Account mismatch detected. Please refresh the page and try again.');
    } else if (error.code === 'UNKNOWN_ERROR' || error.code === -32603) {
      console.error('[DelegationManager] RPC Error Details:', {
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

    throw new Error('Failed to revoke delegation. Please try again.');
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
