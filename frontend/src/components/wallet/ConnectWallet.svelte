<script lang="ts">
  import { connectMetaMask, isConnected, switchNetwork, CHIADO_NETWORK } from '$lib/web3/walletConnect';
  import { currentChainId } from '$lib/web3/walletConnect';

  let connecting = false;
  let error = '';

  async function handleConnect() {
    connecting = true;
    error = '';

    try {
      await connectMetaMask();

      // Check if on correct network
      const chainId = $currentChainId;
      if (chainId && chainId !== CHIADO_NETWORK.chainId) {
        console.log('Switching to Chiado network...');
        await switchNetwork(CHIADO_NETWORK);
      }
    } catch (err: any) {
      console.error('Connection error:', err);
      error = err.message || 'Failed to connect wallet';
    } finally {
      connecting = false;
    }
  }
</script>

<div class="connect-wallet">
  {#if !$isConnected}
    <button
      class="connect-button"
      on:click={handleConnect}
      disabled={connecting}
    >
      {#if connecting}
        Connecting...
      {:else}
        Connect Wallet
      {/if}
    </button>

    {#if error}
      <p class="error">{error}</p>
    {/if}

    <p class="hint">
      Connect with MetaMask to start delegating your voting power
    </p>
  {/if}
</div>

<style>
  .connect-wallet {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 2rem;
  }

  .connect-button {
    padding: 0.75rem 2rem;
    font-size: 1.1rem;
    font-weight: 600;
    color: white;
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);
  }

  .connect-button:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(99, 102, 241, 0.6);
  }

  .connect-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .error {
    color: #fca5a5;
    font-size: 0.9rem;
    margin: 0;
  }

  .hint {
    color: #9ca3af;
    font-size: 0.9rem;
    text-align: center;
    margin: 0;
    max-width: 300px;
  }
</style>
