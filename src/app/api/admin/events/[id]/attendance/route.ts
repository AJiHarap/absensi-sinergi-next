import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/server'

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

const QuerySchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100000).default(20),
  sort: z.enum(['time.desc', 'time.asc']).default('time.desc'),
  export: z.enum(['csv', 'excel']).optional(),
  noSeat: z.enum(['true', 'false']).optional(),
  from: z.string().optional(), // ISO date (YYYY-MM-DD) or ISO datetime
  to: z.string().optional(),   // ISO date (YYYY-MM-DD) or ISO datetime
})

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const eventId = params.id
    const { searchParams } = new URL(req.url)
    const parsed = QuerySchema.safeParse(Object.fromEntries(searchParams))
    if (!parsed.success) return NextResponse.json({ ok: false, message: 'Bad query' }, { status: 400 })
    const { q, page, pageSize, sort, export: exportType, noSeat, from, to } = parsed.data

    // Base query: attendance logs for event with participant data
    let query = supabaseAdmin
      .from('attendance_logs')
      .select(
        `id, scanned_at, participant:participant_id(full_name, participant_code), participant_id`,
        { count: 'exact' }
      )
      .eq('event_id', eventId)

    // Search by participant name/code
    if (q && q.trim()) {
      // supabase: ilike on nested needs filtering after fetch; to keep efficient, fetch participant ids first
      const { data: partIds, error: partErr } = await supabaseAdmin
        .from('participants')
        .select('id')
        .eq('event_id', eventId)
        .or(`full_name.ilike.%${q}%,participant_code.ilike.%${q}%`)
      if (partErr) throw partErr
      const ids = (partIds || []).map((p) => p.id)
      if (ids.length === 0) return NextResponse.json({ ok: true, data: [], total: 0 })
      query = query.in('participant_id', ids)
    }

    // Custom date range filter (from/to)
    if (from) {
      // If only date is provided (YYYY-MM-DD), convert to start of day UTC
      const fromDate = from.length === 10 ? new Date(from + 'T00:00:00.000Z') : new Date(from)
      if (!isNaN(fromDate.getTime())) query = query.gte('scanned_at', fromDate.toISOString())
    }
    if (to) {
      // If only date is provided, include the entire day by adding 1 day and using lt next day start
      if (to.length === 10) {
        const toDate = new Date(to + 'T00:00:00.000Z')
        const nextDay = new Date(toDate.getTime() + 24 * 60 * 60 * 1000)
        query = query.lt('scanned_at', nextDay.toISOString())
      } else {
        const toDate = new Date(to)
        if (!isNaN(toDate.getTime())) query = query.lte('scanned_at', toDate.toISOString())
      }
    }

    // Sorting
    const ascending = sort === 'time.asc'
    query = query.order('scanned_at', { ascending })

    // Pagination (skip when exporting)
    if (!exportType) {
      const offsetFrom = (page - 1) * pageSize
      const offsetTo = offsetFrom + pageSize - 1
      query = query.range(offsetFrom, offsetTo)
    }

    const { data, error, count } = await query
    if (error) throw error

    // Get current seat assignment for listed participants
    const pids = Array.from(new Set((data || []).map((r: any) => r.participant_id as string)))
    let seatMap = new Map<string, { table_number: number | null; seat_number: number | null }>()
    let firstScanMap = new Map<string, string>() // participant_id -> earliest scanned_at
    if (pids.length > 0) {
      const { data: assigns, error: aerr } = await supabaseAdmin
        .from('seat_assignments')
        .select('participant_id, seat:seat_id(table_number, seat_number)')
        .eq('event_id', eventId)
        .in('participant_id', pids)
      if (aerr) throw aerr
      for (const a of assigns || []) {
        seatMap.set((a as any).participant_id as string, {
          table_number: (a as any).seat?.table_number ?? null,
          seat_number: (a as any).seat?.seat_number ?? null,
        })
      }

      // earliest scan per participant (whole event) without GROUP (not supported in client)
      const { data: allLogs, error: allErr } = await supabaseAdmin
        .from('attendance_logs')
        .select('participant_id, scanned_at')
        .eq('event_id', eventId)
        .in('participant_id', pids)
        .order('scanned_at', { ascending: true })
      if (allErr) throw allErr
      for (const row of allLogs || []) {
        const pid = (row as any).participant_id as string
        const ts = (row as any).scanned_at as string
        if (!firstScanMap.has(pid)) firstScanMap.set(pid, ts)
      }
    }

    let rows = (data || []).map((r: any) => ({
      scanned_at: r.scanned_at as string,
      participant_name: r.participant?.full_name || '-',
      participant_code: r.participant?.participant_code || '-',
      table_number: seatMap.get(r.participant_id)?.table_number ?? null,
      seat_number: seatMap.get(r.participant_id)?.seat_number ?? null,
      is_first: firstScanMap.get(r.participant_id || '') === r.scanned_at,
    }))

    // Optional filter: only participants without seat
    if (noSeat === 'true') {
      rows = rows.filter((r) => r.table_number === null && r.seat_number === null)
    }

    const uniqueCount = new Set(rows.map((r) => r.participant_code)).size
    const totalCount = rows.length

    if (exportType === 'csv') {
      const header = 'scanned_at,participant_name,participant_code,table_number,seat_number,is_first\n'
      const csv = header + rows.map(r => [
        r.scanned_at,
        JSON.stringify(r.participant_name),
        JSON.stringify(r.participant_code),
        r.table_number ?? '',
        r.seat_number ?? '',
        r.is_first ? '1' : '0',
      ].join(',')).join('\n')
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="attendance_${eventId}.csv"`,
        },
      })
    } else if (exportType === 'excel') {
      const tableRows = rows.map(r => `
        <tr>
          <td>${escapeHtml(new Date(r.scanned_at).toLocaleString())}</td>
          <td>${escapeHtml(r.participant_name)}</td>
          <td>${escapeHtml(r.participant_code)}</td>
          <td>${r.table_number ?? ''}</td>
          <td>${r.seat_number ?? ''}</td>
          <td>${r.is_first ? 'Pertama' : 'Ulang'}</td>
        </tr>`).join('')
      const html = `<!doctype html><html><head><meta charset="utf-8"></head><body><table border="1"><thead><tr><th>scanned_at</th><th>participant_name</th><th>participant_code</th><th>table_number</th><th>seat_number</th><th>status</th></tr></thead><tbody>${tableRows}</tbody></table></body></html>`
      return new NextResponse(html, {
        headers: {
          'Content-Type': 'application/vnd.ms-excel; charset=utf-8',
          'Content-Disposition': `attachment; filename="attendance_${eventId}.xls"`,
        },
      })
    }

    return NextResponse.json({ ok: true, data: rows, total: count ?? rows.length, total_scans: totalCount, unique_scans: uniqueCount })
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || 'Gagal mengambil attendance' }, { status: 400 })
  }
}
