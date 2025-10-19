import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("🚀 Deploying ProposalManager...\n");

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
  const votePowerVerifierAddress = deployment.votePowerVerifier;

  if (!topicRegistryAddress || !delegationManagerAddress || !votePowerVerifierAddress) {
    throw new Error("Required contract addresses not found in deployment.");
  }

  console.log("📝 Using existing contracts:");
  console.log("  TopicRegistry:", topicRegistryAddress);
  console.log("  DelegationManager:", delegationManagerAddress);
  console.log("  VotePowerVerifier:", votePowerVerifierAddress);
  console.log("");

  // Deploy ProposalManager
  console.log("📋 Deploying ProposalManager...");
  const ProposalManager = await ethers.getContractFactory("ProposalManager");
  const proposalManager = await ProposalManager.deploy(
    topicRegistryAddress,
    delegationManagerAddress,
    votePowerVerifierAddress
  );

  await proposalManager.waitForDeployment();
  const proposalManagerAddress = await proposalManager.getAddress();

  console.log("  ✓ ProposalManager deployed to:", proposalManagerAddress);
  console.log("");

  // Update deployment file
  deployment.proposalManager = proposalManagerAddress;
  deployment.proposalManagerDeployedAt = Date.now();

  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));

  console.log("📄 Deployment addresses saved to:", deploymentPath);
  console.log("");

  console.log("============================================================");
  console.log("🎉 Deployment Summary");
  console.log("============================================================");
  console.log("TopicRegistry:        ", topicRegistryAddress);
  console.log("VotePowerVerifier:    ", deployment.votePowerVerifier);
  console.log("DelegationManager:    ", delegationManagerAddress);
  console.log("ProposalManager:      ", proposalManagerAddress);
  console.log("============================================================");
  console.log("");

  console.log("📋 Environment Variables (add to frontend .env):");
  console.log("");
  console.log(`VITE_PROPOSAL_MANAGER_ADDRESS=${proposalManagerAddress}`);
  console.log("");

  console.log("✅ ProposalManager deployment complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
