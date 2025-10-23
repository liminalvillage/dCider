<script lang="ts">
  import { onMount } from 'svelte';
  import { walletStore, getFreshSigner } from '$lib/web3/walletConnect';
  import TopicSelector from '$components/delegation/TopicSelector.svelte';
  import DelegateInput from '$components/delegation/DelegateInput.svelte';
  import {
    delegate,
    revoke,
    getDelegation,
    getTerminalDelegate,
    getDelegationDepth,
    getDelegationChain,
    type Delegation
  } from '$lib/contracts/delegationManager';

  let selectedTopicId: number | null = null;
  let delegateAddress: string | null = null;
  let currentDelegation: Delegation | null = null;
  let terminalDelegate: string | null = null;
  let delegationChain: string[] = [];
  let delegationDepth: number = 0;

  let loading = false;
  let success: string | null = null;
  let error: string | null = null;

  $: connected = $walletStore.connected;
  $: userAddress = $walletStore.address;
  $: provider = $walletStore.provider;
  $: chainId = $walletStore.chainId;

  // Load delegation when topic is selected
  $: if (selectedTopicId !== null && userAddress && provider && chainId) {
    loadCurrentDelegation();
  }

  async function loadCurrentDelegation() {
    if (!selectedTopicId || !userAddress || !provider || !chainId) return;

    try {
      currentDelegation = await getDelegation(provider, chainId, userAddress, selectedTopicId);

      if (currentDelegation) {
        terminalDelegate = await getTerminalDelegate(provider, chainId, userAddress, selectedTopicId);
        delegationDepth = await getDelegationDepth(provider, chainId, userAddress, selectedTopicId);
        delegationChain = await getDelegationChain(provider, chainId, userAddress, selectedTopicId);
      } else {
        terminalDelegate = null;
        delegationDepth = 0;
        delegationChain = [];
      }
    } catch (e: any) {
      console.error('Error loading delegation:', e);
    }
  }

  function handleTopicSelected(event: CustomEvent) {
    selectedTopicId = event.detail.topicId;
    delegateAddress = null;
    success = null;
    error = null;
  }

  function handleAddressChanged(event: CustomEvent) {
    delegateAddress = event.detail.address;
    error = null;
  }

  async function handleDelegate() {
    if (!selectedTopicId || !delegateAddress || !chainId) {
      error = 'Missing required information';
      return;
    }

    loading = true;
    error = null;
    success = null;

    try {
      // Get fresh signer to ensure it matches current MetaMask account
      const freshSigner = await getFreshSigner();

      const txHash = await delegate(freshSigner, chainId, selectedTopicId, delegateAddress);
      success = currentDelegation
        ? `Delegation updated successfully! Transaction: ${txHash.slice(0, 10)}...`
        : `Delegation successful! Transaction: ${txHash.slice(0, 10)}...`;

      // Reload delegation
      await loadCurrentDelegation();
      delegateAddress = null;
    } catch (e: any) {
      error = e.message || 'Failed to delegate vote';
      console.error('Delegation error:', e);
    } finally {
      loading = false;
    }
  }

  async function handleRevoke() {
    if (!selectedTopicId || !chainId) {
      error = 'Missing required information';
      return;
    }

    loading = true;
    error = null;
    success = null;

    try {
      // Get fresh signer to ensure it matches current MetaMask account
      const freshSigner = await getFreshSigner();

      const txHash = await revoke(freshSigner, chainId, selectedTopicId);
      success = `Revocation successful! Transaction: ${txHash.slice(0, 10)}...`;

      // Reload delegation
      await loadCurrentDelegation();
    } catch (e: any) {
      error = e.message || 'Failed to revoke delegation';
      console.error('Revocation error:', e);
    } finally {
      loading = false;
    }
  }

  function formatAddress(address: string): string {
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  }
</script>

