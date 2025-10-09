import { promises as fs } from 'fs'
import path from 'path'

function isAddress(s: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(s)
}

async function tryRead(filePath: string): Promise<string | null> {
  try {
    const b = await fs.readFile(filePath, 'utf8')
    return b
  } catch {
    return null
  }
}

export async function GET(_req: Request, { params }: { params: { address: string } }) {
  const addressRaw = params?.address || ''
  if (!isAddress(addressRaw)) {
    return new Response(JSON.stringify({ ok: false, error: 'invalid address' }), {
      status: 400,
      headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' }
    })
  }

  const pubDir = path.resolve(process.cwd(), 'public')
  const candidates = [
    path.join(pubDir, 'token', `${addressRaw}.json`),
    path.join(pubDir, 'token', `${addressRaw.toLowerCase()}.json`),
    path.join(pubDir, 'token', `${addressRaw.toUpperCase()}.json`)
  ]

  let body: string | null = null
  for (const p of candidates) {
    body = await tryRead(p)
    if (body) break
  }
  // Fallback to generic metadata if per-address file not found
  if (!body) {
    body = await tryRead(path.join(pubDir, 'token-metadata.json'))
  }

  if (!body) {
    return new Response(JSON.stringify({ ok: false, error: 'metadata not found' }), {
      status: 404,
      headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' }
    })
  }

  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // Cache for 5 minutes at the edge; allow long SWR for crawlers
      'cache-control': 'public, s-maxage=300, stale-while-revalidate=86400',
      'access-control-allow-origin': '*'
    }
  })
}


