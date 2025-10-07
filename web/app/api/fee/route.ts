export async function GET() {
  try {
    const profit = (process.env.PROFIT_ADDRESS || '').trim()
    if (!/^0x[a-fA-F0-9]{40}$/.test(profit)) {
      return Response.json({ ok: false, error: 'Missing PROFIT_ADDRESS' }, { status: 500 })
    }
    const feeUsd = Number(process.env.CREATION_FEE_USD || '5')
    // Fetch ETH price in USD
    let ethUsd = 0
    try {
      const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd', { cache: 'no-store' })
      const j = await r.json()
      ethUsd = Number(j?.ethereum?.usd || 0)
    } catch {}
    if (!ethUsd || !isFinite(ethUsd) || ethUsd <= 0) ethUsd = 3000 // fallback
    const ethAmount = feeUsd / ethUsd
    const wei = BigInt(Math.round(ethAmount * 1e18))
    return Response.json({ ok: true, profit, feeUsd, ethUsd, ethAmount, wei: wei.toString() })
  } catch (e) {
    return Response.json({ ok: false, error: 'fee calc failed' }, { status: 500 })
  }
}