<div class="delegate-page">
  <div class="page-header">
    <h1>Delegate Your Vote</h1>
    <p class="subtitle">
      Choose a topic and delegate your voting power to someone you trust
    </p>
  </div>

  {#if !connected}
    <div class="warning-card">
      <p>⚠️ Please connect your wallet to delegate votes</p>
    </div>
  {:else}
    <div class="delegation-container">
      <!-- Topic Selection -->
      <div class="section">
        <TopicSelector on:topicSelected={handleTopicSelected} />
      </div>

      {#if selectedTopicId !== null}
        <!-- Current Delegation Status -->
        {#if currentDelegation}
          <div class="section current-delegation" data-testid="current-delegation">
            <h3>Current Delegation</h3>
            <div class="delegation-info">
              <div class="info-row">
                <span class="label">Delegated to:</span>
                <span class="value monospace">{formatAddress(currentDelegation.delegate)}</span>
              </div>

              {#if terminalDelegate && terminalDelegate !== currentDelegation.delegate}
                <div class="info-row">
                  <span class="label">Terminal delegate:</span>
                  <span class="value monospace">{formatAddress(terminalDelegate)}</span>
                </div>
              {/if}

              <div class="info-row">
                <span class="label">Chain depth:</span>
                <span class="value">{delegationDepth} level{delegationDepth !== 1 ? 's' : ''}</span>
              </div>

              {#if delegationChain.length > 1}
                <div class="chain-visualization">
                  <span class="label">Delegation chain:</span>
                  <div class="chain">
                    {#each delegationChain as address, index}
                      <span class="chain-item" class:current={index === 0}>
                        {index === 0 ? 'You' : formatAddress(address)}
                      </span>
                      {#if index < delegationChain.length - 1}
                        <span class="chain-arrow">→</span>
                      {/if}
                    {/each}
                  </div>
                </div>
              {/if}
            </div>

            <button class="revoke-btn" on:click={handleRevoke} disabled={loading}>
              {loading ? 'Revoking...' : 'Revoke Delegation'}
            </button>
          </div>
        {/if}

        <!-- Delegate Input -->
        <div class="section">
          <h3>{currentDelegation ? 'Change Delegation' : 'New Delegation'}</h3>
          <DelegateInput
            {userAddress}
            {provider}
            on:addressChanged={handleAddressChanged}
          />

          <button
            class="delegate-btn"
            on:click={handleDelegate}
            disabled={!delegateAddress || loading}
          >
            {#if loading}
              Processing...
            {:else if currentDelegation}
              Update Delegation
            {:else}
              Delegate Vote
            {/if}
          </button>
        </div>

        <!-- Status Messages -->
        {#if success}
          <div class="success-message">{success}</div>
        {/if}

        {#if error}
          <div class="error-message">{error}</div>
        {/if}
      {/if}
    </div>
  {/if}
</div>

<style>
  .delegate-page {
    max-width: 800px;
    margin: 0 auto;
  }

  .page-header {
    margin-bottom: 2rem;
  }

  .page-header h1 {
    margin: 0 0 0.5rem;
    font-size: 2rem;
    color: #f3f4f6;
    text-shadow: 0 0 20px rgba(129, 140, 248, 0.3);
  }

  .subtitle {
    margin: 0;
    color: #9ca3af;
    font-size: 1.125rem;
  }

  .warning-card {
    padding: 1.5rem;
    background: rgba(251, 191, 36, 0.1);
    border: 1px solid #f59e0b;
    border-radius: 8px;
    text-align: center;
    backdrop-filter: blur(10px);
  }

  .warning-card p {
    margin: 0;
    color: #fbbf24;
    font-weight: 500;
  }

  .delegation-container {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .section {
    background: #1f2937;
    padding: 1.5rem;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    border: 1px solid #374151;
  }

  .section h3 {
    margin: 0 0 1rem;
    font-size: 1.25rem;
    color: #f3f4f6;
  }

  .current-delegation {
    background: rgba(16, 185, 129, 0.1);
    border: 2px solid #10b981;
  }

  .delegation-info {
    margin-bottom: 1rem;
  }

  .info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 0;
    border-bottom: 1px solid #374151;
  }

  .info-row:last-child {
    border-bottom: none;
  }

  .label {
    font-weight: 500;
    color: #9ca3af;
  }

  .value {
    color: #e5e7eb;
  }

  .monospace {
    font-family: 'Monaco', 'Courier New', monospace;
    font-size: 0.9rem;
  }

  .chain-visualization {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #374151;
  }

  .chain {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .chain-item {
    padding: 0.5rem 1rem;
    background: #111827;
    border: 1px solid #374151;
    border-radius: 4px;
    font-size: 0.875rem;
    font-family: 'Monaco', 'Courier New', monospace;
    color: #d1d5db;
    transition: all 0.3s ease;
  }

  .chain-item:hover {
    border-color: #6366f1;
    box-shadow: 0 0 10px rgba(99, 102, 241, 0.2);
  }

  .chain-item.current {
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    color: white;
    border-color: #6366f1;
    box-shadow: 0 0 15px rgba(99, 102, 241, 0.4);
  }

  .chain-arrow {
    color: #6366f1;
    font-weight: 700;
  }

  .delegate-btn,
  .revoke-btn {
    width: 100%;
    padding: 0.875rem 1.5rem;
    font-size: 1rem;
    font-weight: 600;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s ease;
    margin-top: 1rem;
  }

  .delegate-btn {
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    color: white;
    box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);
  }

  .delegate-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(99, 102, 241, 0.6);
  }

  .delegate-btn:disabled {
    background: #374151;
    cursor: not-allowed;
    opacity: 0.5;
    box-shadow: none;
  }

  .revoke-btn {
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    color: white;
    box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4);
  }

  .revoke-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(239, 68, 68, 0.6);
  }

  .revoke-btn:disabled {
    background: #374151;
    cursor: not-allowed;
    opacity: 0.5;
    box-shadow: none;
  }

  .success-message,
  .error-message {
    padding: 1rem 1.5rem;
    border-radius: 8px;
    font-weight: 500;
    backdrop-filter: blur(10px);
  }

  .success-message {
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid #10b981;
    color: #6ee7b7;
  }

  .error-message {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid #ef4444;
    color: #fca5a5;
  }
</style>
