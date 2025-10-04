import { NextRequest } from 'next/server'

export async function GET(_req: NextRequest) {
  try {
    const chainId = 8453 // Base mainnet
    // Query Clanker Public API for tokens launched via our interface context
    const url = `https://api.clanker.world/public/tokens?chainId=${chainId}&contextInterface=steermeme&limit=100`
    const r = await fetch(url, { next: { revalidate: 60 } })
    if (!r.ok) throw new Error(`clanker api ${r.status}`)
    const data = await r.json()
    return Response.json({ ok: true, tokens: data?.tokens || data || [] })
  } catch (e) {
    return Response.json({ ok: false, tokens: [] })
  }
}


