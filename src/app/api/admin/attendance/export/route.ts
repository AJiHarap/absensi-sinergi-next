import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

function toCsvRow(fields: (string | number | null | undefined)[]) {
  return fields
    .map((v) => {
      if (v === null || v === undefined) return ''
      const s = String(v)
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return '"' + s.replace(/"/g, '""') + '"'
      }
      return s
    })
    .join(',')
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const eventId = searchParams.get('eventId')
  if (!eventId) {
    return new Response('eventId is required', { status: 400 })
  }

  // 1) Fetch attendance logs with participant basic info
  const { data: logs, error: logErr } = await supabaseAdmin
    .from('attendance_logs')
    .select('id, scanned_at, participant:participant_id(id, full_name, participant_code)')
    .eq('event_id', eventId)
    .order('scanned_at', { ascending: true })
  if (logErr) {
    return new Response(`Error: ${logErr.message}`, { status: 400 })
  }

  // 2) Fetch seat assignments for this event (map by participant_id)
  const { data: assigns, error: assignErr } = await supabaseAdmin
    .from('seat_assignments')
    .select('participant_id, seat:seat_id(table_number, seat_number)')
    .eq('event_id', eventId)
  if (assignErr) {
    return new Response(`Error: ${assignErr.message}`, { status: 400 })
  }
  const seatMap = new Map<string, { table_number: number | null; seat_number: number | null }>()
  assigns?.forEach((a: any) => {
    seatMap.set(a.participant_id, {
      table_number: a.seat?.table_number ?? null,
      seat_number: a.seat?.seat_number ?? null,
    })
  })

  // 3) Build CSV
  const header = [
    'attendance_id',
    'scanned_at',
    'participant_id',
    'participant_name',
    'participant_code',
    'table_number',
    'seat_number',
  ]
  const rows: string[] = []
  rows.push(toCsvRow(header))
  for (const log of logs ?? []) {
    const p = (log as any).participant
    const seat = seatMap.get(p?.id) || { table_number: null, seat_number: null }
    rows.push(
      toCsvRow([
        (log as any).id,
        (log as any).scanned_at,
        p?.id ?? '',
        p?.full_name ?? '',
        p?.participant_code ?? '',
        seat.table_number,
        seat.seat_number,
      ])
    )
  }

  const csv = rows.join('\n')
  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="attendance_${eventId}.csv"`,
    },
  })
}
