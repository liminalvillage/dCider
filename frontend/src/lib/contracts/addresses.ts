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
// ProposalManager redeployed: 2025-10-19 (fixed contract references)
export const CHIADO_ADDRESSES: ContractAddresses = {
  delegationManager: '0x4653C8826930F9F293955cc3a904D0114c81637E',
  topicRegistry: '0x9d9063f220aA191aAC406De2A5432A577b253827',
  votePowerVerifier: '0x9aef5a8B434BF396049E06050e59D1036Eed7e84',
  rewardDistributor: '0x0000000000000000000000000000000000000000',
  proposalManager: '0xA149b19B57BA49a6B19c40318279B68aaa79Ffcd',
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
