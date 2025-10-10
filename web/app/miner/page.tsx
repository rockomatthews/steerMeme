"use client"

import { useEffect, useMemo, useState } from 'react'
import { useAccount, useBalance, useReadContract, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi'
import miningStaking from '@/lib/MiningStaking.json'
import memeToken from '@/lib/MemeToken.json'
import type { Abi } from 'viem'
import { formatUnits, parseUnits, maxUint256 } from 'viem'
import Image from 'next/image'

const MINER_ADDRESS = process.env.NEXT_PUBLIC_MINER_ADDRESS as `0x${string}` | undefined
const TOKEN_ADDRESS = process.env.NEXT_PUBLIC_TOKEN_ADDRESS as `0x${string}` | undefined
const TOKEN_DECIMALS = Number(process.env.NEXT_PUBLIC_TOKEN_DECIMALS || 18)

const MINER_ABI = miningStaking.abi as Abi
const TOKEN_ABI = memeToken.abi as Abi

export default function MinerPage() {
	const { address } = useAccount()
	const chainId = useChainId()
	const [amount, setAmount] = useState('')
	const [pendingHash, setPendingHash] = useState<`0x${string}` | undefined>()
	const [lockDays, setLockDays] = useState<number>(0)
	const [liveEarned, setLiveEarned] = useState<bigint>(0n)

	// Reads
	const { data: staked } = useReadContract({
		address: MINER_ADDRESS,
		abi: MINER_ABI,
		functionName: 'users',
		args: address ? [address] : undefined
	}) as { data: { staked: bigint, weightedStake: bigint, rewardsAccrued: bigint, userRewardPerWeightedStakePaid: bigint, lockEnd?: bigint, lockBoostMultiplier?: bigint } | undefined }

	const { data: earned } = useReadContract({
		address: MINER_ADDRESS,
		abi: MINER_ABI,
		functionName: 'earned',
		args: address ? [address] : undefined
	}) as { data: bigint | undefined }

	const { data: balance } = useBalance({ address, token: TOKEN_ADDRESS })

	// Allowance of miner to spend $Randy on behalf of user
	const { data: allowance } = useReadContract({
		address: TOKEN_ADDRESS,
		abi: TOKEN_ABI,
		functionName: 'allowance',
		args: address && MINER_ADDRESS ? [address, MINER_ADDRESS] : undefined
	}) as { data: bigint | undefined }

	// Global emissions and tiers
	const { data: tiers } = useReadContract({
		address: MINER_ADDRESS,
		abi: MINER_ABI,
		functionName: 'tiers'
	}) as { data: readonly [bigint[], bigint[]] | undefined }

const { data: _rewardRate } = useReadContract({
		address: MINER_ADDRESS,
		abi: MINER_ABI,
		functionName: 'rewardRatePerSecond'
	}) as { data: bigint | undefined }

const { data: _totalWeighted } = useReadContract({
		address: MINER_ADDRESS,
		abi: MINER_ABI,
		functionName: 'totalWeightedStake'
	}) as { data: bigint | undefined }

	// Current user multiplier (considers lock + tiers on-chain)
	const { data: _userMult } = useReadContract({
		address: MINER_ADDRESS,
		abi: MINER_ABI,
		functionName: 'currentUserMultiplier',
		args: address ? [address] : undefined
	}) as { data: bigint | undefined }

	// Reward token balance held by miner to estimate runway
	const { data: minerRewardBal } = useBalance({ address: MINER_ADDRESS, token: TOKEN_ADDRESS })

	const rewardRate = _rewardRate ? formatUnits(_rewardRate, TOKEN_DECIMALS) : '0'
	const totalWeighted = _totalWeighted ? _totalWeighted.toString() : '0'
	const runwayDays = useMemo(() => {
		if (!_rewardRate || !minerRewardBal?.value) return '—'
		if (_rewardRate === 0n) return '∞'
		const seconds = minerRewardBal.value / _rewardRate
		const days = Number(seconds) / (60 * 60 * 24)
		return days.toFixed(1)
	}, [_rewardRate, minerRewardBal])

	// DEX buy link (Base)
	const buyUrl = useMemo(() => {
		if (!TOKEN_ADDRESS) return undefined
		// Use Uniswap v2/permutations friendly aggregator like Baseswap or Uniswap interface if available
		// Fallback to basescan token page
		return `https://basescan.org/token/${TOKEN_ADDRESS}`
	}, [])

	// Writes
	const { writeContract, data: hash } = useWriteContract()
	useWaitForTransactionReceipt({ hash })
	useEffect(() => setPendingHash(hash), [hash])

	const formattedStake = staked ? formatUnits(staked.staked, TOKEN_DECIMALS) : '0'
	const formattedEarned = earned ? formatUnits(earned, TOKEN_DECIMALS) : '0'

	const amountBN = useMemo(() => {
		try {
			return amount ? parseUnits(amount, TOKEN_DECIMALS) : 0n
		} catch {
			return 0n
		}
	}, [amount])

	const needsApproval = useMemo(() => {
		if (!MINER_ADDRESS || !TOKEN_ADDRESS) return true
		if (!amountBN) return false
		if (allowance === undefined) return true
		return allowance < amountBN
	}, [allowance, amountBN])

	function approve() {
		if (!TOKEN_ADDRESS || !MINER_ADDRESS) return
		writeContract({ address: TOKEN_ADDRESS, abi: TOKEN_ABI, functionName: 'approve', args: [MINER_ADDRESS, maxUint256] })
	}
	function stake() {
		if (!MINER_ADDRESS || !amountBN) return
		const seconds = BigInt(Math.max(0, Math.min(365, lockDays))) * 86400n
		if (seconds > 0n) {
			writeContract({ address: MINER_ADDRESS, abi: MINER_ABI, functionName: 'stakeWithLock', args: [amountBN, seconds] })
		} else {
			writeContract({ address: MINER_ADDRESS, abi: MINER_ABI, functionName: 'stake', args: [amountBN] })
		}
	}
	function withdraw() {
		if (!MINER_ADDRESS || !amountBN) return
		writeContract({ address: MINER_ADDRESS, abi: MINER_ABI, functionName: 'withdraw', args: [amountBN] })
	}
	function claim() {
		if (!MINER_ADDRESS) return
		writeContract({ address: MINER_ADDRESS, abi: MINER_ABI, functionName: 'getReward', args: [] })
	}

	function setMax() {
		if (!balance?.value) return
		setAmount(formatUnits(balance.value, TOKEN_DECIMALS))
	}

	const explorerBase = chainId === 8453 ? 'https://basescan.org' : 'https://sepolia.basescan.org'
	// Live mined counter: increment from earned() using per-second share
	useEffect(() => {
		const base = earned ?? 0n
		setLiveEarned(base)
		if (!_rewardRate || !_totalWeighted || _totalWeighted === 0n) return
		const userStaked = staked?.staked ?? 0n
		const mult = _userMult ?? 1000000000000000000n // 1e18
		const userWeighted = (userStaked * mult) / 1000000000000000000n
		const perSecWei = (_rewardRate * userWeighted) / _totalWeighted
		if (perSecWei === 0n) return
		const id = setInterval(() => {
			setLiveEarned((prev) => prev + perSecWei)
		}, 1000)
		return () => clearInterval(id)
	}, [earned, _rewardRate, _totalWeighted, staked?.staked, _userMult])

	// Graph data: show relative mining speed = stake * multiplier (scaled)
	const graphPoints = useMemo(() => {
		const res: { x: number; y: number }[] = []
		if (!tiers) return res
		const [thresholds, multipliers] = tiers
		if (thresholds.length === 0 || multipliers.length === 0) return res
		// Build simple step line across thresholds (in whole tokens)
		const scale = 1e18
		const max = Number(thresholds[thresholds.length - 1] / BigInt(10 ** TOKEN_DECIMALS)) * 2 || 1000
		const xs = Array.from({ length: 11 }, (_, i) => Math.floor((max * i) / 10))
		function currentMult(raw: number) {
			const stakeWei = BigInt(raw) * BigInt(10 ** TOKEN_DECIMALS)
			let m = BigInt(scale)
			for (let i = 0; i < thresholds.length; i++) {
				if (stakeWei >= thresholds[i]) m = multipliers[i]
			}
			return Number(m) / scale
		}
		xs.forEach(x => {
			const y = x * currentMult(x)
			res.push({ x, y })
		})
		return res
	}, [tiers])


	return (
		<main className="min-h-dvh p-6 mx-auto max-w-2xl flex flex-col gap-6">
			<div className="flex items-center gap-3">
				<Image src="/randy.png" alt="Randy" width={56} height={56} />
				<div>
					<h1 className="text-2xl font-bold text-yellow-300 sp-title">Randy Mining</h1>
					<p className="text-sm text-yellow-200">Stake $Randy (ERC-20), not ETH. Approve once, then stake to mine.</p>
				</div>
			</div>

			<div className="grid grid-cols-2 sm:grid-cols-3 gap-6 text-center place-items-center">
				<div>
					<div className="text-xs opacity-70">Connected</div>
					<div className="sp-title text-xl text-yellow-300 break-all">{address || '—'}</div>
				</div>
				<div>
					<div className="text-xs opacity-70">Network</div>
					<div className="sp-title text-xl text-yellow-300">{chainId}</div>
				</div>
				<div>
					<div className="text-xs opacity-70">Balance ($Randy)</div>
					<div className="sp-title text-xl text-yellow-300">{balance ? `${balance.formatted}` : '—'}</div>
				</div>
				{allowance !== undefined && (
					<div>
						<div className="text-xs opacity-70">Allowance → Miner</div>
						<div className="sp-title text-xl text-yellow-300">{formatUnits(allowance, TOKEN_DECIMALS)}</div>
					</div>
				)}
				<div>
					<div className="text-xs opacity-70">Staked</div>
					<div className="sp-title text-xl text-yellow-300">{formattedStake}</div>
				</div>
				<div>
					<div className="text-xs opacity-70">Unclaimed</div>
					<div className="sp-title text-xl text-yellow-300">{formattedEarned}</div>
				</div>
				<div>
					<div className="text-xs opacity-70">Remaining to mine</div>
					<div className="sp-title text-xl text-yellow-300">{minerRewardBal?.value ? formatUnits(minerRewardBal.value, TOKEN_DECIMALS) : '—'}</div>
				</div>
				<div>
					<div className="text-xs opacity-70">Reward rate</div>
					<div className="sp-title text-xl text-yellow-300">{rewardRate} / sec</div>
				</div>
				<div>
					<div className="text-xs opacity-70">Total weighted stake</div>
					<div className="sp-title text-xl text-yellow-300">{totalWeighted}</div>
				</div>
				<div>
					<div className="text-xs opacity-70">Runway (days)</div>
					<div className="sp-title text-xl text-yellow-300">{runwayDays}</div>
				</div>
			</div>
			{pendingHash && <div className="text-center"><a className="text-blue-600" target="_blank" href={`${explorerBase}/tx/${pendingHash}`}>View tx</a></div>}

			<div className="flex flex-col items-center gap-4">
				<div className="w-full max-w-xl">
					<label className="block text-center text-sm mb-2">Amount of $Randy</label>
					<div className="flex gap-2 items-center justify-center">
						<input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.0" className="sp-title text-2xl text-yellow-300 w-full max-w-md border rounded px-4 py-3 border-yellow-400 bg-yellow-400/10" />
						<button onClick={setMax} className="px-4 py-3 rounded text-sm font-bold border-2 border-yellow-400 text-yellow-300 bg-yellow-400/10 hover:bg-yellow-400/20">Max</button>
					</div>
				</div>
				<div className="flex flex-wrap items-center justify-center gap-3">
					{buyUrl && <a href={buyUrl} target="_blank" className="px-6 py-3 rounded text-sm font-bold border-2 border-green-400 text-green-300 bg-green-400/10 hover:bg-green-400/20 shadow-[0_0_20px_rgba(74,222,128,0.35)]">Buy</a>}
					<button onClick={approve} disabled={!amountBN || !TOKEN_ADDRESS || !MINER_ADDRESS || !needsApproval} className="px-6 py-3 rounded text-sm font-bold border-2 border-yellow-400 text-yellow-300 bg-yellow-400/10 hover:bg-yellow-400/20 disabled:opacity-50 shadow-[0_0_20px_rgba(250,204,21,0.35)] sp-btn">{needsApproval ? 'Approve $Randy' : 'Approved'}</button>
					<button onClick={stake} disabled={!amountBN || needsApproval || !MINER_ADDRESS} className="px-6 py-3 rounded text-sm font-bold border-2 border-yellow-400 text-yellow-300 bg-yellow-400/10 hover:bg-yellow-400/20 disabled:opacity-50 shadow-[0_0_20px_rgba(250,204,21,0.35)] sp-btn">Stake</button>
					<button onClick={withdraw} disabled={!amountBN || !MINER_ADDRESS} className="px-6 py-3 rounded text-sm font-bold border-2 border-yellow-400 text-yellow-300 bg-yellow-400/10 hover:bg-yellow-400/20 disabled:opacity-50 shadow-[0_0_20px_rgba(250,204,21,0.35)] sp-btn">Withdraw</button>
					<button onClick={claim} disabled={!MINER_ADDRESS} className="px-6 py-3 rounded text-sm font-bold border-2 border-yellow-400 text-yellow-300 bg-yellow-400/10 hover:bg-yellow-400/20 disabled:opacity-50 shadow-[0_0_20px_rgba(250,204,21,0.35)] sp-btn">Claim</button>
				</div>
			</div>

			{/* Lock slider */}
			<div className="border border-yellow-400/60 rounded p-4 text-center">
				<label className="block text-sm mb-2">Lock period (days)</label>
				<div className="sp-title text-2xl text-yellow-300 mb-2">{lockDays}</div>
				<input type="range" min={0} max={365} value={lockDays} onChange={(e)=>setLockDays(Number(e.target.value))} className="w-full" />
				<p className="text-xs text-yellow-200 mt-2">Boost: {(1 + (2 * lockDays) / 365).toFixed(2)}x. Withdraw disabled until lock ends.</p>
			</div>

			{/* Live mined counter */}
			<div className="text-center">
				<div className="text-xs opacity-70">Mined $RANDY (live)</div>
				<div className="sp-title text-2xl text-yellow-300">{formatUnits(liveEarned, TOKEN_DECIMALS)}</div>
			</div>

			{/* Simple SVG graph of mining speed vs stake */}
			{graphPoints.length > 0 && (
				<div className="mt-4 border border-yellow-400/60 rounded p-3">
					<p className="text-sm text-yellow-200 mb-2">Mining speed grows with stake × multiplier</p>
					<svg viewBox="0 0 100 40" className="w-full h-48">
						<polyline
							fill="none"
							stroke="#FDE047"
							strokeWidth="2"
							points={graphPoints.map((p)=>`${(p.x/graphPoints[graphPoints.length-1].x)*100},${40-(p.y/graphPoints[graphPoints.length-1].y)*38}`).join(' ')}
						/>
					</svg>
				</div>
			)}
		</main>
	)
}
