import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import QRCode from 'qrcode'
import sharp from 'sharp'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, context: any) {
  try {
    const { params } = (context || {}) as { params: { id: string; pid: string } }
    const eventId = params.id
    const participantId = params.pid

    // Fetch participant
    const { data: p, error } = await supabaseAdmin
      .from('participants')
      .select('id, full_name, participant_code')
      .eq('event_id', eventId)
      .eq('id', participantId)
      .maybeSingle()
    if (error) throw error
    if (!p) return NextResponse.json({ ok: false, message: 'Peserta tidak ditemukan' }, { status: 404 })

    const name = (p as any).full_name as string
    const code = (p as any).participant_code as string

    // Generate QR content and compose labeled PNG identical to email version
    const qrText = `${eventId}:${code}`
    const qrBase = await QRCode.toBuffer(qrText, { margin: 1, scale: 8 })
    const meta = await sharp(qrBase).metadata()
    const qW = meta.width || 240
    const qH = meta.height || 240

    const pad = 16
    const nameLen = (name || '').length
    const fontSize = nameLen > 34 ? 14 : nameLen > 22 ? 16 : 20
    const labelH = Math.max(40, Math.round(fontSize * 2.2))
    const svgLabel = Buffer.from(
      `<svg width="${qW}" height="${labelH}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#ffffff"/>
        <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial, Helvetica, Liberation Sans, DejaVu Sans, sans-serif" font-size="${fontSize}" font-weight="600" fill="#111827" text-rendering="optimizeLegibility">${escapeHtml(name)}</text>
      </svg>`
    )

    const labeledPng = await sharp({
      create: { width: qW + pad * 2, height: qH + pad * 2 + labelH, channels: 3, background: '#ffffff' }
    })
      .composite([
        { input: qrBase, left: pad, top: pad },
        { input: svgLabel, left: pad, top: pad + qH },
      ])
      .png()
      .toBuffer()

    const filename = `${safeFile(name)} (${safeFile(code)}).png`
    return new NextResponse(labeledPng as any, {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || 'Gagal membuat QR' }, { status: 400 })
  }
}

function safeFile(s: string) {
  return (s || '').replace(/[^a-zA-Z0-9-_.\s]/g, '').replace(/\s+/g, ' ').trim()
}

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
