"use client";

import { useState } from "react";
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import { useAccount, usePublicClient, useWalletClient, useChainId, useSwitchChain } from "wagmi";
import type { PublicClient, Account, EIP1193Provider } from "viem";
import { createWalletClient, custom } from "viem";
import { parseEther } from "viem";
import { Clanker } from "clanker-sdk/v4";
import { base, baseSepolia } from "wagmi/chains";

const TREASURY: `0x${string}` = "0x57585874DBf39B18df1AD2b829F18D6BFc2Ceb4b";

async function logLaunchError(payload: unknown) {
    try {
        await fetch('/api/launch-logs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ts: Date.now(), payload }) })
    } catch {
        // no-op
    }
}

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
	const [imagePreviewUrl, setImagePreviewUrl] = useState<string>("");
	const [description, setDescription] = useState("");
	const [twitter, setTwitter] = useState("");
	const [website, setWebsite] = useState("");
	const [telegram, setTelegram] = useState("");
	const [farcaster, setFarcaster] = useState("");
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
	const [creationFeeUsd, setCreationFeeUsd] = useState<string>("");
	const [creationFeeWei, setCreationFeeWei] = useState<string>("");

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
				// 1) fetch creation fee and send to PROFIT wallet
				setStatus('Paying creation fee...')
				const feeRes = await fetch('/api/fee')
				const feeJson = await feeRes.json()
				if (!feeRes.ok || !feeJson?.ok) throw new Error(feeJson?.error || 'Fee unavailable')
				setCreationFeeUsd(String(feeJson.feeUsd))
				setCreationFeeWei(String(feeJson.wei))
				// send native ETH to profit address
				await walletForSdk.sendTransaction({
					to: feeJson.profit as `0x${string}`,
					value: BigInt(feeJson.wei)
				})
            type DeployArg = Parameters<typeof clanker.deploy>[0];
			const socials: { platform: string; url: string }[] = [];
            if (twitter) socials.push({ platform: 'twitter', url: twitter });
            if (website) socials.push({ platform: 'website', url: website });
			if (telegram) socials.push({ platform: 'telegram', url: telegram });
			if (farcaster) socials.push({ platform: 'farcaster', url: farcaster });
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
			// persist to local list for homepage wall
			try {
				const key = 'launchedTokens'
				type LocalToken = { address: string; name: string; symbol: string; image?: string }
				const prev = JSON.parse(localStorage.getItem(key) || '[]') as LocalToken[]
				const next: LocalToken[] = [{ address: tokenAddr, name, symbol, image }, ...prev.filter((x)=>x.address!==tokenAddr)].slice(0,100)
				localStorage.setItem(key, JSON.stringify(next))
			} catch {}
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
				// Resize/crop to centered square and compress on client (< ~1MB)
				async function downscaleToLimit(file: File, targetDim = 1024, targetBytes = 950_000): Promise<{ blob: Blob; name: string }> {
					const img = document.createElement('img')
					const objectUrl = URL.createObjectURL(file)
					await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error('image load failed')); img.src = objectUrl })
					const canvas = document.createElement('canvas')
					const ctx = canvas.getContext('2d')
					if (!ctx) throw new Error('canvas context failed')
					// Determine centered square crop from source
					const srcSize = Math.min(img.width, img.height)
					const sx = Math.floor((img.width - srcSize) / 2)
					const sy = Math.floor((img.height - srcSize) / 2)
					// Output square canvas
					const outDim = Math.min(targetDim, srcSize)
					canvas.width = outDim
					canvas.height = outDim
					ctx.imageSmoothingQuality = 'high'
					ctx.drawImage(img, sx, sy, srcSize, srcSize, 0, 0, outDim, outDim)
					let quality = 0.9
					let out: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
					while (out && out.size > targetBytes && quality > 0.4) {
						quality -= 0.1
						out = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
					}
					URL.revokeObjectURL(objectUrl)
					if (!out) throw new Error('image encode failed')
					const base = (file.name || 'upload').replace(/\.[^.]+$/, '')
					return { blob: out, name: `${base}.jpg` }
				}

				const { blob, name } = await downscaleToLimit(f)
				const fd = new FormData();
				fd.append('file', blob, name);
				setStatus('Uploading image...');
				setError('');
				try {
					const res = await fetch('/api/ipfs', { method: 'POST', body: fd });
					const ct = res.headers.get('content-type') || ''
					if (!res.ok) {
						const errText = ct.includes('application/json') ? JSON.stringify(await res.json()) : await res.text()
						throw new Error(errText || 'Upload failed')
					}
					const json = ct.includes('application/json') ? await res.json() : { uri: '' }
					setImage(json.uri);
					// Local preview via object URL for immediate feedback
					setImagePreviewUrl(URL.createObjectURL(blob))
					setStatus('Image uploaded');
				} catch (err: unknown) {
					setError(err instanceof Error ? err.message : 'Upload failed');
					setStatus('');
				}
			}} />
			<label htmlFor="token-image" className="inline-block w-fit cursor-pointer px-6 py-3 rounded text-sm font-bold border-2 border-yellow-400 text-yellow-300 bg-yellow-400/10 hover:bg-yellow-400/20 shadow-[0_0_20px_rgba(250,204,21,0.35)]">Select Picture</label>
			{(image || imagePreviewUrl) && (
				<div className="mt-2 border border-white/60 rounded p-2 relative">
					<IconButton size="small" onClick={()=>{ setImage(''); if (imagePreviewUrl) { URL.revokeObjectURL(imagePreviewUrl); } setImagePreviewUrl(''); }} className="!absolute !top-1 !right-1 !text-white/80">
						<CloseIcon fontSize="small" />
					</IconButton>
					<img src={(image || '').startsWith('ipfs://') ? image.replace('ipfs://', 'https://ipfs.io/ipfs/') : (image || imagePreviewUrl)} alt="preview" className="w-48 h-48 object-cover" />
				</div>
			)}
			<TextField label="Description" multiline minRows={3} value={description} onChange={(e)=>setDescription(e.target.value)} placeholder="What is your token?" />
			<TextField label="Twitter URL" value={twitter} onChange={(e)=>setTwitter(e.target.value)} placeholder="https://x.com/handle" />
			<TextField label="Website URL" value={website} onChange={(e)=>setWebsite(e.target.value)} placeholder="https://yoursite" />
			<TextField label="Telegram URL" value={telegram} onChange={(e)=>setTelegram(e.target.value)} placeholder="https://t.me/yourchannel" />
			<TextField label="Farcaster URL" value={farcaster} onChange={(e)=>setFarcaster(e.target.value)} placeholder="https://warpcast.com/username" />
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
			<div className="flex flex-col gap-4">
				<div>
					<div className="flex items-center gap-2 mb-1">
						<Typography variant="body2" fontWeight={600}>Vault % (max 90)</Typography>
						<Tooltip title="Percentage of total token supply reserved to a vault at launch. Vaulted tokens are removed from circulating supply initially and unlock later based on your lockup and vesting settings. Typical range is 5–20%.">
							<InfoOutlined fontSize="small" className="opacity-70" />
						</Tooltip>
					</div>
					<TextField type="number" value={vaultPct} onChange={(e)=>setVaultPct(e.target.value)} placeholder="e.g. 10" />
				</div>
				<div>
					<div className="flex items-center gap-2 mb-1">
						<Typography variant="body2" fontWeight={600}>Lockup (days, min 7)</Typography>
						<Tooltip title="Cliff period where the vault cannot be withdrawn at all. Minimum 7 days per Clanker v4. After the lockup ends, either all tokens unlock immediately (if vesting is 0) or they begin unlocking linearly over the vesting period.">
							<InfoOutlined fontSize="small" className="opacity-70" />
						</Tooltip>
					</div>
					<TextField type="number" value={lockupDays} onChange={(e)=>setLockupDays(e.target.value)} placeholder="e.g. 30" />
				</div>
				<div>
					<div className="flex items-center gap-2 mb-1">
						<Typography variant="body2" fontWeight={600}>Vesting (days)</Typography>
						<Tooltip title="Linear release duration after lockup. 0 means the entire vault unlocks at the end of the lockup (a cliff). For non‑zero vesting, tokens release smoothly from the day lockup ends until vesting completes.">
							<InfoOutlined fontSize="small" className="opacity-70" />
						</Tooltip>
					</div>
					<TextField type="number" value={vestingDays} onChange={(e)=>setVestingDays(e.target.value)} placeholder="e.g. 90" />
				</div>
			</div>
			<TextField label="Dev Buy (ETH)" value={devBuyEth} onChange={(e)=>setDevBuyEth(e.target.value)} placeholder="0" />
			<Button onClick={deploy} variant="contained" disabled={activeChain.id !== base.id} className="w-fit px-6 py-3 rounded text-sm font-bold border-2 border-yellow-400 text-black bg-yellow-300 hover:bg-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.35)]">Deploy</Button>
			{creationFeeUsd && <div className="text-xs opacity-80">Creation fee: ~${creationFeeUsd} (wei {creationFeeWei})</div>}

			{/* Educational: Vault, Lockup, Vesting strategies */}
			<div className="mt-6 space-y-3 text-yellow-200">
				<Typography variant="subtitle1" fontWeight={700}>How Vault, Lockup and Vesting work together</Typography>
				<Typography variant="body2">
					Vault % sets how much of total supply is reserved for long‑term needs (team, growth, ops). Lockup prevents any withdrawal of the vault until it ends (a cliff). Vesting then determines whether the vault unlocks instantly (0 days) or linearly over time.
				</Typography>
				<Typography variant="subtitle2" fontWeight={700}>Examples</Typography>
				<ul className="list-disc pl-5 space-y-1">
					<li><b>No vault:</b> 0% vault, 0 lockup, 0 vesting → 100% circulating at launch.</li>
					<li><b>Cliff only:</b> 10% vault, 30‑day lockup, 0 vesting → that 10% unlocks all at day 31.</li>
					<li><b>Smoother release:</b> 10% vault, 7‑day lockup, 90‑day vesting → unlocks linearly from day 8 to day 97.</li>
					<li><b>Long‑term:</b> 20% vault, 60‑day lockup, 180‑day vesting → strong supply discipline and alignment.</li>
				</ul>
				<Typography variant="subtitle2" fontWeight={700}>Strategy tips</Typography>
				<ul className="list-disc pl-5 space-y-1">
					<li>Keep vault ≤ 20% to avoid supply concerns; communicate purpose clearly.</li>
					<li>Use ≥ 7‑30 days lockup to signal commitment and avoid immediate sell pressure.</li>
					<li>Prefer non‑zero vesting for smoother unlocks unless you intentionally want a cliff event.</li>
				</ul>
			</div>
			{status && <div className="text-sm">{status}</div>}
			{txHash && <a className="text-blue-600 text-sm" target="_blank" href={`${explorerBase}/tx/${txHash}`}>View tx</a>}
			{deployed && <div className="text-sm">Token: {deployed} &nbsp; <a className="text-blue-600" target="_blank" href={`https://clanker.world/clanker/${deployed}`}>View on Clanker</a></div>}
			{error && <div className="text-sm text-red-600">{error}</div>}
		</main>
	);
}


