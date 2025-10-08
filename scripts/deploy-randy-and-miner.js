import hre from "hardhat";
import { ethers } from "ethers";
import { spawnSync } from "child_process";

function parseCsv(csv) {
  return csv
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function toUnits(amountStr, decimals) {
  return ethers.parseUnits(String(amountStr), Number(decimals));
}

async function main() {
  const rpcUrl = process.env.BASE_RPC_URL || process.env.BASE_SEPOLIA_RPC_URL;
  const pk = process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) throw new Error("DEPLOYER_PRIVATE_KEY required");
  if (!rpcUrl) throw new Error("RPC URL required (BASE_RPC_URL or BASE_SEPOLIA_RPC_URL)");
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(pk, provider);

  // Token params
  const tokenName = process.env.TOKEN_NAME || "Randy";
  const tokenSymbol = process.env.TOKEN_SYMBOL || "RANDY";
  const tokenDecimals = Number(process.env.TOKEN_DECIMALS || 18);
  const tokenSupply = process.env.TOKEN_SUPPLY || "1000000000"; // whole tokens
  const tokenOwner = process.env.TOKEN_OWNER || wallet.address;
  const tokenLogoUri = process.env.TOKEN_LOGO_URI || "";
  const tokenDescription = process.env.TOKEN_DESCRIPTION || "";
  const tokenWebsite = process.env.TOKEN_WEBSITE || "";
  const tokenX = process.env.TOKEN_X || "";
  const tokenTwitter = process.env.TOKEN_TWITTER || "";
  const tokenInstagram = process.env.TOKEN_INSTAGRAM || "";
  const tokenFarcaster = process.env.TOKEN_FARCASTER || "";
  const tokenTelegram = process.env.TOKEN_TELEGRAM || "";
  const tokenDiscord = process.env.TOKEN_DISCORD || "";
  const tokenGithub = process.env.TOKEN_GITHUB || "";
  const tokenMedium = process.env.TOKEN_MEDIUM || "";

  // Miner params
  const useExistingToken = process.env.TOKEN_ADDRESS; // if provided, skip deploy
  const rewardRatePerSecondRaw = process.env.REWARD_RATE_PER_SECOND; // in token units per sec (raw, scaled by decimals)
  const emissionsTotal = process.env.REWARD_EMISSIONS_TOTAL; // whole tokens to emit
  const emissionsDays = Number(process.env.REWARD_EMISSIONS_DAYS || 0); // days

  // Tiers: thresholds can be provided in whole tokens or raw units
  const thresholdsTokensCsv = process.env.MINER_TIER_THRESHOLDS_TOKENS || ""; // e.g., "0,50000,250000,1000000"
  const thresholdsRawCsv = process.env.MINER_TIER_THRESHOLDS || ""; // raw wei values if desired
  const multipliersCsv = process.env.MINER_TIER_MULTIPLIERS || ""; // e.g., "1.0,1.2,1.5,2.0"

  // Optional initial miner funding
  const rewardFundAmount = process.env.REWARD_FUND_AMOUNT; // whole tokens

  // 1) Deploy or reuse token
  let tokenAddress = useExistingToken;
  if (!tokenAddress) {
    const { abi, bytecode } = await hre.artifacts.readArtifact("MemeToken");
    const factory = new ethers.ContractFactory(abi, bytecode, wallet);
    const totalSupplyUnits = toUnits(tokenSupply, tokenDecimals);
    const token = await factory.deploy(tokenName, tokenSymbol, totalSupplyUnits, tokenOwner);
    await token.waitForDeployment();
    tokenAddress = await token.getAddress();
    console.log("Token deployed:", tokenAddress);
  } else {
    console.log("Using existing token:", tokenAddress);
  }

  // 2) Build tiers
  let thresholds = [];
  if (thresholdsTokensCsv) {
    thresholds = parseCsv(thresholdsTokensCsv).map((t) => toUnits(t, tokenDecimals));
  } else if (thresholdsRawCsv) {
    thresholds = parseCsv(thresholdsRawCsv).map((t) => BigInt(t));
  }
  const tierMultipliers = multipliersCsv
    ? parseCsv(multipliersCsv).map((s) => BigInt(Math.round(parseFloat(s) * 1e18)))
    : [];
  if (thresholds.length !== tierMultipliers.length) {
    throw new Error("Tier thresholds and multipliers length mismatch");
  }

  // 3) Compute reward rate per second if emissions total + days provided
  let rewardRatePerSecond = 0n;
  if (emissionsTotal && emissionsDays > 0) {
    const totalUnits = toUnits(emissionsTotal, tokenDecimals);
    const seconds = BigInt(emissionsDays * 24 * 60 * 60);
    rewardRatePerSecond = totalUnits / seconds;
  } else if (rewardRatePerSecondRaw) {
    rewardRatePerSecond = BigInt(rewardRatePerSecondRaw);
  } else {
    throw new Error("Provide REWARD_RATE_PER_SECOND or REWARD_EMISSIONS_TOTAL + REWARD_EMISSIONS_DAYS");
  }

  // 4) Deploy miner with token as both stake and reward
  const { abi: minerAbi, bytecode: minerBytecode } = await hre.artifacts.readArtifact("MiningStaking");
  const minerFactory = new ethers.ContractFactory(minerAbi, minerBytecode, wallet);
  const miner = await minerFactory.deploy(
    tokenOwner,
    tokenAddress,
    tokenAddress,
    rewardRatePerSecond,
    thresholds,
    tierMultipliers
  );
  await miner.waitForDeployment();
  const minerAddress = await miner.getAddress();
  console.log("MiningStaking deployed:", minerAddress);

  // 5) Optionally fund miner with reward tokens
  if (rewardFundAmount) {
    const { abi } = await hre.artifacts.readArtifact("IERC20");
    const erc20 = new ethers.Contract(tokenAddress, abi, wallet);
    const amt = toUnits(rewardFundAmount, tokenDecimals);
    const tx = await erc20.transfer(minerAddress, amt);
    await tx.wait();
    console.log("Funded miner with", rewardFundAmount, tokenSymbol);
  }

  // 6) Update tokenlist.json
  if (tokenLogoUri) {
    const res = spawnSync(process.execPath, ["scripts/update-tokenlist.js"], {
      stdio: "inherit",
      env: {
        ...process.env,
        TOKEN_ADDRESS: tokenAddress,
        TOKEN_NAME: tokenName,
        TOKEN_SYMBOL: tokenSymbol,
        TOKEN_DECIMALS: String(tokenDecimals),
        TOKEN_LOGO_URI: tokenLogoUri,
        TOKEN_DESCRIPTION: tokenDescription,
        TOKEN_WEBSITE: tokenWebsite,
        TOKEN_X: tokenX,
        TOKEN_TWITTER: tokenTwitter,
        TOKEN_INSTAGRAM: tokenInstagram,
        TOKEN_FARCASTER: tokenFarcaster,
        TOKEN_TELEGRAM: tokenTelegram,
        TOKEN_DISCORD: tokenDiscord,
        TOKEN_GITHUB: tokenGithub,
        TOKEN_MEDIUM: tokenMedium,
      },
    });
    if (res.status !== 0) {
      console.warn("tokenlist update failed (continuing)");
    }
  } else {
    console.warn("TOKEN_LOGO_URI not provided; skipping tokenlist update");
  }

  // 7) Write canonical token metadata JSON files for crawlers/aggregators
  {
    const res = spawnSync(process.execPath, ["scripts/write-token-metadata.js"], {
      stdio: "inherit",
      env: {
        ...process.env,
        TOKEN_ADDRESS: tokenAddress,
      },
    });
    if (res.status !== 0) {
      console.warn("write-token-metadata failed (continuing)");
    }
  }

  // 8) Print env exports for frontend
  console.log("\nExport these to your web/.env.local:");
  console.log(`NEXT_PUBLIC_TOKEN_ADDRESS=${tokenAddress}`);
  console.log(`NEXT_PUBLIC_MINER_ADDRESS=${minerAddress}`);
  console.log(`NEXT_PUBLIC_TOKEN_DECIMALS=${tokenDecimals}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});


