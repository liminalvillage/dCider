<script lang="ts">
  import {
    isConnected,
    userAddress,
    currentChainId,
    disconnectWallet,
    formatAddress,
    getExplorerUrl,
    CHIADO_NETWORK,
  } from '$lib/web3/walletConnect';

  $: networkName = $currentChainId === 10200 ? 'Chiado Testnet' :
                   $currentChainId === 100 ? 'Gnosis' :
                   `Chain ${$currentChainId}`;

  $: isCorrectNetwork = $currentChainId === CHIADO_NETWORK.chainId;

  function handleDisconnect() {
    disconnectWallet();
  }

  function copyAddress() {
    if ($userAddress) {
      navigator.clipboard.writeText($userAddress);
      // Could add toast notification here
    }
  }
</script>

{#if $isConnected && $userAddress}
  <div class="wallet-status">
    <div class="wallet-info">
      <div class="network-indicator" class:correct={isCorrectNetwork}>
        <span class="status-dot"></span>
        <span class="network-name">{networkName}</span>
      </div>

      <div class="address-container">
        <button class="address-button" on:click={copyAddress} title="Copy address">
          {formatAddress($userAddress)}
        </button>

        <a
          href={getExplorerUrl($userAddress, $currentChainId || 10200)}
          target="_blank"
          rel="noopener noreferrer"
          class="explorer-link"
          title="View on explorer"
        >
          ↗
        </a>
      </div>
    </div>

    <button class="disconnect-button" on:click={handleDisconnect}>
      Disconnect
    </button>
  </div>
{/if}

<style>
  .wallet-status {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.5rem 1rem;
    background: #1f2937;
    border: 1px solid #374151;
    border-radius: 8px;
    transition: all 0.3s ease;
  }

  .wallet-status:hover {
    border-color: #4b5563;
  }

  .wallet-info {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .network-indicator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0.75rem;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid #ef4444;
    border-radius: 6px;
    font-size: 0.85rem;
    font-weight: 500;
    transition: all 0.3s ease;
  }

  .network-indicator.correct {
    background: rgba(16, 185, 129, 0.1);
    border-color: #10b981;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #ef4444;
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  .network-indicator.correct .status-dot {
    background: #10b981;
  }

  .network-name {
    color: #e5e7eb;
  }

  .address-container {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .address-button {
    padding: 0.5rem 1rem;
    font-family: 'Courier New', monospace;
    font-size: 0.9rem;
    color: #d1d5db;
    background: #111827;
    border: 1px solid #374151;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .address-button:hover {
    background: #1f2937;
    border-color: #6366f1;
    color: #a5b4fc;
    box-shadow: 0 0 10px rgba(99, 102, 241, 0.2);
  }

  .explorer-link {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    color: #9ca3af;
    text-decoration: none;
    border: 1px solid #374151;
    border-radius: 6px;
    transition: all 0.3s ease;
  }

  .explorer-link:hover {
    color: #818cf8;
    border-color: #6366f1;
    background: #1f2937;
    box-shadow: 0 0 10px rgba(99, 102, 241, 0.2);
  }

  .disconnect-button {
    padding: 0.5rem 1rem;
    font-size: 0.9rem;
    color: #fca5a5;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid #ef4444;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .disconnect-button:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: #dc2626;
    box-shadow: 0 0 10px rgba(239, 68, 68, 0.2);
  }
</style>
