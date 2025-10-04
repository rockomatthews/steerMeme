import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    console.warn('[launch-log]', JSON.stringify(body))
    return Response.json({ ok: true })
  } catch (e) {
    return Response.json({ ok: false }, { status: 400 })
  }
}


