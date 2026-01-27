"use client"

import { useEffect, useState } from 'react'
import Link from 'next/link'

type EventRow = {
  id: string
  name: string
  start_at: string | null
  end_at: string | null
  is_active: boolean
  created_at: string
}

export default function AdminEventsPage() {
  const [events, setEvents] = useState<EventRow[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', start_at: '', end_at: '' })
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/events', { cache: 'no-store' })
      const json = await res.json()
      if (!json.ok) throw new Error(json.message || 'Gagal memuat event')
      setEvents(json.data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }

  }

  const onDelete = async (id: string, name: string) => {
    const ok = typeof window !== 'undefined' ? window.confirm(`Yakin ingin menghapus event "${name}"? Semua data terkait (peserta, seat, kehadiran) juga akan ikut terhapus.`) : true
    if (!ok) return
    setDeletingId(id)
    setError(null)
    try {
      const res = await fetch(`/api/admin/events/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!json.ok) throw new Error(json.message || 'Gagal menghapus event')
      await load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setDeletingId(null)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          start_at: form.start_at || undefined,
          end_at: form.end_at || undefined,
          is_active: true,
        }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.message || 'Gagal membuat event')
      setForm({ name: '', start_at: '', end_at: '' })
      await load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setCreating(false)
    }
  }

  const toggleActive = async (id: string, current: boolean) => {
    setError(null)
    try {
      const res = await fetch(`/api/admin/events/${id}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !current }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.message || 'Gagal update status')
      await load()
    } catch (e: any) {
      setError(e.message)
    }
  }

  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-semibold">Kelola Event</h1>

      <form onSubmit={onCreate} className="card p-4 grid sm:grid-cols-4 gap-3">
        <input
          className="rounded border px-3 py-2 sm:col-span-2"
          placeholder="Nama event"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          required
        />
        <input
          type="datetime-local"
          className="rounded border px-3 py-2"
          value={form.start_at}
          onChange={(e) => setForm((f) => ({ ...f, start_at: e.target.value }))}
        />
        <input
          type="datetime-local"
          className="rounded border px-3 py-2"
          value={form.end_at}
          onChange={(e) => setForm((f) => ({ ...f, end_at: e.target.value }))}
        />
        <div className="sm:col-span-4 flex gap-2">
          <button type="submit" disabled={creating} className="btn btn-gold">
            {creating ? 'Menyimpan…' : 'Tambah Event'}
          </button>
        </div>
      </form>

      {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>}

      <div className="card">
        <div className="table-responsive">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left p-3">Nama</th>
              <th className="text-left p-3">Waktu</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="p-3" colSpan={4}>Memuat…</td></tr>
            ) : events.length === 0 ? (
              <tr><td className="p-3" colSpan={4}>Belum ada event</td></tr>
            ) : (
              events.map((ev) => (
                <tr key={ev.id} className="border-t">
                  <td className="p-3 font-medium">{ev.name}</td>
                  <td className="p-3">
                    <div className="text-gray-700">Mulai: {ev.start_at ? new Date(ev.start_at).toLocaleString() : '-'}</div>
                    <div className="text-gray-700">Selesai: {ev.end_at ? new Date(ev.end_at).toLocaleString() : '-'}</div>
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs ${ev.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                      {ev.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="p-3">
                    <button className="btn btn-outline mr-2" onClick={() => toggleActive(ev.id, ev.is_active)}>
                      {ev.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                    <Link
                      href={`/admin/events/${ev.id}/seating`}
                      className="btn btn-dark mr-2"
                    >
                      Kelola Seat
                    </Link>
                    <Link
                      href={`/admin/events/${ev.id}/participants`}
                      className="btn btn-gold mr-2"
                    >
                      Kelola Peserta
                    </Link>
                    <button
                      className="btn btn-danger"
                      onClick={() => onDelete(ev.id, ev.name)}
                      disabled={deletingId === ev.id}
                      title="Hapus event beserta semua data terkait"
                    >
                      {deletingId === ev.id ? 'Menghapus…' : 'Hapus'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>
    </main>
  )
}
