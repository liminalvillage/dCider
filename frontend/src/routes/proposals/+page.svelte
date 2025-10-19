<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { walletStore } from '$lib/web3/walletConnect';
  import TopicSelector from '$components/delegation/TopicSelector.svelte';
  import {
    createProposal,
    castVote,
    executeProposal,
    getProposalsByTopic,
    hasVoted,
    getVotingPower,
    getStatusLabel,
    VoteChoice,
    ProposalStatus,
    type Proposal
  } from '$lib/contracts/proposalManager';

  let selectedTopicId: number | null = null;
  let proposalTitle = '';
  let proposalDescription = '';
  let votingPeriod = 1000;
  let loading = false;
  let loadingProposals = false;
  let success: string | null = null;
  let error: string | null = null;
  let proposals: Proposal[] = [];
  let userVotingPowers: Map<number, number> = new Map();
  let userHasVoted: Map<number, boolean> = new Map();

  $: connected = $walletStore.connected;
  $: userAddress = $walletStore.address;
  $: signer = $walletStore.signer;
  $: provider = $walletStore.provider;
  $: chainId = $walletStore.chainId;

  function handleTopicSelected(event: CustomEvent) {
    selectedTopicId = event.detail.topicId;
    success = null;
    error = null;
    loadProposals();
  }

  async function loadProposals() {
    if (!selectedTopicId || !provider || !chainId) return;

    loadingProposals = true;
    try {
      const topicProposals = await getProposalsByTopic(provider, chainId, selectedTopicId);
      proposals = topicProposals;

      // Load voting power and vote status for each proposal
      if (userAddress) {
        for (const proposal of proposals) {
          const power = await getVotingPower(provider, chainId, proposal.id, userAddress);
          userVotingPowers.set(proposal.id, power);

          const voted = await hasVoted(provider, chainId, proposal.id, userAddress);
          userHasVoted.set(proposal.id, voted);
        }
        userVotingPowers = userVotingPowers; // Trigger reactivity
        userHasVoted = userHasVoted;
      }
    } catch (e: any) {
      console.error('Error loading proposals:', e);
      error = e.message || 'Failed to load proposals';
    } finally {
      loadingProposals = false;
    }
  }

  async function handleCreateProposal() {
    if (!selectedTopicId || !proposalTitle || !signer || !chainId) {
      error = 'Please fill in all fields';
      return;
    }

    loading = true;
    error = null;
    success = null;

    try {
      const result = await createProposal(
        signer,
        chainId,
        selectedTopicId,
        proposalTitle,
        proposalDescription || 'No description provided',
        votingPeriod
      );

      success = `Proposal #${result.proposalId} created successfully! TX: ${result.txHash.slice(0, 10)}...`;
      proposalTitle = '';
      proposalDescription = '';

      // Reload proposals
      await loadProposals();
    } catch (e: any) {
      error = e.message || 'Failed to create proposal';
    } finally {
      loading = false;
    }
  }

  async function handleVote(proposalId: number, choice: VoteChoice) {
    if (!signer || !chainId) return;

    loading = true;
    error = null;
    success = null;

    try {
      const txHash = await castVote(signer, chainId, proposalId, choice);
      success = `Vote cast successfully! TX: ${txHash.slice(0, 10)}...`;

      // Reload proposals
      await loadProposals();
    } catch (e: any) {
      error = e.message || 'Failed to cast vote';
    } finally {
      loading = false;
    }
  }

  async function handleExecute(proposalId: number) {
    if (!signer || !chainId) return;

    loading = true;
    error = null;
    success = null;

    try {
      const txHash = await executeProposal(signer, chainId, proposalId);
      success = `Proposal executed successfully! TX: ${txHash.slice(0, 10)}...`;

      // Reload proposals
      await loadProposals();
    } catch (e: any) {
      error = e.message || 'Failed to execute proposal';
    } finally {
      loading = false;
    }
  }

  function getStatusColor(status: ProposalStatus): string {
    switch (status) {
      case ProposalStatus.Active:
        return 'status-active';
      case ProposalStatus.Succeeded:
        return 'status-succeeded';
      case ProposalStatus.Failed:
        return 'status-failed';
      case ProposalStatus.Executed:
        return 'status-executed';
      case ProposalStatus.Cancelled:
        return 'status-cancelled';
      default:
        return '';
    }
  }

  function canVote(proposal: Proposal): boolean {
    if (!userAddress) return false;
    if (proposal.status !== ProposalStatus.Active) return false;
    if (userHasVoted.get(proposal.id)) return false;
    const power = userVotingPowers.get(proposal.id) || 0;
    return power > 0;
  }

  function canExecute(proposal: Proposal): boolean {
    return proposal.status === ProposalStatus.Succeeded && !proposal.executed;
  }
</script>

