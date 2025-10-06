import { NextRequest } from 'next/server'
export const runtime = 'nodejs'
// Using HTTP API to avoid client-side key format constraints

export async function POST(req: NextRequest) {
	try {
		const form = await req.formData()
		const file = form.get('file') as unknown as File | null
		if (!file) return new Response('no file', { status: 400 })
		let token = (process.env.NFT_STORAGE_TOKEN || process.env.WEB3_STORAGE_TOKEN || '').trim()
		if (token.toLowerCase().startsWith('bearer ')) token = token.slice(7)
		if (!token) return Response.json({ ok: false, error: 'missing server token' }, { status: 500 })
		// Forward raw bytes (octet-stream) to nft.storage HTTP API
		const blob = file as unknown as Blob
		const ab = await (blob as Blob).arrayBuffer()
		const buf = Buffer.from(ab)
		const upstream = await fetch('https://api.nft.storage/upload', {
			method: 'POST',
			headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream', 'Content-Length': String(buf.length) },
			body: buf
		})
		const ct = upstream.headers.get('content-type') || ''
		const body = ct.includes('application/json') ? await upstream.json() : { ok: false, error: await upstream.text() }
		if (!upstream.ok || body?.ok === false) {
			const msg = (body?.error && (body.error.message || body.error)) || `nft.storage ${upstream.status}`
			return Response.json({ ok: false, status: upstream.status, error: msg }, { status: 500 })
		}
		const cid = body?.value?.cid || body?.cid
		return Response.json({ ok: true, cid, uri: `ipfs://${cid}` })
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : 'upload failed'
		return Response.json({ ok: false, error: msg }, { status: 500 })
	}
}


