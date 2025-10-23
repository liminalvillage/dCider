/**
 * Finalize VotePowerVerifier setup
 * 1. Grant VERIFIER_ROLE on RewardDistributor to new VotePowerVerifier
 * 2. Migrate operators from old to new VotePowerVerifier
 */

import { ethers } from 'hardhat';

async function main() {
  console.log('🔧 Finalizing VotePowerVerifier setup...\n');

  const [deployer] = await ethers.getSigners();

  const oldVerifierAddress = "0x9aef5a8B434BF396049E06050e59D1036Eed7e84";
  const newVerifierAddress = "0x156ee62c9bf96F28b5aacf37C5B73935CA1d71C3";
  const rewardDistributorAddress = "0x8a4f7A29989565F36216Eb82ca030bEb129E039A";

  console.log('Deployer:', deployer.address);
  console.log('Old VotePowerVerifier:', oldVerifierAddress);
  console.log('New VotePowerVerifier:', newVerifierAddress);
  console.log('RewardDistributor:', rewardDistributorAddress);
  console.log('');

  // 1. Grant VERIFIER_ROLE on RewardDistributor
  console.log('Step 1: Granting VERIFIER_ROLE on RewardDistributor...');
  const RewardDistributor = await ethers.getContractAt(
    'RewardDistributorSimple',
    rewardDistributorAddress
  );

  const VERIFIER_ROLE = await RewardDistributor.VERIFIER_ROLE();
  const hasRole = await RewardDistributor.hasRole(VERIFIER_ROLE, newVerifierAddress);

  if (!hasRole) {
    const tx1 = await RewardDistributor.grantRole(VERIFIER_ROLE, newVerifierAddress);
    await tx1.wait();
    console.log('✅ VERIFIER_ROLE granted to new VotePowerVerifier');
  } else {
    console.log('✅ New VotePowerVerifier already has VERIFIER_ROLE');
  }

  // Revoke from old verifier
  const oldHasRole = await RewardDistributor.hasRole(VERIFIER_ROLE, oldVerifierAddress);
  if (oldHasRole) {
    const tx2 = await RewardDistributor.revokeRole(VERIFIER_ROLE, oldVerifierAddress);
    await tx2.wait();
    console.log('✅ VERIFIER_ROLE revoked from old VotePowerVerifier');
  }

  console.log('');

  // 2. Migrate operators
  console.log('Step 2: Migrating operators...');
  const OldVerifier = await ethers.getContractAt('VotePowerVerifier', oldVerifierAddress);
  const NewVerifier = await ethers.getContractAt('VotePowerVerifier', newVerifierAddress);

  try {
    const operators = await OldVerifier.getOperators();
    console.log(`Found ${operators.length} operators in old contract`);

    for (const operator of operators) {
      console.log(`  Migrating operator: ${operator}`);
      
      // Check if already added
      const isOperator = await NewVerifier.isOperator(operator);
      if (!isOperator) {
        const tx = await NewVerifier.addOperator(operator, "Migrated operator");
        await tx.wait();
        console.log(`    ✅ Added`);
      } else {
        console.log(`    ✅ Already exists`);
      }
    }

    console.log('✅ All operators migrated');
  } catch (err: any) {
    console.log('⚠️  Could not migrate operators:', err.message);
    console.log('   You may need to manually add operators to the new contract');
  }

  console.log('');
  console.log('=== Setup Complete ===');
  console.log('New VotePowerVerifier is ready to receive attestations and trigger reward updates!');
  console.log('');
  console.log('Next steps:');
  console.log('  1. Update frontend addresses');
  console.log('  2. Update enclave configuration');
  console.log('  3. Test with a delegation and attestation');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
