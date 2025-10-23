/**
 * Connect RewardDistributor to VotePowerVerifier with debugging
 */

import hre from "hardhat";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH\n");

  const votePowerVerifierAddress = "0x9aef5a8B434BF396049E06050e59D1036Eed7e84";
  const rewardDistributorAddress = "0x8a4f7A29989565F36216Eb82ca030bEb129E039A";

  const VotePowerVerifier = await hre.ethers.getContractAt(
    "VotePowerVerifier",
    votePowerVerifierAddress
  );

  // Check admin role
  const ADMIN_ROLE = await VotePowerVerifier.DEFAULT_ADMIN_ROLE();
  const hasRole = await VotePowerVerifier.hasRole(ADMIN_ROLE, deployer.address);
  console.log("Has DEFAULT_ADMIN_ROLE:", hasRole);

  if (!hasRole) {
    console.error("❌ No admin access");
    return;
  }

  // Try to call with explicit gas limit
  try {
    console.log("\nAttempting to set RewardDistributor...");
    const tx = await VotePowerVerifier.setRewardDistributor(rewardDistributorAddress, {
      gasLimit: 500000
    });
    console.log("Transaction sent:", tx.hash);
    
    const receipt = await tx.wait();
    console.log("✅ Success! Gas used:", receipt?.gasUsed.toString());
    
    // Verify
    const set = await VotePowerVerifier.rewardDistributor();
    console.log("\nVerification:");
    console.log("  Set to:", set);
    console.log("  Expected:", rewardDistributorAddress);
    console.log("  Match:", set === rewardDistributorAddress ? "✅" : "❌");
    
  } catch (error: any) {
    console.error("\n❌ Transaction failed:");
    console.error("Error:", error.message);
    
    if (error.data) {
      console.error("Error data:", error.data);
    }
    
    // Try to get revert reason
    try {
      const code = await VotePowerVerifier.setRewardDistributor.staticCall(rewardDistributorAddress);
      console.log("Static call result:", code);
    } catch (staticError: any) {
      console.error("Static call error:", staticError.message);
      if (staticError.data) {
        console.error("Revert data:", staticError.data);
      }
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
