#!/usr/bin/env node
import fs from "fs";
import path from "path";

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function main() {
  const chainId = Number(process.env.CHAIN_ID || 8453);
  const tokenAddress = process.env.TOKEN_ADDRESS;
  if (!tokenAddress) {
    console.error("TOKEN_ADDRESS required");
    process.exit(1);
  }

  const name = process.env.TOKEN_NAME || "Randy";
  const symbol = process.env.TOKEN_SYMBOL || "RANDY";
  const decimals = Number(process.env.TOKEN_DECIMALS || 18);
  const logoURI = process.env.TOKEN_LOGO_URI || "";
  const description = process.env.TOKEN_DESCRIPTION || "";
  const website = process.env.TOKEN_WEBSITE || "";
  const twitter = process.env.TOKEN_TWITTER || process.env.TOKEN_X || "";
  const telegram = process.env.TOKEN_TELEGRAM || "";
  const discord = process.env.TOKEN_DISCORD || "";
  const instagram = process.env.TOKEN_INSTAGRAM || "";
  const farcaster = process.env.TOKEN_FARCASTER || "";
  const github = process.env.TOKEN_GITHUB || "";
  const medium = process.env.TOKEN_MEDIUM || "";

  // Clanker-style socials array
  const socialMediaUrls = [];
  if (twitter) socialMediaUrls.push({ platform: 'x', url: twitter });
  if (website) socialMediaUrls.push({ platform: 'website', url: website });
  if (telegram) socialMediaUrls.push({ platform: 'telegram', url: telegram });
  if (discord) socialMediaUrls.push({ platform: 'discord', url: discord });
  if (instagram) socialMediaUrls.push({ platform: 'instagram', url: instagram });
  if (farcaster) socialMediaUrls.push({ platform: 'farcaster', url: farcaster });
  if (github) socialMediaUrls.push({ platform: 'github', url: github });
  if (medium) socialMediaUrls.push({ platform: 'medium', url: medium });

  const payload = {
    name,
    symbol,
    address: tokenAddress,
    chainId,
    decimals,
    description,
    website,
    logoURI,
    image: logoURI || undefined,
    metadata: {
      description: description || undefined,
      socialMediaUrls,
      auditUrls: []
    },
    context: {
      interface: 'steermeme'
    },
    links: {
      twitter: twitter || undefined,
      telegram: telegram || undefined,
      discord: discord || undefined,
      instagram: instagram || undefined,
      farcaster: farcaster || undefined,
      github: github || undefined,
      medium: medium || undefined
    }
  };

  // Write canonical files for crawlers
  const baseDir = path.resolve("web/public");
  ensureDir(baseDir);
  const addrDir = path.join(baseDir, "token");
  ensureDir(addrDir);
  const wellKnownDir = path.join(baseDir, ".well-known");
  ensureDir(wellKnownDir);

  const byAddressPath = path.join(addrDir, `${tokenAddress}.json`);
  const wellKnownPath = path.join(wellKnownDir, `token-${tokenAddress}.json`);
  const canonicalPath = path.join(baseDir, "token-metadata.json");

  fs.writeFileSync(byAddressPath, JSON.stringify(payload, null, 2) + "\n");
  fs.writeFileSync(wellKnownPath, JSON.stringify(payload, null, 2) + "\n");
  fs.writeFileSync(canonicalPath, JSON.stringify(payload, null, 2) + "\n");

  console.log("Wrote token metadata files:", byAddressPath, wellKnownPath, canonicalPath);
}

main();


