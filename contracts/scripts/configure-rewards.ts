/**
 * Configure RewardDistributor pool flow rates
 *
 * This script sets up the flow rates for each topic
 * Flow rate is in tokens per second
 *
 * Example: 1 token/day = 1 / 86400 = ~0.00001157 tokens/second
 */

import hre from "hardhat";
import { formatEther, parseEther } from "ethers";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Configuring rewards with account:", deployer.address);

  // Get RewardDistributor contract
  const rewardDistributorAddress = "0x8a4f7A29989565F36216Eb82ca030bEb129E039A";
  const RewardDistributor = await hre.ethers.getContractAt(
    "RewardDistributorSimple",
    rewardDistributorAddress
  );

  console.log("RewardDistributor:", rewardDistributorAddress);

  // Check deployer has ADMIN_ROLE
  const ADMIN_ROLE = await RewardDistributor.ADMIN_ROLE();
  const hasAdminRole = await RewardDistributor.hasRole(ADMIN_ROLE, deployer.address);

  if (!hasAdminRole) {
    console.error("❌ Deployer does not have ADMIN_ROLE");
    console.log("Current deployer:", deployer.address);
    return;
  }

  console.log("✅ Deployer has ADMIN_ROLE\n");

  // Configure flow rates for topics 0-5
  // 10 tokens per day per topic = 10 / 86400 seconds
  const tokensPerDay = parseEther("10");
  const secondsPerDay = 86400n;
  const flowRate = tokensPerDay / secondsPerDay;

  console.log(`Setting flow rate: ${formatEther(flowRate)} tokens/second`);
  console.log(`  = ${formatEther(tokensPerDay)} tokens/day\n`);

  const topics = [0, 1, 2, 3, 4, 5];

  for (const topicId of topics) {
    try {
      console.log(`Setting flow rate for topic ${topicId}...`);
      const tx = await RewardDistributor.setPoolFlowRate(topicId, flowRate);
      await tx.wait();

      // Verify
      const [poolFlowRate, totalDistributed, remainingCapacity] =
        await RewardDistributor.getPoolFlowRate(topicId);

      console.log(`✅ Topic ${topicId}:`);
      console.log(`   Pool Flow Rate: ${formatEther(poolFlowRate)} tokens/second`);
      console.log(`   Daily Capacity: ${formatEther(poolFlowRate * secondsPerDay)} tokens/day`);
      console.log(`   Total Distributed: ${formatEther(totalDistributed)} tokens/second`);
      console.log(`   Remaining: ${formatEther(remainingCapacity)} tokens/second\n`);
    } catch (error: any) {
      console.error(`❌ Failed to set flow rate for topic ${topicId}:`, error.message);
    }
  }

  console.log("\n=== Configuration Complete ===");
  console.log(`Total pool capacity: ${formatEther(flowRate * BigInt(topics.length))} tokens/second`);
  console.log(`Total daily capacity: ${formatEther(tokensPerDay * BigInt(topics.length))} tokens/day`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
