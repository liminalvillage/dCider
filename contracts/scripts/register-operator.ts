import { ethers } from "hardhat";

/**
 * Register an enclave operator with VotePowerVerifier
 *
 * This allows the operator to submit attestations
 */

async function main() {
  console.log("👤 Registering Enclave Operator...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Admin account:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "xDAI\n");

  const votePowerVerifierAddress = "0x2844871F06BED295aeF95f7e1e0a16360A942DBF";

  const votePowerVerifier = await ethers.getContractAt(
    "VotePowerVerifier",
    votePowerVerifierAddress
  );

  // Check if already registered
  const [isOp, active] = await votePowerVerifier.isOperator(deployer.address);

  if (isOp) {
    console.log("✓ Operator is already registered");
    console.log("  Address:", deployer.address);
    console.log("  Active:", active);

    if (!active) {
      console.log("\n⚠️  Operator is inactive. Contact admin to reactivate.");
    }

    return;
  }

  // Generate mock enclave public key (in production, this comes from TEE)
  const enclavePublicKey = ethers.randomBytes(64); // Mock 64-byte public key

  console.log("📝 Registering operator...");
  console.log("  Operator address:", deployer.address);
  console.log("  Enclave public key:", ethers.hexlify(enclavePublicKey));

  try {
    const tx = await votePowerVerifier.addOperator(
      deployer.address,
      enclavePublicKey
    );

    console.log("\nTransaction sent:", tx.hash);
    console.log("Waiting for confirmation...");

    const receipt = await tx.wait();
    console.log("✅ Operator registered successfully!");
    console.log("Gas used:", receipt.gasUsed.toString());

    // Verify registration
    const [nowIsOp, nowActive] = await votePowerVerifier.isOperator(deployer.address);
    console.log("\n✓ Verification:");
    console.log("  Is operator:", nowIsOp);
    console.log("  Active:", nowActive);

    // Get operator details
    const [operators, threshold, totalOperators] = await votePowerVerifier.getOperators();
    console.log("\n📊 Operator Info:");
    console.log("  Total operators:", totalOperators.toString());
    console.log("  Signature threshold:", threshold.toString());

    console.log("\n🎉 Operator registration complete!");
    console.log("\nYou can now submit attestations using:");
    console.log("npx hardhat run scripts/submit-attestation.ts --network chiado");

  } catch (error: any) {
    console.error("\n❌ Error registering operator:");
    console.error(error.message);

    if (error.message.includes("AccessControlUnauthorizedAccount")) {
      console.log("\n💡 Only the admin can register operators.");
      console.log("Current account:", deployer.address);
      console.log("Make sure you're using the admin account.");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
