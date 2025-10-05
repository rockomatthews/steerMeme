import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function Home() {
	return (
		<main className="min-h-dvh flex flex-col items-center justify-center gap-8 p-8">
			<Image src="/randy.png" alt="Randy" width={128} height={128} priority />
			<h1 className="text-3xl font-bold text-yellow-300">Randy Mining</h1>
			<p className="opacity-80 text-yellow-200">The more you stake, the faster you mine</p>
			<div className="flex gap-4">
				<Link href="/miner" className="px-6 py-3 rounded text-xl font-extrabold border-2 border-yellow-400 text-yellow-300 bg-yellow-400/10 hover:bg-yellow-400/20 shadow-[0_0_20px_rgba(250,204,21,0.35)]">Open Miner</Link>
				<Link href="/launch" className="px-6 py-3 rounded text-xl font-extrabold border-2 border-yellow-400 text-yellow-300 bg-yellow-400/10 hover:bg-yellow-400/20 shadow-[0_0_20px_rgba(250,204,21,0.35)]">Launch your own token!</Link>
			</div>

			<TokensWall />

			<div className="w-full h-[500px] mt-8">
				<iframe
					src="https://my.spline.design/forestlightscopy-2fe691ae6c70aa4bda94b2be3eff5ffe/"
					frameBorder={0}
					width="100%"
					height="100%"
					className="w-full h-full rounded"
				/>
			</div>
		</main>
	)
}

async function fetchTokens() {
    const r = await fetch('/api/tokens', { cache: 'no-store' })
    if (!r.ok) return [] as any[]
    const j = await r.json()
    return j.tokens ?? []
}

function formatUSD(n?: number) {
    if (!n && n !== 0) return '—'
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact' }).format(n)
}

function pct(n?: number) {
    if (n === undefined || n === null) return '—'
    const sign = n > 0 ? '+' : ''
    return `${sign}${n.toFixed(2)}%`
}

function TokensWall() {
    const [tokens, setTokens] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    useEffect(() => { (async()=>{ setLoading(true); setTokens(await fetchTokens()); setLoading(false) })() }, [])
    return (
        <div className="w-full max-w-5xl mt-8">
            <h2 className="text-yellow-300 font-bold mb-3">Launched Tokens</h2>
            {loading && <div className="opacity-70">Loading…</div>}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {tokens.map((t, i) => (
                    <a key={i} href={`https://clanker.world/clanker/${t.address || t.tokenAddress}`} target="_blank" className="block p-4 border-2 border-yellow-400 rounded bg-yellow-400/5 hover:bg-yellow-400/10">
                        <div className="font-bold text-yellow-300 mb-1">{t.name || t.token?.name} <span className="opacity-70">{t.symbol || t.token?.symbol}</span></div>
                        <div className="text-sm">MCap: {formatUSD(t.marketCapUsd || t.stats?.marketCapUsd)}</div>
                        <div className={`text-sm ${((t.change24hPct || t.stats?.change24hPct) ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>24h: {pct(t.change24hPct || t.stats?.change24hPct)}</div>
                    </a>
                ))}
            </div>
        </div>
    )
}
