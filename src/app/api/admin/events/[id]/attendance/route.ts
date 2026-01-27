import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

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

export async function GET(req: NextRequest, context: any) {
  try {
    const { params } = (context || {}) as { params: { id: string } }
    const eventId = params.id
    const { searchParams } = new URL(req.url)
    const parsed = QuerySchema.safeParse(Object.fromEntries(searchParams))
    if (!parsed.success) return NextResponse.json({ ok: false, message: 'Bad query' }, { status: 400 })
    const { q, page, pageSize, sort, export: exportType, noSeat, from, to } = parsed.data

    // Base query: attendance logs for event with participant data
    let query = supabaseAdmin
      .from('attendance_logs')
      .select(
        `id, scanned_at, participant:participant_id(full_name, participant_code, email, phone, metadata), participant_id`,
        { count: 'exact' }
      )
      .eq('event_id', eventId)

    // Search by participant name/code (skip if q indicates order filter)
    if (q && q.trim()) {
      const ql = q.trim().toLowerCase()
      const orderWords: Record<string, number> = { 'pertama': 1, 'kedua': 2, 'ketiga': 3, 'keempat': 4, 'kelima': 5, 'keenam': 6, 'ketujuh': 7, 'kedelapan': 8, 'kesembilan': 9, 'kesepuluh': 10 }
      let isOrderFilter = false
      if (ql.startsWith('order:')) {
        const n = Number(ql.split(':')[1] || '')
        if (!isNaN(n) && n > 0) isOrderFilter = true
      } else if (orderWords[ql]) {
        isOrderFilter = true
      }
      if (!isOrderFilter) {
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
    let orderIndexMap = new Map<string, string[]>() // participant_id -> array of scanned_at asc
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
        const arr = orderIndexMap.get(pid) || []
        arr.push(ts)
        orderIndexMap.set(pid, arr)
      }
    }

    let rows = (data || []).map((r: any) => {
      const pid = r.participant_id as string
      const scans = orderIndexMap.get(pid) || []
      const idx = Math.max(0, scans.indexOf(r.scanned_at as string)) + 1
      return {
      scanned_at: r.scanned_at as string,
      participant_name: r.participant?.full_name || '-',
      participant_code: r.participant?.participant_code || '-',
      table_number: seatMap.get(r.participant_id)?.table_number ?? null,
      seat_number: seatMap.get(r.participant_id)?.seat_number ?? null,
      is_first: firstScanMap.get(r.participant_id || '') === r.scanned_at,
      order_index: idx,
      email: r.participant?.email || '',
      phone: r.participant?.phone || '',
      gender: (r.participant?.metadata as any)?.gender || '',
      jabatan: (r.participant?.metadata as any)?.jabatan || '',
      divisi: (r.participant?.metadata as any)?.divisi || '',
      asal: (r.participant?.metadata as any)?.asal || '',
    }
    })

    // Optional filter: only participants without seat
    if (noSeat === 'true') {
      rows = rows.filter((r) => r.table_number === null && r.seat_number === null)
    }

    // Search by order keywords if q matches e.g., 'pertama', 'kedua', 'ketiga', or 'order:2'
    if (q && q.trim()) {
      const ql = q.trim().toLowerCase()
      const orderWords: Record<string, number> = { 'pertama': 1, 'kedua': 2, 'ketiga': 3, 'keempat': 4, 'kelima': 5, 'keenam': 6, 'ketujuh': 7, 'kedelapan': 8, 'kesembilan': 9, 'kesepuluh': 10 }
      let wanted: number | null = null
      if (ql.startsWith('order:')) {
        const n = Number(ql.split(':')[1] || '')
        if (!isNaN(n) && n > 0) wanted = n
      } else if (orderWords[ql]) {
        wanted = orderWords[ql]
      }
      if (wanted) {
        rows = rows.filter(r => r.order_index === wanted)
      }
    }

    const uniqueCount = new Set(rows.map((r) => r.participant_code)).size
    const totalCount = rows.length

    if (exportType === 'csv') {
      const header = 'scanned_at,participant_name,participant_code,table_number,seat_number,order_index,status,email,phone,gender,jabatan,divisi,asal\n'
      const csv = header + rows.map(r => [
        r.scanned_at,
        JSON.stringify(r.participant_name),
        JSON.stringify(r.participant_code),
        r.table_number ?? '',
        r.seat_number ?? '',
        r.order_index,
        JSON.stringify(r.order_index === 1 ? 'Pertama' : `Ke-${r.order_index}`),
        JSON.stringify(r.email || ''),
        JSON.stringify(r.phone || ''),
        JSON.stringify(r.gender || ''),
        JSON.stringify(r.jabatan || ''),
        JSON.stringify(r.divisi || ''),
        JSON.stringify(r.asal || ''),
      ].join(',')).join('\n')
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="attendance_${eventId}.csv"`,
        },
      })
    } else if (exportType === 'excel') {
      const header = ['scanned_at','participant_name','participant_code','table_number','seat_number','order_index','status','email','phone','gender','jabatan','divisi','asal']
      const aoa: any[][] = [header]
      for (const r of rows) {
        aoa.push([
          new Date(r.scanned_at).toLocaleString(),
          r.participant_name,
          r.participant_code,
          r.table_number ?? '',
          r.seat_number ?? '',
          r.order_index,
          r.order_index === 1 ? 'Pertama' : `Ke-${r.order_index}`,
          r.email || '',
          r.phone || '',
          r.gender || '',
          r.jabatan || '',
          r.divisi || '',
          r.asal || '',
        ])
      }
      const ws = XLSX.utils.aoa_to_sheet(aoa)
      ;(ws as any)['!cols'] = [
        { wch: 22 }, { wch: 28 }, { wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 26 }, { wch: 16 }, { wch: 10 }, { wch: 16 }, { wch: 16 }, { wch: 16 }
      ]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Attendance')
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
      return new NextResponse(buf as any, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="attendance_${eventId}.xlsx"`,
          'Cache-Control': 'no-store',
        },
      })
    }

    return NextResponse.json({ ok: true, data: rows, total: count ?? rows.length, total_scans: totalCount, unique_scans: uniqueCount })
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || 'Gagal mengambil attendance' }, { status: 400 })
  }
}
