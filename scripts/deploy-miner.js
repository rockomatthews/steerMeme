import hre from "hardhat";
import { ethers } from "ethers";

async function main() {
  const rpcUrl = process.env.BASE_RPC_URL || process.env.BASE_SEPOLIA_RPC_URL;
  const pk = process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) throw new Error("DEPLOYER_PRIVATE_KEY required");
  if (!rpcUrl) throw new Error("RPC URL required (BASE_RPC_URL or BASE_SEPOLIA_RPC_URL)");
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(pk, provider);
  const owner = process.env.TOKEN_OWNER || wallet.address;
  const stakeToken = process.env.STAKE_TOKEN_ADDRESS; // Randy address
  const rewardToken = process.env.REWARD_TOKEN_ADDRESS || stakeToken; // default same as stake
  const rewardRatePerSecond = process.env.REWARD_RATE_PER_SECOND || "0"; // raw token units per sec

  if (!stakeToken) throw new Error("STAKE_TOKEN_ADDRESS required");
  if (!rewardToken) throw new Error("REWARD_TOKEN_ADDRESS required");

  // Tiers: comma-separated thresholds and multipliers (as decimals, 1.0 = 1e18)
  const thresholdsCsv = process.env.MINER_TIER_THRESHOLDS || ""; // e.g., "1000,10000,100000"
  const multipliersCsv = process.env.MINER_TIER_MULTIPLIERS || ""; // e.g., "1.0,1.25,1.5"

  const thresholds = thresholdsCsv
    ? thresholdsCsv.split(",").map((s) => s.trim()).map((s) => BigInt(s))
    : [];

  const multipliers = multipliersCsv
    ? multipliersCsv
        .split(",")
        .map((s) => s.trim())
        .map((s) => Math.round(parseFloat(s) * 1e18))
        .map((n) => BigInt(n))
    : [];

  if (thresholds.length !== multipliers.length) {
    throw new Error("MINER_TIER_THRESHOLDS and MINER_TIER_MULTIPLIERS length mismatch");
  }

  const { abi, bytecode } = await hre.artifacts.readArtifact("MiningStaking");
  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  const miner = await factory.deploy(
    owner,
    stakeToken,
    rewardToken,
    BigInt(rewardRatePerSecond),
    thresholds,
    multipliers
  );
  await miner.waitForDeployment();
  console.log("MiningStaking deployed:", await miner.getAddress());
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});


