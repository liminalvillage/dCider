/**
 * Verify RewardDistributor deployment and configuration
 */

import hre from "hardhat";
import { formatEther } from "ethers";

async function main() {
  console.log("=== RewardDistributor Verification ===\n");

  const rewardDistributorAddress = "0x8a4f7A29989565F36216Eb82ca030bEb129E039A";
  const votePowerVerifierAddress = "0x9aef5a8B434BF396049E06050e59D1036Eed7e84";

  // Get contracts
  const RewardDistributor = await hre.ethers.getContractAt(
    "RewardDistributorSimple",
    rewardDistributorAddress
  );

  const VotePowerVerifier = await hre.ethers.getContractAt(
    "VotePowerVerifier",
    votePowerVerifierAddress
  );

  console.log("Contract Addresses:");
  console.log("  RewardDistributor:", rewardDistributorAddress);
  console.log("  VotePowerVerifier:", votePowerVerifierAddress);
  console.log();

  // Check VotePowerVerifier configuration
  const verifierAddress = await RewardDistributor.votePowerVerifier();
  console.log("RewardDistributor Configuration:");
  console.log("  VotePowerVerifier:", verifierAddress);
  console.log("  ✅ Matches expected address:", verifierAddress === votePowerVerifierAddress);
  console.log();

  // Check roles
  const VERIFIER_ROLE = await RewardDistributor.VERIFIER_ROLE();
  const ADMIN_ROLE = await RewardDistributor.ADMIN_ROLE();
  const DEFAULT_ADMIN_ROLE = await RewardDistributor.DEFAULT_ADMIN_ROLE();

  const [deployer] = await hre.ethers.getSigners();

  const hasVerifierRole = await RewardDistributor.hasRole(VERIFIER_ROLE, votePowerVerifierAddress);
  const hasAdminRole = await RewardDistributor.hasRole(ADMIN_ROLE, deployer.address);
  const hasDefaultAdminRole = await RewardDistributor.hasRole(
    DEFAULT_ADMIN_ROLE,
    deployer.address
  );

  console.log("Role Configuration:");
  console.log("  VERIFIER_ROLE granted to VotePowerVerifier:", hasVerifierRole ? "✅" : "❌");
  console.log("  ADMIN_ROLE granted to deployer:", hasAdminRole ? "✅" : "❌");
  console.log("  DEFAULT_ADMIN_ROLE granted to deployer:", hasDefaultAdminRole ? "✅" : "❌");
  console.log();

  // Check if VotePowerVerifier has RewardDistributor set
  try {
    const verifierRewardDist = await VotePowerVerifier.rewardDistributor();
    console.log("VotePowerVerifier Configuration:");
    console.log("  RewardDistributor set:", verifierRewardDist);
    if (verifierRewardDist === rewardDistributorAddress) {
      console.log("  ✅ Correctly configured");
    } else if (verifierRewardDist === "0x0000000000000000000000000000000000000000") {
      console.log("  ⚠️  Not yet configured - needs setRewardDistributor() call");
    } else {
      console.log("  ❌ Configured to different address");
    }
  } catch (error: any) {
    console.log("  ❌ Could not read rewardDistributor from VotePowerVerifier");
    console.log("     Error:", error.message);
  }
  console.log();

  // Check pool flow rates for topics 0-5
  console.log("Pool Flow Rates:");
  const secondsPerDay = 86400n;

  for (let topicId = 0; topicId <= 5; topicId++) {
    try {
      const [poolFlowRate, totalDistributed, remainingCapacity] =
        await RewardDistributor.getPoolFlowRate(topicId);

      const dailyCapacity = poolFlowRate * secondsPerDay;

      console.log(`  Topic ${topicId}:`);
      console.log(`    Flow Rate: ${formatEther(poolFlowRate)} tokens/second`);
      console.log(`    Daily Capacity: ${formatEther(dailyCapacity)} tokens/day`);
      console.log(`    Distributed: ${formatEther(totalDistributed)} tokens/second`);
      console.log(`    Remaining: ${formatEther(remainingCapacity)} tokens/second`);

      if (poolFlowRate > 0n) {
        console.log(`    ✅ Configured`);
      } else {
        console.log(`    ⚠️  Not configured`);
      }
    } catch (error: any) {
      console.log(`  Topic ${topicId}: ❌ Error - ${error.message}`);
    }
  }

  console.log();
  console.log("=== Verification Complete ===");
  console.log();

  // Summary
  const allChecks = [hasVerifierRole, hasAdminRole, hasDefaultAdminRole];
  const passedChecks = allChecks.filter((check) => check).length;

  console.log(`Status: ${passedChecks}/${allChecks.length} checks passed`);

  if (passedChecks === allChecks.length) {
    console.log("✅ RewardDistributor is properly configured and ready to use!");
  } else {
    console.log("⚠️  Some configuration issues detected. Review output above.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
