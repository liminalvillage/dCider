<script lang="ts">
  import { connectMetaMask, walletStore, switchNetwork, CHIADO_NETWORK, disconnectWallet } from '$lib/web3/walletConnect';

  let connecting = false;
  let showMenu = false;

  $: connected = $walletStore.connected;
  $: address = $walletStore.address;
  $: chainId = $walletStore.chainId;

  async function handleConnect() {
    connecting = true;

    try {
      await connectMetaMask();

      // Check if on correct network
      if ($walletStore.chainId && $walletStore.chainId !== CHIADO_NETWORK.chainId) {
        console.log('Switching to Chiado network...');
        await switchNetwork(CHIADO_NETWORK);
      }
    } catch (err: any) {
      console.error('Connection error:', err);
    } finally {
      connecting = false;
    }
  }

  function handleDisconnect() {
    disconnectWallet();
    showMenu = false;
  }

  function formatAddress(addr: string): string {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }

  function toggleMenu() {
    showMenu = !showMenu;
  }
</script>

{#if !connected}
  <button
    class="wallet-button connect"
    on:click={handleConnect}
    disabled={connecting}
  >
    {#if connecting}
      Connecting...
    {:else}
      Connect Wallet
    {/if}
  </button>
{:else}
  <div class="wallet-connected">
    <button class="wallet-button connected" on:click={toggleMenu}>
      <span class="status-dot"></span>
      {formatAddress(address || '')}
    </button>

    {#if showMenu}
      <div class="wallet-menu">
        <div class="menu-item network">
          <span class="label">Network:</span>
          <span class="value">
            {#if chainId === 10200}
              Chiado Testnet
            {:else if chainId === 100}
              Gnosis
            {:else}
              Chain {chainId}
            {/if}
          </span>
        </div>
        <button class="menu-item disconnect" on:click={handleDisconnect}>
          Disconnect
        </button>
      </div>
    {/if}
  </div>
{/if}

<style>
  .wallet-button {
    padding: 0.5rem 1rem;
    border-radius: 6px;
    font-size: 0.9rem;
    font-weight: 600;
    border: none;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .wallet-button.connect {
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    color: white;
    box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
  }

  .wallet-button.connect:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.5);
  }

  .wallet-button.connect:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .wallet-connected {
    position: relative;
  }

  .wallet-button.connected {
    background: #1f2937;
    color: #e5e7eb;
    border: 1px solid #374151;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .wallet-button.connected:hover {
    background: #374151;
    border-color: #4b5563;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #10b981;
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  .wallet-menu {
    position: absolute;
    top: calc(100% + 0.5rem);
    right: 0;
    background: #1f2937;
    border: 1px solid #374151;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    min-width: 200px;
    z-index: 1000;
  }

  .menu-item {
    padding: 0.75rem 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }

  .menu-item.network {
    border-bottom: 1px solid #374151;
    font-size: 0.85rem;
  }

  .menu-item.network .label {
    color: #9ca3af;
  }

  .menu-item.network .value {
    color: #6ee7b7;
    font-weight: 600;
  }

  .menu-item.disconnect {
    width: 100%;
    background: none;
    border: none;
    color: #fca5a5;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 600;
    text-align: left;
    transition: all 0.2s ease;
  }

  .menu-item.disconnect:hover {
    background: #374151;
    color: #ef4444;
  }
</style>
