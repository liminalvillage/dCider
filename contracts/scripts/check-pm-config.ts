import { ethers } from 'hardhat';

async function main() {
  const proposalManagerAddress = '0x6b4B03DA3f92dAb312bf7592733Da8AC013ea254';
  const proposalManager = await ethers.getContractAt('ProposalManager', proposalManagerAddress);

  console.log('ProposalManager address:', proposalManagerAddress);
  console.log('TopicRegistry address (from ProposalManager):', await proposalManager.topicRegistry());
  console.log('DelegationManager address (from ProposalManager):', await proposalManager.delegationManager());
  console.log('VotePowerVerifier address (from ProposalManager):', await proposalManager.votePowerVerifier());

  console.log('\nExpected addresses (from frontend addresses.ts):');
  console.log('TopicRegistry: 0x9d9063f220aA191aAC406De2A5432A577b253827');
  console.log('DelegationManager: 0x4653C8826930F9F293955cc3a904D0114c81637E');
  console.log('VotePowerVerifier: 0x9aef5a8B434BF396049E06050e59D1036Eed7e84');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
