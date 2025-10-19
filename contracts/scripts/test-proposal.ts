import { ethers } from "hardhat";

async function main() {
  console.log("🧪 Testing ProposalManager...\n");

  const [signer] = await ethers.getSigners();
  console.log("Testing with account:", signer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(signer.address)), "xDAI\n");

  // Get contracts (Phase 5 - with weighted voting)
  const proposalManager = await ethers.getContractAt(
    "ProposalManager",
    "0x6b4B03DA3f92dAb312bf7592733Da8AC013ea254"
  );

  const delegationManager = await ethers.getContractAt(
    "DelegationManager",
    "0x642421767A8bBB0ca27800a02Ec87b58a4dAE35A"
  );

  const topicId = 1;

  // Check if user has delegated
  console.log("Checking delegation status for topic", topicId, "...");

  try {
    const delegation = await delegationManager.getDelegation(signer.address, topicId);
    console.log("Delegation info:", delegation);

    const terminal = await delegationManager.getTerminalDelegate(signer.address, topicId);
    console.log("Terminal delegate:", terminal);

    if (delegation.delegate !== ethers.ZeroAddress) {
      console.log("\n⚠️  You have delegated your vote to:", delegation.delegate);
      console.log("You need to revoke your delegation before creating proposals.");
      console.log("\nGo to http://localhost:5173/#delegate and click 'Revoke Delegation'");
      return;
    }

    if (terminal !== signer.address) {
      console.log("\n⚠️  Your terminal delegate is:", terminal);
      console.log("This means you've delegated your vote.");
      return;
    }
  } catch (e) {
    console.log("No delegation found - you can create proposals!");
  }

  console.log("\n✅ You are a terminal delegate. You can create proposals!");

  // Try to create a proposal
  console.log("\nCreating test proposal...");

  try {
    const params = {
      topicId: topicId,
      title: "Test Proposal from Script",
      descriptionCID: "This is a test proposal",
      votingPeriod: 1000
    };

    const tx = await proposalManager.createProposal(params);
    console.log("Transaction sent:", tx.hash);

    const receipt = await tx.wait();
    console.log("✅ Proposal created successfully!");
    console.log("Gas used:", receipt.gasUsed.toString());

    // Parse event
    const event = receipt.logs
      .map((log: any) => {
        try {
          return proposalManager.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((parsed: any) => parsed?.name === 'ProposalCreated');

    if (event) {
      console.log("Proposal ID:", event.args[0].toString());
    }
  } catch (error: any) {
    console.error("❌ Error creating proposal:");
    console.error(error.message);

    if (error.message.includes('InsufficientVotingPower')) {
      console.log("\n💡 This error means you need to be a terminal delegate.");
      console.log("Make sure you haven't delegated your vote to someone else.");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
