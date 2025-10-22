import { ethers } from 'hardhat';

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log('Deploying with account:', deployer.address);
  console.log();
  
  // Get existing addresses
  const topicRegistryAddress = '0x9d9063f220aA191aAC406De2A5432A577b253827';
  
  console.log('Deploying DelegationManager with:');
  console.log('  TopicRegistry:', topicRegistryAddress);
  console.log();
  
  const DelegationManager = await ethers.getContractFactory('DelegationManager');
  const delegationManager = await DelegationManager.deploy(topicRegistryAddress);
  await delegationManager.waitForDeployment();
  
  const address = await delegationManager.getAddress();
  console.log('✅ DelegationManager deployed to:', address);
  console.log();
  console.log('Update frontend/src/lib/contracts/addresses.ts with:');
  console.log(`  delegationManager: '${address}',`);
  console.log();
  console.log('⚠️  You will also need to redeploy ProposalManager with the new DelegationManager address!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
