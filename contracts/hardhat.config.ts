import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-verify";
import "@typechain/hardhat";
import "hardhat-deploy";
import * as dotenv from "dotenv";

// Load .env from contracts directory
dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true, // Enable IR-based code generator for better optimization
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    chiado: {
      url: process.env.CHIADO_RPC_URL || "https://rpc.chiadochain.net",
      chainId: 10200,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    gnosis: {
      url: process.env.GNOSIS_RPC_URL || "https://rpc.gnosischain.com",
      chainId: 100,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
  etherscan: {
    apiKey: {
      chiado: process.env.GNOSISSCAN_API_KEY || "",
      gnosis: process.env.GNOSISSCAN_API_KEY || "",
    },
    customChains: [
      {
        network: "chiado",
        chainId: 10200,
        urls: {
          apiURL: "https://gnosis-chiado.blockscout.com/api",
          browserURL: "https://gnosis-chiado.blockscout.com",
        },
      },
      {
        network: "gnosis",
        chainId: 100,
        urls: {
          apiURL: "https://api.gnosisscan.io/api",
          browserURL: "https://gnosisscan.io",
        },
      },
    ],
  },
  paths: {
    sources: "./src",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  // Exclude test files from compilation
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  // Ignore test files during deployment
  external: {
    contracts: [
      {
        artifacts: "src",
      },
    ],
  },
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6",
  },
  namedAccounts: {
    deployer: {
      default: 0, // Use first account from accounts array
    },
  },
};

export default config;
