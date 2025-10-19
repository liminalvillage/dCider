/**
 * TopicRegistry Contract Interaction Module
 * Handles reading and querying topics
 */

import { ethers, type Provider, type Signer } from 'ethers';
import { TOPIC_REGISTRY_ABI } from './abis';
import { getContractAddresses } from './addresses';

export interface Topic {
  id: number;
  name: string;
  descriptionCID: string;
  proposalThreshold: number;
  active: boolean;
  createdAt: number;
  admin: string;
}

export interface TopicSummary {
  id: number;
  name: string;
  active: boolean;
  proposalThreshold: number;
}

/**
 * Get TopicRegistry contract instance
 */
function getTopicRegistryContract(
  providerOrSigner: Provider | Signer,
  chainId: number
): ethers.Contract {
  const addresses = getContractAddresses(chainId);

  if (!addresses.topicRegistry) {
    throw new Error('TopicRegistry address not configured');
  }

  return new ethers.Contract(
    addresses.topicRegistry,
    TOPIC_REGISTRY_ABI,
    providerOrSigner
  );
}

/**
 * Get all topics (active or all)
 */
export async function getAllTopics(
  provider: Provider,
  chainId: number,
  activeOnly: boolean = true
): Promise<TopicSummary[]> {
  const contract = getTopicRegistryContract(provider, chainId);

  try {
    // Contract returns [topics, count]
    const result = await contract.getAllTopics(activeOnly);
    const topics = result[0]; // First element is the topics array

    return topics.map((topic: any) => ({
      id: Number(topic.id),
      name: topic.name,
      active: topic.active,
      proposalThreshold: Number(topic.proposalThreshold)
    }));
  } catch (error) {
    console.error('Error fetching topics:', error);
    throw new Error('Failed to fetch topics');
  }
}

/**
 * Get specific topic by ID
 */
export async function getTopicById(
  provider: Provider,
  chainId: number,
  topicId: number
): Promise<Topic> {
  const contract = getTopicRegistryContract(provider, chainId);

  try {
    const topic = await contract.getTopic(topicId);

    return {
      id: Number(topic.id),
      name: topic.name,
      descriptionCID: topic.descriptionCID,
      proposalThreshold: Number(topic.proposalThreshold),
      active: topic.active,
      createdAt: Number(topic.createdAt),
      admin: topic.admin
    };
  } catch (error) {
    console.error(`Error fetching topic ${topicId}:`, error);
    throw new Error(`Failed to fetch topic ${topicId}`);
  }
}

/**
 * Check if topic is active
 */
export async function isTopicActive(
  provider: Provider,
  chainId: number,
  topicId: number
): Promise<boolean> {
  const contract = getTopicRegistryContract(provider, chainId);

  try {
    const [exists, active] = await contract.isTopicActive(topicId);
    return exists && active;
  } catch (error) {
    console.error(`Error checking topic ${topicId} active status:`, error);
    return false;
  }
}

/**
 * Get total number of topics
 */
export async function getTopicCount(
  provider: Provider,
  chainId: number
): Promise<number> {
  const contract = getTopicRegistryContract(provider, chainId);

  try {
    const count = await contract.topicCount();
    return Number(count);
  } catch (error) {
    console.error('Error fetching topic count:', error);
    throw new Error('Failed to fetch topic count');
  }
}

/**
 * Create new topic (admin only)
 */
export async function createTopic(
  signer: Signer,
  chainId: number,
  name: string,
  descriptionCID: string,
  proposalThreshold: number
): Promise<{ topicId: number; txHash: string }> {
  const contract = getTopicRegistryContract(signer, chainId);

  try {
    const tx = await contract.createTopic(name, descriptionCID, proposalThreshold);
    const receipt = await tx.wait();

    // Parse TopicCreated event to get ID
    const event = receipt.logs
      .map((log: any) => {
        try {
          return contract.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((parsed: any) => parsed?.name === 'TopicCreated');

    const topicId = event ? Number(event.args[0]) : -1;

    return {
      topicId,
      txHash: receipt.hash
    };
  } catch (error: any) {
    console.error('Error creating topic:', error);
    throw new Error(error.message || 'Failed to create topic');
  }
}

/**
 * Update topic proposal threshold (admin only)
 */
export async function updateTopicThreshold(
  signer: Signer,
  chainId: number,
  topicId: number,
  newThreshold: number
): Promise<string> {
  const contract = getTopicRegistryContract(signer, chainId);

  try {
    const tx = await contract.updateTopicThreshold(topicId, newThreshold);
    const receipt = await tx.wait();
    return receipt.hash;
  } catch (error: any) {
    console.error('Error updating topic threshold:', error);
    throw new Error(error.message || 'Failed to update topic threshold');
  }
}

/**
 * Set topic active status (admin only)
 */
export async function setTopicActive(
  signer: Signer,
  chainId: number,
  topicId: number,
  active: boolean
): Promise<string> {
  const contract = getTopicRegistryContract(signer, chainId);

  try {
    const tx = await contract.setTopicActive(topicId, active);
    const receipt = await tx.wait();
    return receipt.hash;
  } catch (error: any) {
    console.error('Error setting topic active status:', error);
    throw new Error(error.message || 'Failed to set topic active status');
  }
}
