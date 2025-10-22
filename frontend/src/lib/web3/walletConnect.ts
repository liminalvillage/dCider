/**
 * Wallet Connection Service
 *
 * Handles Web3 wallet connection with MetaMask and WalletConnect support
 * Manages wallet state and network switching with consistent behavior
 */

import { ethers, type Eip1193Provider } from 'ethers';
import { writable, derived, type Readable, get } from 'svelte/store';
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

// Internal state
let isUpdating = false;
let updateTimeout: NodeJS.Timeout | null = null;

/**
 * Update wallet state from current provider
 * Debounced to prevent rapid updates
 */
async function updateWalletState(force: boolean = false): Promise<void> {
  // Prevent concurrent updates
  if (isUpdating && !force) {
    console.log('[WalletConnect] Update already in progress, skipping');
    return;
  }

  // Clear any pending update
  if (updateTimeout) {
    clearTimeout(updateTimeout);
    updateTimeout = null;
  }

  isUpdating = true;

  try {
    if (typeof window.ethereum === 'undefined') {
      throw new Error('MetaMask is not installed');
    }

    // Get current accounts
    const accounts = await window.ethereum.request({ method: 'eth_accounts' });

    if (accounts.length === 0) {
      console.log('[WalletConnect] No accounts found, disconnecting');
      disconnectWallet();
      return;
    }

    // Create fresh provider and signer
    const provider = new ethers.BrowserProvider(window.ethereum as Eip1193Provider);
    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);

    // Update store atomically
    walletStore.set({
      connected: true,
      address,
      chainId,
      provider,
      signer,
    });

    console.log('[WalletConnect] State updated:', { address, chainId });
  } catch (error: any) {
    console.error('[WalletConnect] Failed to update state:', error);
    // Don't disconnect on temporary errors, but log them
    if (error.message?.includes('user rejected')) {
      disconnectWallet();
    }
  } finally {
    isUpdating = false;
  }
}

/**
 * Debounced update to prevent state thrashing
 */
function scheduleUpdate(delay: number = 100): void {
  if (updateTimeout) {
    clearTimeout(updateTimeout);
  }

  updateTimeout = setTimeout(() => {
    updateWalletState(false);
  }, delay);
}

/**
 * Connect to MetaMask wallet
 */
export async function connectMetaMask(): Promise<void> {
  if (typeof window.ethereum === 'undefined') {
    throw new Error('MetaMask is not installed. Please install MetaMask to continue.');
  }

  try {
    console.log('[WalletConnect] Requesting account access...');

    // Request account access
    const accounts = await window.ethereum.request({
      method: 'eth_requestAccounts',
    });

    if (accounts.length === 0) {
      throw new Error('No accounts found. Please unlock your wallet.');
    }

    // Update wallet state
    await updateWalletState(true);

    // Setup event listeners (only once)
    setupEventListeners();

    const state = get(walletStore);
    notifications.success(`Connected to ${formatAddress(state.address!)}`, 3000);
  } catch (error: any) {
    console.error('[WalletConnect] Connection failed:', error);

    // User-friendly error messages
    if (error.code === 4001) {
      throw new Error('Connection rejected by user');
    } else if (error.code === -32002) {
      throw new Error('Connection request already pending. Please check MetaMask.');
    } else {
      throw new Error(error.message || 'Failed to connect wallet');
    }
  }
}

/**
 * Disconnect wallet
 */
export function disconnectWallet(): void {
  console.log('[WalletConnect] Disconnecting wallet');

  // Clear any pending updates
  if (updateTimeout) {
    clearTimeout(updateTimeout);
    updateTimeout = null;
  }

  // Remove event listeners
  removeEventListeners();

  // Reset state
  walletStore.set(initialState);
  isUpdating = false;

  notifications.info('Wallet disconnected', 2000);
}

/**
 * Switch to specified network
 */
