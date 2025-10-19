/**
 * Setup Script for Initial Topics
 *
 * Creates initial governance topics for testing
 */

import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

interface Topic {
  name: string;
  description: string;
  proposalThreshold: number;
}

// Initial topics for MVP
const INITIAL_TOPICS: Topic[] = [
  {
    name: 'Climate Policy',
    description: 'Decisions related to climate change initiatives and environmental policy',
    proposalThreshold: 10, // Minimum 10 voting power to create proposals
  },
  {
    name: 'Education',
    description: 'Educational system reforms and funding decisions',
    proposalThreshold: 10,
  },
  {
    name: 'Treasury Management',
    description: 'Management of community treasury and financial decisions',
    proposalThreshold: 20, // Higher threshold for financial decisions
  },
  {
    name: 'Technical Upgrades',
    description: 'Protocol upgrades and technical improvements',
    proposalThreshold: 15,
  },
];

async function main() {
  console.log('🎯 Setting up initial topics...\n');

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log('Setting up with account:', deployer.address);
  console.log('Network:', network.name);
  console.log('');

  // Load deployment addresses
  const deploymentsDir = path.join(__dirname, '../deployments');
  const filename = `${network.name}-${network.chainId}.json`;
  const filepath = path.join(deploymentsDir, filename);

  if (!fs.existsSync(filepath)) {
    throw new Error(`Deployment file not found: ${filepath}\nRun deploy.ts first.`);
  }

  const deploymentData = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  const topicRegistryAddress = deploymentData.topicRegistry;

  console.log('TopicRegistry address:', topicRegistryAddress);
  console.log('');

  // Get TopicRegistry contract
  const TopicRegistry = await ethers.getContractFactory('TopicRegistry');
  const topicRegistry = TopicRegistry.attach(topicRegistryAddress);

  // Create topics
  const createdTopics: { id: number; name: string }[] = [];

  for (const topic of INITIAL_TOPICS) {
    console.log(`Creating topic: "${topic.name}"...`);

    // Generate description CID (mock for now - in production use actual IPFS)
    const descriptionCID = ethers.keccak256(ethers.toUtf8Bytes(topic.description));

    try {
      const tx = await topicRegistry.createTopic(
        topic.name,
        descriptionCID,
        topic.proposalThreshold
      );

      console.log('  Transaction hash:', tx.hash);
      const receipt = await tx.wait();

      // Get topic ID from event
      const event = receipt?.logs
        .map((log: any) => {
          try {
            return topicRegistry.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((parsed: any) => parsed?.name === 'TopicCreated');

      const topicId = event ? Number(event.args[0]) : -1;

      console.log(`  ✓ Topic created with ID: ${topicId}`);
      console.log('');

      createdTopics.push({
        id: topicId,
        name: topic.name,
      });
    } catch (error: any) {
      console.error(`  ✗ Failed to create topic: ${error.message}`);
      console.log('');
    }
  }

  // Verify topics
  console.log('🔍 Verifying created topics...\n');

  for (const { id, name } of createdTopics) {
    const topic = await topicRegistry.getTopic(id);
    console.log(`Topic ${id}: ${topic.name}`);
    console.log(`  Active: ${topic.active}`);
    console.log(`  Proposal Threshold: ${topic.proposalThreshold}`);
    console.log(`  Admin: ${topic.admin}`);
    console.log('');
  }

  console.log('='.repeat(60));
  console.log('✅ Topic setup complete!');
  console.log('='.repeat(60));
  console.log(`Total topics created: ${createdTopics.length}`);
  console.log('');
  console.log('Topics:');
  createdTopics.forEach(({ id, name }) => {
    console.log(`  ${id}: ${name}`);
  });
  console.log('');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
