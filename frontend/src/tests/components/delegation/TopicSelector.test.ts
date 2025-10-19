/**
 * T047: Frontend component test for TopicSelector
 * Tests topic selection UI component
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@testing-library/svelte';
import TopicSelector from '$components/delegation/TopicSelector.svelte';
import { get } from 'svelte/store';

// Mock contract interaction
vi.mock('$lib/contracts/topicRegistry', () => ({
  getAllTopics: vi.fn(() => Promise.resolve([
    { id: 1, name: 'Climate Policy', active: true, proposalThreshold: 10 },
    { id: 2, name: 'Education', active: true, proposalThreshold: 10 },
    { id: 3, name: 'Treasury', active: false, proposalThreshold: 20 }
  ])),
  getTopicById: vi.fn((id: number) => {
    const topics = [
      { id: 1, name: 'Climate Policy', active: true, proposalThreshold: 10, descriptionCID: 'ipfs://abc', createdAt: 1234567890 },
      { id: 2, name: 'Education', active: true, proposalThreshold: 10, descriptionCID: 'ipfs://def', createdAt: 1234567891 }
    ];
    return Promise.resolve(topics.find(t => t.id === id));
  })
}));

describe('TopicSelector Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render loading state initially', () => {
    const { container } = render(TopicSelector);
    expect(container.textContent).toContain('Loading topics');
  });

  it('should load and display topics', async () => {
    const { container } = render(TopicSelector);

    await waitFor(() => {
      expect(screen.queryByText('Loading topics')).not.toBeInTheDocument();
    });

    // Should show active topics
    expect(container.textContent).toContain('Climate Policy');
    expect(container.textContent).toContain('Education');
  });

  it('should filter out inactive topics by default', async () => {
    const { container } = render(TopicSelector);

    await waitFor(() => {
      expect(screen.queryByText('Loading topics')).not.toBeInTheDocument();
    });

    // Inactive topic should not appear
    expect(container.textContent).not.toContain('Treasury');
  });

  it('should emit event when topic is selected', async () => {
    const { component } = render(TopicSelector);
    let selectedTopicId: number | null = null;

    component.$on('topicSelected', (event: CustomEvent) => {
      selectedTopicId = event.detail.topicId;
    });

    await waitFor(() => {
      expect(screen.queryByText('Loading topics')).not.toBeInTheDocument();
    });

    // Simulate clicking on Climate Policy topic
    const climateButton = screen.getByText('Climate Policy');
    await fireEvent.click(climateButton);

    expect(selectedTopicId).toBe(1);
  });

  it('should show topic details when expanded', async () => {
    render(TopicSelector);

    await waitFor(() => {
      expect(screen.queryByText('Loading topics')).not.toBeInTheDocument();
    });

    // Click to expand Climate Policy
    const expandButton = screen.getByLabelText('Expand Climate Policy');
    await fireEvent.click(expandButton);

    // Should show proposal threshold
    await waitFor(() => {
      expect(screen.getByText(/Proposal Threshold: 10/i)).toBeInTheDocument();
    });
  });

  it('should handle empty topics list', async () => {
    // Mock empty response
    const { getAllTopics } = await import('$lib/contracts/topicRegistry');
    vi.mocked(getAllTopics).mockResolvedValueOnce([]);

    const { container } = render(TopicSelector);

    await waitFor(() => {
      expect(screen.queryByText('Loading topics')).not.toBeInTheDocument();
    });

    expect(container.textContent).toContain('No active topics available');
  });

  it('should handle loading error', async () => {
    // Mock error
    const { getAllTopics } = await import('$lib/contracts/topicRegistry');
    vi.mocked(getAllTopics).mockRejectedValueOnce(new Error('Network error'));

    const { container } = render(TopicSelector);

    await waitFor(() => {
      expect(container.textContent).toContain('Error loading topics');
    });
  });

  it('should show selected topic with visual indicator', async () => {
    const { component } = render(TopicSelector);

    await waitFor(() => {
      expect(screen.queryByText('Loading topics')).not.toBeInTheDocument();
    });

    const climateButton = screen.getByText('Climate Policy');
    await fireEvent.click(climateButton);

    // Selected topic should have 'selected' class
    await waitFor(() => {
      expect(climateButton.closest('.topic-item')).toHaveClass('selected');
    });
  });

  it('should allow deselecting a topic', async () => {
    const { component } = render(TopicSelector);
    let selectedTopicId: number | null = null;

    component.$on('topicSelected', (event: CustomEvent) => {
      selectedTopicId = event.detail.topicId;
    });

    await waitFor(() => {
      expect(screen.queryByText('Loading topics')).not.toBeInTheDocument();
    });

    // Select topic
    const climateButton = screen.getByText('Climate Policy');
    await fireEvent.click(climateButton);
    expect(selectedTopicId).toBe(1);

    // Click again to deselect
    await fireEvent.click(climateButton);
    expect(selectedTopicId).toBeNull();
  });

  it('should refresh topics when requested', async () => {
    const { getAllTopics } = await import('$lib/contracts/topicRegistry');
    const mockGetAllTopics = vi.mocked(getAllTopics);

    mockGetAllTopics.mockResolvedValueOnce([
      { id: 1, name: 'Climate Policy', active: true, proposalThreshold: 10 }
    ]);

    const { component } = render(TopicSelector);

    await waitFor(() => {
      expect(screen.queryByText('Loading topics')).not.toBeInTheDocument();
    });

    // Simulate refresh
    mockGetAllTopics.mockResolvedValueOnce([
      { id: 1, name: 'Climate Policy', active: true, proposalThreshold: 10 },
      { id: 4, name: 'New Topic', active: true, proposalThreshold: 5 }
    ]);

    const refreshButton = screen.getByLabelText('Refresh topics');
    await fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(screen.getByText('New Topic')).toBeInTheDocument();
    });

    expect(mockGetAllTopics).toHaveBeenCalledTimes(2);
  });
});
