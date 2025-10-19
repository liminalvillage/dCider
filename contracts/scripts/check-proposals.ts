import { ethers } from "hardhat";

async function main() {
  console.log("📋 Checking proposals in Phase 5 contract...\\n");

  const proposalManagerAddress = "0x6b4B03DA3f92dAb312bf7592733Da8AC013ea254"; // Phase 5
  const proposalManager = await ethers.getContractAt(
    "ProposalManager",
    proposalManagerAddress
  );

  const totalProposals = await proposalManager.proposalCount();
  console.log("Total proposals:", totalProposals.toString());

  if (totalProposals === 0n) {
    console.log("\\n⚠️  No proposals in this contract yet.");
    console.log("Create one using: npx hardhat run scripts/test-proposal.ts --network chiado");
    return;
  }

  for (let i = 1; i <= Number(totalProposals); i++) {
    const proposal = await proposalManager.getProposal(i);
    console.log(`\\nProposal #${i}:`);
    console.log("  Title:", proposal.title);
    console.log("  Proposer:", proposal.proposer);
    console.log("  Topic ID:", proposal.topicId.toString());
    console.log("  For:", proposal.forVotes.toString());
    console.log("  Against:", proposal.againstVotes.toString());
    console.log("  Status:", proposal.status.toString());
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
