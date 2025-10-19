import { ethers } from 'hardhat';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying with account:', await deployer.getAddress());

  // Use the CURRENT contract addresses (from addresses.ts)
  const topicRegistry = '0x9d9063f220aA191aAC406De2A5432A577b253827';
  const delegationManager = '0x4653C8826930F9F293955cc3a904D0114c81637E';
  const votePowerVerifier = '0x9aef5a8B434BF396049E06050e59D1036Eed7e84';

  console.log('\nDeploying ProposalManager with:');
  console.log('  TopicRegistry:', topicRegistry);
  console.log('  DelegationManager:', delegationManager);
  console.log('  VotePowerVerifier:', votePowerVerifier);

  const ProposalManager = await ethers.getContractFactory('ProposalManager');
  const proposalManager = await ProposalManager.deploy(
    topicRegistry,
    delegationManager,
    votePowerVerifier
  );

  await proposalManager.waitForDeployment();

  const address = await proposalManager.getAddress();
  console.log('\n✅ ProposalManager deployed to:', address);

  console.log('\nUpdate frontend/src/lib/contracts/addresses.ts with:');
  console.log(`  proposalManager: '${address}',`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
