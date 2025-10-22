import { ethers } from 'hardhat';

async function main() {
  const [signer] = await ethers.getSigners();
  
  console.log('\n🧪 Testing NEW Voting Power Calculation...\n');
  console.log('Account:', signer.address);
  
  const delegationManager = await ethers.getContractAt(
    'DelegationManager',
    '0x4c8875ac664bb0a94f5eE71b232A786772Fdd704'  // New address
  );
  
  const topicId = 5; // Climate
  const terminalAddress = '0x672b8071676FB3eA9bc7E27E9120EdCD89C54C80';
  
  console.log('Topic ID:', topicId);
  console.log('Terminal Address:', terminalAddress);
  console.log();
  
  // Try to calculate voting power (should work even with no delegations)
  try {
    const votingPower = await delegationManager.calculateVotingPower(terminalAddress, topicId);
    console.log('✅ Voting Power (no delegations yet):', votingPower.toString());
    console.log('   Expected: 1 (only terminal\'s own vote)');
  } catch (error: any) {
    console.log('❌ Error calculating voting power:', error.message);
  }
  
  console.log('\n⚠️  Note: You need to recreate the delegations on the new DelegationManager!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
