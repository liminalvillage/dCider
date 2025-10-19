<script lang="ts">
  import { onMount } from 'svelte';
  import { checkConnection, walletStore } from '$lib/web3/walletConnect';
  import { getEventListener } from '$lib/web3/eventListener';
  import { getContractAddresses, validateAddresses } from '$lib/contracts/addresses';
  import ConnectWallet from '$components/wallet/ConnectWallet.svelte';
  import WalletStatus from '$components/wallet/WalletStatus.svelte';

  let addressesValid = false;

  onMount(async () => {
    // Check for existing wallet connection
    await checkConnection();

    // Setup event listener when wallet connects
    walletStore.subscribe(($wallet) => {
      if ($wallet.connected && $wallet.provider && $wallet.chainId) {
        const addresses = getContractAddresses($wallet.chainId);
        addressesValid = validateAddresses(addresses);

        if (addressesValid) {
          const eventListener = getEventListener($wallet.provider);
          eventListener.startListening({
            delegationManager: addresses.delegationManager,
            topicRegistry: addresses.topicRegistry,
            votePowerVerifier: addresses.votePowerVerifier,
          });
        } else {
          console.warn('[Layout] Contract addresses not configured');
        }
      }
    });
  });
</script>

<div class="app">
  <header class="header">
    <div class="container">
      <div class="header-content">
        <div class="brand">
          <h1 class="logo">Liquid Democracy Engine</h1>
          <p class="tagline">Delegate your vote, reclaim your power</p>
        </div>

        <nav class="nav">
          <a href="/" class="nav-link">Home</a>
          <a href="/delegate" class="nav-link">Delegate</a>
          <a href="/graph" class="nav-link">Graph</a>
          <a href="/rewards" class="nav-link">Rewards</a>
        </nav>

        <div class="wallet-section">
          <ConnectWallet />
          <WalletStatus />
        </div>
      </div>
    </div>
  </header>

  <main class="main">
    <div class="container">
      {#if !addressesValid}
        <div class="warning-banner">
          ⚠️ Contract addresses not configured. Please set environment variables.
        </div>
      {/if}

      <slot />
    </div>
  </main>

  <footer class="footer">
    <div class="container">
      <p class="footer-text">
        Liquid Democracy Engine &copy; 2025 |
        <a href="https://github.com/your-org/dCider" target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
      </p>
    </div>
  </footer>
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    background: #f7fafc;
    color: #2d3748;
  }

  .app {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }

  .header {
    background: white;
    border-bottom: 1px solid #e2e8f0;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }

  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 1.5rem;
  }

  .header-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 0;
    gap: 2rem;
  }

  .brand {
    flex-shrink: 0;
  }

  .logo {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .tagline {
    margin: 0.25rem 0 0;
    font-size: 0.85rem;
    color: #718096;
  }

  .nav {
    display: flex;
    gap: 2rem;
  }

  .nav-link {
    color: #4a5568;
    text-decoration: none;
    font-weight: 500;
    transition: color 0.2s;
  }

  .nav-link:hover {
    color: #667eea;
  }

  .wallet-section {
    flex-shrink: 0;
  }

  .main {
    flex: 1;
    padding: 2rem 0;
  }

  .warning-banner {
    padding: 1rem;
    margin-bottom: 2rem;
    background: #fef3c7;
    border: 1px solid #f59e0b;
    border-radius: 8px;
    color: #92400e;
    text-align: center;
  }

  .footer {
    background: white;
    border-top: 1px solid #e2e8f0;
    padding: 1.5rem 0;
    margin-top: auto;
  }

  .footer-text {
    margin: 0;
    text-align: center;
    color: #718096;
    font-size: 0.9rem;
  }

  .footer-text a {
    color: #667eea;
    text-decoration: none;
  }

  .footer-text a:hover {
    text-decoration: underline;
  }

  @media (max-width: 768px) {
    .header-content {
      flex-direction: column;
      align-items: flex-start;
      gap: 1rem;
    }

    .nav {
      flex-direction: column;
      gap: 0.5rem;
    }
  }
</style>
