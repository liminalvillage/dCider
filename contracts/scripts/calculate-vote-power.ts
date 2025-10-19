import { ethers } from "hardhat";

/**
 * Calculate voting power for all terminal delegates in a topic
 *
 * Algorithm:
 * 1. Get all delegators for the topic
 * 2. For each delegator, find their terminal delegate
 * 3. Increment power count for that terminal delegate
 * 4. Result: Map of terminal delegate => voting power
 */

export interface VotingPowerResult {
  address: string;
  power: number;
}

export async function calculateVotingPower(
  delegationManagerAddress: string,
  topicId: number
): Promise<VotingPowerResult[]> {
  console.log(`\n🔢 Calculating voting power for topic ${topicId}...\n`);

  // Get DelegationManager contract
  const delegationManager = await ethers.getContractAt(
    "DelegationManager",
    delegationManagerAddress
  );

  // Get all delegators for this topic
  const delegators = await delegationManager.getTopicDelegators(topicId);
  console.log(`Found ${delegators.length} delegators for topic ${topicId}`);

  // Map to store voting power
  const votingPowerMap = new Map<string, number>();

  // Process each delegator
  for (const delegator of delegators) {
    // Get terminal delegate for this delegator
    const terminal = await delegationManager.getTerminalDelegate(delegator, topicId);

    // Increment power for terminal delegate
    const currentPower = votingPowerMap.get(terminal) || 0;
    votingPowerMap.set(terminal, currentPower + 1);

    console.log(`  ${delegator} → terminal: ${terminal}`);
  }

  // Also count addresses that have power but aren't in delegators list
  // (i.e., terminal delegates who never delegated themselves)
  // For simplicity, we assume all participating addresses are in the delegators list
  // or we'd need to track all addresses that could vote

  console.log(`\n📊 Voting Power Results:`);
  console.log(`===================================`);

  const results: VotingPowerResult[] = [];
  for (const [address, power] of votingPowerMap.entries()) {
    console.log(`  ${address}: ${power} votes`);
    results.push({ address, power });
  }

  console.log(`===================================\n`);

  return results;
}

export async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log("Usage: npx hardhat run scripts/calculate-vote-power.ts -- <delegationManager> <topicId>");
    process.exit(1);
  }

  const delegationManagerAddress = args[0];
  const topicId = parseInt(args[1]);

  const results = await calculateVotingPower(delegationManagerAddress, topicId);

  console.log("\n✅ Calculation complete!");
  console.log(`\nTotal terminal delegates: ${results.length}`);
  console.log(`Total voting power: ${results.reduce((sum, r) => sum + r.power, 0)}`);
}

// Only run main if this script is executed directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
