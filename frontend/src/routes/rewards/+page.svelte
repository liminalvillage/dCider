<script lang="ts">
  import { onMount } from 'svelte';
  import { walletStore } from '$lib/web3/walletConnect';
  import { getContractAddresses } from '$lib/contracts/addresses';
  import { getAllTopics, type TopicSummary } from '$lib/contracts/topicRegistry';
  import { getTopicDelegators, getDelegation } from '$lib/contracts/delegationManager';
  import RewardStreamDisplay from '$lib/components/RewardStreamDisplay.svelte';
  import {
    initRewardDistributor,
    fetchFlowRate,
    fetchPoolFlowRate,
    fetchActiveDelegates,
    getStream,
    getPool,
    type RewardStream,
    type TopicRewardPool,
  } from '$lib/stores/rewardStreams';

  let topics: TopicSummary[] = [];
  let selectedTopicId: number | null = null;
  let loading = true;
  let error: string | null = null;
  let isInitialized = false;
  let initializationError: string | null = null;

  let userStream: RewardStream | undefined;
  let pool: TopicRewardPool | undefined;
  let activeDelegates: string[] = [];
  let allStreams: RewardStream[] = [];
  let loadingData = false;
  let refreshInterval: NodeJS.Timeout | null = null;

  $: connected = $walletStore.connected;
  $: userAddress = $walletStore.address;
  $: provider = $walletStore.provider;
  $: chainId = $walletStore.chainId;
  $: selectedTopic = topics.find(t => t.id === selectedTopicId);

  // Load topics when wallet connects
  $: if (provider && chainId) {
    loadTopics();
  }

  // Initialize rewards when wallet connects
  $: if (connected && provider && chainId && !isInitialized) {
    initializeRewards();
  }

  // Load rewards data when topic changes
  $: if (selectedTopicId !== null && isInitialized) {
    loadRewardsData();
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

  async function initializeRewards() {
    try {
      const addresses = getContractAddresses(chainId!);

      if (!addresses.rewardDistributor) {
        initializationError = 'RewardDistributor not configured';
        return;
      }

      const abiModule = await import('$lib/contracts/RewardDistributor.abi.json');
      const abi = abiModule.default;

      const success = await initRewardDistributor(provider!, addresses.rewardDistributor, abi);

      if (success) {
        isInitialized = true;
      } else {
        initializationError = 'Failed to initialize RewardDistributor';
      }
    } catch (err) {
      console.error('Error initializing rewards:', err);
      initializationError = err instanceof Error ? err.message : 'Unknown error';
    }
  }

  async function loadRewardsData() {
    if (selectedTopicId === null || !userAddress || !provider || !chainId) return;

    try {
      loadingData = true;

      // Fetch user's stream
      await fetchFlowRate(userAddress, selectedTopicId);
      userStream = getStream(userAddress, selectedTopicId);

      // Fetch pool data
      await fetchPoolFlowRate(selectedTopicId);
      pool = getPool(selectedTopicId);

      // Get all delegators from DelegationManager
      const delegators = await getTopicDelegators(provider, chainId, selectedTopicId);
      console.log('[Rewards] Found delegators:', delegators.length);

      // Build set of unique delegates by following delegation chains
      const delegateSet = new Set<string>();
      for (const delegator of delegators) {
        const delegation = await getDelegation(provider, chainId, delegator, selectedTopicId);
        if (delegation && delegation.delegate) {
          delegateSet.add(delegation.delegate);
        }
      }

      activeDelegates = Array.from(delegateSet);
      console.log('[Rewards] Found unique delegates:', activeDelegates.length, activeDelegates);

      // Fetch streams for all delegates
      allStreams = [];
      for (const delegate of activeDelegates) {
        const stream = await fetchFlowRate(delegate, selectedTopicId);
        if (stream) {
          allStreams.push(stream);
        }
      }
      // Sort by flow rate descending
      allStreams.sort((a, b) => Number(b.flowRate - a.flowRate));
      console.log('[Rewards] Active streams:', allStreams.length);
    } catch (err) {
      console.error('Error loading rewards data:', err);
    } finally {
      loadingData = false;
    }
  }

  function handleTopicSelect(topicId: number) {
    selectedTopicId = topicId;
  }

  function formatAddress(address: string): string {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  function calculatePoolUtilization(): number {
    if (!pool || pool.poolFlowRate === 0n) return 0;
    return Number((pool.totalDistributed * 10000n) / pool.poolFlowRate) / 100;
  }

  function formatFlowRate(flowRate: bigint): number {
    if (flowRate === 0n) return 0;
    // Convert to tokens per day
    const perDay = flowRate * 86400n;
    return Number(perDay) / 1e18;
  }

  onMount(() => {
    // Set up auto-refresh every 30 seconds
    refreshInterval = setInterval(() => {
      if (selectedTopicId !== null && isInitialized) {
        loadRewardsData();
      }
    }, 30000);

    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  });
</script>

<div class="dashboard">
  {#if !connected}
    <div class="connect-prompt">
      <h2>Connect Your Wallet</h2>
      <p>Please connect your wallet to view streaming rewards</p>
    </div>
  {:else if loading}
    <div class="loading">Loading topics...</div>
  {:else if error}
    <div class="error">{error}</div>
  {:else if initializationError}
    <div class="error">
      <p>{initializationError}</p>
    </div>
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

    <!-- Content Grid -->
    <div class="content-grid">
      <!-- Left Column: Pool Info & Your Rewards -->
      <div class="rewards-section">
        <div class="section-header">
          <h3>💎 {selectedTopic?.name || 'Rewards Pool'}</h3>
        </div>

        <!-- Pool Information -->
        {#if pool}
          <div class="pool-card">
            <h4>Pool Information</h4>
            <div class="pool-stats">
              <div class="stat">
                <span class="stat-label">Pool Capacity</span>
                <span class="stat-value">{formatFlowRate(pool.poolFlowRate).toFixed(2)} tokens/day</span>
              </div>
              <div class="stat">
                <span class="stat-label">Currently Distributed</span>
                <span class="stat-value">{formatFlowRate(pool.totalDistributed).toFixed(2)} tokens/day</span>
              </div>
              <div class="stat">
                <span class="stat-label">Available</span>
                <span class="stat-value">{formatFlowRate(pool.remainingCapacity).toFixed(2)} tokens/day</span>
              </div>
              <div class="stat">
                <span class="stat-label">Utilization</span>
                <span class="stat-value">{calculatePoolUtilization().toFixed(1)}%</span>
              </div>
            </div>
            {#if pool.poolFlowRate > 0n}
              <div class="progress-bar">
                <div class="progress-fill" style="width: {calculatePoolUtilization()}%"></div>
              </div>
            {/if}
          </div>
        {/if}

        <!-- User's Reward Stream -->
        <div class="user-stream-card">
          <h4>Your Reward Stream</h4>
          {#if userStream && userStream.isActive}
            <RewardStreamDisplay
              delegate={userStream.delegate}
              topicId={userStream.topicId}
              flowRate={userStream.flowRate}
              totalStreamed={userStream.totalStreamed}
              lastUpdated={userStream.lastUpdated}
              isActive={userStream.isActive}
              compact={false}
            />
          {:else}
            <div class="no-stream">
              <p>You don't have an active reward stream for this topic.</p>
              <p class="hint">Receive delegations to start earning rewards!</p>
            </div>
          {/if}
        </div>

        <!-- Info Box -->
        <div class="info-box">
          <h4>📊 How It Works</h4>
          <ul>
            <li>Rewards stream continuously based on your voting power</li>
            <li>Your share = (Your Power / Total Power) × Pool Rate</li>
            <li>Updates automatically when delegations change</li>
            <li>No claiming needed - rewards stream in real-time</li>
          </ul>
        </div>
      </div>

      <!-- Right Column: Leaderboard -->
      <div class="side-column">
        <div class="leaderboard-card">
          <div class="section-header">
            <h3>🏆 Top Delegates</h3>
            <span class="badge">{activeDelegates.length}</span>
          </div>

          <div class="delegates-list">
            {#if loadingData}
              <div class="loading-delegates">
                <p>Loading delegates...</p>
              </div>
            {:else if allStreams.length === 0}
              <div class="no-delegates">
                <p>No active delegates yet</p>
                <p class="hint-small">Delegate votes to see rewards</p>
              </div>
            {:else}
              {#each allStreams as stream, index (stream.delegate)}
                <div class="delegate-card" class:highlight={stream.delegate.toLowerCase() === userAddress?.toLowerCase()}>
                  <div class="delegate-header">
                    <span class="rank">#{index + 1}</span>
                    <div class="delegate-address">
                      {formatAddress(stream.delegate)}
                      {#if stream.delegate.toLowerCase() === userAddress?.toLowerCase()}
                        <span class="you-badge">You</span>
                      {/if}
                    </div>
                  </div>
                  <div class="delegate-rate">
                    {formatFlowRate(stream.flowRate).toFixed(4)} tokens/day
                  </div>
                  <div class="delegate-stream">
                    <RewardStreamDisplay
                      delegate={stream.delegate}
                      topicId={stream.topicId}
                      flowRate={stream.flowRate}
                      totalStreamed={stream.totalStreamed}
                      lastUpdated={stream.lastUpdated}
                      isActive={stream.isActive}
                      compact={true}
                    />
                  </div>
                </div>
              {/each}
            {/if}
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .dashboard {
    max-width: 1600px;
    margin: 0 auto;
    padding: 1.5rem;
  }

  .connect-prompt,
  .loading,
  .error {
    text-align: center;
    padding: 4rem 2rem;
    background: #1f2937;
    border-radius: 12px;
    border: 1px solid #374151;
  }

  .connect-prompt h2,
  .loading {
    color: #f3f4f6;
    margin-bottom: 1rem;
  }

  .connect-prompt p {
    color: #9ca3af;
  }

  .error {
    color: #ef4444;
  }

  /* Topic Tabs */
  .topic-tabs {
    margin-bottom: 1.5rem;
    border-bottom: 2px solid #374151;
  }

  .tabs-scroll {
    display: flex;
    gap: 0.5rem;
    overflow-x: auto;
    padding-bottom: 0.5rem;
  }

  .topic-tab {
    padding: 0.75rem 1.5rem;
    background: transparent;
    border: none;
    border-bottom: 3px solid transparent;
    color: #9ca3af;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.2s;
    font-size: 0.95rem;
  }

  .topic-tab:hover {
    color: #e0e7ff;
    background: rgba(99, 102, 241, 0.1);
    border-radius: 8px 8px 0 0;
  }

  .topic-tab.active {
    color: #818cf8;
    border-bottom-color: #6366f1;
  }

  /* Content Grid */
  .content-grid {
    display: grid;
    grid-template-columns: 1fr 420px;
    gap: 1.5rem;
    align-items: start;
  }

  /* Rewards Section */
  .rewards-section {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .section-header h3 {
    font-size: 1.25rem;
    font-weight: 600;
    color: #f3f4f6;
    margin: 0;
  }

  .badge {
    background: #4f46e5;
    color: white;
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .pool-card,
  .user-stream-card,
  .info-box {
    background: #1f2937;
    border-radius: 12px;
    padding: 1.5rem;
    border: 1px solid #374151;
  }

  .pool-card h4,
  .user-stream-card h4,
  .info-box h4 {
    margin: 0 0 1rem 0;
    color: #f3f4f6;
    font-size: 1rem;
    font-weight: 600;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid #374151;
  }

  .pool-stats {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .stat {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .stat-label {
    font-size: 0.75rem;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .stat-value {
    font-size: 1.25rem;
    font-weight: 700;
    color: #f3f4f6;
  }

  .progress-bar {
    width: 100%;
    height: 6px;
    background: #111827;
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #6366f1 0%, #8b5cf6 100%);
    transition: width 0.3s ease;
  }

  .no-stream,
  .no-delegates {
    text-align: center;
    padding: 2rem 1rem;
    color: #6b7280;
  }

  .no-stream p,
  .no-delegates p {
    margin: 0 0 0.5rem 0;
    color: #9ca3af;
  }

  .hint,
  .hint-small {
    font-size: 0.875rem;
    font-style: italic;
    color: #6b7280;
  }

  .info-box ul {
    margin: 0;
    padding-left: 1.5rem;
    color: #9ca3af;
    line-height: 1.8;
  }

  .info-box li {
    font-size: 0.875rem;
    margin-bottom: 0.5rem;
  }

  /* Leaderboard */
  .side-column {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .leaderboard-card {
    background: #1f2937;
    border-radius: 12px;
    padding: 1.5rem;
    border: 1px solid #374151;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
  }

  .leaderboard-card .section-header {
    padding-bottom: 0.75rem;
    border-bottom: 1px solid #374151;
    margin-bottom: 1rem;
  }

  .delegates-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-height: 700px;
    overflow-y: auto;
  }

  .loading-delegates {
    text-align: center;
    padding: 2rem 1rem;
    color: #6b7280;
  }

  .delegate-card {
    background: #111827;
    border: 1px solid #374151;
    border-radius: 8px;
    padding: 1rem;
    transition: all 0.2s;
  }

  .delegate-card:hover {
    border-color: #4f46e5;
    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.2);
  }

  .delegate-card.highlight {
    background: rgba(79, 70, 229, 0.1);
    border-color: #4f46e5;
  }

  .delegate-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
  }

  .rank {
    font-size: 1rem;
    font-weight: 700;
    color: #6366f1;
    min-width: 2rem;
  }

  .delegate-address {
    font-family: 'Monaco', 'Courier New', monospace;
    font-size: 0.875rem;
    font-weight: 600;
    color: #f3f4f6;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
  }

  .you-badge {
    background: #10b981;
    color: white;
    padding: 0.125rem 0.5rem;
    border-radius: 6px;
    font-size: 0.7rem;
    font-weight: 700;
  }

  .delegate-rate {
    font-size: 0.75rem;
    color: #9ca3af;
    margin-bottom: 0.5rem;
  }

  .delegate-stream {
    font-size: 0.875rem;
  }

  @media (max-width: 1200px) {
    .content-grid {
      grid-template-columns: 1fr;
    }

    .pool-stats {
      grid-template-columns: 1fr;
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
  }
</style>
