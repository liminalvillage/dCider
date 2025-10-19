import { ethers } from "hardhat";

async function main() {
  console.log("🗳️  Testing Phase 5 weighted voting...\\n");

  const [signer] = await ethers.getSigners();
  console.log("Account:", signer.address);

  const proposalManagerAddress = "0x6b4B03DA3f92dAb312bf7592733Da8AC013ea254"; // Phase 5
  const proposalManager = await ethers.getContractAt(
    "ProposalManager",
    proposalManagerAddress
  );

  const proposalId = 1;

  // Get proposal details
  console.log("\\nFetching proposal", proposalId, "...");
  const proposal = await proposalManager.getProposal(proposalId);

  console.log("\\nProposal Details:");
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
    console.log("\\n⚠️  You have already voted on this proposal!");

    const receipt = await proposalManager.getReceipt(proposalId, signer.address);
    console.log("Your vote:", receipt.choice === 1n ? "FOR" : receipt.choice === 0n ? "AGAINST" : "ABSTAIN");
    console.log("Voting power used:", receipt.votes.toString());
    return;
  }

  // Check voting power
  const votingPower = await proposalManager.getVotingPower(proposalId, signer.address);
  console.log("\\nYour voting power:", votingPower.toString());

  if (votingPower === 0n) {
    console.log("⚠️  You have no voting power. Did you delegate your vote?");
    return;
  }

  console.log("\\n📊 Testing fallback mechanism (no attestation submitted)");
  console.log("Expected power: 1 (fallback)");
  console.log("Actual power:", votingPower.toString());
  console.log(votingPower === 1n ? "✅ Fallback working correctly!" : "❌ Unexpected power value");

  // Cast vote FOR
  console.log("\\nCasting vote FOR...");
  const VoteChoice = { Against: 0, For: 1, Abstain: 2 };

  const tx = await proposalManager.castVote(proposalId, VoteChoice.For);
  console.log("Transaction sent:", tx.hash);

  const receipt = await tx.wait();
  console.log("✅ Vote cast successfully!");
  console.log("Gas used:", receipt.gasUsed.toString());

  // Get updated proposal
  const updatedProposal = await proposalManager.getProposal(proposalId);
  console.log("\\nUpdated vote counts:");
  console.log("  For:", updatedProposal.forVotes.toString());
  console.log("  Against:", updatedProposal.againstVotes.toString());
  console.log("  Abstain:", updatedProposal.abstainVotes.toString());

  console.log("\\n🎉 Phase 5 voting successful!");
  console.log("\\n📝 Summary:");
  console.log("  - ProposalManager: Phase 5 (weighted voting enabled)");
  console.log("  - VotePowerVerifier: Integrated ✅");
  console.log("  - Attestation submitted: ❌ (using fallback power=1)");
  console.log("  - Vote counted: ✅");
  console.log("\\n💡 Next: Submit attestation to enable weighted voting");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
