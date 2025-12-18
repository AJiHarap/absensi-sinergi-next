"use client"

import { useState } from 'react'

export default function ExportAttendancePage() {
  const [eventId, setEventId] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onDownload = async () => {
    setError(null)
    if (!eventId) {
      setError('Event ID wajib diisi')
      return
    }
    try {
      setDownloading(true)
      const url = `/api/admin/attendance/export?eventId=${encodeURIComponent(eventId)}`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Gagal export: ${res.status}`)
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `attendance_${eventId}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-semibold">Export Kehadiran (CSV)</h1>
      <div className="space-y-2">
        <label className="text-sm text-gray-700">Event ID</label>
        <input
          className="w-full border rounded px-3 py-2"
          placeholder="UUID event"
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
        />
      </div>
      <button
        onClick={onDownload}
        disabled={downloading}
        className="rounded bg-blue-600 text-white px-4 py-2 disabled:opacity-60"
      >
        {downloading ? 'Menyiapkan…' : 'Download CSV'}
      </button>
      {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>}
    </main>
  )
}
