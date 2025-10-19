import { ethers } from "hardhat";
import { calculateVotingPower } from "./calculate-vote-power";
import * as crypto from "crypto";

/**
 * Mock Enclave Operator Service
 *
 * This script simulates an enclave operator that:
 * 1. Calculates voting power for a topic
 * 2. Creates an attestation
 * 3. Signs it with operator keys
 * 4. Submits to VotePowerVerifier
 *
 * In production, this would run inside Enclave.gg TEE
 */

async function main() {
  console.log("🔐 Mock Enclave Operator - Attestation Submission\n");

  const [deployer] = await ethers.getSigners();
  console.log("Operator account:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "xDAI\n");

  // Contract addresses (hardcoded for Chiado)
  const delegationManagerAddress = "0x642421767A8bBB0ca27800a02Ec87b58a4dAE35A";
  const votePowerVerifierAddress = "0x2844871F06BED295aeF95f7e1e0a16360A942DBF";

  const topicId = 1; // Climate Policy

  // Step 1: Calculate voting power
  console.log("📊 Step 1: Calculate voting power...");
  const votingPowerResults = await calculateVotingPower(delegationManagerAddress, topicId);

  if (votingPowerResults.length === 0) {
    console.log("⚠️  No delegations found for this topic. Nothing to submit.");
    return;
  }

  // Step 2: Prepare attestation data
  console.log("\n📝 Step 2: Prepare attestation data...");

  const addresses = votingPowerResults.map(r => r.address);
  const powers = votingPowerResults.map(r => r.power);

  console.log("Addresses:", addresses.length);
  console.log("Powers:", powers);

  // Calculate result hash
  const resultHash = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["address[]", "uint256[]"],
      [addresses, powers]
    )
  );

  console.log("Result hash:", resultHash);

  // Generate nonce (should be unique per attestation)
  const nonce = Date.now();

  // Get current block number
  const blockNumber = await ethers.provider.getBlockNumber();

  console.log("Block number:", blockNumber);
  console.log("Nonce:", nonce);
  console.log("Topic ID:", topicId);

  // Step 3: Sign the attestation
  console.log("\n✍️  Step 3: Sign attestation...");

  // In a real enclave, this would be signed by the enclave's private key
  // For now, we sign with the deployer's key
  const messageHash = ethers.solidityPackedKeccak256(
    ["bytes32"],
    [resultHash]
  );

  const signature = await deployer.signMessage(ethers.getBytes(messageHash));
  console.log("Signature:", signature.slice(0, 20) + "...");

  // Step 4: Submit attestation to VotePowerVerifier
  console.log("\n📤 Step 4: Submit to VotePowerVerifier...");

  const votePowerVerifier = await ethers.getContractAt(
    "VotePowerVerifier",
    votePowerVerifierAddress
  );

  // Check if operator is registered
  const [isOp, active] = await votePowerVerifier.isOperator(deployer.address);

  if (!isOp) {
    console.log("\n⚠️  Operator not registered!");
    console.log("Run the following command to register:");
    console.log(`npx hardhat run scripts/register-operator.ts --network chiado`);
    return;
  }

  if (!active) {
    console.log("\n⚠️  Operator is registered but not active!");
    return;
  }

  console.log("✓ Operator is registered and active");

  // Prepare attestation struct
  const attestation = {
    resultHash,
    topicId,
    blockNumber,
    nonce,
    signatures: [signature] // Single signature for now
  };

  try {
    const tx = await votePowerVerifier.submitAttestation(
      attestation,
      addresses,
      powers
    );

    console.log("\nTransaction sent:", tx.hash);
    console.log("Waiting for confirmation...");

    const receipt = await tx.wait();
    console.log("✅ Attestation submitted successfully!");
    console.log("Gas used:", receipt.gasUsed.toString());

    // Verify the cached power
    console.log("\n🔍 Verifying cached voting power...");
    for (const result of votingPowerResults) {
      const [power, lastUpdated, attestationHash] =
        await votePowerVerifier.getVotingPower(result.address, topicId);

      console.log(`  ${result.address}:`);
      console.log(`    Power: ${power.toString()}`);
      console.log(`    Last updated: ${new Date(Number(lastUpdated) * 1000).toLocaleString()}`);
      console.log(`    Attestation: ${attestationHash.slice(0, 10)}...`);
    }

    console.log("\n🎉 Vote power attestation complete!");
    console.log("\nProposals on this topic will now use weighted voting!");

  } catch (error: any) {
    console.error("\n❌ Error submitting attestation:");
    console.error(error.message);

    if (error.message.includes("InsufficientSignatures")) {
      console.log("\n💡 This error means the contract requires M-of-N signatures.");
      console.log("Current threshold: 3 signatures required");
      console.log("You provided: 1 signature");
      console.log("\nFor MVP testing, you can:");
      console.log("1. Lower the threshold (if you have admin access)");
      console.log("2. Add more operators and collect signatures");
      console.log("3. Use a test deployment with threshold=1");
    }

    if (error.message.includes("NonceAlreadyUsed")) {
      console.log("\n💡 This nonce was already used. Try again with a new nonce.");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
