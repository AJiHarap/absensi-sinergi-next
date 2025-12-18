import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/server'

const RowSchema = z.object({
  full_name: z.string().min(1),
  participant_code: z.string().min(1),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  table_number: z.number().nullable().optional(),
  seat_number: z.number().nullable().optional(),
})

const BodySchema = z.object({
  eventId: z.string().min(1),
  rows: z.array(RowSchema).min(1),
})

export async function POST(req: NextRequest) {
  try {
    const json = await req.json()
    const { eventId, rows } = BodySchema.parse(json)

    // 1) Upsert participants
    const participantsPayload = rows.map((r) => ({
      event_id: eventId,
      full_name: r.full_name,
      email: r.email ?? null,
      phone: r.phone ?? null,
      participant_code: r.participant_code,
    }))

    const { data: upsertedParticipants, error: partErr } = await supabaseAdmin
      .from('participants')
      .upsert(participantsPayload, { onConflict: 'event_id,participant_code' })
      .select('id, event_id, participant_code')
    if (partErr) throw partErr

    // map code->id
    const codeToId = new Map<string, string>()
    upsertedParticipants?.forEach((p) => codeToId.set(p.participant_code, p.id))

    // 2) If seat info provided, upsert seats and assignments
    const seatRows = rows.filter((r) => r.table_number != null && r.seat_number != null)
    let upsertedSeats = 0
    let upsertedAssignments = 0

    if (seatRows.length > 0) {
      const seatsPayload = seatRows.map((r) => ({
        event_id: eventId,
        table_number: r.table_number!,
        seat_number: r.seat_number!,
        status: 'available',
      }))

      const { data: seats, error: seatErr } = await supabaseAdmin
        .from('seats')
        .upsert(seatsPayload, { onConflict: 'event_id,table_number,seat_number' })
        .select('id, table_number, seat_number')
      if (seatErr) throw seatErr
      upsertedSeats = seats?.length ?? 0

      // build seat key map
      const seatKey = (t: number, s: number) => `${t}-${s}`
      const seatMap = new Map<string, string>()
      seats?.forEach((s) => seatMap.set(seatKey(s.table_number, s.seat_number), s.id))

      const assignmentsPayload = seatRows.map((r) => ({
        event_id: eventId,
        participant_id: codeToId.get(r.participant_code)!,
        seat_id: seatMap.get(seatKey(r.table_number!, r.seat_number!))!,
      }))

      const { data: assigns, error: assignErr } = await supabaseAdmin
        .from('seat_assignments')
        .upsert(assignmentsPayload, { onConflict: 'event_id,participant_id' })
        .select('id')
      if (assignErr) throw assignErr
      upsertedAssignments = assigns?.length ?? 0
    }

    return NextResponse.json({
      ok: true,
      data: {
        inserted_participants: upsertedParticipants?.length ?? participantsPayload.length,
        upserted_seats: upsertedSeats,
        upserted_assignments: upsertedAssignments,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || 'Import gagal' }, { status: 400 })
  }
}
