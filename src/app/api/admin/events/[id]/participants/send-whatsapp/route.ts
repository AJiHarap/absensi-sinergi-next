import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(_req: NextRequest) {
  return NextResponse.json({ ok: false, message: 'Fitur WhatsApp telah dihapus.' }, { status: 410 })
}
