import { ethers } from 'hardhat';

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log('Deploying with account:', deployer.address);
  console.log();
  
  // Existing addresses
  const topicRegistryAddress = '0x9d9063f220aA191aAC406De2A5432A577b253827';
  const votePowerVerifierAddress = '0x9aef5a8B434BF396049E06050e59D1036Eed7e84';
  const newDelegationManagerAddress = '0x4c8875ac664bb0a94f5eE71b232A786772Fdd704'; // NEW!
  
  console.log('Deploying ProposalManager with:');
  console.log('  TopicRegistry:', topicRegistryAddress);
  console.log('  DelegationManager:', newDelegationManagerAddress);
  console.log('  VotePowerVerifier:', votePowerVerifierAddress);
  console.log();
  
  const ProposalManager = await ethers.getContractFactory('ProposalManager');
  const proposalManager = await ProposalManager.deploy(
    topicRegistryAddress,
    newDelegationManagerAddress,
    votePowerVerifierAddress
  );
  await proposalManager.waitForDeployment();
  
  const address = await proposalManager.getAddress();
  console.log('✅ ProposalManager deployed to:', address);
  console.log();
  console.log('Update frontend/src/lib/contracts/addresses.ts with:');
  console.log(`  proposalManager: '${address}',`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
