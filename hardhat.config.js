import "dotenv/config";
import "@nomicfoundation/hardhat-ethers";

const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "";
const isValidPk = /^0x[0-9a-fA-F]{64}$/.test(PRIVATE_KEY);

/** @type import('hardhat/config').HardhatUserConfig */
const config = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 }
    }
  },
  networks: {
    hardhat: {
      type: "edr-simulated"
    },
    base: {
      type: "http",
      url: process.env.BASE_RPC_URL || "https://mainnet.base.org",
      chainId: 8453,
      ...(isValidPk ? { accounts: [PRIVATE_KEY] } : {})
    },
    baseSepolia: {
      type: "http",
      url: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
      chainId: 84532,
      ...(isValidPk ? { accounts: [PRIVATE_KEY] } : {})
    }
  }
};

export default config;


