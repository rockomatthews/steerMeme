import { NextRequest } from 'next/server'
// Using HTTP API to avoid client-side key format constraints

export async function POST(req: NextRequest) {
	try {
		const form = await req.formData()
		const file = form.get('file') as unknown as File | null
		if (!file) return new Response('no file', { status: 400 })
		let token = (process.env.NFT_STORAGE_TOKEN || process.env.WEB3_STORAGE_TOKEN || '').trim()
		if (token.toLowerCase().startsWith('bearer ')) token = token.slice(7)
		if (!token) return new Response('missing server token', { status: 500 })
		// Forward the same file to nft.storage HTTP API
		const fd = new FormData()
		// preserve filename if present
		const blob = file as unknown as Blob
		const name = (file as unknown as File).name || 'upload.bin'
		fd.append('file', blob, name)
		const upstream = await fetch('https://api.nft.storage/upload', {
			method: 'POST',
			headers: { Authorization: `Bearer ${token}` },
			body: fd
		})
		const ct = upstream.headers.get('content-type') || ''
		const body = ct.includes('application/json') ? await upstream.json() : { ok: false, error: await upstream.text() }
		if (!upstream.ok || body?.ok === false) {
			const msg = (body?.error && (body.error.message || body.error)) || 'upload failed'
			return new Response(String(msg), { status: 500 })
		}
		const cid = body?.value?.cid || body?.cid
		return Response.json({ cid, uri: `ipfs://${cid}` })
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : 'upload failed'
		return new Response(msg, { status: 500 })
	}
}


