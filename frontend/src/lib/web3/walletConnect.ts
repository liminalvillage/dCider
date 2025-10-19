/**
 * Wallet Connection Service
 *
 * Handles Web3 wallet connection with MetaMask and WalletConnect support
 * Manages wallet state and network switching
 */

import { ethers, type Eip1193Provider } from 'ethers';
import { writable, derived, type Readable } from 'svelte/store';
import { notifications } from '../stores/notifications';

export interface WalletState {
  connected: boolean;
  address: string | null;
  chainId: number | null;
  provider: ethers.BrowserProvider | null;
  signer: ethers.Signer | null;
}

export interface NetworkConfig {
  chainId: number;
  chainName: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorerUrls: string[];
}

// Gnosis Chiado testnet configuration
export const CHIADO_NETWORK: NetworkConfig = {
  chainId: 10200,
  chainName: 'Gnosis Chiado Testnet',
  nativeCurrency: {
    name: 'Chiado xDAI',
    symbol: 'xDAI',
    decimals: 18,
  },
  rpcUrls: ['https://rpc.chiadochain.net'],
  blockExplorerUrls: ['https://gnosis-chiado.blockscout.com'],
};

// Gnosis mainnet configuration
export const GNOSIS_NETWORK: NetworkConfig = {
  chainId: 100,
  chainName: 'Gnosis',
  nativeCurrency: {
    name: 'xDAI',
    symbol: 'xDAI',
    decimals: 18,
  },
  rpcUrls: ['https://rpc.gnosischain.com'],
  blockExplorerUrls: ['https://gnosisscan.io'],
};

// Wallet state store
const initialState: WalletState = {
  connected: false,
  address: null,
  chainId: null,
  provider: null,
  signer: null,
};

export const walletStore = writable<WalletState>(initialState);

// Derived stores for convenience
export const isConnected: Readable<boolean> = derived(
  walletStore,
  ($wallet) => $wallet.connected
);

export const userAddress: Readable<string | null> = derived(
  walletStore,
  ($wallet) => $wallet.address
);

export const currentChainId: Readable<number | null> = derived(
  walletStore,
  ($wallet) => $wallet.chainId
);

/**
 * Connect to MetaMask wallet
 */
export async function connectMetaMask(): Promise<void> {
  if (typeof window.ethereum === 'undefined') {
    throw new Error('MetaMask is not installed');
  }

  try {
    // Request account access
    const accounts = await window.ethereum.request({
      method: 'eth_requestAccounts',
    });

    if (accounts.length === 0) {
      throw new Error('No accounts found');
    }

    // Create provider and signer
    const provider = new ethers.BrowserProvider(window.ethereum as Eip1193Provider);
    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    const network = await provider.getNetwork();

    // Update store
    walletStore.set({
      connected: true,
      address,
      chainId: Number(network.chainId),
      provider,
      signer,
    });

    console.log('[WalletConnect] Connected to MetaMask');
    console.log(`  Address: ${address}`);
    console.log(`  Chain ID: ${network.chainId}`);

    // Setup event listeners
    setupEventListeners();
  } catch (error: any) {
    console.error('[WalletConnect] Connection failed:', error);
    throw new Error(`Failed to connect: ${error.message}`);
  }
}

/**
 * Disconnect wallet
 */
export function disconnectWallet(): void {
  removeEventListeners();
  walletStore.set(initialState);
  console.log('[WalletConnect] Disconnected');
}

/**
 * Switch to specified network
 */
export async function switchNetwork(network: NetworkConfig): Promise<void> {
  if (typeof window.ethereum === 'undefined') {
    throw new Error('MetaMask is not installed');
  }

  try {
    // Try to switch to the network
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: `0x${network.chainId.toString(16)}` }],
    });

    console.log(`[WalletConnect] Switched to ${network.chainName}`);
  } catch (error: any) {
    // This error code indicates that the chain has not been added to MetaMask
    if (error.code === 4902) {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: `0x${network.chainId.toString(16)}`,
              chainName: network.chainName,
              nativeCurrency: network.nativeCurrency,
              rpcUrls: network.rpcUrls,
              blockExplorerUrls: network.blockExplorerUrls,
            },
          ],
        });

        console.log(`[WalletConnect] Added ${network.chainName} to MetaMask`);
      } catch (addError: any) {
        console.error('[WalletConnect] Failed to add network:', addError);
        throw new Error(`Failed to add network: ${addError.message}`);
      }
    } else {
      console.error('[WalletConnect] Failed to switch network:', error);
      throw new Error(`Failed to switch network: ${error.message}`);
    }
  }
}

