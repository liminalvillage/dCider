import { ethers } from "hardhat";

/**
 * Debug script to check delegations and topic delegators
 */

async function main() {
  console.log("🔍 Debugging Delegations...\n");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("Account:", deployer.address);
  console.log("Network:", network.name);
  console.log("Chain ID:", network.chainId, "\n");

  // Load deployment
  const fs = require('fs');
  const path = require('path');
  const deploymentPath = path.join(__dirname, `../deployments/chiado-${network.chainId}.json`);

  if (!fs.existsSync(deploymentPath)) {
    throw new Error("Deployment file not found.");
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const delegationManagerAddress = deployment.delegationManager;

  console.log("DelegationManager:", delegationManagerAddress, "\n");

  const DelegationManager = await ethers.getContractFactory("DelegationManager");
  const delegationManager = DelegationManager.attach(delegationManagerAddress);

  // Check Climate topic (ID 5)
  const topicId = 5;

  console.log("=".repeat(60));
  console.log(`Checking Topic ${topicId}: Climate`);
  console.log("=".repeat(60));

  // Try to get delegators
  try {
    const delegators = await delegationManager.getTopicDelegators(topicId);
    console.log(`\n✓ getTopicDelegators() returned ${delegators.length} delegators:`);

    if (delegators.length === 0) {
      console.log("  (empty array - no delegations found)");
    } else {
      for (const delegator of delegators) {
        console.log(`  - ${delegator}`);

        // Get delegation details
        const delegation = await delegationManager.getDelegation(delegator, topicId);
        console.log(`    → Delegated to: ${delegation.delegate}`);
        console.log(`    → Timestamp: ${new Date(Number(delegation.timestamp) * 1000).toISOString()}`);
        console.log(`    → Active: ${delegation.delegate !== ethers.ZeroAddress}`);
      }
    }
  } catch (error: any) {
    console.log(`\n✗ Error calling getTopicDelegators():`, error.message);
  }

  // Try getAllDelegations
  try {
    console.log("\n" + "-".repeat(60));
    const [delegators, delegates] = await delegationManager.getAllDelegations(topicId);
    console.log(`✓ getAllDelegations() returned ${delegators.length} delegations:`);

    if (delegators.length === 0) {
      console.log("  (no delegations found)");
    } else {
      for (let i = 0; i < delegators.length; i++) {
        console.log(`  ${i + 1}. ${delegators[i]} → ${delegates[i]}`);
      }
    }
  } catch (error: any) {
    console.log(`\n✗ Error calling getAllDelegations():`, error.message);
  }

  // Check if your address has delegated
  console.log("\n" + "-".repeat(60));
  console.log(`Checking your delegation (${deployer.address}):`);

  try {
    const yourDelegation = await delegationManager.getDelegation(deployer.address, topicId);

    if (yourDelegation.delegate === ethers.ZeroAddress) {
      console.log("  You have NOT delegated on this topic");
    } else {
      console.log(`  ✓ You delegated to: ${yourDelegation.delegate}`);
      console.log(`  ✓ Timestamp: ${new Date(Number(yourDelegation.timestamp) * 1000).toISOString()}`);

      // Get terminal delegate
      const terminal = await delegationManager.getTerminalDelegate(deployer.address, topicId);
      console.log(`  ✓ Terminal delegate: ${terminal}`);
    }
  } catch (error: any) {
    console.log(`  ✗ Error:`, error.message);
  }

  console.log("\n" + "=".repeat(60));
  console.log("Debug complete!");
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
