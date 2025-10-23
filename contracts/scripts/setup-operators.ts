/**
 * Setup operators on new VotePowerVerifier
 */

import { ethers } from 'hardhat';

async function main() {
  console.log('👥 Setting up operators on new VotePowerVerifier...\n');

  const [deployer] = await ethers.getSigners();
  const newVerifierAddress = "0x156ee62c9bf96F28b5aacf37C5B73935CA1d71C3";

  console.log('Deployer:', deployer.address);
  console.log('New VotePowerVerifier:', newVerifierAddress);
  console.log('');

  const NewVerifier = await ethers.getContractAt('VotePowerVerifier', newVerifierAddress);

  // Add deployer as operator for testing (they can sign attestations)
  console.log('Adding deployer as operator...');
  const isOperator = await NewVerifier.isOperator(deployer.address);
  
  if (!isOperator) {
    const tx = await NewVerifier.addOperator(deployer.address, "Primary operator");
    await tx.wait();
    console.log('✅ Deployer added as operator');
  } else {
    console.log('✅ Deployer is already an operator');
  }

  // List all operators
  const operators = await NewVerifier.getOperators();
  console.log('\nCurrent operators:');
  for (const op of operators) {
    console.log(`  - ${op}`);
  }

  console.log('\n✅ Operator setup complete!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