// Store event handlers to allow cleanup
let accountsChangedHandler: ((accounts: string[]) => void) | null = null;
let chainChangedHandler: ((chainId: string) => void) | null = null;
let disconnectHandler: (() => void) | null = null;

/**
 * Setup event listeners for account and network changes
 */
function setupEventListeners(): void {
  if (typeof window.ethereum === 'undefined') {
    return;
  }

  // Remove existing listeners to prevent duplicates
  removeEventListeners();

  // Account changed handler
  accountsChangedHandler = async (accounts: string[]) => {
    if (accounts.length === 0) {
      // User disconnected
      console.log('[WalletConnect] All accounts disconnected');
      disconnectWallet();
    } else {
      // Account switched - update state smoothly
      console.log('[WalletConnect] Account changed, updating...');
      try {
        const provider = new ethers.BrowserProvider(window.ethereum as Eip1193Provider);
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        const network = await provider.getNetwork();

        walletStore.update(state => ({
          ...state,
          address,
          chainId: Number(network.chainId),
          provider,
          signer,
        }));

        console.log(`[WalletConnect] Switched to account: ${address}`);

        // Show notification to user
        notifications.info(
          `Account switched to ${formatAddress(address)}`,
          4000
        );
      } catch (error) {
        console.error('[WalletConnect] Failed to update account:', error);
        // Fallback to full reconnect
        await connectMetaMask();
      }
    }
  };

  // Chain changed handler
  chainChangedHandler = (chainIdHex: string) => {
    console.log(`[WalletConnect] Chain changed to ${chainIdHex}`);
    // Reload to avoid state issues (MetaMask recommendation)
    window.location.reload();
  };

  // Disconnect handler
  disconnectHandler = () => {
    console.log('[WalletConnect] Provider disconnected');
    disconnectWallet();
  };

  // Register event listeners
  window.ethereum.on('accountsChanged', accountsChangedHandler);
  window.ethereum.on('chainChanged', chainChangedHandler);
  window.ethereum.on('disconnect', disconnectHandler);

  console.log('[WalletConnect] Event listeners registered');
}

/**
 * Remove event listeners
 */
function removeEventListeners(): void {
  if (typeof window.ethereum === 'undefined') {
    return;
  }

  if (accountsChangedHandler) {
    window.ethereum.removeListener('accountsChanged', accountsChangedHandler);
  }
  if (chainChangedHandler) {
    window.ethereum.removeListener('chainChanged', chainChangedHandler);
  }
  if (disconnectHandler) {
    window.ethereum.removeListener('disconnect', disconnectHandler);
  }
}

/**
 * Check if wallet is connected on page load
 */
export async function checkConnection(): Promise<void> {
  if (typeof window.ethereum === 'undefined') {
    return;
  }

  try {
    const accounts = await window.ethereum.request({ method: 'eth_accounts' });

    if (accounts.length > 0) {
      // Wallet was previously connected
      await connectMetaMask();
    }
  } catch (error) {
    console.error('[WalletConnect] Failed to check connection:', error);
  }
}

/**
 * Format address for display (0x1234...5678)
 */
export function formatAddress(address: string): string {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Get block explorer URL for address
 */
export function getExplorerUrl(address: string, chainId: number): string {
  const network = chainId === 10200 ? CHIADO_NETWORK : GNOSIS_NETWORK;
  return `${network.blockExplorerUrls[0]}/address/${address}`;
}

/**
 * Get block explorer URL for transaction
 */
export function getTxExplorerUrl(txHash: string, chainId: number): string {
  const network = chainId === 10200 ? CHIADO_NETWORK : GNOSIS_NETWORK;
  return `${network.blockExplorerUrls[0]}/tx/${txHash}`;
}

// Type declarations for window.ethereum
declare global {
  interface Window {
    ethereum?: {
      request: (request: { method: string; params?: any[] }) => Promise<any>;
      on: (event: string, callback: (...args: any[]) => void) => void;
      removeListener: (event: string, callback: (...args: any[]) => void) => void;
      isMetaMask?: boolean;
    };
  }
}
