import hre from "hardhat";
import { ethers } from "ethers";

async function main() {
  const name = process.env.TOKEN_NAME || "SteerMeme";
  const symbol = process.env.TOKEN_SYMBOL || "STEER";
  const decimals = Number(process.env.TOKEN_DECIMALS || 18);
  const supply = process.env.TOKEN_SUPPLY || "1000000000"; // in whole tokens
  const rpcUrl = process.env.BASE_RPC_URL || process.env.BASE_SEPOLIA_RPC_URL;
  const pk = process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) throw new Error("DEPLOYER_PRIVATE_KEY required");
  if (!rpcUrl) throw new Error("RPC URL required (BASE_RPC_URL or BASE_SEPOLIA_RPC_URL)");
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(pk, provider);
  const owner = process.env.TOKEN_OWNER || wallet.address;

  const initialSupply = ethers.parseUnits(supply, decimals);

  const { abi, bytecode } = await hre.artifacts.readArtifact("MemeToken");
  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  const token = await factory.deploy(name, symbol, initialSupply, owner);
  await token.waitForDeployment();

  console.log("Token deployed to:", await token.getAddress());
  console.log("Owner:", owner);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});


