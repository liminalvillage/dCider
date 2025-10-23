import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

/**
 * Deployment script for RewardDistributor contract
 *
 * Prerequisites:
 * - VotePowerVerifier must be deployed
 * - Superfluid Host and Super Token addresses must be configured
 *
 * Gnosis Chiado Testnet Addresses:
 * - Superfluid Host: 0x42b11d1AdC84b2B95B0c3e39738e25329e3F84CC
 * - Super Token (fDAIx): 0xF2d68898557cCb2Cf4C10c3Ef2B034b2a69DAD00
 */
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy, get } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log("Deploying RewardDistributor with account:", deployer);

  // Use known VotePowerVerifier address from previous deployment
  const votePowerVerifierAddress = "0x9aef5a8B434BF396049E06050e59D1036Eed7e84";
  console.log("VotePowerVerifier address:", votePowerVerifierAddress);

  // Superfluid addresses per network
  const superfluidConfig: Record<string, { host: string; token: string }> = {
    chiado: {
      host: "0x42b11d1AdC84b2B95B0c3e39738e25329e3F84CC",
      token: "0xF2d68898557cCb2Cf4C10c3Ef2B034b2a69DAD00", // fDAIx
    },
    gnosis: {
      host: "0x2dFe937cD98Ab92e59cF3139138f18c823a4efE7",
      token: "0x59988e47A3503AaFaA0368b9deF095c818Fdca01", // USDCx
    },
    localhost: {
      // For local testing, these would need to be deployed first
      host: process.env.SUPERFLUID_HOST || "",
      token: process.env.SUPER_TOKEN || "",
    },
  };

  const config = superfluidConfig[network.name];

  if (!config || !config.host || !config.token) {
    throw new Error(
      `Superfluid configuration not found for network: ${network.name}. ` +
        `Please configure SUPERFLUID_HOST and SUPER_TOKEN environment variables.`
    );
  }

  console.log("Superfluid Host:", config.host);
  console.log("Reward Token (Super Token):", config.token);

  // Deploy RewardDistributorSimple (simplified version without Superfluid)
  const rewardDistributor = await deploy("RewardDistributorSimple", {
    from: deployer,
    args: [votePowerVerifierAddress],
    log: true,
    waitConfirmations: network.name === "localhost" ? 1 : 3,
    contract: "RewardDistributorSimple",
  });

  console.log("RewardDistributor deployed to:", rewardDistributor.address);

  // Note: Connecting RewardDistributor to VotePowerVerifier requires ADMIN_ROLE
  // This should be done manually by the contract owner:
  // await VotePowerVerifier.setRewardDistributor(rewardDistributor.address);
  console.log("\n⚠️  Manual step required:");
  console.log("Call VotePowerVerifier.setRewardDistributor(" + rewardDistributor.address + ")");
  console.log("This requires ADMIN_ROLE on VotePowerVerifier\n");

  // Grant VERIFIER_ROLE to VotePowerVerifier
  const RewardDistributor = await hre.ethers.getContractAt(
    "RewardDistributorSimple",
    rewardDistributor.address
  );

  const VERIFIER_ROLE = await RewardDistributor.VERIFIER_ROLE();
  const hasRole = await RewardDistributor.hasRole(VERIFIER_ROLE, votePowerVerifierAddress);

  if (!hasRole) {
    console.log("Granting VERIFIER_ROLE to VotePowerVerifier...");
    const tx = await RewardDistributor.grantRole(VERIFIER_ROLE, votePowerVerifierAddress);
    await tx.wait();
    console.log("✅ VERIFIER_ROLE granted");
  } else {
    console.log("✅ VotePowerVerifier already has VERIFIER_ROLE");
  }

  // Deployment summary
  console.log("\n=== Deployment Summary ===");
  console.log("Network:", network.name);
  console.log("RewardDistributor:", rewardDistributor.address);
  console.log("VotePowerVerifier:", votePowerVerifierAddress);
  console.log("Superfluid Host:", config.host);
  console.log("Reward Token:", config.token);
  console.log("==========================\n");
};

func.tags = ["RewardDistributor", "streaming"];
func.dependencies = [];

export default func;
