import { ethers } from "hardhat";

async function main() {
  console.log("🔄 Revoking delegation...\n");

  const [signer] = await ethers.getSigners();
  console.log("Account:", signer.address);

  const delegationManager = await ethers.getContractAt(
    "DelegationManager",
    "0x642421767A8bBB0ca27800a02Ec87b58a4dAE35A"
  );

  const topicId = 1; // Climate Policy

  // Check current delegation
  const delegation = await delegationManager.getDelegation(signer.address, topicId);

  if (delegation.delegate === ethers.ZeroAddress) {
    console.log("✅ No delegation found for topic", topicId);
    console.log("You can already create proposals!");
    return;
  }

  console.log("Current delegate:", delegation.delegate);
  console.log("\nRevoking delegation for topic", topicId, "...");

  const tx = await delegationManager.revoke(topicId);
  console.log("Transaction sent:", tx.hash);

  const receipt = await tx.wait();
  console.log("✅ Delegation revoked!");
  console.log("Gas used:", receipt.gasUsed.toString());

  console.log("\n🎉 You can now create proposals and vote!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
