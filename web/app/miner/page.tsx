"use client"

import { useEffect, useState } from 'react'
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

	// Writes
	const { writeContract, data: hash } = useWriteContract()
	const { isLoading: _isMining, isSuccess: _isSuccess } = useWaitForTransactionReceipt({ hash })
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

	return (
		<main className="min-h-dvh p-6 mx-auto max-w-xl flex flex-col gap-6">
			<div className="flex items-center gap-3">
				<Image src="/randy.png" alt="Randy" width={56} height={56} />
				<div>
					<h1 className="text-2xl font-bold">Randy Miner</h1>
					<p className="text-sm opacity-70">Stake Randy to mine faster. More stake → higher multiplier.</p>
				</div>
			</div>

			<div className="grid gap-2 text-sm">
				<div>Connected: {address || '—'}</div>
				<div>Network: {chainId}</div>
				<div>Balance: {balance ? `${balance.formatted} ${balance.symbol}` : '—'}</div>
				<div>Staked: {formattedStake}</div>
				<div>Unclaimed: {formattedEarned}</div>
				{pendingHash && <a className="text-blue-600" target="_blank" href={`https://sepolia.basescan.org/tx/${pendingHash}`}>View tx</a>}
			</div>

			<div className="flex gap-2 items-end">
				<div className="flex-1">
					<label className="block text-sm mb-1">Amount</label>
					<input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.0" className="w-full border rounded px-3 py-2" />
				</div>
				<button onClick={approve} className="px-3 py-2 border rounded">Approve</button>
				<button onClick={stake} className="px-3 py-2 bg-blue-600 text-white rounded">Stake</button>
				<button onClick={withdraw} className="px-3 py-2 border rounded">Withdraw</button>
				<button onClick={claim} className="px-3 py-2 border rounded">Claim</button>
			</div>
		</main>
	)
}
