import { NextRequest } from 'next/server'
import { Web3Storage } from 'web3.storage'

export async function POST(req: NextRequest) {
	try {
		const form = await req.formData()
		const file = form.get('file') as unknown as File | null
		if (!file) return new Response('no file', { status: 400 })
		const token = process.env.WEB3_STORAGE_TOKEN
		if (!token) return new Response('missing server token', { status: 500 })
		const client = new Web3Storage({ token })
		const cid = await client.put([file], { wrapWithDirectory: false })
		return Response.json({ cid, uri: `ipfs://${cid}` })
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : 'upload failed'
		return new Response(msg, { status: 500 })
	}
}


