import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/server'

const AssignSchema = z.object({
  participantCode: z.string().min(1),
  table_number: z.number().int().positive(),
  seat_number: z.number().int().positive(),
})

const UnassignSchema = z.object({
  table_number: z.number().int().positive(),
  seat_number: z.number().int().positive(),
})

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const eventId = params.id
    const body = AssignSchema.parse(await req.json())

    // Find participant
    const { data: participant, error: partErr } = await supabaseAdmin
      .from('participants')
      .select('id')
      .eq('event_id', eventId)
      .eq('participant_code', body.participantCode)
      .maybeSingle()
    if (partErr) throw partErr
    if (!participant) return NextResponse.json({ ok: false, message: 'Peserta tidak ditemukan' }, { status: 404 })

    // Ensure seat exists (create if needed) and get seat id
    const { data: seat, error: seatErr } = await supabaseAdmin
      .from('seats')
      .upsert(
        [{ event_id: eventId, table_number: body.table_number, seat_number: body.seat_number, status: 'available' }],
        { onConflict: 'event_id,table_number,seat_number' }
      )
      .select('id')
      .single()
    if (seatErr) throw seatErr

    // Remove any existing assignment for this seat (reassigning seat)
    const { error: delSeatErr } = await supabaseAdmin
      .from('seat_assignments')
      .delete()
      .eq('event_id', eventId)
      .eq('seat_id', seat.id)
    if (delSeatErr) throw delSeatErr

    // Remove any existing assignment for this participant in this event
    const { error: delPartErr } = await supabaseAdmin
      .from('seat_assignments')
      .delete()
      .eq('event_id', eventId)
      .eq('participant_id', participant.id)
    if (delPartErr) throw delPartErr

    // Insert new assignment
    const { error: assignErr } = await supabaseAdmin
      .from('seat_assignments')
      .insert([{ event_id: eventId, participant_id: participant.id, seat_id: seat.id }])
    if (assignErr) throw assignErr

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || 'Gagal assign kursi' }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const eventId = params.id
    const body = UnassignSchema.parse(await req.json())

    // Find seat id
    const { data: seat, error: seatErr } = await supabaseAdmin
      .from('seats')
      .select('id')
      .eq('event_id', eventId)
      .eq('table_number', body.table_number)
      .eq('seat_number', body.seat_number)
      .maybeSingle()
    if (seatErr) throw seatErr
    if (!seat) return NextResponse.json({ ok: true })

    const { error } = await supabaseAdmin
      .from('seat_assignments')
      .delete()
      .eq('event_id', eventId)
      .eq('seat_id', seat.id)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || 'Gagal unassign kursi' }, { status: 400 })
  }
}
