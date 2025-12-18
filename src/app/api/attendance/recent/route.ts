import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function GET(_req: NextRequest) {
  try {
    // Get latest attendance logs (limit 20)
    const { data: logs, error } = await supabaseAdmin
      .from('attendance_logs')
      .select('event_id, participant_id, scanned_at, participant:participant_id(full_name, participant_code)')
      .order('scanned_at', { ascending: false })
      .limit(20)
    if (error) throw error

    const items = logs || []
    // Group participant IDs by event for efficient lookup
    const eventPidMap = new Map<string, Set<string>>()
    for (const r of items) {
      const evt = (r as any).event_id as string
      const pid = (r as any).participant_id as string
      if (!eventPidMap.has(evt)) eventPidMap.set(evt, new Set<string>())
      eventPidMap.get(evt)!.add(pid)
    }

    const result: Array<{ participant_name: string; participant_code: string; event_id: string; table_number: number | null; seat_number: number | null; scanned_at: string }>
      = []

    // For each event, fetch current seat assignment and seats metadata
    for (const [evt, pidSet] of eventPidMap.entries()) {
      const pids = Array.from(pidSet)
      if (pids.length === 0) continue

      const { data: assigns, error: assignErr } = await supabaseAdmin
        .from('seat_assignments')
        .select('participant_id, seat_id')
        .eq('event_id', evt)
        .in('participant_id', pids)
      if (assignErr) throw assignErr

      const seatIds = Array.from(new Set((assigns || []).map((a: any) => a.seat_id as string)))
      let seatMap = new Map<string, { table_number: number; seat_number: number }>()
      if (seatIds.length > 0) {
        const { data: seatRows, error: seatErr } = await supabaseAdmin
          .from('seats')
          .select('id, table_number, seat_number')
          .in('id', seatIds)
        if (seatErr) throw seatErr
        seatMap = new Map(seatRows!.map((s: any) => [s.id as string, { table_number: s.table_number as number, seat_number: s.seat_number as number }]))
      }

      // Build map participant -> seat info
      const partSeat = new Map<string, { table_number: number | null; seat_number: number | null }>()
      for (const a of assigns || []) {
        const pid = (a as any).participant_id as string
        const seat = seatMap.get((a as any).seat_id as string)
        partSeat.set(pid, seat ? { table_number: seat.table_number, seat_number: seat.seat_number } : { table_number: null, seat_number: null })
      }

      for (const r of items.filter((x) => (x as any).event_id === evt)) {
        const pid = (r as any).participant_id as string
        const seat = partSeat.get(pid) || { table_number: null, seat_number: null }
        result.push({
          participant_name: (r as any).participant?.full_name || '-',
          participant_code: (r as any).participant?.participant_code || '-',
          event_id: evt,
          table_number: seat.table_number,
          seat_number: seat.seat_number,
          scanned_at: (r as any).scanned_at,
        })
      }
    }

    // Keep descending order by time
    result.sort((a, b) => (a.scanned_at < b.scanned_at ? 1 : -1))
    return NextResponse.json({ ok: true, data: result })
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || 'Gagal mengambil riwayat kehadiran' }, { status: 400 })
  }
}
