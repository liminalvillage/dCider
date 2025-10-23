<script lang="ts">
  import { onMount } from 'svelte';
  import { ethers } from 'ethers';
  import { walletStore, getFreshSigner } from '$lib/web3/walletConnect';
  import { getAllTopics, type TopicSummary } from '$lib/contracts/topicRegistry';
  import {
    delegate,
    revoke,
    getDelegation,
    getTerminalDelegate,
    type Delegation
  } from '$lib/contracts/delegationManager';
  import {
    createProposal,
    getProposalsByTopic,
    castVote,
    hasVoted,
    getVotingPower,
    type Proposal,
    getStatusLabel,
    ProposalStatus,
    VoteChoice
  } from '$lib/contracts/proposalManager';
  import { fetchDelegationGraph, type DelegationGraphData } from '$lib/services/graphData';
  import DelegateInput from '$components/delegation/DelegateInput.svelte';
  import DelegationGraph from '$lib/components/DelegationGraph.svelte';

  let topics: TopicSummary[] = [];
  let selectedTopicId: number | null = null;
  let loading = true;
  let error: string | null = null;

  // Proposals state
  let proposals: Proposal[] = [];
  let loadingProposals = false;
  let votingOnProposal: number | null = null;
  let votedProposals = new Set<number>();
  let votingPowers = new Map<number, number>();

  // Delegation state
  let currentDelegation: Delegation | null = null;
  let delegateAddress: string | null = null;
  let delegating = false;
  let delegationSuccess: string | null = null;
  let delegationError: string | null = null;
  let canCreateProposals = false; // User is terminal delegate (hasn't delegated away voting power)

  // Graph state
  let graphData: DelegationGraphData | null = null;
  let loadingGraph = false;

  // Modal state
  let showProposalModal = false;
  let proposalTitle = '';
  let proposalDescription = '';
  let creatingProposal = false;
  let proposalError: string | null = null;

  $: connected = $walletStore.connected;
  $: userAddress = $walletStore.address;
  $: provider = $walletStore.provider;
  $: chainId = $walletStore.chainId;

  // Load topics when wallet connects
  $: if (provider && chainId) {
    loadTopics();
  }

  // Load delegation, graph, and proposals when topic changes
  $: if (selectedTopicId !== null && userAddress && provider && chainId) {
    loadCurrentDelegation();
    loadGraph();
    loadProposals();
  }

  async function loadTopics() {
    if (!provider || !chainId) {
      error = 'Please connect your wallet';
      loading = false;
      return;
    }

    try {
      loading = true;
      topics = await getAllTopics(provider, chainId, true);
      if (topics.length > 0 && !selectedTopicId) {
        selectedTopicId = topics[0].id;
      }
    } catch (e: any) {
      error = e.message || 'Failed to load topics';
      console.error('Error loading topics:', e);
    } finally {
      loading = false;
    }
  }

  async function loadCurrentDelegation() {
    if (!selectedTopicId || !userAddress || !provider || !chainId) return;

    try {
      currentDelegation = await getDelegation(provider, chainId, userAddress, selectedTopicId);

      // Check if user is terminal delegate (can create proposals)
      // Terminal delegate means you haven't delegated your vote away
      const terminalDelegate = await getTerminalDelegate(provider, chainId, userAddress, selectedTopicId);
      canCreateProposals = terminalDelegate.toLowerCase() === userAddress.toLowerCase();

      console.log('Terminal delegate:', terminalDelegate);
      console.log('User address:', userAddress);
      console.log('Can create proposals:', canCreateProposals);
    } catch (e: any) {
      console.error('Error loading delegation:', e);
    }
  }

  async function loadGraph() {
    if (!selectedTopicId || !chainId) return;

    try {
      loadingGraph = true;
      // Use the signer from walletStore for read operations (graph data)
      graphData = await fetchDelegationGraph($walletStore.signer, chainId, selectedTopicId, userAddress);
    } catch (e: any) {
      console.error('Error loading graph:', e);
    } finally {
      loadingGraph = false;
    }
  }

  async function loadProposals() {
    if (selectedTopicId === null || !provider || !chainId) return;

    try {
      loadingProposals = true;
      proposals = await getProposalsByTopic(provider, chainId, selectedTopicId);
      console.log('Loaded proposals:', proposals);

      // Check voting status and power for each proposal
      if (userAddress) {
        votedProposals = new Set();
        votingPowers = new Map();

        for (const proposal of proposals) {
          // Check if user has voted
          const voted = await hasVoted(provider, chainId, proposal.id, userAddress);
          if (voted) {
            votedProposals.add(proposal.id);
          }

          // Get voting power for this proposal from contract
          let power = await getVotingPower(provider, chainId, proposal.id, userAddress);

          // Fallback: If power is 1 (default) and we have graph data with actual power > 1, use that
          if (power === 1 && graphData?.terminalDelegates) {
            const graphPower = graphData.terminalDelegates.get(userAddress.toLowerCase()) ||
                              graphData.terminalDelegates.get(userAddress);
            if (graphPower && graphPower > 1) {
              console.log(`Using graph voting power ${graphPower} instead of contract default ${power}`);
              power = graphPower;
            }
          }

          votingPowers.set(proposal.id, power);
        }

        // Trigger reactivity
        votedProposals = votedProposals;
        votingPowers = votingPowers;
      }
    } catch (e: any) {
      console.error('Error loading proposals:', e);
      proposals = [];
    } finally {
      loadingProposals = false;
    }
  }

  function handleTopicSelect(topicId: number) {
    selectedTopicId = topicId;
    delegationSuccess = null;
    delegationError = null;
  }

  function handleAddressChanged(event: CustomEvent) {
    delegateAddress = event.detail.address;
    delegationError = null;
  }

  async function handleDelegate() {
    if (!selectedTopicId || !delegateAddress || !chainId) {
      delegationError = 'Missing required information';
      return;
    }

    delegating = true;
    delegationError = null;
    delegationSuccess = null;

    try {
      // Get fresh signer to ensure it matches current MetaMask account
      const freshSigner = await getFreshSigner();

      const txHash = await delegate(freshSigner, chainId, selectedTopicId, delegateAddress);
      delegationSuccess = `Delegation successful! TX: ${txHash.slice(0, 10)}...`;

      // Reload delegation and graph
      await loadCurrentDelegation();
      await loadGraph();
      delegateAddress = null;
    } catch (e: any) {
      delegationError = e.message || 'Failed to delegate vote';
      console.error('Delegation error:', e);
    } finally {
      delegating = false;
    }
  }

  async function handleRevoke() {
    if (!selectedTopicId || !chainId) {
      delegationError = 'Missing required information';
      return;
    }

    delegating = true;
    delegationError = null;
    delegationSuccess = null;

    try {
      // Get fresh signer to ensure it matches current MetaMask account
      const freshSigner = await getFreshSigner();

      const txHash = await revoke(freshSigner, chainId, selectedTopicId);
      delegationSuccess = `Delegation revoked! TX: ${txHash.slice(0, 10)}...`;

      // Reload delegation and graph
      await loadCurrentDelegation();
      await loadGraph();
    } catch (e: any) {
      delegationError = e.message || 'Failed to revoke delegation';
      console.error('Revoke error:', e);
    } finally {
      delegating = false;
    }
  }

  function openProposalModal() {
    showProposalModal = true;
    proposalTitle = '';
    proposalDescription = '';
    proposalError = null;
  }

  function closeProposalModal() {
    showProposalModal = false;
  }

  async function handleCreateProposal() {
    if (!proposalTitle || !proposalDescription) {
      proposalError = 'Please fill in all fields';
      return;
    }

    if (selectedTopicId === null) {
      proposalError = 'Please select a topic';
      return;
    }

    if (!canCreateProposals) {
      proposalError = 'You cannot create proposals because you have delegated your vote. Revoke your delegation first.';
      return;
    }

    creatingProposal = true;
    proposalError = null;

    try {
      if (!chainId) {
        throw new Error('Wallet not connected');
      }

      // Get fresh signer to ensure it matches current MetaMask account
      const freshSigner = await getFreshSigner();

      // Double-check terminal delegate status before sending transaction
      const terminalDelegate = await getTerminalDelegate(provider, chainId, userAddress, selectedTopicId);
      if (terminalDelegate.toLowerCase() !== userAddress.toLowerCase()) {
        throw new Error('You have delegated your vote and cannot create proposals. Please revoke your delegation first.');
      }

      // Create a hash of the description as a pseudo-CID
      // In production, this should upload to IPFS and get a real CID
      const descriptionBytes = ethers.toUtf8Bytes(proposalDescription);
      const descriptionHash = ethers.keccak256(descriptionBytes);
      const descriptionCID = descriptionHash.slice(2, 50); // Use first 48 chars as pseudo-CID

      // Default voting period: 7 days (50400 blocks on Gnosis at 12s/block)
      const votingPeriod = 50400;

      console.log('Creating proposal on blockchain:', {
        topicId: selectedTopicId,
        topicName: selectedTopic?.name,
        title: proposalTitle,
        descriptionCID,
        votingPeriod,
        availableTopics: topics.map(t => ({ id: t.id, name: t.name, active: t.active }))
      });

      const result = await createProposal(
        freshSigner,
        chainId,
        selectedTopicId,
        proposalTitle,
        descriptionCID,
        votingPeriod
      );

      console.log('Proposal created successfully:', result);

      closeProposalModal();
      delegationSuccess = `Proposal created successfully! ID: ${result.proposalId}`;

      // Reload proposals for this topic
      await loadProposals();

    } catch (e: any) {
      console.error('Failed to create proposal:', e);

      // Parse error message
      let errorMessage = 'Failed to create proposal';

      if (e.message) {
        // Error selectors
        const errorCodes: Record<string, string> = {
          '0x69585f99': 'Invalid topic selected. Please refresh the page and try again.',
          '0xcabeb655': 'You have delegated your vote and cannot create proposals. Please revoke your delegation first.',
          '0x05a612e3': 'Invalid voting period',
        };

        // Check for error codes
        for (const [code, message] of Object.entries(errorCodes)) {
          if (e.message.includes(code)) {
            errorMessage = message;
            break;
          }
        }

        // Check for error names
        if (e.message.includes('InsufficientVotingPower')) {
          errorMessage = 'You have delegated your vote and cannot create proposals. Please revoke your delegation first.';
        } else if (e.message.includes('InvalidTopic')) {
          errorMessage = 'Invalid topic selected. Please refresh the page and try again.';
        } else if (e.message.includes('InvalidVotingPeriod')) {
          errorMessage = 'Invalid voting period';
        } else if (e.message.includes('user rejected')) {
          errorMessage = 'Transaction was rejected';
        } else if (errorMessage === 'Failed to create proposal') {
          // If no specific error matched, use the original message
          errorMessage = e.message;
        }
      }

      proposalError = errorMessage;
    } finally {
      creatingProposal = false;
    }
  }

  async function handleVote(proposalId: number, choice: VoteChoice) {
    if (!chainId) {
      delegationError = 'Wallet not connected';
      return;
    }

    if (currentDelegation) {
      delegationError = 'You have delegated your vote. Revoke delegation to vote directly.';
      return;
    }

    votingOnProposal = proposalId;
    delegationError = null;
    delegationSuccess = null;

    try {
      // Get fresh signer to ensure it matches current MetaMask account
      const freshSigner = await getFreshSigner();

      const txHash = await castVote(freshSigner, chainId, proposalId, choice);

      const choiceLabel = choice === VoteChoice.For ? 'For' : choice === VoteChoice.Against ? 'Against' : 'Abstain';
      delegationSuccess = `Vote cast successfully (${choiceLabel})! TX: ${txHash.slice(0, 10)}...`;

      // Reload proposals to update vote counts
      await loadProposals();
    } catch (e: any) {
      console.error('Failed to vote:', e);
      delegationError = e.message || 'Failed to cast vote';
    } finally {
      votingOnProposal = null;
    }
  }

  // Reactive statement for selected topic
  $: selectedTopic = topics.find(t => t.id === selectedTopicId);

  function getSelectedTopic() {
    return selectedTopic;
  }
