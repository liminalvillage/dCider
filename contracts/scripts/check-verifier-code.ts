/**
 * Check VotePowerVerifier bytecode to see if it has the function
 */

import hre from "hardhat";

async function main() {
  const address = "0x9aef5a8B434BF396049E06050e59D1036Eed7e84";
  
  // Get the contract code
  const code = await hre.ethers.provider.getCode(address);
  console.log("Contract code length:", code.length);
  
  // Get the contract
  const VotePowerVerifier = await hre.ethers.getContractAt("VotePowerVerifier", address);
  
  // Check if function exists by getting function selector
  const iface = VotePowerVerifier.interface;
  const fragment = iface.getFunction("setRewardDistributor");
  if (fragment) {
    const selector = iface.getFunction("setRewardDistributor").selector;
    console.log("✅ setRewardDistributor selector:", selector);
    
    // Check if selector exists in bytecode
    const selectorInCode = code.includes(selector.slice(2)); // remove 0x
    console.log("Selector in bytecode:", selectorInCode);
  } else {
    console.log("❌ Function not found in ABI");
  }
  
  // List all functions
  console.log("\nAvailable functions:");
  const functions = iface.fragments.filter(f => f.type === 'function');
  functions.forEach(f => {
    if (f.type === 'function') {
      console.log(`  - ${f.name}`);
    }
  });
  
  // Try to read the current rewardDistributor value
  try {
    const current = await VotePowerVerifier.rewardDistributor();
    console.log("\n✅ Current rewardDistributor:", current);
  } catch (err: any) {
    console.log("\n❌ Cannot read rewardDistributor:", err.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