<div class="proposals-page">
  <h1>Proposals & Voting</h1>
  <p class="subtitle">Create and vote on governance proposals</p>

  {#if !connected}
    <div class="alert alert-warning">
      Please connect your wallet to create and vote on proposals.
    </div>
  {/if}

  <div class="section">
    <h2>Select a Topic</h2>
    <TopicSelector on:topicSelected={handleTopicSelected} />
  </div>

  {#if selectedTopicId}
    <div class="section">
      <h2>Create Proposal</h2>

      <div class="form">
        <div class="form-group">
          <label for="title">Proposal Title *</label>
          <input
            id="title"
            type="text"
            bind:value={proposalTitle}
            placeholder="e.g., Reduce carbon emissions by 50%"
            maxlength="200"
            disabled={loading}
          />
        </div>

        <div class="form-group">
          <label for="description">Description</label>
          <textarea
            id="description"
            bind:value={proposalDescription}
            placeholder="Describe your proposal in detail..."
            rows="5"
            disabled={loading}
          ></textarea>
          <p class="help-text">This will be stored on-chain. Keep it concise!</p>
        </div>

        <div class="form-group">
          <label for="period">Voting Period (blocks) *</label>
          <input
            id="period"
            type="number"
            bind:value={votingPeriod}
            min="100"
            max="100800"
            disabled={loading}
          />
          <p class="help-text">1000 blocks ≈ 3.3 hours | 7200 blocks ≈ 1 day on Gnosis</p>
        </div>

        {#if error}
          <div class="alert alert-error">{error}</div>
        {/if}

        {#if success}
          <div class="alert alert-success">{success}</div>
        {/if}

        <button
          class="btn btn-primary"
          on:click={handleCreateProposal}
          disabled={!connected || loading || !proposalTitle}
        >
          {loading ? '⏳ Creating...' : '✨ Create Proposal'}
        </button>
      </div>
    </div>

    <div class="section">
      <div class="section-header">
        <h2>Proposals for this Topic</h2>
        <button class="btn-refresh" on:click={loadProposals} disabled={loadingProposals}>
          {loadingProposals ? '⏳' : '🔄'} Refresh
        </button>
      </div>

      {#if loadingProposals}
        <p class="loading">Loading proposals...</p>
      {:else if proposals.length === 0}
        <div class="empty-state">
          <p>📝 No proposals yet.</p>
          <p>Be the first to create one!</p>
        </div>
      {:else}
        <div class="proposals-list">
          {#each proposals as proposal}
            <div class="proposal-card">
              <div class="proposal-header">
                <div>
                  <h3>#{proposal.id}: {proposal.title}</h3>
                  <p class="proposer">By {proposal.proposer.slice(0, 6)}...{proposal.proposer.slice(-4)}</p>
                </div>
                <span class="status-badge {getStatusColor(proposal.status)}">
                  {getStatusLabel(proposal.status)}
                </span>
              </div>

              {#if proposal.descriptionCID !== 'No description provided'}
                <p class="description">{proposal.descriptionCID}</p>
              {/if}

              <div class="vote-stats">
                <div class="stat stat-for">
                  <span class="label">✅ For</span>
                  <span class="value">{proposal.forVotes}</span>
                </div>
                <div class="stat stat-against">
                  <span class="label">❌ Against</span>
                  <span class="value">{proposal.againstVotes}</span>
                </div>
                <div class="stat stat-abstain">
                  <span class="label">⊘ Abstain</span>
                  <span class="value">{proposal.abstainVotes}</span>
                </div>
              </div>

              <div class="proposal-info">
                <span>Blocks: {proposal.startBlock} → {proposal.endBlock}</span>
                {#if userAddress}
                  <span>Your power: {userVotingPowers.get(proposal.id) || 0}</span>
                {/if}
              </div>

              {#if userAddress}
                <div class="proposal-actions">
                  {#if canVote(proposal)}
                    <button
                      class="btn btn-vote btn-for"
                      on:click={() => handleVote(proposal.id, VoteChoice.For)}
                      disabled={loading}
                    >
                      👍 Vote For
                    </button>
                    <button
                      class="btn btn-vote btn-against"
                      on:click={() => handleVote(proposal.id, VoteChoice.Against)}
                      disabled={loading}
                    >
                      👎 Vote Against
                    </button>
                    <button
                      class="btn btn-vote btn-abstain"
                      on:click={() => handleVote(proposal.id, VoteChoice.Abstain)}
                      disabled={loading}
                    >
                      ⊘ Abstain
                    </button>
                  {:else if userHasVoted.get(proposal.id)}
                    <div class="voted-badge">✓ You voted</div>
                  {:else if proposal.status !== ProposalStatus.Active}
                    <div class="info-badge">Voting ended</div>
                  {:else if (userVotingPowers.get(proposal.id) || 0) === 0}
                    <div class="info-badge">⚠️ You delegated your vote</div>
                  {/if}

                  {#if canExecute(proposal)}
                    <button
                      class="btn btn-execute"
                      on:click={() => handleExecute(proposal.id)}
                      disabled={loading}
                    >
                      ⚡ Execute Proposal
                    </button>
                  {/if}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {:else}
    <div class="empty-state">
      <p>👆 Please select a topic above to view and create proposals.</p>
    </div>
  {/if}
</div>

<style>
  .proposals-page {
    max-width: 900px;
    margin: 0 auto;
    padding: 2rem 1rem;
  }

  h1 {
    font-size: 2rem;
    margin-bottom: 0.5rem;
    color: #1a202c;
  }

  .subtitle {
    color: #718096;
    margin-bottom: 2rem;
  }

  h2 {
    font-size: 1.5rem;
    margin-bottom: 1rem;
    color: #2d3748;
  }

  .section {
    background: white;
    border-radius: 8px;
    padding: 1.5rem;
    margin-bottom: 2rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .btn-refresh {
    background: none;
    border: 1px solid #cbd5e0;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.875rem;
  }

  .btn-refresh:hover:not(:disabled) {
    background: #f7fafc;
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  label {
    font-weight: 600;
    color: #2d3748;
    font-size: 0.875rem;
  }

  input[type="text"],
  input[type="number"],
  textarea {
    padding: 0.75rem;
    border: 1px solid #cbd5e0;
    border-radius: 6px;
    font-size: 1rem;
    transition: border-color 0.2s;
    font-family: inherit;
  }

  input:focus,
  textarea:focus {
    outline: none;
    border-color: #4299e1;
  }

  .help-text {
    font-size: 0.875rem;
    color: #718096;
    margin: 0;
  }

  .alert {
    padding: 1rem;
    border-radius: 6px;
    margin: 1rem 0;
  }

  .alert-error {
    background: #fed7d7;
    color: #c53030;
    border: 1px solid #fc8181;
  }

  .alert-success {
    background: #c6f6d5;
    color: #276749;
    border: 1px solid #68d391;
  }

  .alert-warning {
    background: #fef5e7;
    color: #744210;
    border: 1px solid #f6ad55;
  }

  .btn {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 1rem;
  }

  .btn-primary {
    background: #4299e1;
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: #3182ce;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .loading,
  .empty-state {
    text-align: center;
    padding: 3rem 1rem;
    color: #718096;
  }

  .empty-state p {
    margin: 0.5rem 0;
  }

  .proposals-list {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .proposal-card {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 1.5rem;
    transition: box-shadow 0.2s;
  }

  .proposal-card:hover {
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  .proposal-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
    gap: 1rem;
  }

  .proposal-header h3 {
    font-size: 1.125rem;
    margin: 0 0 0.25rem 0;
    color: #1a202c;
  }

  .proposer {
    font-size: 0.875rem;
    color: #718096;
    margin: 0;
  }

  .status-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .status-active {
    background: #bee3f8;
    color: #2c5282;
  }

  .status-succeeded {
    background: #c6f6d5;
    color: #276749;
  }

  .status-failed {
    background: #fed7d7;
    color: #c53030;
  }

  .status-executed {
    background: #d6bcfa;
    color: #553c9a;
  }

  .status-cancelled {
    background: #e2e8f0;
    color: #4a5568;
  }

  .description {
    color: #4a5568;
    margin-bottom: 1rem;
  }

  .vote-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .stat {
    padding: 0.75rem;
    border-radius: 6px;
    text-align: center;
  }

  .stat-for {
    background: #f0fff4;
    border: 1px solid #9ae6b4;
  }

  .stat-against {
    background: #fff5f5;
    border: 1px solid #fc8181;
  }

  .stat-abstain {
    background: #f7fafc;
    border: 1px solid #cbd5e0;
  }

  .stat .label {
    display: block;
    font-size: 0.75rem;
    color: #718096;
    margin-bottom: 0.25rem;
  }

  .stat .value {
    display: block;
    font-size: 1.5rem;
    font-weight: 700;
    color: #1a202c;
  }

  .proposal-info {
    display: flex;
    justify-content: space-between;
    font-size: 0.875rem;
    color: #718096;
    margin-bottom: 1rem;
    padding-top: 0.75rem;
    border-top: 1px solid #e2e8f0;
  }

  .proposal-actions {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .btn-vote {
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    flex: 1;
    min-width: 120px;
  }

  .btn-for {
    background: #48bb78;
    color: white;
  }

  .btn-for:hover:not(:disabled) {
    background: #38a169;
  }

  .btn-against {
    background: #f56565;
    color: white;
  }

  .btn-against:hover:not(:disabled) {
    background: #e53e3e;
  }

  .btn-abstain {
    background: #cbd5e0;
    color: #2d3748;
  }

  .btn-abstain:hover:not(:disabled) {
    background: #a0aec0;
  }

  .btn-execute {
    background: #9f7aea;
    color: white;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    width: 100%;
  }

  .btn-execute:hover:not(:disabled) {
    background: #805ad5;
  }

  .voted-badge,
  .info-badge {
    padding: 0.5rem 1rem;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 600;
    text-align: center;
    width: 100%;
  }

  .voted-badge {
    background: #c6f6d5;
    color: #276749;
  }

  .info-badge {
    background: #e2e8f0;
    color: #4a5568;
  }
</style>
