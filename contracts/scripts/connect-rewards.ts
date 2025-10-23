/**
 * Connect RewardDistributor to VotePowerVerifier
 *
 * This script calls setRewardDistributor() on VotePowerVerifier
 * to enable automatic reward updates when attestations are submitted
 */

import hre from "hardhat";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Connecting rewards with account:", deployer.address);

  // Contract addresses
  const votePowerVerifierAddress = "0x9aef5a8B434BF396049E06050e59D1036Eed7e84";
  const rewardDistributorAddress = "0x8a4f7A29989565F36216Eb82ca030bEb129E039A";

  console.log("VotePowerVerifier:", votePowerVerifierAddress);
  console.log("RewardDistributor:", rewardDistributorAddress);

  // Get VotePowerVerifier contract
  const VotePowerVerifier = await hre.ethers.getContractAt(
    "VotePowerVerifier",
    votePowerVerifierAddress
  );

  // Check if deployer has ADMIN role
  const ADMIN_ROLE = await VotePowerVerifier.DEFAULT_ADMIN_ROLE();
  const hasAdminRole = await VotePowerVerifier.hasRole(ADMIN_ROLE, deployer.address);

  if (!hasAdminRole) {
    console.error("❌ Deployer does not have DEFAULT_ADMIN_ROLE");
    console.log("Current deployer:", deployer.address);
    return;
  }

  console.log("✅ Deployer has DEFAULT_ADMIN_ROLE\n");

  // Check current rewardDistributor value
  try {
    const currentDistributor = await VotePowerVerifier.rewardDistributor();
    console.log("Current RewardDistributor:", currentDistributor);

    if (currentDistributor === rewardDistributorAddress) {
      console.log("✅ RewardDistributor already set correctly!");
      return;
    }
  } catch (error: any) {
    console.log("RewardDistributor not yet set");
  }

  // Set RewardDistributor
  console.log("\nSetting RewardDistributor...");
  const tx = await VotePowerVerifier.setRewardDistributor(rewardDistributorAddress);
  console.log("Transaction hash:", tx.hash);
  
  await tx.wait();
  console.log("✅ Transaction confirmed!");

  // Verify
  const newDistributor = await VotePowerVerifier.rewardDistributor();
  console.log("\nVerification:");
  console.log("  RewardDistributor:", newDistributor);
  console.log("  Expected:", rewardDistributorAddress);
  console.log("  Match:", newDistributor === rewardDistributorAddress ? "✅" : "❌");

  console.log("\n=== Connection Complete ===");
  console.log("Rewards will now automatically update when attestations are submitted!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
