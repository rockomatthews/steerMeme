"use client"

import { useEffect, useMemo, useState } from 'react'
import { useAccount, useBalance, useReadContract, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi'
import miningStaking from '@/lib/MiningStaking.json'
import memeToken from '@/lib/MemeToken.json'
import type { Abi } from 'viem'
import { formatUnits, parseUnits } from 'viem'
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

	// Reads
	const { data: staked } = useReadContract({
		address: MINER_ADDRESS,
		abi: MINER_ABI,
		functionName: 'users',
		args: address ? [address] : undefined
	}) as { data: { staked: bigint, weightedStake: bigint, rewardsAccrued: bigint, userRewardPerWeightedStakePaid: bigint } | undefined }

	const { data: earned } = useReadContract({
		address: MINER_ADDRESS,
		abi: MINER_ABI,
		functionName: 'earned',
		args: address ? [address] : undefined
	}) as { data: bigint | undefined }

	const { data: balance } = useBalance({ address, token: TOKEN_ADDRESS })

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

	// Writes
	const { writeContract, data: hash } = useWriteContract()
	useWaitForTransactionReceipt({ hash })
	useEffect(() => setPendingHash(hash), [hash])

	const formattedStake = staked ? formatUnits(staked.staked, TOKEN_DECIMALS) : '0'
	const formattedEarned = earned ? formatUnits(earned, TOKEN_DECIMALS) : '0'

	function approve() {
		if (!TOKEN_ADDRESS || !MINER_ADDRESS) return
		writeContract({ address: TOKEN_ADDRESS, abi: TOKEN_ABI, functionName: 'approve', args: [MINER_ADDRESS, parseUnits('115792089237316195423570985008687907853269984665640564039457', TOKEN_DECIMALS)] })
	}
	function stake() {
		if (!MINER_ADDRESS || !amount) return
		writeContract({ address: MINER_ADDRESS, abi: MINER_ABI, functionName: 'stake', args: [parseUnits(amount, TOKEN_DECIMALS)] })
	}
	function withdraw() {
		if (!MINER_ADDRESS || !amount) return
		writeContract({ address: MINER_ADDRESS, abi: MINER_ABI, functionName: 'withdraw', args: [parseUnits(amount, TOKEN_DECIMALS)] })
	}
	function claim() {
		if (!MINER_ADDRESS) return
		writeContract({ address: MINER_ADDRESS, abi: MINER_ABI, functionName: 'getReward', args: [] })
	}

	const explorerBase = chainId === 8453 ? 'https://basescan.org' : 'https://sepolia.basescan.org'

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
					<h1 className="text-2xl font-bold text-yellow-300">Randy Mining</h1>
					<p className="text-sm text-yellow-200">The more you stake, the faster you mine</p>
				</div>
			</div>

			<div className="grid gap-2 text-sm">
				<div>Connected: {address || '—'}</div>
				<div>Network: {chainId}</div>
				<div>Balance: {balance ? `${balance.formatted} ${balance.symbol}` : '—'}</div>
				<div>Staked: {formattedStake}</div>
				<div>Unclaimed: {formattedEarned}</div>
				{pendingHash && <a className="text-blue-600" target="_blank" href={`${explorerBase}/tx/${pendingHash}`}>View tx</a>}
			</div>

			<div className="flex gap-2 items-end">
				<div className="flex-1">
					<label className="block text-sm mb-1">Amount</label>
					<input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.0" className="w-full border rounded px-3 py-2 border-yellow-400 bg-yellow-400/10 text-yellow-200" />
				</div>
				<button onClick={approve} className="px-6 py-3 rounded text-sm font-bold border-2 border-yellow-400 text-yellow-300 bg-yellow-400/10 hover:bg-yellow-400/20 shadow-[0_0_20px_rgba(250,204,21,0.35)]">Approve</button>
				<button onClick={stake} className="px-6 py-3 rounded text-sm font-bold border-2 border-yellow-400 text-yellow-300 bg-yellow-400/10 hover:bg-yellow-400/20 shadow-[0_0_20px_rgba(250,204,21,0.35)]">Stake</button>
				<button onClick={withdraw} className="px-6 py-3 rounded text-sm font-bold border-2 border-yellow-400 text-yellow-300 bg-yellow-400/10 hover:bg-yellow-400/20 shadow-[0_0_20px_rgba(250,204,21,0.35)]">Withdraw</button>
				<button onClick={claim} className="px-6 py-3 rounded text-sm font-bold border-2 border-yellow-400 text-yellow-300 bg-yellow-400/10 hover:bg-yellow-400/20 shadow-[0_0_20px_rgba(250,204,21,0.35)]">Claim</button>
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
