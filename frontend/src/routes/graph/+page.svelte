<script lang="ts">
  import { onMount } from 'svelte';
  import { walletStore } from '$lib/web3/walletConnect';
  import { getAllTopics } from '$lib/contracts/topicRegistry';
  import { fetchDelegationGraph } from '$lib/services/graphData';
  import DelegationGraph from '$lib/components/DelegationGraph.svelte';
  import type { DelegationGraphData } from '$lib/services/graphData';

  let topics: any[] = [];
  let selectedTopicId = 1;
  let graphData: DelegationGraphData | null = null;
  let filteredGraphData: DelegationGraphData | null = null;
  let loading = false;
  let error: string | null = null;
  let searchQuery = '';
  let filterMode: 'all' | 'terminal' | 'delegating' = 'all';
  let minPower = 0;

  $: signer = $walletStore.signer;
  $: chainId = $walletStore.chainId;
  $: userAddress = $walletStore.address;

  onMount(async () => {
    await loadTopics();
    await loadGraph();
  });

  async function loadTopics() {
    if (!signer || !chainId) return;

    try {
      topics = await getAllTopics(signer, chainId);
    } catch (e: any) {
      console.error('Error loading topics:', e);
      error = e.message || 'Failed to load topics';
    }
  }

  async function loadGraph() {
    if (!signer || !chainId) {
      error = 'Please connect your wallet';
      return;
    }

    loading = true;
    error = null;

    try {
      graphData = await fetchDelegationGraph(signer, chainId, selectedTopicId, userAddress);

      if (graphData.nodes.length === 0) {
        error = 'No delegations found for this topic yet. Create some delegations to see the graph!';
      }
    } catch (e: any) {
      console.error('Error loading graph:', e);
      error = e.message || 'Failed to load delegation graph';
    } finally {
      loading = false;
    }
  }

  async function handleTopicChange() {
    await loadGraph();
  }

  // Filter and search functionality
  $: {
    if (graphData) {
      let nodes = graphData.nodes;
      let edges = graphData.edges;

      // Apply search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchingAddresses = new Set(
          nodes
            .filter(n =>
              n.address.toLowerCase().includes(query) ||
              n.label.toLowerCase().includes(query)
            )
            .map(n => n.address.toLowerCase())
        );

        nodes = nodes.filter(n => matchingAddresses.has(n.address.toLowerCase()));
        edges = edges.filter(e =>
          matchingAddresses.has(e.source.toString().toLowerCase()) ||
          matchingAddresses.has(e.target.toString().toLowerCase())
        );
      }

      // Apply power filter
      if (minPower > 0) {
        const terminalAddresses = new Set(
          nodes
            .filter(n => n.votingPower >= minPower)
            .map(n => n.address.toLowerCase())
        );

        // Include nodes in delegation chains leading to filtered terminals
        const relevantNodes = new Set<string>();
        edges.forEach(edge => {
          const target = typeof edge.target === 'string' ? edge.target : edge.target.id || '';
          if (terminalAddresses.has(target.toLowerCase())) {
            relevantNodes.add(edge.source.toString().toLowerCase());
            relevantNodes.add(target.toLowerCase());
          }
        });

        nodes = nodes.filter(n =>
          relevantNodes.has(n.address.toLowerCase()) ||
          terminalAddresses.has(n.address.toLowerCase())
        );
        edges = edges.filter(e =>
          relevantNodes.has(e.source.toString().toLowerCase()) &&
          relevantNodes.has(e.target.toString().toLowerCase())
        );
      }

      // Apply node type filter
      if (filterMode === 'terminal') {
        nodes = nodes.filter(n => n.isTerminal && n.votingPower > 0);
        edges = edges.filter(e => {
          const sourceAddr = e.source.toString();
          const targetAddr = e.target.toString();
          return nodes.some(n => n.address === sourceAddr) &&
                 nodes.some(n => n.address === targetAddr);
        });
      } else if (filterMode === 'delegating') {
        nodes = nodes.filter(n => n.isDelegating);
        edges = edges.filter(e => {
          const sourceAddr = e.source.toString();
          const targetAddr = e.target.toString();
          return nodes.some(n => n.address === sourceAddr) &&
                 nodes.some(n => n.address === targetAddr);
        });
      }

      filteredGraphData = {
        ...graphData,
        nodes,
        edges
      };
    } else {
      filteredGraphData = null;
    }
  }

  function resetFilters() {
    searchQuery = '';
    filterMode = 'all';
    minPower = 0;
  }
</script>

