import { ethers } from 'hardhat';

async function main() {
  const [signer] = await ethers.getSigners();
  const userAddress = await signer.getAddress();

  console.log('User address:', userAddress);

  // Contract addresses from your deployment
  const delegationManagerAddress = '0x4653C8826930F9F293955cc3a904D0114c81637E';
  const proposalManagerAddress = '0x6b4B03DA3f92dAb312bf7592733Da8AC013ea254';

  const topicId = 5; // Climate topic

  // Get contracts
  const delegationManager = await ethers.getContractAt('DelegationManager', delegationManagerAddress);
  const proposalManager = await ethers.getContractAt('ProposalManager', proposalManagerAddress);

  console.log('\n=== Checking delegation status ===');

  // Check if user has delegation
  const delegation = await delegationManager.getDelegation(userAddress, topicId);
  console.log('Delegation:', delegation);

  // Get terminal delegate
  const terminal = await delegationManager.getTerminalDelegate(userAddress, topicId);
  console.log('Terminal delegate:', terminal);
  console.log('Is user their own terminal?', terminal.toLowerCase() === userAddress.toLowerCase());

  // Try to estimate gas for createProposal
  console.log('\n=== Testing proposal creation ===');

  const params = {
    topicId: topicId,
    title: 'Test Proposal',
    descriptionCID: 'test123',
    votingPeriod: 50400
  };

  try {
    console.log('Attempting to estimate gas...');
    const gasEstimate = await proposalManager.createProposal.estimateGas(params);
    console.log('✅ Gas estimate succeeded:', gasEstimate.toString());
  } catch (error: any) {
    console.error('❌ Gas estimate failed');
    console.error('Error data:', error.data);
    console.error('Error message:', error.message);

    // Try to decode the error
    if (error.data) {
      console.log('\nDecoding error...');
      const iface = new ethers.Interface([
        'error InvalidTopic()',
        'error InsufficientVotingPower()',
        'error InvalidVotingPeriod()',
        'error ProposalNotActive()',
        'error AlreadyVoted()',
      ]);

      try {
        const decodedError = iface.parseError(error.data);
        console.log('Decoded error:', decodedError?.name);
      } catch (e) {
        console.log('Could not decode error');

        // Calculate error selectors manually
        console.log('\nError selector mappings:');
        const errors = [
          'InvalidTopic()',
          'InsufficientVotingPower()',
          'InvalidVotingPeriod()',
          'ProposalNotActive()',
          'AlreadyVoted()',
        ];

        errors.forEach(err => {
          const selector = ethers.id(err).slice(0, 10);
          console.log(`${err}: ${selector}`);
        });

        console.log(`\nReceived error data: ${error.data}`);
      }
    }
  }

  // Check topic status
  console.log('\n=== Checking topic status ===');
  const topicRegistry = await ethers.getContractAt(
    'TopicRegistry',
    await proposalManager.topicRegistry()
  );

  try {
    const topic = await topicRegistry.getTopic(topicId);
    console.log('Topic exists:', true);
    console.log('Topic active:', topic.active);
  } catch (e) {
    console.log('Topic does not exist or error:', e);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
