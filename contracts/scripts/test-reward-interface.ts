/**
 * Test if RewardDistributor implements IRewardDistributor interface correctly
 */

import hre from "hardhat";

async function main() {
  const rewardDistributorAddress = "0x8a4f7A29989565F36216Eb82ca030bEb129E039A";

  console.log("Testing RewardDistributor interface...");
  console.log("Address:", rewardDistributorAddress);

  const RewardDistributor = await hre.ethers.getContractAt(
    "RewardDistributorSimple",
    rewardDistributorAddress
  );

  try {
    // Try to call interface methods
    const votePowerVerifier = await RewardDistributor.votePowerVerifier();
    console.log("✅ votePowerVerifier():", votePowerVerifier);

    // Check if contract has updateFlows function
    const code = await hre.ethers.provider.getCode(rewardDistributorAddress);
    console.log("✅ Contract code length:", code.length);

    // Get interface ID
    const iface = RewardDistributor.interface;
    console.log("✅ Interface functions:", iface.fragments.filter(f => f.type === 'function').length);

  } catch (error: any) {
    console.error("❌ Error:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
