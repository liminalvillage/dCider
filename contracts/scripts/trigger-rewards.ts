/**
 * Manual Reward Trigger Script (Development Mode)
 *
 * This script bypasses the enclave and manually triggers reward updates by:
 * 1. Calculating voting power for a topic from on-chain delegation data
 * 2. Creating a mock attestation
 * 3. Submitting it to VotePowerVerifier
 * 4. VotePowerVerifier automatically calls RewardDistributor.updateFlows()
 *
 * This allows testing rewards without running a full enclave service.
 */

import { ethers } from "hardhat";
import { calculateVotingPower, VotingPowerResult } from "./calculate-vote-power";

async function main() {
  console.log("💰 Manual Reward Trigger - Development Mode\n");

  const [operator] = await ethers.getSigners();
  console.log("Operator account:", operator.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(operator.address)), "xDAI\n");

  // Updated contract addresses
  const delegationManagerAddress = "0x4c8875ac664bb0a94f5eE71b232A786772Fdd704";
  const votePowerVerifierAddress = "0x156ee62c9bf96F28b5aacf37C5B73935CA1d71C3"; // NEW
  const rewardDistributorAddress = "0x8a4f7A29989565F36216Eb82ca030bEb129E039A";

  // Get topic ID from environment variable or default to 0
  const topicId = process.env.TOPIC_ID ? parseInt(process.env.TOPIC_ID) : 0;

  console.log("📋 Configuration:");
  console.log("  DelegationManager:", delegationManagerAddress);
  console.log("  VotePowerVerifier:", votePowerVerifierAddress);
  console.log("  RewardDistributor:", rewardDistributorAddress);
  console.log("  Topic ID:", topicId);
  console.log("");

  // Step 1: Calculate voting power from on-chain delegation data
  console.log("📊 Step 1: Calculate voting power from delegation graph...");
  const votingPowerResults = await calculateVotingPower(delegationManagerAddress, topicId);

  if (votingPowerResults.length === 0) {
    console.log("⚠️  No delegations found for this topic.");
    console.log("💡 Try delegating some votes first, then run this script again.\n");
    return;
  }

  const totalPower = votingPowerResults.reduce((sum, r) => sum + r.power, 0);
  console.log(`✅ Found ${votingPowerResults.length} delegates with ${totalPower} total voting power\n`);

  // Step 2: Prepare attestation data
  console.log("📝 Step 2: Prepare attestation data...");

  const addresses = votingPowerResults.map(r => r.address);
  const powers = votingPowerResults.map(r => BigInt(r.power));

  // Calculate result hash
  const resultHash = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["address[]", "uint256[]"],
      [addresses, powers]
    )
  );

  console.log("  Addresses:", addresses.length);
  console.log("  Powers:", powers.map(p => p.toString()));
  console.log("  Result hash:", resultHash);

  // Generate unique nonce
  const nonce = Date.now();
  const blockNumber = await ethers.provider.getBlockNumber();

  console.log("  Block number:", blockNumber);
  console.log("  Nonce:", nonce);
  console.log("");

  // Step 3: Sign the attestation
  console.log("✍️  Step 3: Create operator signature...");

  // Sign the result hash (this simulates the enclave signature)
  const messageHash = ethers.solidityPackedKeccak256(["bytes32"], [resultHash]);
  const signature = await operator.signMessage(ethers.getBytes(messageHash));

  console.log("  Signature:", signature.slice(0, 20) + "...");
  console.log("");

  // Step 4: Submit attestation
  console.log("📤 Step 4: Submit attestation to VotePowerVerifier...");

  const votePowerVerifier = await ethers.getContractAt(
    "VotePowerVerifier",
    votePowerVerifierAddress
  );

  // Check if operator is registered
  const isOp = await votePowerVerifier.isOperator(operator.address);

  if (!isOp) {
    console.log("⚠️  Operator not registered!");
    console.log("Attempting to add operator...");

    try {
      const addTx = await votePowerVerifier.addOperator(operator.address, "Dev operator");
      await addTx.wait();
      console.log("✅ Operator added successfully");
    } catch (err: any) {
      console.error("❌ Failed to add operator:", err.message);
      console.log("\nYou may need admin access to add operators.");
      return;
    }
  } else {
    console.log("✅ Operator is registered");
  }

  // Check RewardDistributor connection
  console.log("\n🔗 Verifying RewardDistributor connection...");
  const connectedRewardDistributor = await votePowerVerifier.rewardDistributor();
  console.log("  Connected to:", connectedRewardDistributor);

  if (connectedRewardDistributor.toLowerCase() !== rewardDistributorAddress.toLowerCase()) {
    console.log("⚠️  Warning: RewardDistributor address mismatch!");
    console.log("  Expected:", rewardDistributorAddress);
  } else {
    console.log("✅ RewardDistributor correctly connected");
  }

  // Prepare attestation struct
  const attestation = {
    resultHash,
    topicId,
    blockNumber,
    nonce,
    signatures: [signature]
  };

  console.log("\n📨 Submitting attestation...");

  try {
    const tx = await votePowerVerifier.submitAttestation(
      attestation,
      addresses,
      powers
    );

    console.log("  Transaction hash:", tx.hash);
    console.log("  Waiting for confirmation...");

    const receipt = await tx.wait();
    console.log("✅ Transaction confirmed!");
    console.log("  Gas used:", receipt?.gasUsed.toString());

    // Step 5: Verify reward flows were created
    console.log("\n💎 Step 5: Verify reward flows...");

    const RewardDistributor = await ethers.getContractAt(
      "RewardDistributorSimple",
      rewardDistributorAddress
    );

    // Get pool info
    const [poolFlowRate, totalDistributed, remainingCapacity] =
      await RewardDistributor.getPoolFlowRate(topicId);

    console.log("\n  Pool Status:");
    console.log("    Pool Flow Rate:", ethers.formatEther(poolFlowRate * 86400n), "tokens/day");
    console.log("    Total Distributed:", ethers.formatEther(totalDistributed * 86400n), "tokens/day");
    console.log("    Remaining Capacity:", ethers.formatEther(remainingCapacity * 86400n), "tokens/day");

    // Check each delegate's flow
    console.log("\n  Delegate Rewards:");
    for (const result of votingPowerResults) {
      const [flowRate, totalStreamed, lastUpdated] =
        await RewardDistributor.getFlowRate(result.address, topicId);

      if (flowRate > 0) {
        const perDay = flowRate * 86400n;
        const perMonth = perDay * 30n;

        console.log(`    ${result.address}:`);
        console.log(`      Voting Power: ${result.power}`);
        console.log(`      Flow Rate: ${ethers.formatEther(perDay)} tokens/day`);
        console.log(`      Monthly: ~${ethers.formatEther(perMonth)} tokens`);
      }
    }

    console.log("\n🎉 Success! Reward flows have been created!");
    console.log("\n💡 Next Steps:");
    console.log("  1. Open the frontend at /rewards");
    console.log("  2. Select topic", topicId);
    console.log("  3. You should now see active reward streams!");
    console.log("\n  To trigger rewards for other topics:");
    console.log("  npx hardhat run scripts/trigger-rewards.ts --network chiado <topicId>");

  } catch (error: any) {
    console.error("\n❌ Error submitting attestation:");
    console.error(error.message);

    if (error.message.includes("InsufficientSignatures")) {
      console.log("\n💡 The contract requires multiple signatures (M-of-N).");
      console.log("  Current threshold: 3 signatures");
      console.log("  Provided: 1 signature");
      console.log("\n  For development testing, you may need to:");
      console.log("  1. Lower the threshold in VotePowerVerifier");
      console.log("  2. Or add multiple operators and collect signatures");
    }

    if (error.message.includes("NonceAlreadyUsed")) {
      console.log("\n💡 This nonce was already used.");
      console.log("  The script uses timestamp as nonce, so wait 1 second and try again.");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
