<script lang="ts">
  import { onMount } from 'svelte';
  import { checkConnection, walletStore } from '$lib/web3/walletConnect';
  import { getEventListener } from '$lib/web3/eventListener';
  import { getContractAddresses, validateAddresses } from '$lib/contracts/addresses';
  import WalletButton from '$components/wallet/WalletButton.svelte';
  import NotificationToast from '$lib/components/NotificationToast.svelte';
  import DashboardPage from './routes/dashboard/+page.svelte';
  import GlobalGraphPage from './routes/global-graph/+page.svelte';

  let addressesValid = false;
  let currentRoute = 'home';

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
          console.warn('[App] Contract addresses not configured');
        }
      }
    });

    // Simple routing based on hash
    updateRoute();
    window.addEventListener('hashchange', updateRoute);
  });

  function updateRoute() {
    const hash = window.location.hash.slice(1) || 'home';
    currentRoute = hash;
  }

  function navigate(route: string) {
    window.location.hash = route;
  }
</script>

<NotificationToast />

<div class="app">
  <header class="header">
    <div class="container">
      <div class="header-content">
        <div class="brand">
          <img src="/dCider.png" alt="dCider Icon" class="brand-icon" />
          <div class="brand-text">
            <h1 class="brand-title">dCider</h1>
            <p class="brand-subtitle">Sober Democracy Engine</p>
          </div>
        </div>

        <nav class="nav">
          <button
            class="nav-link"
            class:active={currentRoute === 'home'}
            on:click={() => navigate('home')}
          >
            Dashboard
          </button>
          <button
            class="nav-link"
            class:active={currentRoute === 'global-graph'}
            on:click={() => navigate('global-graph')}
          >
            Global Graph
          </button>
        </nav>

        <div class="wallet-section">
          <WalletButton />
        </div>
      </div>
    </div>
  </header>

  <main class="main">
    <div class="container">
      {#if !$walletStore.connected}
        <!-- Landing Page -->
        <div class="landing">
          <div class="hero">
            <div class="hero-content">
              <h1 class="hero-title">
                Democracy, Evolved
              </h1>
              <p class="hero-subtitle">
                Topic-specific, revocable vote delegation with secure computation and transparent rewards
              </p>
              <div class="hero-cta">
                <WalletButton />
                <p class="cta-hint">Connect your wallet to start participating</p>
              </div>
            </div>
            <div class="hero-visual">
              <div class="visual-orb orb-1"></div>
              <div class="visual-orb orb-2"></div>
              <div class="visual-orb orb-3"></div>
            </div>
          </div>

          <div class="features">
            <div class="feature-card">
              <div class="feature-icon">🎯</div>
              <h3 class="feature-title">Topic-Based Delegation</h3>
              <p class="feature-description">
                Delegate your vote on climate policy to one expert, and AI ethics to another.
                Your voice, amplified by expertise.
              </p>
            </div>

            <div class="feature-card">
              <div class="feature-icon">🔄</div>
              <h3 class="feature-title">Revocable & Flexible</h3>
              <p class="feature-description">
                Changed your mind? Revoke delegation at any time and vote directly.
                Your power, your control.
              </p>
            </div>

            <div class="feature-card">
              <div class="feature-icon">🔐</div>
              <h3 class="feature-title">Privacy-Preserving</h3>
              <p class="feature-description">
                Vote weight computation happens securely in Trusted Execution Environments.
                Verifiable without compromising privacy.
              </p>
            </div>

            <div class="feature-card">
              <div class="feature-icon">💎</div>
              <h3 class="feature-title">Streaming Rewards</h3>
              <p class="feature-description">
                Delegates earn real-time token flows proportionate to their voting power.
                Trust rewarded, continuously.
              </p>
            </div>
          </div>

          <div class="architecture">
            <h2 class="section-title">How It Works</h2>
            <div class="architecture-grid">
              <div class="architecture-step">
                <div class="step-number">1</div>
                <h4 class="step-title">Delegate</h4>
                <p class="step-description">
                  Choose trusted delegates per topic. All delegation actions are transparent on-chain.
                </p>
              </div>

              <div class="architecture-step">
                <div class="step-number">2</div>
                <h4 class="step-title">Compute</h4>
                <p class="step-description">
                  TEE-powered enclave securely calculates final voting power from delegation chains.
                </p>
              </div>

              <div class="architecture-step">
                <div class="step-number">3</div>
                <h4 class="step-title">Vote</h4>
                <p class="step-description">
                  Terminal delegates vote with accumulated power. Results verified and recorded on-chain.
                </p>
              </div>

              <div class="architecture-step">
                <div class="step-number">4</div>
                <h4 class="step-title">Reward</h4>
                <p class="step-description">
                  Delegates receive proportional streaming payments based on their final voting power.
                </p>
              </div>
            </div>
          </div>

          <div class="cta-section">
            <h2 class="cta-title">Ready to Shape the Future?</h2>
            <p class="cta-description">
              Join a governance system that scales with expertise while preserving individual autonomy.
            </p>
            <WalletButton />
          </div>
        </div>
      {:else}
        <!-- Connected View -->
        {#if !addressesValid}
          <div class="warning-banner">
            ⚠️ Contract addresses not configured. Please set environment variables.
          </div>
        {/if}

        {#if currentRoute === 'home'}
          <DashboardPage />
        {:else if currentRoute === 'global-graph'}
          <GlobalGraphPage />
        {/if}
      {/if}
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
    background: #0f1419;
    color: #e5e7eb;
  }

  :global(*) {
    scrollbar-width: thin;
    scrollbar-color: #4f46e5 #1f2937;
  }

  :global(::-webkit-scrollbar) {
    width: 8px;
    height: 8px;
  }

  :global(::-webkit-scrollbar-track) {
    background: #1f2937;
  }

  :global(::-webkit-scrollbar-thumb) {
    background: #4f46e5;
    border-radius: 4px;
  }

  :global(::-webkit-scrollbar-thumb:hover) {
    background: #6366f1;
  }

  .app {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }

  .header {
    background: #1a1f2e;
    border-bottom: 1px solid #2d3748;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(10px);
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
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .brand-icon {
    height: 50px;
    width: 50px;
    object-fit: contain;
  }

  .brand-text {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }

  .brand-title {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 900;
    background: linear-gradient(135deg, #ffffff, #e0e7ff);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    letter-spacing: -0.02em;
  }

  .brand-subtitle {
    margin: 0;
    font-size: 0.65rem;
    color: #9B9EF5;
    font-weight: 400;
    letter-spacing: 0.02em;
  }

  .nav {
    display: flex;
    gap: 2rem;
  }

  .nav-link {
    background: none;
    border: none;
    color: #d1d5db;
    text-decoration: none;
    font-weight: 500;
    padding: 0.5rem 0;
    position: relative;
    display: inline-block;
    cursor: pointer;
    transition: all 0.3s ease;
    font-size: 1rem;
  }

  .nav-link::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    width: 0;
    height: 2px;
    background: linear-gradient(90deg, #6366f1, #8b5cf6);
    transition: width 0.3s ease;
  }

  .nav-link:hover {
    color: #818cf8;
  }

  .nav-link:hover::after {
    width: 100%;
  }

  .nav-link.active {
    color: #818cf8;
  }

  .nav-link.active::after {
    width: 100%;
  }

  .wallet-section {
    flex-shrink: 0;
    display: flex;
    gap: 1rem;
    align-items: center;
  }

  .main {
    flex: 1;
    padding: 2rem 0;
  }

  .warning-banner {
    padding: 1rem;
    margin-bottom: 2rem;
    background: rgba(251, 191, 36, 0.1);
    border: 1px solid #f59e0b;
    border-radius: 8px;
    color: #fbbf24;
    text-align: center;
    backdrop-filter: blur(10px);
  }

  .footer {
    background: #1a1f2e;
    border-top: 1px solid #2d3748;
    padding: 1.5rem 0;
    margin-top: auto;
  }

  .footer-text {
    margin: 0;
    text-align: center;
    color: #9ca3af;
    font-size: 0.9rem;
  }

  .footer-text a {
    color: #818cf8;
    text-decoration: none;
    transition: color 0.2s;
  }

  .footer-text a:hover {
    color: #a5b4fc;
    text-decoration: underline;
  }

  /* Landing Page Styles */
  .landing {
    padding: 2rem 0;
  }

  .hero {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 3rem;
    align-items: center;
    padding: 2rem 0;
    min-height: 350px;
  }

  .hero-content {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .hero-title {
    font-size: 2.5rem;
    font-weight: 900;
    line-height: 1.1;
    margin: 0;
    background: linear-gradient(135deg, #ffffff 0%, #a5b4fc 50%, #6366f1 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    letter-spacing: -0.03em;
  }

  .hero-subtitle {
    font-size: 1rem;
    color: #9ca3af;
    line-height: 1.6;
    margin: 0;
    max-width: 500px;
  }

  .hero-cta {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-top: 0.5rem;
  }

  .cta-hint {
    margin: 0;
    font-size: 0.85rem;
    color: #6b7280;
    font-style: italic;
  }

  .hero-visual {
    position: relative;
    height: 300px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .visual-orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(40px);
    opacity: 0.6;
    animation: float 3s ease-in-out infinite;
  }

  .orb-1 {
    width: 300px;
    height: 300px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    top: 5%;
    left: 5%;
    animation-delay: 0s;
  }

  .orb-2 {
    width: 220px;
    height: 220px;
    background: linear-gradient(135deg, #ec4899, #8b5cf6);
    bottom: 10%;
    right: 10%;
    animation-delay: 1s;
  }

  .orb-3 {
    width: 260px;
    height: 260px;
    background: linear-gradient(135deg, #06b6d4, #6366f1);
    top: 35%;
    right: 0%;
    animation-delay: 2s;
  }

  @keyframes float {
    0%, 100% {
      transform: translateY(0px) translateX(0px) scale(1);
    }
    33% {
      transform: translateY(-40px) translateX(20px) scale(1.1);
    }
    66% {
      transform: translateY(20px) translateX(-20px) scale(0.9);
    }
  }

  .features {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 2rem;
    padding: 4rem 0;
    margin-top: 2rem;
  }

  .feature-card {
    background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
    border: 1px solid #374151;
    border-radius: 16px;
    padding: 2rem;
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
  }

  .feature-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, #6366f1, #8b5cf6, #ec4899);
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  .feature-card:hover {
    transform: translateY(-8px);
    border-color: #6366f1;
    box-shadow: 0 20px 40px rgba(99, 102, 241, 0.3);
  }

  .feature-card:hover::before {
    opacity: 1;
  }

  .feature-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
    display: inline-block;
  }

  .feature-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #f3f4f6;
    margin: 0 0 1rem 0;
  }

  .feature-description {
    font-size: 1rem;
    color: #9ca3af;
    line-height: 1.6;
    margin: 0;
  }

  .architecture {
    padding: 4rem 0;
    margin-top: 2rem;
  }

  .section-title {
    font-size: 2.5rem;
    font-weight: 800;
    text-align: center;
    margin: 0 0 3rem 0;
    background: linear-gradient(135deg, #ffffff 0%, #a5b4fc 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .architecture-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 2rem;
  }

  .architecture-step {
    background: #1f2937;
    border: 1px solid #374151;
    border-radius: 12px;
    padding: 2rem;
    text-align: center;
    transition: all 0.3s ease;
  }

  .architecture-step:hover {
    border-color: #6366f1;
    box-shadow: 0 10px 30px rgba(99, 102, 241, 0.2);
  }

  .step-number {
    width: 60px;
    height: 60px;
    margin: 0 auto 1.5rem;
    border-radius: 50%;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.75rem;
    font-weight: 700;
    color: white;
    box-shadow: 0 8px 20px rgba(99, 102, 241, 0.4);
  }

  .step-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: #f3f4f6;
    margin: 0 0 1rem 0;
  }

  .step-description {
    font-size: 0.95rem;
    color: #9ca3af;
    line-height: 1.6;
    margin: 0;
  }

  .cta-section {
    text-align: center;
    padding: 5rem 2rem;
    margin-top: 3rem;
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%);
    border-radius: 20px;
    border: 1px solid rgba(99, 102, 241, 0.3);
  }

  .cta-title {
    font-size: 2.5rem;
    font-weight: 800;
    margin: 0 0 1rem 0;
    background: linear-gradient(135deg, #ffffff 0%, #a5b4fc 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .cta-description {
    font-size: 1.25rem;
    color: #9ca3af;
    margin: 0 0 2rem 0;
    max-width: 600px;
    margin-left: auto;
    margin-right: auto;
  }

  @media (max-width: 768px) {
    .header-content {
      flex-direction: column;
      align-items: flex-start;
      gap: 1rem;
    }

    .nav {
      flex-direction: row;
      gap: 1rem;
    }

    .hero {
      grid-template-columns: 1fr;
      gap: 2rem;
      padding: 2rem 0;
    }

    .hero-title {
      font-size: 2.5rem;
    }

    .hero-subtitle {
      font-size: 1.1rem;
    }

    .hero-visual {
      height: 300px;
    }

    .features {
      grid-template-columns: repeat(2, 1fr);
      gap: 1.5rem;
    }
  }

  @media (max-width: 640px) {
    .features {
      grid-template-columns: 1fr;
    }
  }
</style>
