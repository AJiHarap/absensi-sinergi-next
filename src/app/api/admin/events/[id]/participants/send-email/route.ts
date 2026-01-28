import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/mailer'
import QRCode from 'qrcode'
import sharp from 'sharp'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/*
POST /api/admin/events/[id]/participants/send-email
Body JSON: { participantIds?: string[] }
- If participantIds provided -> send to those
- Else -> send to all participants in the event having a non-empty email
Sends each participant an email with their QR (PNG attachment) and instructions.
This is a simple sequential sender; for many recipients you can extend to batching/queue later.
*/
export async function POST(req: NextRequest, context: any) {
  try {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
      throw new Error('GMAIL_USER/GMAIL_PASS belum dikonfigurasi di .env')
    }
    const { params } = (context || {}) as { params: { id: string } }
    const eventId = params.id
    const body = await req.json().catch(() => ({})) as { participantIds?: string[] }

    // fetch event name
    const { data: evt, error: evtErr } = await supabaseAdmin
      .from('events')
      .select('id, name')
      .eq('id', eventId)
      .single()
    if (evtErr) throw evtErr
    const eventName = (evt as any)?.name || 'Event'

    // fetch participants
    let query = supabaseAdmin
      .from('participants')
      .select('id, full_name, email, participant_code')
      .eq('event_id', eventId)
    if (Array.isArray(body.participantIds) && body.participantIds.length) {
      query = query.in('id', body.participantIds)
    }
    const { data: participants, error: pErr } = await query
    if (pErr) throw pErr

    const site = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    let success = 0
    const errors: { id: string; message: string }[] = []

    for (const p of participants || []) {
      const email = (p as any).email as string | null
      const name = (p as any).full_name as string
      const code = (p as any).participant_code as string
      const id = (p as any).id as string
      if (!email) { errors.push({ id, message: 'No email' }); continue }

      const qrText = `${eventId}:${code}`
      const qrBase = await QRCode.toBuffer(qrText, { margin: 1, scale: 8 })
      // Compose labeled QR (white background padding + name label under QR)
      const meta = await sharp(qrBase).metadata()
      const qW = meta.width || 240
      const qH = meta.height || 240
      const pad = 16
      // Larger label area to ensure visibility across email clients
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

      const subject = `[${eventName}] QR Kehadiran Peserta`
      const year = new Date().getFullYear()
      const html = emailTemplate({ name, eventName, code, year })
      try {
        await sendEmail({
          to: email,
          subject,
          html,
          attachments: [
            // Inline image for display in email body
            { filename: `${safeFile(name)} (${safeFile(code)}).png`, content: labeledPng, contentType: 'image/png', cid: 'qrinline', contentDisposition: 'inline' },
            // Separate attachment for easy download
            { filename: `${safeFile(name)} (${safeFile(code)}).png`, content: labeledPng, contentType: 'image/png', contentDisposition: 'attachment' },
          ],
        })
        success++
      } catch (e: any) {
        errors.push({ id, message: e?.message || 'send error' })
      }
    }

    return NextResponse.json({ ok: true, data: { success, failed: errors.length, errors } })
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || 'Gagal mengirim email' }, { status: 400 })
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

function emailTemplate({ name, eventName, code, year }: { name: string; eventName: string; code: string; year: number }) {
  const brand = 'Absensi Sinergi'
  const hName = escapeHtml(name)
  const hEvent = escapeHtml(eventName)
  const hCode = escapeHtml(code)
  const hQrCid = 'cid:qrinline'
  return `<!doctype html>
  <html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <title>${brand} - QR Kehadiran</title>
  </head>
  <body style="margin:0;padding:24px;background:#f3f4f6;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,sans-serif;color:#111827;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
      <tr>
        <td style="background:#0f172a;color:#fff;padding:16px 20px;font-weight:600;">
          ${brand}
          <div style="font-weight:400;color:#cbd5e1;font-size:12px;">QR Kehadiran Peserta</div>
        </td>
      </tr>
      <tr>
        <td style="padding:24px 24px 8px 24px;">
          <p style="margin:0 0 8px 0;">Halo, <b>${hName}</b>,</p>
          <p style="margin:0 0 16px 0;">Berikut adalah QR untuk kehadiran Anda pada event <b>${hEvent}</b>.</p>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 24px 8px 24px;text-align:center;">
          <div style="display:inline-block;border:1px solid #e5e7eb;border-radius:8px;padding:12px;background:#fff;">
            <img src="${hQrCid}" alt="QR Kehadiran - ${hName}" width="260" style="display:block;border-radius:4px;" />
            <div style="font-size:13px;color:#111827;margin-top:8px;font-weight:600;">${hName}</div>
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 24px;">
          <div style="font-size:12px;color:#6b7280;margin-bottom:6px;">Kode Kehadiran</div>
          <div style="display:inline-block;background:#0f172a;color:#fff;padding:6px 10px;border-radius:8px;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono','Courier New',monospace;">${hCode}</div>
          
        </td>
      </tr>
      <tr>
        <td style="padding:8px 24px 24px 24px;">
          <div style="font-weight:600;margin:8px 0 6px 0;">Panduan:</div>
          <ul style="margin:0;padding-left:18px;color:#374151;font-size:14px;">
            <li>Simpan email ini, atau screenshot gambar QR.</li>
            <li>Tunjukkan QR ini ke petugas pada saat registrasi/kehadiran.</li>
            <li>Jika QR sulit dipindai, gunakan kode kehadiran di atas.</li>
          </ul>
          <p style="margin:16px 0 0 0;font-size:12px;color:#6b7280;">Gambar QR juga terlampir sebagai file PNG pada email ini.</p>
        </td>
      </tr>
      <tr>
        <td style="background:#f8fafc;color:#6b7280;padding:16px 20px;text-align:center;font-size:12px;">
          © ${year} ${brand}
        </td>
      </tr>
    </table>
  </body>
  </html>`
}
