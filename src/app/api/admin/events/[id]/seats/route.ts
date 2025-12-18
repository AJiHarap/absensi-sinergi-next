import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function GET(_req: NextRequest, context: any) {
  const { params } = (context || {}) as { params: { id: string } }
  const eventId = params.id
  // List seats with optional assignment + participant info
  const { data, error } = await supabaseAdmin
    .from('seats')
    .select(`
      id,
      table_number,
      seat_number,
      assignment:seat_assignments(
        participant_id,
        participant:participants(full_name, participant_code)
      )
    `)
    .eq('event_id', eventId)
    .order('table_number', { ascending: true })
    .order('seat_number', { ascending: true })
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 400 })
  // Normalize nested seat_assignments (array) to a single object or null
  const normalized = (data || []).map((s: any) => ({
    ...s,
    assignment: Array.isArray(s.assignment) ? (s.assignment[0] ?? null) : (s.assignment ?? null),
  }))
  return NextResponse.json({ ok: true, data: normalized })
}

const GenerateSchema = z.object({
  mode: z.literal('generate'),
  tables: z.number().int().positive(),
  seatsPerTable: z.number().int().positive(),
})

const CreateSchema = z.object({
  mode: z.literal('create'),
  table_number: z.number().int().positive(),
  seat_number: z.number().int().positive(),
})

type Body = z.infer<typeof GenerateSchema> | z.infer<typeof CreateSchema>

export async function POST(req: NextRequest, context: any) {
  try {
    const { params } = (context || {}) as { params: { id: string } }
    const eventId = params.id
    const json = (await req.json()) as Body

    if ('mode' in json && json.mode === 'generate') {
      const seatsPayload = [] as { event_id: string; table_number: number; seat_number: number; status: string }[]
      for (let t = 1; t <= json.tables; t++) {
        for (let s = 1; s <= json.seatsPerTable; s++) {
          seatsPayload.push({ event_id: eventId, table_number: t, seat_number: s, status: 'available' })
        }
      }
      const { data, error } = await supabaseAdmin
        .from('seats')
        .upsert(seatsPayload, { onConflict: 'event_id,table_number,seat_number' })
        .select('id')
      if (error) throw error
      return NextResponse.json({ ok: true, data: { upserted: data?.length ?? seatsPayload.length } })
    }

    if ('mode' in json && json.mode === 'create') {
      const { data, error } = await supabaseAdmin
        .from('seats')
        .upsert(
          [{ event_id: eventId, table_number: json.table_number, seat_number: json.seat_number, status: 'available' }],
          { onConflict: 'event_id,table_number,seat_number' }
        )
        .select('id')
        .single()
      if (error) throw error
      return NextResponse.json({ ok: true, data })
    }

    return NextResponse.json({ ok: false, message: 'Bad request' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || 'Gagal membuat seats' }, { status: 400 })
  }
}
