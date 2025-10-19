<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { getAllTopics, type TopicSummary } from '$lib/contracts/topicRegistry';
  import { createEventDispatcher } from 'svelte';
  import { walletStore } from '$lib/web3/walletConnect';

  const dispatch = createEventDispatcher();

  let topics: TopicSummary[] = [];
  let loading = true;
  let error: string | null = null;
  let selectedTopicId: number | null = null;
  let expandedTopicId: number | null = null;

  // Subscribe to wallet changes
  let unsubscribe: any;
  onMount(() => {
    unsubscribe = walletStore.subscribe(async ($wallet) => {
      if ($wallet.connected && $wallet.provider && $wallet.chainId) {
        await loadTopics();
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  });

  async function loadTopics() {
    loading = true;
    error = null;

    try {
      const $wallet = get(walletStore);

      if (!$wallet.provider || !$wallet.chainId) {
        error = 'Please connect your wallet';
        return;
      }

      const allTopics = await getAllTopics($wallet.provider, $wallet.chainId, true);
      topics = allTopics;
    } catch (e: any) {
      error = e.message || 'Failed to load topics';
      console.error('Error loading topics:', e);
    } finally {
      loading = false;
    }
  }

  function handleTopicClick(topicId: number) {
    if (selectedTopicId === topicId) {
      // Deselect
      selectedTopicId = null;
      dispatch('topicSelected', { topicId: null });
    } else {
      selectedTopicId = topicId;
      dispatch('topicSelected', { topicId });
    }
  }

  function toggleExpand(topicId: number) {
    expandedTopicId = expandedTopicId === topicId ? null : topicId;
  }

  async function handleRefresh() {
    await loadTopics();
  }
</script>

<div class="topic-selector">
  <div class="selector-header">
    <h2>Select a Topic</h2>
    <button class="refresh-btn" on:click={handleRefresh} aria-label="Refresh topics">
      🔄
    </button>
  </div>

  {#if loading}
    <div class="loading">Loading topics...</div>
  {:else if error}
    <div class="error">Error loading topics: {error}</div>
  {:else if topics.length === 0}
    <div class="empty">No active topics available</div>
  {:else}
    <div class="topics-list">
      {#each topics as topic (topic.id)}
        <div
          class="topic-item"
          class:selected={selectedTopicId === topic.id}
          class:expanded={expandedTopicId === topic.id}
        >
          <div class="topic-header">
            <button
              class="topic-button"
              on:click={() => handleTopicClick(topic.id)}
            >
              <span class="topic-name">{topic.name}</span>
              {#if selectedTopicId === topic.id}
                <span class="selected-badge">✓</span>
              {/if}
            </button>

            <button
              class="expand-button"
              on:click={() => toggleExpand(topic.id)}
              aria-label="Expand {topic.name}"
            >
              {expandedTopicId === topic.id ? '▼' : '▶'}
            </button>
          </div>

          {#if expandedTopicId === topic.id}
            <div class="topic-details">
              <p><strong>Topic ID:</strong> {topic.id}</p>
              <p><strong>Proposal Threshold:</strong> {topic.proposalThreshold}</p>
              <p><strong>Status:</strong> {topic.active ? 'Active' : 'Inactive'}</p>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .topic-selector {
    padding: 1rem;
    background: #1f2937;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    border: 1px solid #374151;
  }

  .selector-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .selector-header h2 {
    margin: 0;
    font-size: 1rem;
    color: #f3f4f6;
    font-weight: 600;
  }

  .refresh-btn {
    background: none;
    border: none;
    font-size: 1.1rem;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 4px;
    transition: all 0.3s ease;
    color: #9ca3af;
  }

  .refresh-btn:hover {
    background: #374151;
    color: #818cf8;
  }

  .loading,
  .error,
  .empty {
    padding: 1.5rem;
    text-align: center;
    color: #9ca3af;
    font-size: 0.9rem;
  }

  .error {
    color: #fca5a5;
    background: rgba(239, 68, 68, 0.1);
    border-radius: 4px;
    border: 1px solid #ef4444;
  }

  .topics-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-height: 400px;
    overflow-y: auto;
    padding-right: 0.5rem;
  }

  .topic-item {
    border: 1px solid #374151;
    border-radius: 6px;
    transition: all 0.3s ease;
    overflow: hidden;
    background: #111827;
  }

  .topic-item:hover {
    border-color: #4b5563;
    box-shadow: 0 0 10px rgba(99, 102, 241, 0.1);
  }

  .topic-item.selected {
    border-color: #6366f1;
    background: rgba(99, 102, 241, 0.1);
    box-shadow: 0 0 15px rgba(99, 102, 241, 0.2);
  }

  .topic-header {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .topic-button {
    flex: 1;
    padding: 0.75rem;
    background: none;
    border: none;
    text-align: left;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.9rem;
    transition: all 0.2s ease;
  }

  .topic-button:hover .topic-name {
    color: #818cf8;
  }

  .topic-name {
    font-weight: 500;
    color: #d1d5db;
    transition: color 0.2s;
  }

  .topic-item.selected .topic-name {
    color: #a5b4fc;
    font-weight: 600;
  }

  .selected-badge {
    color: #818cf8;
    font-weight: 700;
    font-size: 1.1rem;
  }

  .expand-button {
    padding: 0.5rem 0.75rem;
    background: none;
    border: none;
    color: #6b7280;
    cursor: pointer;
    font-size: 0.75rem;
    transition: all 0.2s ease;
  }

  .expand-button:hover {
    color: #9ca3af;
  }

  .topic-details {
    padding: 0.75rem;
    background: #0f1419;
    border-top: 1px solid #374151;
    font-size: 0.8rem;
  }

  .topic-details p {
    margin: 0.4rem 0;
    color: #9ca3af;
  }

  .topic-details strong {
    color: #d1d5db;
  }
</style>
