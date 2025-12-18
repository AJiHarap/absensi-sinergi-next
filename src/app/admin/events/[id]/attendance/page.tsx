"use client"

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'

type Row = {
  scanned_at: string
  participant_name: string
  participant_code: string
  table_number: number | null
  seat_number: number | null
  is_first?: boolean
}

export default function AttendancePage() {
  const { id: eventId } = useParams() as { id: string }
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [totalScans, setTotalScans] = useState(0)
  const [uniqueScans, setUniqueScans] = useState(0)
  const [totalParticipants, setTotalParticipants] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [sort, setSort] = useState<'time.desc' | 'time.asc'>('time.desc')
  const [noSeat, setNoSeat] = useState(false)
  const [fromDate, setFromDate] = useState('') // YYYY-MM-DD
  const [toDate, setToDate] = useState('') // YYYY-MM-DD

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))
      params.set('sort', sort)
      if (noSeat) params.set('noSeat', 'true')
      if (fromDate) params.set('from', fromDate)
      if (toDate) params.set('to', toDate)
      const res = await fetch(`/api/admin/events/${eventId}/attendance?${params.toString()}`, { cache: 'no-store' })
      const json = await res.json()
      if (!json.ok) throw new Error(json.message || 'Gagal memuat daftar hadir')
      setRows(json.data as Row[])
      setTotal(json.total ?? (json.data as Row[]).length)
      setTotalScans(json.total_scans ?? (json.data as Row[]).length)
      setUniqueScans(json.unique_scans ?? new Set((json.data as Row[]).map((r) => r.participant_code)).size)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, q, page, pageSize, sort, noSeat, fromDate, toDate])

  // Load total participants for this event
  useEffect(() => {
    let cancelled = false
    const loadTotal = async () => {
      try {
        const res = await fetch(`/api/admin/events/${eventId}/participants?page=1&pageSize=1`, { cache: 'no-store' })
        const json = await res.json()
        if (!cancelled && json?.ok) setTotalParticipants(json.total ?? 0)
      } catch {}
    }
    if (eventId) loadTotal()
    return () => { cancelled = true }
  }, [eventId])

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Kehadiran</h1>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => router.back()} className="btn btn-outline text-sm">Kembali</button>
          <Link href={`/admin/events/${eventId}/participants`} className="btn btn-outline text-sm">Peserta</Link>
          <Link href={`/admin/events/${eventId}/seating`} className="btn btn-outline text-sm">Kelola Seat</Link>
        </div>
      </div>

      {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>}

      <section className="card p-4 grid sm:grid-cols-5 gap-3 items-end">
        <div className="sm:col-span-2">
          <label className="text-sm text-gray-700">Cari</label>
          <input className="w-full border rounded px-3 py-2" placeholder="Nama atau kode peserta" value={q} onChange={(e) => { setPage(1); setQ(e.target.value) }} />
        </div>
        <div>
          <label className="text-sm text-gray-700">Urutkan</label>
          <select className="w-full border rounded px-3 py-2" value={sort} onChange={(e) => setSort(e.target.value as any)}>
            <option value="time.desc">Terbaru dulu</option>
            <option value="time.asc">Terlama dulu</option>
          </select>
        </div>
        <div>
          <label className="text-sm text-gray-700">Dari Tanggal</label>
          <input type="date" className="w-full border rounded px-3 py-2" value={fromDate} onChange={(e) => { setPage(1); setFromDate(e.target.value) }} />
        </div>
        <div>
          <label className="text-sm text-gray-700">Ke Tanggal</label>
          <input type="date" className="w-full border rounded px-3 py-2" value={toDate} onChange={(e) => { setPage(1); setToDate(e.target.value) }} />
        </div>
        <div className="sm:col-span-3 flex items-center gap-2">
          <input id="only-no-seat" type="checkbox" className="h-4 w-4" checked={noSeat} onChange={(e) => { setPage(1); setNoSeat(e.target.checked) }} />
          <label htmlFor="only-no-seat" className="text-sm text-gray-700">Hanya peserta tanpa kursi</label>
        </div>
        <div className="sm:col-span-5 flex flex-wrap gap-2 mt-2">
          <a
            className="btn btn-outline"
            href={`/api/admin/events/${eventId}/attendance?export=csv&sort=${sort}&page=1&pageSize=100000${q ? `&q=${encodeURIComponent(q)}` : ''}${fromDate ? `&from=${encodeURIComponent(fromDate)}` : ''}${toDate ? `&to=${encodeURIComponent(toDate)}` : ''}${noSeat ? `&noSeat=true` : ''}`}
          >
            Export CSV (sesuai filter)
          </a>
          <a
            className="btn btn-outline"
            href={`/api/admin/events/${eventId}/attendance?export=excel&sort=${sort}&page=1&pageSize=100000${q ? `&q=${encodeURIComponent(q)}` : ''}${fromDate ? `&from=${encodeURIComponent(fromDate)}` : ''}${toDate ? `&to=${encodeURIComponent(toDate)}` : ''}${noSeat ? `&noSeat=true` : ''}`}
          >
            Export Excel (sesuai filter)
          </a>
          <a
            className="btn btn-outline"
            href={`/api/admin/events/${eventId}/attendance?export=csv&sort=${sort}&page=1&pageSize=100000`}
          >
            Export CSV (semua)
          </a>
          <a
            className="btn btn-outline"
            href={`/api/admin/events/${eventId}/attendance?export=excel&sort=${sort}&page=1&pageSize=100000`}
          >
            Export Excel (semua)
          </a>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-3">
        <div className="rounded border bg-white p-3">
          <div className="text-xs text-gray-500">Total scan</div>
          <div className="text-2xl font-semibold">{totalScans}</div>
        </div>
        <div className="rounded border bg-white p-3">
          <div className="text-xs text-gray-500">Total scan pertama</div>
          <div className="text-2xl font-semibold">{rows.filter(r => r.is_first).length}</div>
        </div>
        <div className="rounded border bg-white p-3">
          <div className="text-xs text-gray-500">Total peserta</div>
          <div className="text-2xl font-semibold">{totalParticipants}</div>
        </div>
      </section>

      <div className="card">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left p-3">Waktu</th>
              <th className="text-left p-3">Nama</th>
              <th className="text-left p-3">Kode</th>
              <th className="text-left p-3">Meja</th>
              <th className="text-left p-3">Kursi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="p-3" colSpan={5}>Memuat…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td className="p-3" colSpan={5}>Belum ada kehadiran</td></tr>
            ) : (
              rows.map((r, idx) => (
                <tr key={idx} className="border-t">
                  <td className="p-3 whitespace-nowrap">{new Date(r.scanned_at).toLocaleString()}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span>{r.participant_name}</span>
                      {r.is_first ? (
                        <span className="text-[10px] uppercase bg-green-100 text-green-700 border border-green-200 rounded px-1 py-0.5">Pertama</span>
                      ) : (
                        <span className="text-[10px] uppercase bg-yellow-100 text-yellow-700 border border-yellow-200 rounded px-1 py-0.5">Ulang</span>
                      )}
                    </div>
                  </td>
                  <td className="p-3 font-mono">{r.participant_code}</td>
                  <td className="p-3">{r.table_number ?? '-'}</td>
                  <td className="p-3">{r.seat_number ?? '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <div>
          Menampilkan {(total === 0 ? 0 : (page - 1) * pageSize + 1)}–{Math.min(page * pageSize, total)} dari {total}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="rounded border px-3 py-1 disabled:opacity-60"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Prev
          </button>
          <span>Hal {page}</span>
          <button
            className="rounded border px-3 py-1 disabled:opacity-60"
            disabled={page * pageSize >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
          <select
            className="border rounded px-2 py-1"
            value={pageSize}
            onChange={(e) => { setPage(1); setPageSize(Number(e.target.value)) }}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>
    </main>
  )
}
