import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/server'

const BodySchema = z.object({
  eventId: z.string().min(1).optional(),
  participantCode: z.string().min(1),
})

export async function POST(req: NextRequest) {
  try {
    const json = await req.json()
    const body = BodySchema.parse(json)

    // Resolve eventId and participant by participantCode when eventId is not provided
    let resolvedEventId: string | null = body.eventId ?? null
    let participant: { id: string; full_name: string; metadata?: any } | null = null

    if (resolvedEventId) {
      // Validate event exists and is active
      const { data: eventData, error: eventErr } = await supabaseAdmin
        .from('events')
        .select('id, is_active')
        .eq('id', resolvedEventId)
        .maybeSingle()
      if (eventErr) throw eventErr
      if (!eventData) return NextResponse.json({ ok: false, message: 'Event tidak ditemukan' }, { status: 404 })
      if (eventData.is_active === false) return NextResponse.json({ ok: false, message: 'Event tidak aktif' }, { status: 400 })

      const { data: part, error: partErr } = await supabaseAdmin
        .from('participants')
        .select('id, full_name, metadata')
        .eq('event_id', resolvedEventId)
        .eq('participant_code', body.participantCode)
        .maybeSingle()
      if (partErr) throw partErr
      if (!part) return NextResponse.json({ ok: false, message: 'Peserta tidak ditemukan' }, { status: 404 })
      participant = part
    } else {
      // No eventId provided: find active event by unique participant_code
      const { data: candidates, error: candErr } = await supabaseAdmin
        .from('participants')
        .select('id, full_name, event_id, metadata')
        .eq('participant_code', body.participantCode)
      if (candErr) throw candErr
      if (!candidates || candidates.length === 0) {
        return NextResponse.json({ ok: false, message: 'Peserta tidak ditemukan' }, { status: 404 })
      }

      // Filter by active events
      const eventIds = Array.from(new Set(candidates.map((c) => c.event_id)))
      const { data: events, error: evErr } = await supabaseAdmin
        .from('events')
        .select('id, is_active')
        .in('id', eventIds)
      if (evErr) throw evErr
      const activeIds = new Set((events || []).filter((e) => e.is_active).map((e) => e.id))
      const activeCandidates = candidates.filter((c) => activeIds.has(c.event_id))

      if (activeCandidates.length === 0) {
        return NextResponse.json({ ok: false, message: 'Tidak ada event aktif untuk peserta ini' }, { status: 404 })
      }
      if (activeCandidates.length > 1) {
        return NextResponse.json({ ok: false, message: 'Kode peserta ditemukan di beberapa event aktif. Gunakan QR dengan format eventId:participantCode.' }, { status: 400 })
      }

      const chosen = activeCandidates[0]
      resolvedEventId = chosen.event_id
      participant = { id: chosen.id, full_name: chosen.full_name, metadata: (chosen as any).metadata }
    }

    // 3) Get seat assignment (join)
    const { data: seatAssign, error: seatErr } = await supabaseAdmin
      .from('seat_assignments')
      .select('seat:seat_id(table_number, seat_number)')
      .eq('event_id', resolvedEventId!)
      .eq('participant_id', participant!.id)
      .maybeSingle()
    if (seatErr) throw seatErr

    const seatInfo = (() => {
      const seat = (seatAssign as any)?.seat
      if (Array.isArray(seat)) return seat[0] ?? null
      return seat ?? null
    })()

    // 4) Insert attendance log (allow multiple)
    const { error: insertErr } = await supabaseAdmin
      .from('attendance_logs')
      .insert({ event_id: resolvedEventId!, participant_id: participant!.id })
    if (insertErr) throw insertErr

    // 5) Count total scans for display
    const { data: countData, error: countErr } = await supabaseAdmin
      .from('attendance_logs')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', resolvedEventId!)
      .eq('participant_id', participant!.id)
    if (countErr) throw countErr

    return NextResponse.json({
      ok: true,
      data: {
        participant_name: participant!.full_name,
        event_id: resolvedEventId!,
        table_number: seatInfo?.table_number ?? null,
        seat_number: seatInfo?.seat_number ?? null,
        total_scans: countData?.length ?? undefined,
        jabatan: (participant as any)?.metadata?.jabatan ?? null,
        divisi: (participant as any)?.metadata?.divisi ?? null,
      },
    })
  } catch (e: any) {
    const message = e?.message || 'Terjadi kesalahan.'
    return NextResponse.json({ ok: false, message }, { status: 400 })
  }
}
