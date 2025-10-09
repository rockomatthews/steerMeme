#!/usr/bin/env node
import fs from "fs";
import path from "path";

const TOKENLIST_PATH = path.resolve("tokenlist.json");

function main() {
  const tokenAddress = process.env.TOKEN_ADDRESS || "";
  const tokenName = process.env.TOKEN_NAME || "SteerMeme";
  const tokenSymbol = process.env.TOKEN_SYMBOL || "STEER";
  const tokenDecimals = Number(process.env.TOKEN_DECIMALS || 18);
  const logoUri = process.env.TOKEN_LOGO_URI || "";
  const chainId = Number(process.env.CHAIN_ID || 8453);
  const description = process.env.TOKEN_DESCRIPTION || "";
  const website = process.env.TOKEN_WEBSITE || "";
  const x = process.env.TOKEN_X || "";
  const twitter = process.env.TOKEN_TWITTER || ""; // prefer explicit twitter if provided
  const instagram = process.env.TOKEN_INSTAGRAM || "";
  const farcaster = process.env.TOKEN_FARCASTER || "";
  const telegram = process.env.TOKEN_TELEGRAM || "";
  const discord = process.env.TOKEN_DISCORD || "";
  const github = process.env.TOKEN_GITHUB || "";
  const medium = process.env.TOKEN_MEDIUM || "";

  if (!tokenAddress) {
    console.error("TOKEN_ADDRESS is required");
    process.exit(1);
  }
  if (!logoUri) {
    console.error("TOKEN_LOGO_URI is required (https URL)");
    process.exit(1);
  }

  const raw = fs.readFileSync(TOKENLIST_PATH, "utf8");
  const data = JSON.parse(raw);

  const now = new Date().toISOString();
  data.timestamp = now;

  let replaced = false;
  data.tokens = (data.tokens || []).map((t) => {
    if (
      String(t.address).toLowerCase() === String(tokenAddress).toLowerCase() ||
      (String(t.symbol).toUpperCase() === String(tokenSymbol).toUpperCase() && t.chainId === chainId)
    ) {
      replaced = true;
      const extensions = {};
      if (description) extensions.description = description;
      if (website) {
        extensions.website = website; // common key used by several UIs
        extensions.url = website;     // alias used by some aggregators
      }
      const tw = twitter || x;
      if (tw) extensions.twitter = tw;
      if (x && !tw) extensions.x = x; // keep x if provided but no twitter
      if (telegram) extensions.telegram = telegram;
      if (discord) extensions.discord = discord;
      if (github) extensions.github = github;
      if (medium) extensions.medium = medium;
      if (instagram) extensions.instagram = instagram;
      if (farcaster) extensions.farcaster = farcaster;
      const token = {
        chainId,
        address: tokenAddress,
        name: tokenName,
        symbol: tokenSymbol,
        decimals: tokenDecimals,
        logoURI: logoUri
      };
      if (Object.keys(extensions).length > 0) {
        token.extensions = extensions;
      }
      return token;
    }
    return t;
  });

  if (!replaced) {
    const extensions = {};
    if (description) extensions.description = description;
    if (website) {
      extensions.website = website;
      extensions.url = website;
    }
    const tw = twitter || x;
    if (tw) extensions.twitter = tw;
    if (x && !tw) extensions.x = x;
    if (telegram) extensions.telegram = telegram;
    if (discord) extensions.discord = discord;
    if (github) extensions.github = github;
    if (medium) extensions.medium = medium;
    if (instagram) extensions.instagram = instagram;
    if (farcaster) extensions.farcaster = farcaster;
    const token = {
      chainId,
      address: tokenAddress,
      name: tokenName,
      symbol: tokenSymbol,
      decimals: tokenDecimals,
      logoURI: logoUri,
      // Clanker-style mirrors to help scrapers
      image: logoUri || undefined,
      metadata: {
        description: description || undefined,
        socialMediaUrls: [
          ...(website ? [{ platform: 'website', url: website }] : []),
          ...((twitter || x) ? [{ platform: 'x', url: twitter || x }] : []),
          ...(telegram ? [{ platform: 'telegram', url: telegram }] : []),
          ...(discord ? [{ platform: 'discord', url: discord }] : []),
          ...(instagram ? [{ platform: 'instagram', url: instagram }] : []),
          ...(farcaster ? [{ platform: 'farcaster', url: farcaster }] : []),
          ...(github ? [{ platform: 'github', url: github }] : []),
          ...(medium ? [{ platform: 'medium', url: medium }] : [])
        ],
        auditUrls: []
      },
      context: { interface: 'steermeme' }
    };
    if (Object.keys(extensions).length > 0) {
      token.extensions = extensions;
    }
    data.tokens.push(token);
  }

  fs.writeFileSync(TOKENLIST_PATH, JSON.stringify(data, null, 2) + "\n");
  console.log("Updated tokenlist.json for", tokenAddress);
}

main();


