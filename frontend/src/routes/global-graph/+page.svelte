<script lang="ts">
  import { onMount } from 'svelte';
  import { walletStore } from '$lib/web3/walletConnect';
  import { getAllTopics, type TopicSummary } from '$lib/contracts/topicRegistry';
  import { fetchDelegationGraph, type DelegationGraphData, type GraphNode, type GraphEdge } from '$lib/services/graphData';

  let topics: TopicSummary[] = [];
  let loading = true;
  let error: string | null = null;
  let loadingGraphs = false;
  let globalGraphData: DelegationGraphData | null = null;

  $: connected = $walletStore.connected;
  $: userAddress = $walletStore.address;
  $: signer = $walletStore.signer;
  $: provider = $walletStore.provider;
  $: chainId = $walletStore.chainId;

  onMount(async () => {
    await loadTopics();
  });

  async function loadTopics() {
    if (!provider || !chainId) {
      error = 'Please connect your wallet';
      loading = false;
      return;
    }

    try {
      loading = true;
      topics = await getAllTopics(provider, chainId, true);

      if (topics.length > 0) {
        await loadGlobalGraph();
      }
    } catch (e: any) {
      error = e.message || 'Failed to load topics';
      console.error('Error loading topics:', e);
    } finally {
      loading = false;
    }
  }

  async function loadGlobalGraph() {
    if (!signer || !chainId || topics.length === 0) return;

    loadingGraphs = true;

    try {
      // Fetch graphs for all topics
      const graphPromises = topics.map(topic =>
        fetchDelegationGraph(signer, chainId, topic.id, userAddress)
      );

      const topicGraphs = await Promise.all(graphPromises);

      // Merge all graphs into one
      const allNodes = new Map<string, GraphNode>();
      const allEdges: GraphEdge[] = [];
      const terminalDelegates = new Map<string, number>();

      for (const graph of topicGraphs) {
        // Merge nodes (aggregate voting power across topics)
        for (const node of graph.nodes) {
          if (allNodes.has(node.address)) {
            const existing = allNodes.get(node.address)!;
            existing.votingPower += node.votingPower;
            existing.isTerminal = existing.isTerminal || node.isTerminal;
            existing.isDelegating = existing.isDelegating || node.isDelegating;
          } else {
            allNodes.set(node.address, { ...node });
          }
        }

        // Add all edges
        allEdges.push(...graph.edges);

        // Merge terminal delegates
        for (const [address, power] of graph.terminalDelegates.entries()) {
          const currentPower = terminalDelegates.get(address) || 0;
          terminalDelegates.set(address, currentPower + power);
        }
      }

      globalGraphData = {
        nodes: Array.from(allNodes.values()),
        edges: allEdges,
        topicId: -1, // Indicate global graph
        userAddress,
        terminalDelegates
      };

      console.log('[GlobalGraph] Merged graph:', globalGraphData);
    } catch (e: any) {
      console.error('Error loading global graph:', e);
    } finally {
      loadingGraphs = false;
    }
  }

  async function refreshGraph() {
    await loadGlobalGraph();
  }
</script>

<div class="global-graph-page">
  <div class="page-header">
    <div class="header-left">
      <h1>🌐 Global Delegation Network</h1>
      <p class="subtitle">View all delegation flows across all topics</p>
    </div>
    <button class="refresh-btn" on:click={refreshGraph} disabled={loadingGraphs}>
      {loadingGraphs ? '⟳ Loading...' : '🔄 Refresh'}
    </button>
  </div>

  {#if !connected}
    <div class="connect-prompt">
      <h2>Connect Your Wallet</h2>
      <p>Please connect your wallet to view the global delegation network</p>
    </div>
  {:else if loading}
    <div class="loading">Loading topics...</div>
  {:else if error}
    <div class="error">{error}</div>
  {:else if loadingGraphs}
    <div class="loading-graphs">
      <div class="loading-spinner"></div>
      <p>Building global delegation network...</p>
      <p class="hint">Fetching data from {topics.length} topic(s)</p>
    </div>
  {:else if globalGraphData && globalGraphData.nodes.length > 0}
    <div class="graph-wrapper">
      {#await import('$lib/components/DelegationGraph.svelte')}
        <div class="loading">Loading graph component...</div>
      {:then { default: DelegationGraph }}
        <DelegationGraph
          graphData={globalGraphData}
          width={Math.min(window.innerWidth - 100, 1400)}
          height={800}
          compact={false}
        />
      {/await}
    </div>
  {:else}
    <div class="no-data">
      <p>No delegations found across any topics</p>
      <p class="hint">Start by delegating your vote on the Dashboard</p>
    </div>
  {/if}
</div>

<style>
  .global-graph-page {
    max-width: 1600px;
    margin: 0 auto;
    padding: 2rem;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 2rem;
    gap: 2rem;
  }

  .header-left {
    flex: 1;
  }

  .page-header h1 {
    margin: 0 0 0.5rem 0;
    color: #f3f4f6;
    font-size: 2rem;
    font-weight: 700;
    background: linear-gradient(135deg, #818cf8 0%, #c084fc 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .subtitle {
    margin: 0;
    color: #9ca3af;
    font-size: 1rem;
  }

  .refresh-btn {
    padding: 0.75rem 1.5rem;
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);
    white-space: nowrap;
  }

  .refresh-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(99, 102, 241, 0.6);
  }

  .refresh-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
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
    padding: 3rem 2rem;
    color: #9ca3af;
    font-size: 1.1rem;
  }

  .error {
    color: #fca5a5;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid #ef4444;
    border-radius: 12px;
  }

  .loading-graphs {
    text-align: center;
    padding: 4rem 2rem;
    background: #1f2937;
    border-radius: 12px;
    border: 1px solid #374151;
  }

  .loading-spinner {
    width: 60px;
    height: 60px;
    border: 4px solid #374151;
    border-top-color: #818cf8;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 1.5rem;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .loading-graphs p {
    margin: 0.5rem 0;
    color: #d1d5db;
    font-size: 1.1rem;
  }

  .loading-graphs .hint {
    color: #9ca3af;
    font-size: 0.9rem;
  }

  .graph-wrapper {
    background: #1f2937;
    border-radius: 12px;
    padding: 1.5rem;
    border: 1px solid #374151;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
  }

  .no-data {
    text-align: center;
    padding: 4rem 2rem;
    background: #1f2937;
    border-radius: 12px;
    border: 1px dashed #374151;
  }

  .no-data p {
    margin: 0.5rem 0;
    color: #9ca3af;
    font-size: 1.1rem;
  }

  .no-data .hint {
    color: #6b7280;
    font-size: 0.95rem;
  }

  @media (max-width: 768px) {
    .global-graph-page {
      padding: 1rem;
    }

    .page-header {
      flex-direction: column;
      align-items: stretch;
      gap: 1rem;
    }

    .page-header h1 {
      font-size: 1.5rem;
    }

    .refresh-btn {
      width: 100%;
    }
  }
</style>
