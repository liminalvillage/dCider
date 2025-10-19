import { ethers } from "hardhat";

/**
 * Create 12 sustainability topics based on the 12 Domains of Sustainability
 *
 * These topics cover:
 * 1. Wellbeing, 2. Food, 3. Trade, 4. Energy, 5. Climate, 6. Biosphere,
 * 7. Water, 8. Habitat, 9. Wealth, 10. Governance, 11. Community, 12. Worldview
 */

async function main() {
  console.log("🌍 Creating 12 Sustainability Topics...\n");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("Deploying with account:", deployer.address);
  console.log("Network:", network.name);
  console.log("Chain ID:", network.chainId, "\n");

  // Load deployment addresses
  const fs = require('fs');
  const path = require('path');
  const deploymentPath = path.join(__dirname, `../deployments/chiado-${network.chainId}.json`);

  if (!fs.existsSync(deploymentPath)) {
    throw new Error("Deployment file not found. Deploy contracts first.");
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const topicRegistryAddress = deployment.topicRegistry;

  if (!topicRegistryAddress) {
    throw new Error("TopicRegistry address not found in deployment.");
  }

  const TopicRegistry = await ethers.getContractFactory("TopicRegistry");
  const topicRegistry = TopicRegistry.attach(topicRegistryAddress);

  // 12 Sustainability Topics
  const topics = [
    {
      name: "1. Wellbeing",
      description: "Population health, sense of security, addictive behaviour, degree of happiness, self-responsibility, creative expression",
      proposalThreshold: 3
    },
    {
      name: "2. Food",
      description: "Agriculture and horticulture, food quality, nutritional balance, food safety, equitable distribution",
      proposalThreshold: 3
    },
    {
      name: "3. Trade",
      description: "Transportation of goods, mobility of people, free/fair trade, markets and agreements, regional economies, trade support systems",
      proposalThreshold: 3
    },
    {
      name: "4. Energy",
      description: "Fossil sources, renewable resources, nuclear sources, energy intensity and efficiency, distribution and application, energy security",
      proposalThreshold: 3
    },
    {
      name: "5. Climate",
      description: "Weather patterns, greenhouse gas emissions, temperature rise, ice melt and sea level, mitigation activity",
      proposalThreshold: 3
    },
    {
      name: "6. Biosphere",
      description: "The state of organic life, species extinction, wilderness, forms of pollution, exploitation and degradation, conservation and restoration",
      proposalThreshold: 3
    },
    {
      name: "7. Water",
      description: "Rainfall and ice-melt patterns, the state of aquifers, rivers and lakes, irrigation and industrial demands, purity and distribution, scarcity and contamination",
      proposalThreshold: 3
    },
    {
      name: "8. Habitat",
      description: "Settlements on all scales, infrastructure and utilities, design quality, degradation and restoration, urban ecological footprints, work life relationships",
      proposalThreshold: 3
    },
    {
      name: "9. Wealth",
      description: "Finance and economy, values and life-style, work and reward, equity and distribution, monetary systems, freedom and regulation",
      proposalThreshold: 3
    },
    {
      name: "10. Governance",
      description: "Political systems, civic participation, local, national and international policies, regulation and subsidies, exploitation, regulation, public order, propaganda terrorism",
      proposalThreshold: 3
    },
    {
      name: "11. Community",
      description: "Living arrangements, life span education, civic capacity, social capital, competition and mutuality, resilience",
      proposalThreshold: 3
    },
    {
      name: "12. Worldview",
      description: "Dominant belief systems, tolerance and fundamentalism, values and outlooks, ideologies and utopias, fixed or dynamic attitudes, the place of consciousness",
      proposalThreshold: 3
    }
  ];

  console.log("Creating topics...\n");

  for (let i = 0; i < topics.length; i++) {
    const topic = topics[i];

    try {
      console.log(`Creating topic ${i + 1}/12: ${topic.name}`);

      // Create topic with description as bytes32
      // For MVP, we'll use a simple hash of the description
      // In production, this would be an actual IPFS CID (bytes32)
      const descriptionCID = ethers.id(topic.description); // keccak256 hash as bytes32

      const tx = await topicRegistry.createTopic(
        topic.name,
        descriptionCID,
        topic.proposalThreshold
      );

      const receipt = await tx.wait();

      // Find TopicCreated event
      const event = receipt.logs
        .map((log: any) => {
          try {
            return topicRegistry.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((parsed: any) => parsed?.name === 'TopicCreated');

      const topicId = event ? Number(event.args[0]) : i + 1;

      console.log(`  ✓ Topic ID: ${topicId}`);
      console.log(`  ✓ Description: ${topic.description}`);
      console.log(`  ✓ TX Hash: ${receipt.hash}`);
      console.log("");

    } catch (error: any) {
      console.error(`  ✗ Failed to create topic: ${error.message}`);
      console.log("");
    }
  }

  console.log("============================================================");
  console.log("🎉 Sustainability Topics Created!");
  console.log("============================================================");
  console.log("");
  console.log("Next steps:");
  console.log("  1. Users can now delegate on these 12 topics");
  console.log("  2. Create proposals under relevant topics");
  console.log("  3. Visualize delegation networks per topic");
  console.log("");
  console.log("Topics represent the 12 Domains of Sustainability:");
  console.log("  - Social (1-3): Wellbeing, Food, Trade");
  console.log("  - Ecological (4-8): Energy, Climate, Biosphere, Water, Habitat");
  console.log("  - Economic & Political (9-11): Wealth, Governance, Community");
  console.log("  - Cultural (12): Worldview");
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