<div class="graph-page">
  <header class="page-header">
    <h1>🕸️ Delegation Graph</h1>
    <p class="subtitle">Visualize how voting power flows through delegation chains</p>
  </header>

  {#if !signer}
    <div class="wallet-warning">
      <p>⚠️ Please connect your wallet to view the delegation graph</p>
    </div>
  {:else}
    <div class="controls">
      <div class="control-group">
        <label for="topic-select">Select Topic:</label>
        <select
          id="topic-select"
          bind:value={selectedTopicId}
          on:change={handleTopicChange}
        >
          {#each topics as topic}
            <option value={topic.id}>{topic.name}</option>
          {/each}
        </select>
      </div>

      <button class="refresh-btn" on:click={loadGraph} disabled={loading}>
        {loading ? '🔄 Loading...' : '🔄 Refresh Graph'}
      </button>
    </div>

    <!-- Search and Filter Controls -->
    {#if graphData && graphData.nodes.length > 0}
      <div class="filter-section">
        <div class="filter-header">
          <h3>🔍 Search & Filter</h3>
          <button class="reset-btn" on:click={resetFilters}>Reset All</button>
        </div>

        <div class="filter-controls">
          <div class="filter-row">
            <div class="filter-group">
              <label for="search-input">Search Address:</label>
              <input
                id="search-input"
                type="text"
                bind:value={searchQuery}
                placeholder="0x... or partial address"
                class="search-input"
              />
            </div>

            <div class="filter-group">
              <label for="filter-mode">Node Type:</label>
              <select id="filter-mode" bind:value={filterMode} class="filter-select">
                <option value="all">All Nodes</option>
                <option value="terminal">Terminal Delegates Only</option>
                <option value="delegating">Delegating Nodes Only</option>
              </select>
            </div>

            <div class="filter-group">
              <label for="min-power">Min Voting Power:</label>
              <input
                id="min-power"
                type="number"
                bind:value={minPower}
                min="0"
                class="power-input"
              />
            </div>
          </div>

          <div class="filter-info">
            {#if searchQuery || filterMode !== 'all' || minPower > 0}
              <p class="active-filters">
                Showing {filteredGraphData?.nodes.length || 0} of {graphData.nodes.length} nodes
                {#if searchQuery}
                  • Search: "{searchQuery}"
                {/if}
                {#if filterMode !== 'all'}
                  • Type: {filterMode}
                {/if}
                {#if minPower > 0}
                  • Power ≥ {minPower}
                {/if}
              </p>
            {/if}
          </div>
        </div>
      </div>
    {/if}

    {#if error}
      <div class="error-box">
        <p>{error}</p>
      </div>
    {/if}

    {#if loading}
      <div class="loading-box">
        <div class="spinner"></div>
        <p>Loading delegation graph...</p>
      </div>
    {:else if filteredGraphData && filteredGraphData.nodes.length > 0}
      <DelegationGraph graphData={filteredGraphData} width={900} height={700} />
    {:else if graphData && graphData.nodes.length > 0}
      <div class="no-results">
        <p>No nodes match your filters. Try adjusting your search criteria.</p>
        <button class="reset-btn" on:click={resetFilters}>Reset Filters</button>
      </div>

      <div class="graph-info">
        <h3>Understanding the Graph</h3>
        <div class="info-grid">
          <div class="info-card">
            <h4>🟢 Terminal Delegates</h4>
            <p>Green nodes with ⚡ power badges. These addresses can vote on proposals with accumulated power from their delegators.</p>
          </div>
          <div class="info-card">
            <h4>🔵 Delegating Nodes</h4>
            <p>Blue nodes that have delegated their vote to someone else. They cannot vote directly until they revoke their delegation.</p>
          </div>
          <div class="info-card">
            <h4>🟠 Your Address</h4>
            <p>Orange node representing your connected wallet. Click it to see your delegation path.</p>
          </div>
          <div class="info-card">
            <h4>➡️ Delegation Arrows</h4>
            <p>Arrows show the direction of vote delegation. Follow the arrows to see where votes flow.</p>
          </div>
        </div>

        <div class="info-note">
          <p><strong>💡 Pro Tip:</strong> Node size represents voting power. Larger nodes have more accumulated votes from delegations!</p>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .graph-page {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
  }

  .page-header {
    text-align: center;
    margin-bottom: 30px;
  }

  .page-header h1 {
    font-size: 32px;
    color: #f3f4f6;
    margin: 0 0 10px 0;
    text-shadow: 0 0 20px rgba(129, 140, 248, 0.3);
  }

  .subtitle {
    color: #9ca3af;
    font-size: 16px;
    margin: 0;
  }

  .wallet-warning {
    background: rgba(251, 191, 36, 0.1);
    border: 1px solid #f59e0b;
    border-radius: 8px;
    padding: 20px;
    text-align: center;
    margin: 20px 0;
    backdrop-filter: blur(10px);
  }

  .wallet-warning p {
    margin: 0;
    color: #fbbf24;
    font-size: 16px;
  }

  .controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    gap: 15px;
    flex-wrap: wrap;
  }

  .control-group {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .control-group label {
    font-weight: 600;
    color: #d1d5db;
    font-size: 14px;
  }

  .control-group select {
    padding: 8px 12px;
    border: 1px solid #374151;
    border-radius: 6px;
    font-size: 14px;
    background: #1f2937;
    color: #e5e7eb;
    cursor: pointer;
    min-width: 200px;
    transition: all 0.3s ease;
  }

  .control-group select:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
  }

  .refresh-btn {
    padding: 8px 16px;
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 2px 10px rgba(99, 102, 241, 0.3);
  }

  .refresh-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 15px rgba(99, 102, 241, 0.5);
  }

  .refresh-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .error-box {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid #ef4444;
    border-radius: 8px;
    padding: 15px;
    margin-bottom: 20px;
    backdrop-filter: blur(10px);
  }

  .error-box p {
    margin: 0;
    color: #fca5a5;
    font-size: 14px;
  }

  .loading-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    background: #1f2937;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    border: 1px solid #374151;
  }

  .spinner {
    border: 4px solid #374151;
    border-top: 4px solid #6366f1;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    animation: spin 1s linear infinite;
    margin-bottom: 15px;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .loading-box p {
    color: #9ca3af;
    font-size: 14px;
    margin: 0;
  }

  .graph-info {
    margin-top: 30px;
    padding: 20px;
    background: #1f2937;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    border: 1px solid #374151;
  }

  .graph-info h3 {
    margin: 0 0 20px 0;
    color: #f3f4f6;
    font-size: 20px;
  }

  .info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 15px;
    margin-bottom: 20px;
  }

  .info-card {
    padding: 15px;
    background: #111827;
    border: 1px solid #374151;
    border-radius: 6px;
    transition: all 0.3s ease;
  }

  .info-card:hover {
    border-color: #6366f1;
    box-shadow: 0 0 15px rgba(99, 102, 241, 0.2);
  }

  .info-card h4 {
    margin: 0 0 8px 0;
    color: #d1d5db;
    font-size: 14px;
  }

  .info-card p {
    margin: 0;
    color: #9ca3af;
    font-size: 13px;
    line-height: 1.5;
  }

  .info-note {
    padding: 12px 16px;
    background: rgba(99, 102, 241, 0.1);
    border-left: 4px solid #6366f1;
    border-radius: 4px;
  }

  .info-note p {
    margin: 0;
    color: #a5b4fc;
    font-size: 14px;
  }

  /* Filter Section Styles */
  .filter-section {
    background: #1f2937;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 20px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    border: 1px solid #374151;
  }

  .filter-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
  }

  .filter-header h3 {
    margin: 0;
    color: #f3f4f6;
    font-size: 18px;
  }

  .reset-btn {
    padding: 6px 12px;
    background: #374151;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .reset-btn:hover {
    background: #4b5563;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  }

  .filter-controls {
    display: flex;
    flex-direction: column;
    gap: 15px;
  }

  .filter-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 15px;
  }

  .filter-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .filter-group label {
    font-weight: 600;
    color: #d1d5db;
    font-size: 13px;
  }

  .search-input,
  .filter-select,
  .power-input {
    padding: 8px 12px;
    border: 1px solid #374151;
    border-radius: 6px;
    font-size: 14px;
    background: #111827;
    color: #e5e7eb;
    transition: all 0.3s ease;
  }

  .search-input:focus,
  .filter-select:focus,
  .power-input:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
  }

  .power-input {
    width: 100%;
  }

  .filter-info {
    padding-top: 10px;
    border-top: 1px solid #374151;
  }

  .active-filters {
    margin: 0;
    color: #818cf8;
    font-size: 13px;
    font-weight: 500;
  }

  .no-results {
    text-align: center;
    padding: 40px 20px;
    background: rgba(251, 191, 36, 0.1);
    border: 1px solid #f59e0b;
    border-radius: 8px;
    margin-bottom: 20px;
    backdrop-filter: blur(10px);
  }

  .no-results p {
    margin: 0 0 15px 0;
    color: #fbbf24;
    font-size: 16px;
  }

  @media (max-width: 768px) {
    .graph-page {
      padding: 15px;
    }

    .page-header h1 {
      font-size: 24px;
    }

    .controls {
      flex-direction: column;
      align-items: stretch;
    }

    .control-group {
      flex-direction: column;
      align-items: stretch;
    }

    .control-group select {
      min-width: 100%;
    }

    .info-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
