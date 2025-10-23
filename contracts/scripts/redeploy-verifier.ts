/**
 * Redeploy VotePowerVerifier with reward distribution support
 * 
 * This will deploy a new VotePowerVerifier and update the addresses
 */

import { ethers } from 'hardhat';

async function main() {
  console.log('🔐 Redeploying VotePowerVerifier with reward support...\n');

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log('Deploying with account:', deployer.address);
  console.log('Balance:', ethers.formatEther(await ethers.provider.getBalance(deployer.address)), 'ETH');
  console.log('Network:', network.name);
  console.log('Chain ID:', network.chainId);
  console.log('');

  // Deploy VotePowerVerifier
  console.log('Deploying VotePowerVerifier...');
  const VotePowerVerifier = await ethers.getContractFactory('VotePowerVerifier');
  const votePowerVerifier = await VotePowerVerifier.deploy();
  await votePowerVerifier.waitForDeployment();
  const votePowerVerifierAddress = await votePowerVerifier.getAddress();
  console.log('✅ VotePowerVerifier deployed to:', votePowerVerifierAddress);
  console.log('');

  // Verify it has the setRewardDistributor function
  console.log('Verifying reward distribution support...');
  try {
    const currentDistributor = await votePowerVerifier.rewardDistributor();
    console.log('✅ rewardDistributor getter exists, currently:', currentDistributor);
  } catch (err) {
    console.log('❌ rewardDistributor getter failed');
  }

  // Set the RewardDistributor
  const rewardDistributorAddress = "0x8a4f7A29989565F36216Eb82ca030bEb129E039A";
  console.log('\nConnecting RewardDistributor:', rewardDistributorAddress);
  
  const tx = await votePowerVerifier.setRewardDistributor(rewardDistributorAddress);
  await tx.wait();
  console.log('✅ RewardDistributor connected!');

  // Verify
  const set = await votePowerVerifier.rewardDistributor();
  console.log('Verification - RewardDistributor set to:', set);

  // Add any operators if needed (copy from old contract)
  const oldVerifierAddress = "0x9aef5a8B434BF396049E06050e59D1036Eed7e84";
  console.log('\nNote: You may need to migrate operators from old VotePowerVerifier:', oldVerifierAddress);

  console.log('\n=== Deployment Complete ===');
  console.log('New VotePowerVerifier:', votePowerVerifierAddress);
  console.log('Connected to RewardDistributor:', rewardDistributorAddress);
  console.log('');
  console.log('⚠️  IMPORTANT: Update contract addresses in:');
  console.log('  1. frontend/src/lib/contracts/addresses.ts');
  console.log('  2. enclave configuration');
  console.log('  3. Any other services using the old address');
  console.log('');
  console.log('⚠️  IMPORTANT: Grant VERIFIER_ROLE on RewardDistributor to new VotePowerVerifier');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
