"use client";

import { useState } from "react";
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import { useAccount, usePublicClient, useWalletClient, useChainId, useSwitchChain } from "wagmi";
import type { WalletClient, PublicClient } from "viem";
import { Clanker } from "clanker-sdk/v4";
import { base, baseSepolia } from "wagmi/chains";

const TREASURY: `0x${string}` = "0x57585874DBf39B18df1AD2b829F18D6BFc2Ceb4b";

export default function LaunchPage() {
	const { address } = useAccount();
	const publicClient = usePublicClient() as PublicClient;
	const { data: wallet } = useWalletClient();
    const chainId = useChainId();
    const activeChain = chainId === base.id ? base : baseSepolia;
    const { switchChain, isPending: isSwitching } = useSwitchChain();

	const [name, setName] = useState("");
	const [symbol, setSymbol] = useState("");
	const [vanity, setVanity] = useState(true);
	const [image, setImage] = useState("");
	const [description, setDescription] = useState("");
	const [twitter, setTwitter] = useState("");
	const [website, setWebsite] = useState("");
	const [feeType, setFeeType] = useState<"static"|"default">("default");
	const [clankerFeeBps, setClankerFeeBps] = useState("100");
	const [pairedFeeBps, setPairedFeeBps] = useState("100");
	const [vaultPct, setVaultPct] = useState("0");
	const [lockup, setLockup] = useState("0");
	const [vesting, setVesting] = useState("0");
	const [devBuyEth, setDevBuyEth] = useState("0");
	const [status, setStatus] = useState<string>("");
	const [txHash, setTxHash] = useState<string>("");
	const [deployed, setDeployed] = useState<string>("");
	const [error, setError] = useState<string>("");

	async function deploy() {
		setStatus("Preparing...");
		setError("");
		setTxHash("");
		setDeployed("");
		if (!address || !wallet || !publicClient) {
			setError("Connect wallet");
			return;
		}
		if (!wallet.account) {
			setError("Wallet account missing");
			return;
		}
		try {
			const walletWithAccount = wallet as WalletClient & { account: NonNullable<WalletClient['account']> };
			const walletForSdk = { ...walletWithAccount, chain: activeChain } as unknown as WalletClient;
			const clanker = new Clanker({ publicClient: publicClient as unknown as any, wallet: walletForSdk as unknown as any });
			const tokenConfig: any = {
				name,
				symbol,
				tokenAdmin: address,
				vanity,
				image: image || undefined,
				metadata: {
					description: description || undefined,
					socialMediaUrls: [twitter || "", website || ""].filter(Boolean),
				},
				context: { interface: 'steermeme' },
				rewards: {
					recipients: [
						{ recipient: address, admin: address, bps: 9800, token: "Paired" },
						{ recipient: TREASURY, admin: TREASURY, bps: 200, token: "Paired" },
					],
				},
			};
			if (feeType === 'static') {
				tokenConfig.fees = { type: 'static', clankerFee: Number(clankerFeeBps), pairedFee: Number(pairedFeeBps) };
			}
			const vp = Number(vaultPct);
			if (vp > 0) {
				tokenConfig.vault = { percentage: vp, lockupDuration: Number(lockup), vestingDuration: Number(vesting) };
			}
			if (Number(devBuyEth) > 0) {
				tokenConfig.devBuy = { ethAmount: Number(devBuyEth) };
			}
			const { txHash, waitForTransaction, error } = await clanker.deploy(tokenConfig);
			if (error) throw error;
			setTxHash(txHash);
			setStatus("Waiting for confirmation...");
			const { address: tokenAddr, error: waitErr } = await waitForTransaction();
			if (waitErr) throw waitErr;
			setDeployed(tokenAddr);
			setStatus("Deployed");
		} catch (e: unknown) {
			setError(e instanceof Error ? e.message : 'Deployment failed');
			setStatus("");
		}
	}

	const explorerBase = activeChain.id === base.id ? "https://basescan.org" : "https://sepolia.basescan.org";

	return (
		<main className="max-w-2xl mx-auto p-6 flex flex-col gap-4">
			<Typography variant="h4" fontWeight={700}>Launch a Meme Token</Typography>
			<Typography variant="body2" color="text.secondary">Deploy via Clanker SDK. Creator 98% / Site Treasury 2% of LP rewards.</Typography>
			{activeChain.id !== base.id && (
				<div className="p-3 border rounded text-sm bg-yellow-50">
					You are on {activeChain.name}. Please switch to Base mainnet.
					<button onClick={() => switchChain({ chainId: base.id })} disabled={isSwitching} className="ml-2 px-3 py-1 border rounded">{isSwitching ? 'Switching…' : 'Switch to Base'}</button>
				</div>
			)}
			<TextField label="Name" value={name} onChange={(e)=>setName(e.target.value)} placeholder="Randy" />
			<TextField label="Symbol" value={symbol} onChange={(e)=>setSymbol(e.target.value)} placeholder="RANDY" />
			<input type="file" accept="image/*" onChange={async (e)=>{
				const f = e.target.files?.[0];
				if (!f) return;
				const fd = new FormData();
				fd.append('file', f);
				setStatus('Uploading image...');
				setError('');
				try {
					const res = await fetch('/api/ipfs', { method: 'POST', body: fd });
					const json = await res.json();
					if (!res.ok) throw new Error(json?.message || 'Upload failed');
					setImage(json.uri);
					setStatus('Image uploaded');
				} catch (err: unknown) {
					setError(err instanceof Error ? err.message : 'Upload failed');
					setStatus('');
				}
			}} />
			{image && (
				<div className="mt-2 border border-white/60 rounded p-2">
					<img src={image.replace('ipfs://', 'https://ipfs.io/ipfs/')} alt="preview" className="max-h-48 object-contain" />
				</div>
			)}
			<TextField label="Description" multiline minRows={3} value={description} onChange={(e)=>setDescription(e.target.value)} placeholder="What is your token?" />
			<TextField label="Twitter URL" value={twitter} onChange={(e)=>setTwitter(e.target.value)} placeholder="https://x.com/handle" />
			<TextField label="Website URL" value={website} onChange={(e)=>setWebsite(e.target.value)} placeholder="https://yoursite" />
			<FormControlLabel control={<Checkbox checked={vanity} onChange={(e)=>setVanity(e.target.checked)} />} label="Vanity suffix" />
			<div className="grid grid-cols-2 gap-3">
				<div>
					<label className="text-sm">Fee Type</label>
					<Select value={feeType} onChange={(e)=>setFeeType(e.target.value as any)}>
						<MenuItem value="default">Dynamic (default)</MenuItem>
						<MenuItem value="static">Static</MenuItem>
					</Select>
				</div>
				{feeType === 'static' && (
					<>
						<TextField label="Clanker Fee (bps)" value={clankerFeeBps} onChange={(e)=>setClankerFeeBps(e.target.value)} />
						<TextField label="Paired Fee (bps)" value={pairedFeeBps} onChange={(e)=>setPairedFeeBps(e.target.value)} />
					</>
				)}
			</div>
			<div className="grid grid-cols-3 gap-3">
				<TextField label="Vault %" value={vaultPct} onChange={(e)=>setVaultPct(e.target.value)} />
				<TextField label="Lockup (sec)" value={lockup} onChange={(e)=>setLockup(e.target.value)} />
				<TextField label="Vesting (sec)" value={vesting} onChange={(e)=>setVesting(e.target.value)} />
			</div>
			<TextField label="Dev Buy (ETH)" value={devBuyEth} onChange={(e)=>setDevBuyEth(e.target.value)} placeholder="0" />
			<Button onClick={deploy} variant="contained" disabled={activeChain.id !== base.id}>Deploy</Button>
			{status && <div className="text-sm">{status}</div>}
			{txHash && <a className="text-blue-600 text-sm" target="_blank" href={`${explorerBase}/tx/${txHash}`}>View tx</a>}
			{deployed && <div className="text-sm">Token: {deployed} &nbsp; <a className="text-blue-600" target="_blank" href={`https://clanker.world/clanker/${deployed}`}>View on Clanker</a></div>}
			{error && <div className="text-sm text-red-600">{error}</div>}
		</main>
	);
}


