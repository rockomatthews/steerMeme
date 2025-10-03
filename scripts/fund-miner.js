import hre from "hardhat";
import { ethers } from "ethers";

async function main() {
  const minerAddress = process.env.MINER_ADDRESS;
  const rewardToken = process.env.REWARD_TOKEN_ADDRESS;
  const rewardAmount = process.env.REWARD_FUND_AMOUNT; // whole tokens
  const rewardDecimals = Number(process.env.REWARD_TOKEN_DECIMALS || 18);
  if (!minerAddress) throw new Error("MINER_ADDRESS required");
  if (!rewardToken) throw new Error("REWARD_TOKEN_ADDRESS required");
  if (!rewardAmount) throw new Error("REWARD_FUND_AMOUNT required");

  const rpcUrl = process.env.BASE_RPC_URL || process.env.BASE_SEPOLIA_RPC_URL;
  const pk = process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) throw new Error("DEPLOYER_PRIVATE_KEY required");
  if (!rpcUrl) throw new Error("RPC URL required (BASE_RPC_URL or BASE_SEPOLIA_RPC_URL)");
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(pk, provider);

  const { abi } = await hre.artifacts.readArtifact("IERC20");
  const erc20 = new ethers.Contract(rewardToken, abi, wallet);
  const amt = ethers.parseUnits(rewardAmount, rewardDecimals);
  const tx = await erc20.transfer(minerAddress, amt);
  await tx.wait();
  console.log("Funded miner with", rewardAmount, "tokens at", minerAddress);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});


