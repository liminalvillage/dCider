import { ethers } from "hardhat";

async function main() {
  console.log("🔍 Checking VotePowerVerifier status...\n");

  const [signer] = await ethers.getSigners();
  console.log("Account:", signer.address);

  const votePowerVerifierAddress = "0x2844871F06BED295aeF95f7e1e0a16360A942DBF";

  const votePowerVerifier = await ethers.getContractAt(
    "VotePowerVerifier",
    votePowerVerifierAddress
  );

  // Check operator status
  const [isOp, active] = await votePowerVerifier.isOperator(signer.address);
  console.log("\n📋 Operator Status:");
  console.log("  Is operator:", isOp);
  console.log("  Active:", active);

  // Get all operators
  const [operators, threshold, totalOperators] = await votePowerVerifier.getOperators();
  console.log("\n📊 Verifier Configuration:");
  console.log("  Total operators:", totalOperators.toString());
  console.log("  Signature threshold (M):", threshold.toString());
  console.log("  Status:", totalOperators >= threshold ? "✅ Ready" : "⚠️  Need more operators");

  if (totalOperators > 0n) {
    console.log("\n  Registered operators:");
    for (let i = 0; i < Number(totalOperators); i++) {
      console.log(`    ${i + 1}. ${operators[i].operatorAddress} (${operators[i].active ? 'active' : 'inactive'})`);
    }
  }

  // Check cached voting power for topic 1
  const topicId = 1;
  console.log(`\n🔋 Cached Voting Power (Topic ${topicId}):`);

  try {
    const [power, lastUpdated, attestationHash] =
      await votePowerVerifier.getVotingPower(signer.address, topicId);

    if (power > 0n) {
      console.log("  Your power:", power.toString());
      console.log("  Last updated:", new Date(Number(lastUpdated) * 1000).toLocaleString());
      console.log("  Attestation hash:", attestationHash);
    } else {
      console.log("  ⚠️  No cached power - using fallback (power = 1)");
    }
  } catch (e) {
    console.log("  ⚠️  No cached power - using fallback (power = 1)");
  }

  console.log("\n💡 Next Steps:");
  if (totalOperators < threshold) {
    console.log(`  1. Register ${Number(threshold) - Number(totalOperators)} more operator(s)`);
    console.log("     OR");
    console.log("  2. Deploy test VotePowerVerifier with threshold=1");
  } else {
    console.log("  1. Run: npx hardhat run scripts/submit-attestation.ts --network chiado");
    console.log("  2. Collect M-of-N signatures from operators");
    console.log("  3. Vote on proposals to see weighted power!");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