</script>

<div class="dashboard">
  {#if !connected}
    <div class="connect-prompt">
      <h2>Connect Your Wallet</h2>
      <p>Please connect your wallet to view topics and participate in governance</p>
    </div>
  {:else if loading}
    <div class="loading">Loading topics...</div>
  {:else if error}
    <div class="error">{error}</div>
  {:else}
    <!-- Horizontal Topic Tabs -->
    <div class="topic-tabs">
      <div class="tabs-scroll">
        {#each topics as topic (topic.id)}
          <button
            class="topic-tab"
            class:active={selectedTopicId === topic.id}
            on:click={() => handleTopicSelect(topic.id)}
          >
            {topic.name}
          </button>
        {/each}
      </div>
    </div>

    <!-- Unified Content Grid -->
    <div class="content-grid">
      <!-- Left Column: Proposals -->
      <div class="proposals-section">
        <div class="section-header">
          <h3>📋 {selectedTopic?.name || 'Proposals'}</h3>
          {#if canCreateProposals}
            <button class="create-btn" on:click={openProposalModal}>
              + Create Proposal
            </button>
          {/if}
        </div>

        <div class="proposals-list">
          {#if loadingProposals}
            <div class="loading-proposals">
              <p>Loading proposals...</p>
            </div>
          {:else if proposals.length === 0}
            <div class="no-proposals">
              <p>No proposals yet for {selectedTopic?.name || 'this topic'}</p>
              {#if canCreateProposals}
                <button class="create-btn-large" on:click={openProposalModal}>
                  + Create First Proposal
                </button>
              {:else}
                <p class="hint">You need voting power to create proposals. Don't delegate to create proposals yourself.</p>
              {/if}
            </div>
          {:else}
            {#each proposals as proposal (proposal.id)}
              <div class="proposal-card">
                <div class="proposal-header">
                  <h4>{proposal.title}</h4>
                  <span class="status-badge status-{proposal.status}">
                    {getStatusLabel(proposal.status)}
                  </span>
                </div>
                <div class="proposal-meta">
                  <span class="proposal-id">#{proposal.id}</span>
                  <span class="proposal-proposer">
                    by {proposal.proposer.slice(0, 6)}...{proposal.proposer.slice(-4)}
                  </span>
                </div>
                <div class="proposal-votes">
                  <div class="vote-bar">
                    <div class="vote-stat for">
                      <span class="vote-label">For</span>
                      <span class="vote-count">{proposal.forVotes}</span>
                    </div>
                    <div class="vote-stat against">
                      <span class="vote-label">Against</span>
                      <span class="vote-count">{proposal.againstVotes}</span>
                    </div>
                    <div class="vote-stat abstain">
                      <span class="vote-label">Abstain</span>
                      <span class="vote-count">{proposal.abstainVotes}</span>
                    </div>
                  </div>
                </div>
                <div class="proposal-blocks">
                  <span>Blocks: {proposal.startBlock} → {proposal.endBlock}</span>
                </div>

                <!-- Voting Section -->
                {#if proposal.status === ProposalStatus.Active}
                  <div class="proposal-actions">
                    {#if votedProposals.has(proposal.id)}
                      <div class="voted-message">
                        ✓ You have already voted on this proposal
                      </div>
                    {:else if currentDelegation}
                      <div class="delegation-notice">
                        <span class="icon">⚠️</span>
                        <span>You delegated your vote. <button class="link-btn" on:click={handleRevoke}>Revoke delegation</button> to vote directly.</span>
                      </div>
                    {:else}
                      <div class="vote-buttons">
                        <div class="vote-power-label">
                          Your voting power: <strong>{votingPowers.get(proposal.id) || 0}</strong>
                        </div>
                        <div class="vote-btn-group">
                          <button
                            class="vote-btn for"
                            on:click={() => handleVote(proposal.id, VoteChoice.For)}
                            disabled={votingOnProposal === proposal.id}
                          >
                            {votingOnProposal === proposal.id ? '...' : '✓ For'}
                          </button>
                          <button
                            class="vote-btn against"
                            on:click={() => handleVote(proposal.id, VoteChoice.Against)}
                            disabled={votingOnProposal === proposal.id}
                          >
                            {votingOnProposal === proposal.id ? '...' : '✗ Against'}
                          </button>
                          <button
                            class="vote-btn abstain"
                            on:click={() => handleVote(proposal.id, VoteChoice.Abstain)}
                            disabled={votingOnProposal === proposal.id}
                          >
                            {votingOnProposal === proposal.id ? '...' : '○ Abstain'}
                          </button>
                        </div>
                      </div>
                    {/if}
                  </div>
                {/if}
              </div>
            {/each}
          {/if}
        </div>
      </div>

      <!-- Right Column: Delegation & Graph -->
      <div class="side-column">
        <!-- Delegation Card -->
        <div class="delegation-card">
          <h3>🤝 {selectedTopic?.name || 'Delegation'}</h3>

          {#if currentDelegation}
            <div class="current-delegation">
              <p class="delegation-status">✓ Currently Delegated</p>
              <p class="delegation-label">Delegated to:</p>
              <p class="delegation-address">{currentDelegation.delegate.slice(0, 10)}...{currentDelegation.delegate.slice(-8)}</p>
              <button class="revoke-btn-small" on:click={handleRevoke} disabled={delegating}>
                {delegating ? 'Revoking...' : 'Revoke'}
              </button>
            </div>
          {:else}
            <div class="delegation-form-compact">
              <DelegateInput
                {userAddress}
                {provider}
                on:addressChanged={handleAddressChanged}
              />
              <button
                class="delegate-btn-small"
                on:click={handleDelegate}
                disabled={!delegateAddress || delegating}
              >
                {delegating ? 'Delegating...' : 'Delegate'}
              </button>
            </div>
          {/if}

          {#if delegationSuccess}
            <div class="success-message-small">{delegationSuccess}</div>
          {/if}

          {#if delegationError}
            <div class="error-message-small">{delegationError}</div>
          {/if}
        </div>

        <!-- Graph Card -->
        <div class="graph-card">
          {#if loadingGraph}
            <div class="graph-loading">Loading graph...</div>
          {:else if graphData && graphData.nodes.length > 0}
            <DelegationGraph
              graphData={graphData}
              width={360}
              height={280}
              compact={true}
              topicName={selectedTopic?.name}
            />
          {:else}
            <div class="no-graph">
              <p>No delegations yet</p>
              <p class="hint-small">Delegate your vote to see the network</p>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>

<!-- Proposal Creation Modal -->
{#if showProposalModal}
  <div class="modal-overlay" on:click={closeProposalModal}>
    <div class="modal" on:click|stopPropagation>
      <div class="modal-header">
        <h2>Create Proposal</h2>
        <button class="modal-close" on:click={closeProposalModal}>×</button>
      </div>

      <div class="modal-body">
        <p class="modal-subtitle">Topic: {selectedTopic?.name || ''}</p>

        <div class="form-group">
          <label for="proposal-title">Proposal Title</label>
          <input
            id="proposal-title"
            type="text"
            bind:value={proposalTitle}
            placeholder="Enter a clear, concise title"
            maxlength="100"
          />
        </div>

        <div class="form-group">
          <label for="proposal-description">Description</label>
          <textarea
            id="proposal-description"
            bind:value={proposalDescription}
            placeholder="Describe your proposal in detail..."
            rows="6"
          />
        </div>

        {#if proposalError}
          <div class="error-message">{proposalError}</div>
        {/if}

        <div class="modal-actions">
          <button class="btn-cancel" on:click={closeProposalModal}>
            Cancel
          </button>
          <button
            class="btn-create"
            on:click={handleCreateProposal}
            disabled={creatingProposal || !proposalTitle || !proposalDescription}
          >
            {creatingProposal ? 'Creating...' : 'Create Proposal'}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .dashboard {
    max-width: 1600px;
    margin: 0 auto;
    padding: 1.5rem;
  }

  .connect-prompt {
    text-align: center;
    padding: 4rem 2rem;
    background: #1f2937;
    border-radius: 12px;
    border: 1px solid #374151;
  }

  .connect-prompt h2 {
    color: #f3f4f6;
    margin-bottom: 1rem;
  }

  .connect-prompt p {
    color: #9ca3af;
  }

  .loading,
  .error {
    text-align: center;
    padding: 2rem;
    color: #9ca3af;
  }

  .error {
    color: #fca5a5;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid #ef4444;
    border-radius: 8px;
  }

  /* Topic Tabs */
  .topic-tabs {
    margin-bottom: 1.5rem;
    overflow-x: auto;
    scrollbar-width: thin;
    scrollbar-color: #4f46e5 #1f2937;
  }

  .tabs-scroll {
    display: flex;
    gap: 0.5rem;
    min-width: min-content;
    padding-bottom: 0.5rem;
  }

  .topic-tab {
    padding: 0.75rem 1.5rem;
    background: #1f2937;
    border: 1px solid #374151;
    border-radius: 8px;
    color: #d1d5db;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s ease;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .topic-tab:hover {
    border-color: #6366f1;
    color: #818cf8;
    box-shadow: 0 0 15px rgba(99, 102, 241, 0.2);
  }

  .topic-tab.active {
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    border-color: #6366f1;
    color: white;
    box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4);
  }

  /* Content Grid */
  .content-grid {
    display: grid;
    grid-template-columns: 1fr 400px;
    gap: 1.5rem;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    overflow: hidden;
  }

  /* Proposals Section */
  .proposals-section {
    background: #1f2937;
    border-radius: 12px;
    padding: 1.5rem;
    border: 1px solid #374151;
    min-height: 600px;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    overflow: hidden;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid #374151;
  }

  .section-header h3 {
    margin: 0;
    color: #f3f4f6;
    font-size: 1.25rem;
  }

  .create-btn {
    padding: 0.6rem 1.25rem;
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 2px 10px rgba(99, 102, 241, 0.3);
  }

  .create-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 15px rgba(99, 102, 241, 0.5);
  }

  .proposals-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .loading-proposals {
    text-align: center;
    padding: 2rem;
    color: #9ca3af;
  }

  .no-proposals {
    text-align: center;
    padding: 3rem 2rem;
    background: #111827;
    border-radius: 8px;
    border: 1px dashed #374151;
  }

  .no-proposals p {
    color: #9ca3af;
    margin: 0 0 1.5rem 0;
  }

  .no-proposals .hint {
    font-size: 0.9rem;
    color: #6b7280;
    font-style: italic;
  }

  .proposal-card {
    background: #111827;
    border: 1px solid #374151;
    border-radius: 8px;
    padding: 1.25rem;
    transition: all 0.3s ease;
  }

  .proposal-card:hover {
    border-color: #4f46e5;
    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.2);
  }

  .proposal-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 0.75rem;
    gap: 1rem;
  }

  .proposal-header h4 {
    margin: 0;
    color: #f3f4f6;
    font-size: 1.1rem;
    font-weight: 600;
    flex: 1;
  }

  .status-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .status-badge.status-0 { /* Pending */
    background: rgba(156, 163, 175, 0.2);
    color: #9ca3af;
  }

  .status-badge.status-1 { /* Active */
    background: rgba(34, 197, 94, 0.2);
    color: #6ee7b7;
  }

  .status-badge.status-2 { /* Succeeded */
    background: rgba(59, 130, 246, 0.2);
    color: #93c5fd;
  }

  .status-badge.status-3 { /* Failed */
    background: rgba(239, 68, 68, 0.2);
    color: #fca5a5;
  }

  .status-badge.status-4 { /* Executed */
    background: rgba(168, 85, 247, 0.2);
    color: #c4b5fd;
  }

  .status-badge.status-5 { /* Cancelled */
    background: rgba(107, 114, 128, 0.2);
    color: #9ca3af;
  }

  .proposal-meta {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
    font-size: 0.85rem;
    color: #9ca3af;
  }

  .proposal-id {
    font-weight: 600;
    color: #818cf8;
  }

  .proposal-proposer {
    font-family: 'Monaco', 'Courier New', monospace;
  }

  .proposal-votes {
    margin-bottom: 0.75rem;
  }

  .vote-bar {
    display: flex;
    gap: 1rem;
    padding: 0.75rem;
    background: #1f2937;
    border-radius: 6px;
  }

  .vote-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    flex: 1;
  }

  .vote-label {
    font-size: 0.75rem;
    text-transform: uppercase;
    font-weight: 600;
  }

  .vote-count {
    font-size: 1.25rem;
    font-weight: 700;
  }

  .vote-stat.for .vote-label {
    color: #6ee7b7;
  }

  .vote-stat.for .vote-count {
    color: #10b981;
  }

  .vote-stat.against .vote-label {
    color: #fca5a5;
  }

  .vote-stat.against .vote-count {
    color: #ef4444;
  }

  .vote-stat.abstain .vote-label {
    color: #9ca3af;
  }

  .vote-stat.abstain .vote-count {
    color: #6b7280;
  }

  .proposal-blocks {
    font-size: 0.8rem;
    color: #6b7280;
    font-family: 'Monaco', 'Courier New', monospace;
    margin-bottom: 1rem;
  }

  .proposal-actions {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #374151;
  }

  .voted-message {
    padding: 0.75rem;
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid #10b981;
    border-radius: 6px;
    color: #6ee7b7;
    text-align: center;
    font-weight: 500;
  }

  .delegation-notice {
    padding: 0.75rem;
    background: rgba(251, 191, 36, 0.1);
    border: 1px solid #f59e0b;
    border-radius: 6px;
    color: #fbbf24;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
  }

  .delegation-notice .icon {
    font-size: 1.1rem;
  }

  .link-btn {
    background: none;
    border: none;
    color: #818cf8;
    text-decoration: underline;
    cursor: pointer;
    padding: 0;
    font-size: inherit;
    font-weight: 600;
  }

  .link-btn:hover {
    color: #a5b4fc;
  }

  .vote-buttons {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .vote-power-label {
    font-size: 0.9rem;
    color: #9ca3af;
    text-align: center;
  }

  .vote-power-label strong {
    color: #818cf8;
    font-size: 1.1rem;
  }

  .vote-btn-group {
    display: flex;
    gap: 0.5rem;
  }

  .vote-btn {
    flex: 1;
    padding: 0.75rem;
    border: 1px solid;
    border-radius: 6px;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .vote-btn.for {
    background: rgba(16, 185, 129, 0.1);
    border-color: #10b981;
    color: #6ee7b7;
  }

  .vote-btn.for:hover:not(:disabled) {
    background: rgba(16, 185, 129, 0.2);
    transform: translateY(-1px);
  }

  .vote-btn.against {
    background: rgba(239, 68, 68, 0.1);
    border-color: #ef4444;
    color: #fca5a5;
  }

  .vote-btn.against:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.2);
    transform: translateY(-1px);
  }

  .vote-btn.abstain {
    background: rgba(156, 163, 175, 0.1);
    border-color: #9ca3af;
    color: #d1d5db;
  }

  .vote-btn.abstain:hover:not(:disabled) {
    background: rgba(156, 163, 175, 0.2);
    transform: translateY(-1px);
  }

  .vote-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .create-btn-large {
    padding: 1rem 2rem;
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4);
  }

  .create-btn-large:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 25px rgba(99, 102, 241, 0.6);
  }

  /* Side Column */
  .side-column {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    min-width: 0;
    overflow: hidden;
  }

  .delegation-card,
  .graph-card {
    background: #1f2937;
    border-radius: 12px;
    padding: 1.5rem;
    border: 1px solid #374151;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    overflow: hidden;
  }

  .delegation-card h3,
  .graph-card h3 {
    margin: 0 0 1rem 0;
    color: #f3f4f6;
    font-size: 1.1rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid #374151;
  }

  /* Delegation */
  .current-delegation {
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid #10b981;
    border-radius: 6px;
    padding: 1rem;
  }

  .delegation-status {
    color: #6ee7b7;
    font-weight: 600;
    margin: 0 0 0.75rem 0;
  }

  .delegation-label {
    color: #9ca3af;
    font-size: 0.85rem;
    margin: 0;
  }

  .delegation-address {
    font-family: 'Monaco', 'Courier New', monospace;
    font-size: 0.85rem;
    color: #d1d5db;
    margin: 0.25rem 0 1rem 0;
  }

  .delegation-form-compact {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
  }

  .delegate-btn-small,
  .revoke-btn-small {
    width: 100%;
    padding: 0.75rem 1.5rem;
    font-size: 0.9rem;
    font-weight: 600;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .delegate-btn-small {
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    color: white;
    box-shadow: 0 2px 10px rgba(99, 102, 241, 0.3);
  }

  .delegate-btn-small:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 15px rgba(99, 102, 241, 0.5);
  }

  .delegate-btn-small:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .revoke-btn-small {
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    color: white;
    box-shadow: 0 2px 10px rgba(239, 68, 68, 0.3);
  }

  .revoke-btn-small:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 15px rgba(239, 68, 68, 0.5);
  }

  .revoke-btn-small:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .success-message-small,
  .error-message-small {
    padding: 0.75rem;
    border-radius: 6px;
    margin-top: 0.75rem;
    font-size: 0.85rem;
    font-weight: 500;
  }

  .success-message-small {
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid #10b981;
    color: #6ee7b7;
  }

  .error-message-small {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid #ef4444;
    color: #fca5a5;
  }

  /* Graph */
  .graph-loading,
  .no-graph {
    text-align: center;
    padding: 2rem 1rem;
    background: #111827;
    border-radius: 6px;
    border: 1px dashed #374151;
  }

  .graph-loading {
    color: #9ca3af;
  }

  .no-graph p {
    color: #9ca3af;
    margin: 0.25rem 0;
    font-size: 0.9rem;
  }

  .hint-small {
    font-size: 0.8rem;
    color: #6b7280;
  }

  /* Modal */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(4px);
  }

  .modal {
    background: #1f2937;
    border-radius: 12px;
    border: 1px solid #374151;
    max-width: 600px;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 10px 50px rgba(0, 0, 0, 0.5);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #374151;
  }

  .modal-header h2 {
    margin: 0;
    color: #f3f4f6;
    font-size: 1.5rem;
  }

  .modal-close {
    background: none;
    border: none;
    color: #9ca3af;
    font-size: 2rem;
    cursor: pointer;
    transition: color 0.2s;
    padding: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .modal-close:hover {
    color: #f3f4f6;
  }

  .modal-body {
    padding: 1.5rem;
  }

  .modal-subtitle {
    color: #818cf8;
    margin: 0 0 1.5rem 0;
    font-weight: 500;
  }

  .form-group {
    margin-bottom: 1.25rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    color: #d1d5db;
    font-weight: 500;
    font-size: 0.95rem;
  }

  .form-group input,
  .form-group textarea {
    width: 100%;
    padding: 0.75rem;
    background: #111827;
    border: 1px solid #374151;
    border-radius: 6px;
    color: #e5e7eb;
    font-size: 0.95rem;
    transition: all 0.3s ease;
    font-family: inherit;
  }

  .form-group input::placeholder,
  .form-group textarea::placeholder {
    color: #6b7280;
  }

  .form-group input:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
  }

  .form-group textarea {
    resize: vertical;
    min-height: 120px;
  }

  .modal-actions {
    display: flex;
    gap: 1rem;
    margin-top: 1.5rem;
  }

  .btn-cancel,
  .btn-create {
    flex: 1;
    padding: 0.875rem 1.5rem;
    font-size: 1rem;
    font-weight: 600;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .btn-cancel {
    background: #374151;
    color: #d1d5db;
  }

  .btn-cancel:hover {
    background: #4b5563;
  }

  .btn-create {
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    color: white;
    box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);
  }

  .btn-create:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(99, 102, 241, 0.6);
  }

  .btn-create:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .error-message {
    padding: 0.75rem;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid #ef4444;
    border-radius: 6px;
    color: #fca5a5;
    font-size: 0.9rem;
    margin-bottom: 1rem;
  }

  @media (max-width: 1024px) {
    .content-grid {
      grid-template-columns: 1fr;
    }

    .side-column {
      order: -1;
    }
  }

  @media (max-width: 768px) {
    .dashboard {
      padding: 1rem;
    }

    .topic-tab {
      font-size: 0.85rem;
      padding: 0.6rem 1rem;
    }

    .proposals-section {
      padding: 1rem;
    }

    .section-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 1rem;
    }

    .create-btn {
      width: 100%;
    }
  }
</style>
