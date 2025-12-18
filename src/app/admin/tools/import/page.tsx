"use client"

import Papa from 'papaparse'
import { useEffect, useState } from 'react'

const template = `full_name,participant_code,email,phone,table_number,seat_number\nJohn Doe,JD001,john@example.com,08123456789,1,3\nJane Doe,JD002,,08129876543,1,4\n`

export default function ImportParticipantsPage() {
  const [eventId, setEventId] = useState('')
  const [text, setText] = useState('')
  const [result, setResult] = useState<string>('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setText(template)
  }, [])

  const handleFile = (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        setText(Papa.unparse(res.data as any[], { header: true }))
      },
      error: (err) => setResult(`Gagal parse CSV: ${err.message}`),
    })
  }

  const onImport = async () => {
    setLoading(true)
    setResult('')
    try {
      if (!eventId) throw new Error('Event ID wajib diisi')
      const parsed = Papa.parse(text.trim(), { header: true, skipEmptyLines: true })
      if (parsed.errors?.length) throw new Error(parsed.errors[0].message)
      const rows = (parsed.data as any[]).map((r) => ({
        full_name: (r.full_name || '').toString().trim(),
        participant_code: (r.participant_code || '').toString().trim(),
        email: (r.email || '').toString().trim() || null,
        phone: (r.phone || '').toString().trim() || null,
        table_number: r.table_number !== undefined && r.table_number !== '' ? Number(r.table_number) : null,
        seat_number: r.seat_number !== undefined && r.seat_number !== '' ? Number(r.seat_number) : null,
      }))
      const res = await fetch('/api/admin/import/participants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, rows }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.message || 'Import gagal')
      setResult(`Import berhasil: participants=${json.data.inserted_participants}, seats=${json.data.upserted_seats}, assignments=${json.data.upserted_assignments}`)
    } catch (e: any) {
      setResult(`Error: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-semibold">Import Peserta (CSV)</h1>

      <div className="space-y-2">
        <label className="text-sm text-gray-700">Event ID</label>
        <input className="w-full border rounded px-3 py-2" value={eventId} onChange={(e) => setEventId(e.target.value)} placeholder="UUID event" />
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input type="file" accept=".csv" onChange={(e) => e.target.files && handleFile(e.target.files[0])} />
          <button className="rounded border px-3 py-1" onClick={() => setText(template)}>Gunakan Template</button>
        </div>
        <textarea className="w-full border rounded p-2 min-h-[220px] font-mono text-sm" value={text} onChange={(e) => setText(e.target.value)} />
        <button onClick={onImport} disabled={loading} className="rounded bg-blue-600 text-white px-4 py-2 disabled:opacity-60">
          {loading ? 'Mengimpor…' : 'Import'}
        </button>
      </div>

      {result && <pre className="bg-gray-900 text-gray-100 p-3 rounded text-sm whitespace-pre-wrap">{result}</pre>}
    </main>
  )
}
