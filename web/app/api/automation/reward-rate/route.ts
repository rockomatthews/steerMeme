import { NextRequest } from 'next/server'
import staking from '@/lib/MiningStaking.json'
import type { Abi } from 'viem'
import { base } from 'viem/chains'
import { createPublicClient, createWalletClient, http, parseUnits, Hex, Address } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

type Json = Record<string, unknown>

export async function GET() {
  try {
    const minerAddress = process.env.NEXT_PUBLIC_MINER_ADDRESS as Address | undefined
    const rpcUrl = process.env.NEXT_PUBLIC_BASE_RPC_URL || process.env.BASE_RPC_URL
    const pk = process.env.PRIVATE_KEY as Hex | undefined
    const decimals = Number(process.env.NEXT_PUBLIC_TOKEN_DECIMALS || process.env.TOKEN_DECIMALS || 18)
    const targetPerDay = process.env.TARGET_EMISSION_PER_DAY
    const thresholdBps = Number(process.env.EMISSION_THRESHOLD_BPS || 500) // 5%

    if (!minerAddress) return Response.json({ ok: false, error: 'Missing MINER_ADDRESS' } as Json, { status: 400 })
    if (!rpcUrl) return Response.json({ ok: false, error: 'Missing BASE RPC URL' } as Json, { status: 400 })
    if (!pk) return Response.json({ ok: false, error: 'Missing PRIVATE_KEY' } as Json, { status: 400 })
    if (!targetPerDay) return Response.json({ ok: false, error: 'Missing TARGET_EMISSION_PER_DAY' } as Json, { status: 400 })

    const publicClient = createPublicClient({ chain: base, transport: http(rpcUrl) })
    const account = privateKeyToAccount(pk)
    const wallet = createWalletClient({ account, chain: base, transport: http(rpcUrl) })

    const abi = staking.abi as Abi

    const current: bigint = await publicClient.readContract({
      address: minerAddress,
      abi,
      functionName: 'rewardRatePerSecond'
    }) as bigint

    const targetPerSecond = parseUnits(targetPerDay, decimals) / BigInt(86400)

    // within threshold?
    const diff = current > targetPerSecond ? current - targetPerSecond : targetPerSecond - current
    const withinBps = current === BigInt(0)
      ? diff === BigInt(0)
      : (diff * BigInt(10_000)) / (current === BigInt(0) ? BigInt(1) : current) <= BigInt(thresholdBps)

    if (withinBps) {
      return Response.json({ ok: true, changed: false, current: current.toString(), target: targetPerSecond.toString() } as Json)
    }

    const hash = await wallet.writeContract({
      address: minerAddress,
      abi,
      functionName: 'setRewardRate',
      args: [targetPerSecond]
    })

    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    return Response.json({ ok: true, changed: true, tx: hash, blockNumber: receipt.blockNumber } as Json)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'automation failed'
    return Response.json({ ok: false, error: msg } as Json, { status: 500 })
  }
}


