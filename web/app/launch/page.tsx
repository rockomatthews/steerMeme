"use client";

import { useState } from "react";
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import NextImage from 'next/image';
import { useAccount, usePublicClient, useWalletClient, useChainId, useSwitchChain } from "wagmi";
import type { PublicClient, Account, EIP1193Provider } from "viem";
import { createWalletClient, custom } from "viem";
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
	// store days in UI; convert to seconds on submit
	const [lockupDays, setLockupDays] = useState("0");
	const [vestingDays, setVestingDays] = useState("0");
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
		// client-side validation
		const vaultPctNum = Number(vaultPct || '0')
		const lockupSec = Math.floor(Number(lockupDays || '0') * 24 * 60 * 60)
		const vestingSec = Math.floor(Number(vestingDays || '0') * 24 * 60 * 60)
		if (vaultPctNum < 0 || vaultPctNum > 90) {
			setStatus(""); setError('Vault % must be between 0 and 90');
			await logLaunchError({ code: 'validation', message: 'vault percent out of range', vaultPct: vaultPctNum });
			return;
		}
		if (lockupSec > 0 && lockupSec < 604800) { // 7 days min per Clanker
			setStatus(""); setError('Lockup must be at least 7 days');
			await logLaunchError({ code: 'validation', message: 'lockup too small', lockupSec });
			return;
		}
		if (!address || !wallet || !publicClient) {
			setError("Connect wallet");
			return;
		}
		if (!wallet.account) {
			setError("Wallet account missing");
			return;
		}
		try {
            const account = wallet.account as Account;
            const provider = (window as unknown as { ethereum?: EIP1193Provider }).ethereum;
            if (!provider) throw new Error('No EIP-1193 provider found');
            const walletForSdk = createWalletClient({ account, chain: activeChain, transport: custom(provider) });
            const clanker = new Clanker({ publicClient, wallet: walletForSdk });
            type DeployArg = Parameters<typeof clanker.deploy>[0];
            const socials: { platform: string; url: string }[] = [];
            if (twitter) socials.push({ platform: 'twitter', url: twitter });
            if (website) socials.push({ platform: 'website', url: website });
			let tokenConfig: DeployArg = {
                name,
                symbol,
                tokenAdmin: address as `0x${string}`,
                vanity,
                image: image || undefined,
                metadata: {
                    description: description || undefined,
					socialMediaUrls: socials,
                },
                context: { interface: 'steermeme' },
                rewards: {
                    recipients: [
                        { recipient: address as `0x${string}`, admin: address as `0x${string}`, bps: 9800, token: "Paired" },
                        { recipient: TREASURY, admin: TREASURY, bps: 200, token: "Paired" },
                    ],
                },
            } as DeployArg;
            if (feeType === 'static') {
                tokenConfig = { ...tokenConfig, fees: { type: 'static', clankerFee: Number(clankerFeeBps), pairedFee: Number(pairedFeeBps) } } as DeployArg;
            }
			const vp = vaultPctNum;
			if (vp > 0) {
				tokenConfig = { ...tokenConfig, vault: { percentage: vp, lockupDuration: lockupSec, vestingDuration: vestingSec } } as DeployArg;
			}
			if (Number(devBuyEth) > 0) {
                tokenConfig = { ...tokenConfig, devBuy: { ethAmount: Number(devBuyEth) } } as DeployArg;
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
			await logLaunchError({ code: 'deploy', message: e instanceof Error ? e.message : String(e) });
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
			<input id="token-image" className="hidden" type="file" accept="image/*" onChange={async (e)=>{
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
			<label htmlFor="token-image" className="inline-block w-fit cursor-pointer px-6 py-3 rounded text-sm font-bold border-2 border-yellow-400 text-yellow-300 bg-yellow-400/10 hover:bg-yellow-400/20 shadow-[0_0_20px_rgba(250,204,21,0.35)]">Select Picture</label>
			{image && (
				<div className="mt-2 border border-white/60 rounded p-2">
                    <NextImage src={image.replace('ipfs://', 'https://ipfs.io/ipfs/')} alt="preview" width={512} height={256} className="w-auto h-48 object-contain" />
				</div>
			)}
			<TextField label="Description" multiline minRows={3} value={description} onChange={(e)=>setDescription(e.target.value)} placeholder="What is your token?" />
			<TextField label="Twitter URL" value={twitter} onChange={(e)=>setTwitter(e.target.value)} placeholder="https://x.com/handle" />
			<TextField label="Website URL" value={website} onChange={(e)=>setWebsite(e.target.value)} placeholder="https://yoursite" />
			<FormControlLabel control={<Checkbox checked={vanity} onChange={(e)=>setVanity(e.target.checked)} />} label="Vanity suffix" />
			<div className="grid grid-cols-2 gap-3">
				<div>
					<label className="text-sm">Fee Type</label>
                    <Select value={feeType} onChange={(e)=>setFeeType(e.target.value === 'static' ? 'static' : 'default')}>
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
				<TextField label="Vault % (max 90)" type="number" value={vaultPct} onChange={(e)=>setVaultPct(e.target.value)} />
				<TextField label="Lockup (days, min 7)" type="number" value={lockupDays} onChange={(e)=>setLockupDays(e.target.value)} />
				<TextField label="Vesting (days)" type="number" value={vestingDays} onChange={(e)=>setVestingDays(e.target.value)} />
			</div>
			<TextField label="Dev Buy (ETH)" value={devBuyEth} onChange={(e)=>setDevBuyEth(e.target.value)} placeholder="0" />
			<Button onClick={deploy} variant="contained" disabled={activeChain.id !== base.id} className="w-fit px-6 py-3 rounded text-sm font-bold border-2 border-yellow-400 text-black bg-yellow-300 hover:bg-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.35)]">Deploy</Button>
			{status && <div className="text-sm">{status}</div>}
			{txHash && <a className="text-blue-600 text-sm" target="_blank" href={`${explorerBase}/tx/${txHash}`}>View tx</a>}
			{deployed && <div className="text-sm">Token: {deployed} &nbsp; <a className="text-blue-600" target="_blank" href={`https://clanker.world/clanker/${deployed}`}>View on Clanker</a></div>}
			{error && <div className="text-sm text-red-600">{error}</div>}
		</main>
	);
}


