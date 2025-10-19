/**
 * Deployment Script for Liquid Democracy Engine
 *
 * Deploys all contracts to specified network
 * Saves deployment addresses to file
 */

import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

interface DeploymentAddresses {
  network: string;
  chainId: number;
  topicRegistry: string;
  votePowerVerifier: string;
  delegationManager: string;
  rewardDistributor: string;
  deployedAt: number;
  deployer: string;
}

async function main() {
  console.log('🚀 Deploying Liquid Democracy Engine contracts...\n');

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log('Deploying with account:', deployer.address);
  console.log('Account balance:', ethers.formatEther(await ethers.provider.getBalance(deployer.address)));
  console.log('Network:', network.name);
  console.log('Chain ID:', network.chainId);
  console.log('');

  // Deploy TopicRegistry
  console.log('📝 Deploying TopicRegistry...');
  const TopicRegistry = await ethers.getContractFactory('TopicRegistry');
  const topicRegistry = await TopicRegistry.deploy();
  await topicRegistry.waitForDeployment();
  const topicRegistryAddress = await topicRegistry.getAddress();
  console.log('  ✓ TopicRegistry deployed to:', topicRegistryAddress);
  console.log('');

  // Deploy VotePowerVerifier
  console.log('🔐 Deploying VotePowerVerifier...');
  const VotePowerVerifier = await ethers.getContractFactory('VotePowerVerifier');
  const votePowerVerifier = await VotePowerVerifier.deploy();
  await votePowerVerifier.waitForDeployment();
  const votePowerVerifierAddress = await votePowerVerifier.getAddress();
  console.log('  ✓ VotePowerVerifier deployed to:', votePowerVerifierAddress);
  console.log('');

  // Deploy DelegationManager
  console.log('⚡ Deploying DelegationManager...');
  const DelegationManager = await ethers.getContractFactory('DelegationManager');
  const delegationManager = await DelegationManager.deploy(topicRegistryAddress);
  await delegationManager.waitForDeployment();
  const delegationManagerAddress = await delegationManager.getAddress();
  console.log('  ✓ DelegationManager deployed to:', delegationManagerAddress);
  console.log('');

  // TODO: Deploy RewardDistributor (requires Superfluid integration)
  console.log('💰 RewardDistributor deployment skipped (TODO: Superfluid integration)');
  const rewardDistributorAddress = '0x0000000000000000000000000000000000000000';
  console.log('');

  // Prepare deployment data
  const deploymentData: DeploymentAddresses = {
    network: network.name,
    chainId: Number(network.chainId),
    topicRegistry: topicRegistryAddress,
    votePowerVerifier: votePowerVerifierAddress,
    delegationManager: delegationManagerAddress,
    rewardDistributor: rewardDistributorAddress,
    deployedAt: Date.now(),
    deployer: deployer.address,
  };

  // Save deployment addresses
  const deploymentsDir = path.join(__dirname, '../deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const filename = `${network.name}-${network.chainId}.json`;
  const filepath = path.join(deploymentsDir, filename);

  fs.writeFileSync(filepath, JSON.stringify(deploymentData, null, 2));

  console.log('📄 Deployment addresses saved to:', filepath);
  console.log('');

  // Print summary
  console.log('='.repeat(60));
  console.log('🎉 Deployment Summary');
  console.log('='.repeat(60));
  console.log('TopicRegistry:       ', topicRegistryAddress);
  console.log('VotePowerVerifier:   ', votePowerVerifierAddress);
  console.log('DelegationManager:   ', delegationManagerAddress);
  console.log('RewardDistributor:   ', rewardDistributorAddress, '(TODO)');
  console.log('='.repeat(60));
  console.log('');

  // Generate .env template
  console.log('📋 Environment Variables (add to .env):');
  console.log('');
  console.log(`PUBLIC_DELEGATION_MANAGER_ADDRESS=${delegationManagerAddress}`);
  console.log(`PUBLIC_TOPIC_REGISTRY_ADDRESS=${topicRegistryAddress}`);
  console.log(`PUBLIC_VOTEPOWER_VERIFIER_ADDRESS=${votePowerVerifierAddress}`);
  console.log(`PUBLIC_REWARD_DISTRIBUTOR_ADDRESS=${rewardDistributorAddress}`);
  console.log('');

  console.log('✅ Deployment complete!');
  console.log('');
  console.log('Next steps:');
  console.log('1. Verify contracts on block explorer (see README)');
  console.log('2. Run setup-topics.ts to create initial topics');
  console.log('3. Configure enclave operators');
  console.log('4. Update frontend .env with contract addresses');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
