import { NextRequest } from 'next/server'
export const runtime = 'nodejs'
// Using HTTP API to avoid client-side key format constraints

export async function POST(req: NextRequest) {
	try {
		const form = await req.formData()
		const file = form.get('file') as unknown as File | null
		if (!file) return new Response('no file', { status: 400 })
    // Prefer Pinata JWT; fall back to key/secret if provided
    const jwt = (process.env.PINATA_JWT || process.env.NEXT_PUBLIC_PINATA_JWT || '').trim()
    const apiKey = (process.env.NEXT_PUBLIC_PINATA_API_KEY || '').trim()
    const secret = (process.env.NEXT_PUBLIC_PINATA_SECRET_API_KEY || '').trim()
    if (!jwt && (!apiKey || !secret)) {
      return Response.json({ ok: false, error: 'missing Pinata credentials' }, { status: 500 })
    }

    const fd = new FormData()
    const blob = file as unknown as Blob
    const name = (file as unknown as File).name || 'upload'
    fd.append('file', blob, name)
    fd.append('pinataMetadata', JSON.stringify({ name }))
    fd.append('pinataOptions', JSON.stringify({ cidVersion: 1 }))

    const headers: Record<string, string> = {}
    if (jwt) headers['Authorization'] = `Bearer ${jwt.replace(/^Bearer\s+/i, '')}`
    if (!jwt && apiKey && secret) {
      headers['pinata_api_key'] = apiKey
      headers['pinata_secret_api_key'] = secret
    }

    const upstream = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers,
      body: fd
    })
    const ct = upstream.headers.get('content-type') || ''
    const body = ct.includes('application/json') ? await upstream.json() : { error: await upstream.text() }
    if (!upstream.ok) {
      const msg = body?.error || `pinata ${upstream.status}`
      return Response.json({ ok: false, status: upstream.status, error: msg }, { status: 500 })
    }
    const cid = body?.IpfsHash || body?.ipfsHash || body?.Hash
    return Response.json({ ok: true, cid, uri: `ipfs://${cid}` })
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : 'upload failed'
		return Response.json({ ok: false, error: msg }, { status: 500 })
	}
}


