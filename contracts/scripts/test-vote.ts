import { ethers } from "hardhat";

async function main() {
  console.log("🗳️  Testing voting...\n");

  const [signer] = await ethers.getSigners();
  console.log("Account:", signer.address);

  const proposalManager = await ethers.getContractAt(
    "ProposalManager",
    "0xB630E192C9e8811194C835BebFfFEb795C2B2235"
  );

  const proposalId = 1;

  // Get proposal details
  console.log("\nFetching proposal", proposalId, "...");
  const proposal = await proposalManager.getProposal(proposalId);

  console.log("\nProposal Details:");
  console.log("  ID:", proposal.id.toString());
  console.log("  Title:", proposal.title);
  console.log("  Proposer:", proposal.proposer);
  console.log("  For:", proposal.forVotes.toString());
  console.log("  Against:", proposal.againstVotes.toString());
  console.log("  Abstain:", proposal.abstainVotes.toString());
  console.log("  Status:", proposal.status);
  console.log("  Start Block:", proposal.startBlock.toString());
  console.log("  End Block:", proposal.endBlock.toString());

  // Check if already voted
  const hasVoted = await proposalManager.hasVoted(proposalId, signer.address);
  if (hasVoted) {
    console.log("\n⚠️  You have already voted on this proposal!");

    const receipt = await proposalManager.getReceipt(proposalId, signer.address);
    console.log("Your vote:", receipt.choice === 1n ? "FOR" : receipt.choice === 0n ? "AGAINST" : "ABSTAIN");
    console.log("Voting power used:", receipt.votes.toString());
    return;
  }

  // Check voting power
  const votingPower = await proposalManager.getVotingPower(proposalId, signer.address);
  console.log("\nYour voting power:", votingPower.toString());

  if (votingPower === 0n) {
    console.log("⚠️  You have no voting power. Did you delegate your vote?");
    return;
  }

  // Cast vote FOR
  console.log("\nCasting vote FOR...");
  const VoteChoice = { Against: 0, For: 1, Abstain: 2 };

  const tx = await proposalManager.castVote(proposalId, VoteChoice.For);
  console.log("Transaction sent:", tx.hash);

  const receipt = await tx.wait();
  console.log("✅ Vote cast successfully!");
  console.log("Gas used:", receipt.gasUsed.toString());

  // Get updated proposal
  const updatedProposal = await proposalManager.getProposal(proposalId);
  console.log("\nUpdated vote counts:");
  console.log("  For:", updatedProposal.forVotes.toString());
  console.log("  Against:", updatedProposal.againstVotes.toString());
  console.log("  Abstain:", updatedProposal.abstainVotes.toString());

  console.log("\n🎉 Voting successful! Check the UI to see the results.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
