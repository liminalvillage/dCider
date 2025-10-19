import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Deploy complete weighted voting system for testing
 * - VotePowerVerifierTest (threshold=1)
 * - ProposalManager (with test verifier)
 * - Register operator
 * - Submit initial attestation
 */

async function main() {
  console.log("🚀 Deploying Test Weighted Voting System...\n");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));
  console.log("Network:", network.name);
  console.log("Chain ID:", network.chainId, "\n");

  // Load existing deployment
  const deploymentPath = path.join(__dirname, `../deployments/chiado-${network.chainId}.json`);

  if (!fs.existsSync(deploymentPath)) {
    throw new Error("Previous deployment not found. Please deploy base contracts first.");
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));

  const topicRegistryAddress = deployment.topicRegistry;
  const delegationManagerAddress = deployment.delegationManager;

  if (!topicRegistryAddress || !delegationManagerAddress) {
    throw new Error("Required contract addresses not found in deployment.");
  }

  // Step 1: Deploy VotePowerVerifierTest (threshold=1)
  console.log("📋 Step 1: Deploying VotePowerVerifierTest (threshold=1)...");
  const VotePowerVerifierTest = await ethers.getContractFactory("VotePowerVerifierTest");
  const votePowerVerifierTest = await VotePowerVerifierTest.deploy();

  await votePowerVerifierTest.waitForDeployment();
  const votePowerVerifierTestAddress = await votePowerVerifierTest.getAddress();

  console.log("  ✓ VotePowerVerifierTest deployed to:", votePowerVerifierTestAddress);
  console.log("");

  // Step 2: Deploy new ProposalManager with test verifier
  console.log("📋 Step 2: Deploying ProposalManager (with test verifier)...");
  const ProposalManager = await ethers.getContractFactory("ProposalManager");
  const proposalManager = await ProposalManager.deploy(
    topicRegistryAddress,
    delegationManagerAddress,
    votePowerVerifierTestAddress
  );

  await proposalManager.waitForDeployment();
  const proposalManagerAddress = await proposalManager.getAddress();

  console.log("  ✓ ProposalManager deployed to:", proposalManagerAddress);
  console.log("");

  // Step 3: Register deployer as operator
  console.log("📋 Step 3: Registering operator...");
  const enclavePublicKey = ethers.randomBytes(64);

  const addOpTx = await votePowerVerifierTest.addOperator(
    deployer.address,
    enclavePublicKey
  );
  await addOpTx.wait();

  console.log("  ✓ Operator registered:", deployer.address);
  console.log("");

  // Step 4: Calculate and submit initial attestation for topic 1
  console.log("📋 Step 4: Calculating voting power for topic 1...");

  const delegationManager = await ethers.getContractAt(
    "DelegationManager",
    delegationManagerAddress
  );

  const topicId = 1;
  const delegators = await delegationManager.getTopicDelegators(topicId);

  console.log(`  Found ${delegators.length} delegators`);

  if (delegators.length === 0) {
    console.log("  ⚠️  No delegations yet. Skipping attestation submission.");
    console.log("  Create some delegations first, then run submit-attestation.ts");
  } else {
    // Calculate voting power
    const votingPowerMap = new Map<string, number>();

    for (const delegator of delegators) {
      const terminal = await delegationManager.getTerminalDelegate(delegator, topicId);
      const currentPower = votingPowerMap.get(terminal) || 0;
      votingPowerMap.set(terminal, currentPower + 1);
    }

    const addresses = Array.from(votingPowerMap.keys());
    const powers = Array.from(votingPowerMap.values());

    console.log("  Voting power distribution:");
    for (let i = 0; i < addresses.length; i++) {
      console.log(`    ${addresses[i]}: ${powers[i]} votes`);
    }

    // Create attestation
    const resultHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address[]", "uint256[]"],
        [addresses, powers]
      )
    );

    const nonce = Date.now();
    const blockNumber = await ethers.provider.getBlockNumber();

    const messageHash = ethers.solidityPackedKeccak256(
      ["bytes32"],
      [resultHash]
    );

    const signature = await deployer.signMessage(ethers.getBytes(messageHash));

    const attestation = {
      resultHash,
      topicId,
      blockNumber,
      nonce,
      signatures: [signature]
    };

    console.log("\n  Submitting attestation...");
    const attestTx = await votePowerVerifierTest.submitAttestation(
      attestation,
      addresses,
      powers
    );

    const receipt = await attestTx.wait();
    console.log("  ✓ Attestation submitted! TX:", receipt.hash);
    console.log("  Gas used:", receipt.gasUsed.toString());
  }

  // Update deployment file
  deployment.votePowerVerifierTest = votePowerVerifierTestAddress;
  deployment.proposalManagerTest = proposalManagerAddress;
  deployment.testDeployedAt = Date.now();

  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));

  console.log("\n📄 Deployment addresses saved to:", deploymentPath);
  console.log("");

  console.log("============================================================");
  console.log("🎉 Test Weighted Voting System Deployment Summary");
  console.log("============================================================");
  console.log("TopicRegistry:              ", topicRegistryAddress);
  console.log("DelegationManager:          ", delegationManagerAddress);
  console.log("VotePowerVerifierTest:      ", votePowerVerifierTestAddress, "(threshold=1)");
  console.log("ProposalManager (Test):     ", proposalManagerAddress);
  console.log("============================================================");
  console.log("");

  console.log("📋 Update Frontend:");
  console.log("");
  console.log("Update frontend/src/lib/contracts/addresses.ts:");
  console.log(`  proposalManager: '${proposalManagerAddress}',`);
  console.log("");

  console.log("✅ Test system deployed! Next steps:");
  console.log("  1. Update frontend contract address");
  console.log("  2. Create a proposal");
  console.log("  3. Vote and see weighted power in action!");
  console.log("");
  console.log("  Your voting power should now reflect delegation chains!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
