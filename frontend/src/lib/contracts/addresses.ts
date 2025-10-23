/**
 * Contract Addresses
 *
 * Contract addresses for different networks
 * These will be populated after deployment
 */

export interface ContractAddresses {
  delegationManager: string;
  topicRegistry: string;
  votePowerVerifier: string;
  rewardDistributor: string;
  proposalManager: string;
}

// Chiado Testnet (chainId: 10200)
// Deployed on 2025-10-18
// Updated with getTopicDelegators function: 2025-10-18
// Redeployed: 2025-10-19 (dynamic vote tallying - delegation revocation updates vote counts)
// RewardDistributor deployed: 2025-10-23
// VotePowerVerifier redeployed: 2025-10-23 (added reward distribution support)
export const CHIADO_ADDRESSES: ContractAddresses = {
  delegationManager: '0x4c8875ac664bb0a94f5eE71b232A786772Fdd704',
  topicRegistry: '0x9d9063f220aA191aAC406De2A5432A577b253827',
  votePowerVerifier: '0x156ee62c9bf96F28b5aacf37C5B73935CA1d71C3',
  rewardDistributor: '0x8a4f7A29989565F36216Eb82ca030bEb129E039A',
  proposalManager: '0xBF57d60545a4A47e6c01197D2Dd91F5E06780Fa5',
};

// Debug: log loaded addresses
console.log('[Addresses] CHIADO_ADDRESSES:', CHIADO_ADDRESSES);

// Gnosis Mainnet (chainId: 100)
export const GNOSIS_ADDRESSES: ContractAddresses = {
  delegationManager: '',
  topicRegistry: '',
  votePowerVerifier: '',
  rewardDistributor: '',
  proposalManager: '',
};

/**
 * Get contract addresses for current network
 */
export function getContractAddresses(chainId: number): ContractAddresses {
  switch (chainId) {
    case 10200: // Chiado
      return CHIADO_ADDRESSES;
    case 100: // Gnosis
      return GNOSIS_ADDRESSES;
    default:
      throw new Error(`Unsupported network: ${chainId}`);
  }
}

/**
 * Validate that required contract addresses are set
 * Note: rewardDistributor is optional (not deployed in MVP)
 */
export function validateAddresses(addresses: ContractAddresses): boolean {
  return !!(
    addresses.delegationManager &&
    addresses.topicRegistry &&
    addresses.votePowerVerifier
    // rewardDistributor is optional
  );
}
