import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import sharp from 'sharp'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// GET /api/qr/labeled?text=EVENTID:CODE&name=Full%20Name
// Returns PNG QR with a white label under the code containing the participant name.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const text = (searchParams.get('text') || '').trim()
    const name = (searchParams.get('name') || '').trim()
    if (!text) return new NextResponse('Missing text', { status: 400 })

    const qrBase = await QRCode.toBuffer(text, { margin: 1, scale: 8 })
    const meta = await sharp(qrBase).metadata()
    const qW = meta.width || 240
    const qH = meta.height || 240
    const pad = 16
    const labelH = 28
    const svgLabel = Buffer.from(
      `<svg width="${qW}" height="${labelH}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#ffffff"/>
        <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14" font-weight="600" fill="#111827">${escapeHtml(name)}</text>
      </svg>`
    )
    const labeled = await sharp({
      create: { width: qW + pad * 2, height: qH + pad * 2 + labelH, channels: 3, background: '#ffffff' }
    })
      .composite([
        { input: qrBase, left: pad, top: pad },
        { input: svgLabel, left: pad, top: pad + qH },
      ])
      .png()
      .toBuffer()

    return new NextResponse(labeled, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || 'Failed to render labeled QR' }, { status: 400 })
  }
}

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
