import { ethers } from "hardhat";

async function main() {
  const name = process.env.TOKEN_NAME || "SteerMeme";
  const symbol = process.env.TOKEN_SYMBOL || "STEER";
  const decimals = Number(process.env.TOKEN_DECIMALS || 18);
  const supply = process.env.TOKEN_SUPPLY || "1000000000"; // in whole tokens
  const owner = process.env.TOKEN_OWNER || (await ethers.getSigners())[0].address;

  const initialSupply = ethers.parseUnits(supply, decimals);

  const MemeToken = await ethers.getContractFactory("MemeToken");
  const token = await MemeToken.deploy(name, symbol, initialSupply, owner);
  await token.waitForDeployment();

  console.log("Token deployed to:", await token.getAddress());
  console.log("Owner:", owner);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});


