"use client"

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

type SeatRow = {
  id: string
  table_number: number
  seat_number: number
  assignment: null | {
    participant_id: string
    participant: { full_name: string; participant_code: string } | null
  }
}

export default function SeatingPage() {
  const { id: eventId } = useParams() as { id: string }
  const [seats, setSeats] = useState<SeatRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Generate form
  const [tablesInput, setTablesInput] = useState<string>('10')
  const [seatsPerTableInput, setSeatsPerTableInput] = useState<string>('8')
  const [generating, setGenerating] = useState(false)

  // Assign form
  const [assignCode, setAssignCode] = useState('')
  const [participants, setParticipants] = useState<{ full_name: string; participant_code: string }[]>([])
  const [assignTableInput, setAssignTableInput] = useState<string>('1')
  const [assignSeatInput, setAssignSeatInput] = useState<string>('1')
  const [assigning, setAssigning] = useState(false)
  const [showAllParticipants, setShowAllParticipants] = useState(false)

  const grouped = useMemo(() => {
    const m = new Map<number, SeatRow[]>()
    for (const s of seats) {
      if (!m.has(s.table_number)) m.set(s.table_number, [])
      m.get(s.table_number)!.push(s)
    }
    for (const [t, arr] of m.entries()) {
      arr.sort((a, b) => a.seat_number - b.seat_number)
      m.set(t, arr)
    }
    return Array.from(m.entries()).sort((a, b) => a[0] - b[0])
  }, [seats])

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/events/${eventId}/seats`, { cache: 'no-store' })
      const json = await res.json()
      if (!json.ok) throw new Error(json.message || 'Gagal memuat seats')
      setSeats(json.data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // load participants options
    const loadParticipants = async () => {
      try {
        const res = await fetch(`/api/admin/events/${eventId}/participants?sort=full_name.asc&page=1&pageSize=1000`, { cache: 'no-store' })
        const json = await res.json()
        if (json.ok) setParticipants(json.data as any)
      } catch {}
    }
    loadParticipants()
  }, [eventId])

  // Derived options for assigns
  const tableOptions = useMemo(() => {
    const set = new Set<number>()
    for (const s of seats) set.add(s.table_number)
    return Array.from(set).sort((a, b) => a - b)
  }, [seats])

  const emptySeatOptions = useMemo(() => {
    const t = parseInt(assignTableInput || '0', 10)
    if (!Number.isFinite(t)) return [] as number[]
    return seats
      .filter(s => s.table_number === t && !s.assignment?.participant)
      .map(s => s.seat_number)
      .sort((a, b) => a - b)
  }, [seats, assignTableInput])

  // Participants already assigned (by code)
  const assignedCodes = useMemo(() => {
    const set = new Set<string>()
    for (const s of seats) {
      const code = s.assignment?.participant?.participant_code
      if (code) set.add(code)
    }
    return set
  }, [seats])

  // Available participants to assign (exclude already assigned)
  const availableParticipants = useMemo(() => {
    return participants.filter(p => !assignedCodes.has(p.participant_code))
  }, [participants, assignedCodes])

  // Options shown in dropdown depending on toggle
  const participantOptions = useMemo(() => {
    return showAllParticipants ? participants : availableParticipants
  }, [showAllParticipants, participants, availableParticipants])

  // If current selected participant becomes assigned (after refresh), clear it
  useEffect(() => {
    if (assignCode && (assignedCodes.has(assignCode) || !participantOptions.some(p => p.participant_code === assignCode))) {
      setAssignCode('')
    }
  }, [assignCode, assignedCodes, participantOptions])

  // Initialize or correct assign table/seat when seats change
  useEffect(() => {
    if (tableOptions.length === 0) return
    const currentTable = parseInt(assignTableInput || '0', 10)
    const validTable = tableOptions.includes(currentTable) ? currentTable : tableOptions[0]
    if (String(validTable) !== assignTableInput) {
      setAssignTableInput(String(validTable))
      return
    }
    // set seat default if current seat invalid
    const currentSeat = parseInt(assignSeatInput || '0', 10)
    if (!emptySeatOptions.includes(currentSeat)) {
      if (emptySeatOptions.length > 0) setAssignSeatInput(String(emptySeatOptions[0]))
    }
  }, [tableOptions, emptySeatOptions])

  const onGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    setGenerating(true)
    setError(null)
    try {
      const tables = parseInt(tablesInput || '0', 10)
      const seatsPerTable = parseInt(seatsPerTableInput || '0', 10)
      if (!Number.isFinite(tables) || tables < 1) throw new Error('Jumlah meja harus minimal 1')
      if (!Number.isFinite(seatsPerTable) || seatsPerTable < 1) throw new Error('Kursi per meja harus minimal 1')
      const res = await fetch(`/api/admin/events/${eventId}/seats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'generate', tables, seatsPerTable }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.message || 'Gagal generate kursi')
      await load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setGenerating(false)
    }
  }

  const onAssign = async (e: React.FormEvent) => {
    e.preventDefault()
    setAssigning(true)
    setError(null)
    try {
      const assignTable = parseInt(assignTableInput || '0', 10)
      const assignSeat = parseInt(assignSeatInput || '0', 10)
      if (!assignCode.trim()) throw new Error('Pilih peserta terlebih dahulu')
      if (!Number.isFinite(assignTable) || assignTable < 1) throw new Error('Nomor meja tidak valid')
      if (!Number.isFinite(assignSeat) || assignSeat < 1) throw new Error('Nomor kursi tidak valid')
      const res = await fetch(`/api/admin/events/${eventId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantCode: assignCode.trim(), table_number: assignTable, seat_number: assignSeat }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.message || 'Gagal assign kursi')
      setAssignCode('')
      // reset to first available table/seat
      if (tableOptions.length > 0) {
        const t = tableOptions[0]
        setAssignTableInput(String(t))
        const empties = seats
          .filter(s => s.table_number === t && !s.assignment?.participant)
          .map(s => s.seat_number)
          .sort((a, b) => a - b)
        if (empties.length > 0) setAssignSeatInput(String(empties[0]))
        else setAssignSeatInput('')
      } else {
        setAssignTableInput('')
        setAssignSeatInput('')
      }
      await load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setAssigning(false)
    }
  }

  const unassignSeat = async (table_number: number, seat_number: number) => {
    setError(null)
    try {
      const res = await fetch(`/api/admin/events/${eventId}/assign`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_number, seat_number }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.message || 'Gagal unassign')
      await load()
    } catch (e: any) {
      setError(e.message)
    }
  }

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Seating Management</h1>
        <Link href="/admin/events" className="link text-sm">Kembali ke Event</Link>
      </div>

      {/* Generate Section */}
      <section className="card p-4 space-y-3">
        <div className="font-medium">Generate Kursi Otomatis</div>
        <form onSubmit={onGenerate} className="grid sm:grid-cols-5 gap-3 items-end">
          <div>
            <label className="text-sm text-gray-700">Jumlah Meja</label>
            <input type="number" min={1} className="w-full border rounded px-3 py-2" value={tablesInput} onChange={(e) => setTablesInput(e.target.value)} />
          </div>
          <div>
            <label className="text-sm text-gray-700">Kursi per Meja</label>
            <input type="number" min={1} className="w-full border rounded px-3 py-2" value={seatsPerTableInput} onChange={(e) => setSeatsPerTableInput(e.target.value)} />
          </div>
          <div className="sm:col-span-3">
            <button type="submit" disabled={generating} className="btn btn-gold">
              {generating ? 'Menghasilkan…' : 'Generate / Update Kursi'}
            </button>
          </div>
        </form>
      </section>

      {/* Assign Section */}
      <section className="card p-4 space-y-3">
        <div className="font-medium">Assign Peserta ke Kursi</div>
        <form onSubmit={onAssign} className="grid sm:grid-cols-5 gap-3 items-end">
          <div className="sm:col-span-2">
            <label className="text-sm text-gray-700">Peserta</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={assignCode}
              onChange={(e) => setAssignCode(e.target.value)}
              required
            >
              <option value="" disabled>Pilih peserta…</option>
              {participantOptions.map((p) => {
                const isAssigned = assignedCodes.has(p.participant_code)
                return (
                  <option key={p.participant_code} value={p.participant_code} disabled={isAssigned}>
                    {p.full_name} — {p.participant_code}{isAssigned ? ' (sudah duduk)' : ''}
                  </option>
                )
              })}
            </select>
            <div className="mt-1 text-xs text-gray-600 flex items-center gap-2">
              <input id="toggle-all-participants" type="checkbox" className="h-3 w-3" checked={showAllParticipants} onChange={(e) => setShowAllParticipants(e.target.checked)} />
              <label htmlFor="toggle-all-participants">Tampilkan semua peserta (termasuk yang sudah duduk)</label>
            </div>
          </div>
          <div>
            <label className="text-sm text-gray-700">Meja</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={assignTableInput}
              onChange={(e) => {
                setAssignTableInput(e.target.value)
                // When table changes, pick first empty seat of that table if available
                const t = parseInt(e.target.value || '0', 10)
                const empties = seats
                  .filter(s => s.table_number === t && !s.assignment?.participant)
                  .map(s => s.seat_number)
                  .sort((a, b) => a - b)
                if (empties.length > 0) setAssignSeatInput(String(empties[0]))
                else setAssignSeatInput('')
              }}
              required
            >
              {tableOptions.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-700">Kursi</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={assignSeatInput}
              onChange={(e) => setAssignSeatInput(e.target.value)}
              required
            >
              {emptySeatOptions.length === 0 ? (
                <option value="" disabled>Tidak ada kursi kosong</option>
              ) : (
                emptySeatOptions.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))
              )}
            </select>
          </div>
          <div>
            <button type="submit" disabled={assigning || !assignCode || emptySeatOptions.length === 0} className="btn btn-dark">
              {assigning ? 'Menyimpan…' : 'Assign'}
            </button>
          </div>
        </form>
      </section>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-red-800">{error}</div>
      )}

      {/* Seats Grid */}
      <section className="space-y-4">
        {loading ? (
          <div>Memuat kursi…</div>
        ) : grouped.length === 0 ? (
          <div className="text-gray-600">Belum ada kursi. Gunakan Generate untuk membuat layout.</div>
        ) : (
          grouped.map(([table, list]) => (
            <div key={table} className="card">
              <div className="px-4 py-2 border-b flex items-center justify-between" style={{ borderColor: 'var(--brand-border)' }}>
                <div className="font-medium">Meja {table}</div>
              </div>
              <div className="p-3 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                {list.map((s) => {
                  const occupied = !!s.assignment?.participant
                  return (
                    <div key={s.id} className={`rounded border p-2 ${occupied ? 'bg-green-50 border-green-200' : 'bg-gray-50'} `}>
                      <div className="text-xs text-gray-500">Kursi {s.seat_number}</div>
                      {occupied ? (
                        <div className="mt-1">
                          <div className="font-medium text-sm">{s.assignment!.participant!.full_name}</div>
                          <div className="text-xs text-gray-600">{s.assignment!.participant!.participant_code}</div>
                          <button
                            onClick={() => unassignSeat(s.table_number, s.seat_number)}
                            className="mt-2 w-full btn btn-danger text-xs"
                          >
                            Unassign
                          </button>
                        </div>
                      ) : (
                        <div className="mt-1 text-xs text-gray-500">Kosong</div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </section>
    </main>
  )
}
