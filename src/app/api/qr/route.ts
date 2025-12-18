import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'

// GET /api/qr?text=EVENTID:CODE
// Returns image/png of the QR code. Useful to share in WhatsApp as a link.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const text = (searchParams.get('text') || '').trim()
    if (!text) return new NextResponse('Missing text', { status: 400 })

    const png = await QRCode.toBuffer(text, { margin: 1, scale: 8 })
    return new NextResponse(png, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || 'Failed to generate QR' }, { status: 400 })
  }
}