export async function switchNetwork(network: NetworkConfig): Promise<void> {
  if (typeof window.ethereum === 'undefined') {
    throw new Error('MetaMask is not installed');
  }

  try {
    console.log(`[WalletConnect] Switching to ${network.chainName}...`);

    // Try to switch to the network
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: `0x${network.chainId.toString(16)}` }],
    });

    console.log(`[WalletConnect] Switched to ${network.chainName}`);
    notifications.success(`Switched to ${network.chainName}`, 3000);

    // Update state after switch
    scheduleUpdate(300);
  } catch (error: any) {
    // This error code indicates that the chain has not been added to MetaMask
    if (error.code === 4902) {
      try {
        console.log(`[WalletConnect] Adding ${network.chainName} to MetaMask...`);

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
        notifications.success(`Added ${network.chainName} to MetaMask`, 3000);

        // Update state after adding
        scheduleUpdate(300);
      } catch (addError: any) {
        console.error('[WalletConnect] Failed to add network:', addError);
        throw new Error(`Failed to add network: ${addError.message}`);
      }
    } else if (error.code === 4001) {
      // User rejected
      notifications.warning('Network switch rejected', 2000);
    } else {
      console.error('[WalletConnect] Failed to switch network:', error);
      throw new Error(`Failed to switch network: ${error.message}`);
    }
  }
}

// Store event handlers for proper cleanup
let accountsChangedHandler: ((accounts: string[]) => void) | null = null;
let chainChangedHandler: ((chainId: string) => void) | null = null;
let disconnectHandler: (() => void) | null = null;
let listenersSetup = false;

/**
 * Setup event listeners for account and network changes
 */
function setupEventListeners(): void {
  if (typeof window.ethereum === 'undefined') {
    return;
  }

  // Prevent duplicate listeners
  if (listenersSetup) {
    console.log('[WalletConnect] Event listeners already setup');
    return;
  }

  // Remove any existing listeners first
  removeEventListeners();

  console.log('[WalletConnect] Setting up event listeners');

  // Account changed handler
  accountsChangedHandler = (accounts: string[]) => {
    console.log('[WalletConnect] Accounts changed event:', accounts.length);

    if (accounts.length === 0) {
      // User disconnected all accounts
      disconnectWallet();
    } else {
      // Account switched - debounced update
      const newAddress = accounts[0];
      const currentAddress = get(walletStore).address;

      if (newAddress.toLowerCase() !== currentAddress?.toLowerCase()) {
        console.log(`[WalletConnect] Account switched: ${currentAddress} → ${newAddress}`);
        scheduleUpdate(200);
      }
    }
  };

  // Chain changed handler
  chainChangedHandler = (chainIdHex: string) => {
    const newChainId = parseInt(chainIdHex, 16);
    const currentChainId = get(walletStore).chainId;

    console.log(`[WalletConnect] Chain changed: ${currentChainId} → ${newChainId}`);

    // Update state gracefully instead of reloading
    scheduleUpdate(200);

    // Show notification
    const networkName = newChainId === 10200 ? 'Chiado Testnet' :
                        newChainId === 100 ? 'Gnosis' :
                        `Chain ${newChainId}`;
    notifications.info(`Network changed to ${networkName}`, 3000);
  };

  // Disconnect handler
  disconnectHandler = () => {
    console.log('[WalletConnect] Provider disconnected event');
    disconnectWallet();
  };

  // Register event listeners
  window.ethereum.on('accountsChanged', accountsChangedHandler);
  window.ethereum.on('chainChanged', chainChangedHandler);
  window.ethereum.on('disconnect', disconnectHandler);

  listenersSetup = true;
  console.log('[WalletConnect] Event listeners registered');
}

/**
 * Remove event listeners
 */
function removeEventListeners(): void {
  if (typeof window.ethereum === 'undefined') {
    return;
  }

  console.log('[WalletConnect] Removing event listeners');

  if (accountsChangedHandler) {
    window.ethereum.removeListener('accountsChanged', accountsChangedHandler);
    accountsChangedHandler = null;
  }
  if (chainChangedHandler) {
    window.ethereum.removeListener('chainChanged', chainChangedHandler);
    chainChangedHandler = null;
  }
  if (disconnectHandler) {
    window.ethereum.removeListener('disconnect', disconnectHandler);
    disconnectHandler = null;
  }

  listenersSetup = false;
}

/**
 * Check if wallet is connected on page load
 */
export async function checkConnection(): Promise<void> {
  if (typeof window.ethereum === 'undefined') {
    console.log('[WalletConnect] MetaMask not detected');
    return;
  }

  try {
    console.log('[WalletConnect] Checking for existing connection...');
    const accounts = await window.ethereum.request({ method: 'eth_accounts' });

    if (accounts.length > 0) {
      console.log('[WalletConnect] Found existing connection, reconnecting...');
      // Wallet was previously connected - restore connection
      await updateWalletState(true);
      setupEventListeners();
    } else {
      console.log('[WalletConnect] No existing connection found');
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
