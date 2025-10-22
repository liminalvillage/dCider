import { ethers } from 'hardhat';

async function main() {
  const [signer] = await ethers.getSigners();
  
  console.log('\n🧪 Testing Voting Power Calculation...\n');
  console.log('Account:', signer.address);
  
  const delegationManager = await ethers.getContractAt(
    'DelegationManager',
    '0x4653C8826930F9F293955cc3a904D0114c81637E'
  );
  
  const topicId = 5; // Climate
  const terminalAddress = '0x672b8071676FB3eA9bc7E27E9120EdCD89C54C80';
  
  console.log('Topic ID:', topicId);
  console.log('Terminal Address:', terminalAddress);
  console.log();
  
  // Check terminal delegate status
  const terminalDelegation = await delegationManager.getDelegation(terminalAddress, topicId);
  console.log('Terminal delegation info:');
  console.log('  - Delegated to:', terminalDelegation.delegate);
  console.log('  - Is terminal (not delegating):', terminalDelegation.delegate === ethers.ZeroAddress);
  console.log();
  
  // Get all delegators
  const delegators = await delegationManager.getTopicDelegators(topicId);
  console.log('All delegators for topic:', delegators);
  console.log('  Count:', delegators.length);
  console.log('  Terminal in list:', delegators.includes(terminalAddress));
  console.log();
  
  // Calculate voting power
  try {
    const votingPower = await delegationManager.calculateVotingPower(terminalAddress, topicId);
    console.log('✅ Voting Power:', votingPower.toString());
  } catch (error: any) {
    console.log('❌ Error calculating voting power:', error.message);
  }
  
  // Manual calculation
  console.log('\n📊 Manual calculation:');
  let manualPower = 1; // Terminal's own vote
  for (const delegator of delegators) {
    const terminal = await delegationManager.getTerminalDelegate(delegator, topicId);
    console.log(`  - ${delegator} → terminal: ${terminal}`);
    if (terminal === terminalAddress) {
      manualPower++;
    }
  }
  console.log('  Expected voting power:', manualPower);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
