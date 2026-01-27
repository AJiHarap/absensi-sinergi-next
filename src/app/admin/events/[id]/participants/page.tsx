"use client"

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import QRCode from 'qrcode'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { useParams } from 'next/navigation'

type Participant = {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  participant_code: string
  metadata?: { gender?: 'L' | 'P'; jabatan?: string | null; divisi?: string | null; asal?: string | null; tanggal_lahir?: string | null } | null
}

export default function ParticipantsPage() {
  const { id: eventId } = useParams() as { id: string }
  const router = useRouter()
  const [data, setData] = useState<Participant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<'full_name.asc' | 'full_name.desc' | 'participant_code.asc' | 'participant_code.desc' | 'email.asc' | 'email.desc'>('full_name.asc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [eventName, setEventName] = useState<string>('')
  const [sending, setSending] = useState<{ email?: boolean; pid?: string | null }>({})

  // add form
  const [form, setForm] = useState({ full_name: '', participant_code: '', email: '', phone: '', gender: '' as '' | 'L' | 'P', jabatan: '', divisi: '', asal: '', tanggal_lahir: '' })
  const [saving, setSaving] = useState(false)
  const [codeTouched, setCodeTouched] = useState(false)

  // duplicate code checks
  const isAddCodeDuplicate = useMemo(() => {
    const code = form.participant_code.trim().toLowerCase()
    if (!code) return false
    return data.some((p) => (p.participant_code || '').toLowerCase() === code)
  }, [data, form.participant_code])

  // edit modal
  const [editing, setEditing] = useState<null | Participant>(null)
  const [editForm, setEditForm] = useState({ full_name: '', participant_code: '', email: '', phone: '', gender: '' as '' | 'L' | 'P', jabatan: '', divisi: '', asal: '', tanggal_lahir: '' })
  const [updating, setUpdating] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (sort) params.set('sort', sort)
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))
      const res = await fetch(`/api/admin/events/${eventId}/participants?${params.toString()}`, { cache: 'no-store' })
      const json = await res.json()
      if (!json.ok) throw new Error(json.message || 'Gagal memuat peserta')
      setData(json.data)
      setTotal(json.total ?? 0)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // Send helpers
  const doSendEmail = async (ids?: string[]) => {
    setSending((s) => ({ ...s, email: true, pid: ids && ids.length === 1 ? ids[0] : null }))
    try {
      const res = await fetch(`/api/admin/events/${eventId}/participants/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ids && ids.length ? { participantIds: ids } : {}),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.message || 'Gagal mengirim email')
      const firstErr = json?.data?.errors?.[0]?.message
      alert(`Email terkirim: ${json.data.success}, Gagal: ${json.data.failed}${firstErr ? `\nDetail: ${firstErr}` : ''}`)
    } catch (e: any) {
      alert(e?.message || 'Gagal mengirim email')
    } finally {
      setSending((s) => ({ ...s, email: false, pid: null }))
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, q, sort, page, pageSize])

  // Fetch event name separately (once per event)
  useEffect(() => {
    let cancelled = false
    const fetchEvent = async () => {
      try {
        const resEvt = await fetch('/api/admin/events', { cache: 'no-store' })
        const jsonEvt = await resEvt.json()
        if (!cancelled && jsonEvt.ok && Array.isArray(jsonEvt.data)) {
          const match = (jsonEvt.data as any[]).find((e) => e.id === eventId)
          if (match?.name) setEventName(match.name as string)
        }
      } catch {}
    }
    fetchEvent()
    return () => { cancelled = true }
  }, [eventId])

  // Auto-generate/live-update code from name until code is manually edited
  useEffect(() => {
    if (!codeTouched) {
      const generated = generateCodeFromName(form.full_name, eventName)
      if (generated && generated !== form.participant_code) {
        setForm((f) => ({ ...f, participant_code: generated }))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.full_name, eventName, codeTouched])

  // Helper: add label text below QR and return data URL (PNG)
  const makeLabeledQR = async (qrText: string, label: string) => {
    const qrDataUrl = await QRCode.toDataURL(qrText, { margin: 1, scale: 8 })
    const img = new Image()
    img.src = qrDataUrl
    await new Promise((res, rej) => {
      img.onload = () => res(null)
      img.onerror = rej as any
    })
    const padding = 16
    const lineHeight = 24
    const width = img.width + padding * 2
    const height = img.height + padding * 2 + lineHeight
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    const x = (width - img.width) / 2
    const y = padding
    ctx.drawImage(img, x, y)
    ctx.fillStyle = '#111827'
    ctx.font = 'bold 16px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const labelY = y + img.height + (padding + lineHeight) / 2
    const maxLabelWidth = width - padding * 2
    let drawLabel = label
    while (ctx.measureText(drawLabel).width > maxLabelWidth && drawLabel.length > 0) {
      drawLabel = drawLabel.slice(0, -1)
    }
    if (drawLabel !== label) drawLabel = drawLabel.trimEnd() + '…'
    ctx.fillText(drawLabel, width / 2, labelY)
    return canvas.toDataURL('image/png')
  }

  // Helpers for safe filenames used in QR exports
  const sanitizeFilePart = (s: string) => (s || '').replace(/[^a-zA-Z0-9-_.\s]/g, '').replace(/\s+/g, ' ').trim()
  const safeQRFileName = (code: string, name: string) => `${sanitizeFilePart(name)} (${sanitizeFilePart(code)}).png`

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      // Ensure code exists (generate on submit if empty)
      const fallbackCode = generateCodeFromName(form.full_name, eventName)
      const effectiveCode = (form.participant_code || '').trim() || fallbackCode
      if (data.some((p) => (p.participant_code || '').toLowerCase() === effectiveCode.toLowerCase())) {
        throw new Error('Participant code sudah digunakan di daftar saat ini')
      }
      const payload = {
        full_name: form.full_name.trim(),
        participant_code: effectiveCode,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        gender: form.gender || null,
        jabatan: form.jabatan.trim() || null,
        divisi: form.divisi.trim() || null,
        asal: form.asal.trim() || null,
        tanggal_lahir: form.tanggal_lahir.trim() || null,
      }
      const res = await fetch(`/api/admin/events/${eventId}/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.message || 'Gagal menyimpan peserta')
      setForm({ full_name: '', participant_code: '', email: '', phone: '', gender: '', jabatan: '', divisi: '', asal: '', tanggal_lahir: '' })
      setCodeTouched(false)
      // reload back to first page including new item in order
      setPage(1)
      await load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  // Helpers: code generator and dataURL -> Blob
  const eventAcronym = (title: string) => {
    const words = title.toUpperCase().replace(/[^A-Z0-9\s]/g, '').trim().split(/\s+/)
    const letters = words.filter(w => /[A-Z]/.test(w)).slice(0, 2).map(w => w[0]).join('')
    const digits = (title.match(/\d+/g) || []).join('').slice(0, 4)
    return (letters + digits).slice(0, 6) || 'EV'
  }

  const generateCodeFromName = (participantName: string, evtName: string) => {
    const cleanName = participantName.trim().toUpperCase()
    const acr = eventAcronym(evtName)
    const ini = (cleanName ? cleanName.split(/\s+/).map(p => p[0]).join('') : '').slice(0, 2) || 'P'
    const rand4 = () => String(Math.floor(1000 + Math.random() * 9000)) // 4-digit number
    let code = `${acr}-${ini}-${rand4()}`
    // Ensure not clashing with current list; if clash, regenerate once
    if (data.some(p => (p.participant_code || '').toUpperCase() === code)) {
      code = `${acr}-${ini}-${rand4()}`
    }
    return code
  }

  const dataURLtoBlob = (dataUrl: string) => {
    const [meta, b64] = dataUrl.split(',')
    const mime = /data:(.*?);base64/.exec(meta)?.[1] || 'image/png'
    const bin = atob(b64)
    const len = bin.length
    const u8 = new Uint8Array(len)
    for (let i = 0; i < len; i++) u8[i] = bin.charCodeAt(i)
    return new Blob([u8], { type: mime })
  }

  const onEditOpen = (p: Participant) => {
    setEditing(p)
    setEditForm({
      full_name: p.full_name,
      participant_code: p.participant_code,
      email: p.email ?? '',
      phone: p.phone ?? '',
      gender: (p.metadata?.gender as any) || '',
      jabatan: (p.metadata?.jabatan as any) || '',
      divisi: (p.metadata?.divisi as any) || '',
      asal: (p.metadata?.asal as any) || '',
      tanggal_lahir: (p.metadata?.tanggal_lahir as any) || '',
    })
  }

  const isEditCodeDuplicate = useMemo(() => {
    if (!editing) return false
    const code = editForm.participant_code.trim().toLowerCase()
    if (!code) return false
    return data.some((p) => p.id !== editing.id && (p.participant_code || '').toLowerCase() === code)
  }, [data, editing, editForm.participant_code])

  const onEditSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing) return
    setUpdating(true)
    setError(null)
    try {
      const payload: any = {
        full_name: editForm.full_name.trim(),
        participant_code: editForm.participant_code.trim(),
        email: editForm.email.trim() || null,
        phone: editForm.phone.trim() || null,
        gender: editForm.gender || null,
        jabatan: editForm.jabatan.trim() || null,
        divisi: editForm.divisi.trim() || null,
        asal: editForm.asal.trim() || null,
        tanggal_lahir: editForm.tanggal_lahir.trim() || null,
      }
      const res = await fetch(`/api/admin/events/${eventId}/participants/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.message || 'Gagal mengubah peserta')
      setEditing(null)
      await load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setUpdating(false)
    }
  }

  const onDelete = async (p: Participant) => {
    if (!confirm(`Hapus peserta "${p.full_name}"?`)) return
    setError(null)
    try {
      const res = await fetch(`/api/admin/events/${eventId}/participants/${p.id}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.message || 'Gagal menghapus peserta')
      await load()
    } catch (e: any) {
      setError(e.message)
    }
  }

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Peserta</h1>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => router.back()} className="btn btn-outline text-sm">Kembali</button>
          <Link href={`/admin/events/${eventId}/seating`} className="btn btn-outline text-sm">Kelola Seat</Link>
          <Link href={`/admin/events/${eventId}/attendance`} className="btn btn-outline text-sm">Kehadiran</Link>
          <button
            onClick={async () => {
              try {
                const zip = new JSZip()
                for (const p of data) {
                  const text = `${eventId}:${p.participant_code}`
                  const dataUrl = await makeLabeledQR(text, p.full_name)
                  const base64 = dataUrl.split(',')[1]
                  const fileName = safeQRFileName(p.participant_code, p.full_name)
                  zip.file(fileName, base64, { base64: true })
                }
                const content = await zip.generateAsync({ type: 'blob' })
                saveAs(content, `qr_participants_${eventId}.zip`)
              } catch (e) {
                console.error(e)
                alert('Gagal membuat ZIP QR')
              }
            }}
            className="link text-sm"
          >
            Unduh Semua QR
          </button>
        </div>
      </div>

      {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>}

      {/* Stats */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded border bg-white p-3">
          <div className="text-xs text-gray-500">Total peserta</div>
          <div className="text-2xl font-semibold">{total}</div>
        </div>
      </section>

      {/* Search & Sort */}
      <section className="card p-4 grid sm:grid-cols-3 gap-3 items-end">
        <div className="sm:col-span-2">
          <label className="text-sm text-gray-700">Cari</label>
          <input className="w-full border rounded px-3 py-2" placeholder="Nama, kode, email, telepon, jabatan, divisi, asal" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div>
          <label className="text-sm text-gray-700">Urutkan</label>
          <select className="w-full border rounded px-3 py-2" value={sort} onChange={(e) => setSort(e.target.value as any)}>
            <option value="full_name.asc">Nama A→Z</option>
            <option value="full_name.desc">Nama Z→A</option>
            <option value="participant_code.asc">Kode A→Z</option>
            <option value="participant_code.desc">Kode Z→A</option>
            <option value="email.asc">Email A→Z</option>
            <option value="email.desc">Email Z→A</option>
          </select>
        </div>
        <div className="sm:col-span-3 flex flex-wrap gap-2 mt-2">
          <a
            className="btn btn-outline"
            href={`/api/admin/events/${eventId}/participants?export=csv${q ? `&q=${encodeURIComponent(q)}` : ''}${sort ? `&sort=${encodeURIComponent(sort)}` : ''}`}
            download
          >
            Export CSV (sesuai filter)
          </a>
          <a
            className="btn btn-outline"
            href={`/api/admin/events/${eventId}/participants?export=excel${q ? `&q=${encodeURIComponent(q)}` : ''}${sort ? `&sort=${encodeURIComponent(sort)}` : ''}`}
            download
          >
            Export Excel (sesuai filter)
          </a>
          <a
            className="btn btn-outline"
            href={`/api/admin/events/${eventId}/participants?export=csv${sort ? `&sort=${encodeURIComponent(sort)}` : ''}`}
            download
          >
            Export CSV (semua)
          </a>
          <a
            className="btn btn-outline"
            href={`/api/admin/events/${eventId}/participants?export=excel${sort ? `&sort=${encodeURIComponent(sort)}` : ''}`}
            download
          >
            Export Excel (semua)
          </a>
          <button
            type="button"
            className="btn btn-gold"
            disabled={sending.email}
            onClick={() => doSendEmail()}
          >
            {sending.email ? 'Mengirim Email…' : 'Kirim Email (semua)'}
          </button>
        </div>
      </section>

      {/* Import CSV/Excel */}
      <section className="card p-4">
        <div className="font-medium mb-2">Import Peserta via CSV / Excel</div>
        <div className="text-xs text-gray-600 mb-2">Format kolom: <code>full_name, participant_code (opsional), email (opsional), phone (opsional), gender (opsional: L/P), jabatan (opsional), divisi (opsional), asal (opsional), tanggal_lahir (opsional)</code>. Excel: gunakan header yang sama.</div>
        <form
          className="flex flex-col sm:flex-row gap-2 items-start"
          onSubmit={async (e) => {
            e.preventDefault()
            const formEl = e.currentTarget as HTMLFormElement
            const input = formEl.querySelector('input[type="file"]') as HTMLInputElement | null
            if (!input || !input.files || input.files.length === 0) return
            const fd = new FormData()
            fd.append('file', input.files[0])
            try {
              const res = await fetch(`/api/admin/events/${eventId}/participants/import`, { method: 'POST', body: fd })
              const json = await res.json()
              if (!json.ok) throw new Error(json.message || 'Gagal import')
              alert(`Import selesai. Sukses: ${json.data.success}, Gagal: ${json.data.failed}`)
              setPage(1)
              await load()
            } catch (err: any) {
              alert(err?.message || 'Gagal import')
            } finally {
              if (input) input.value = ''
            }
          }}
        >
          <input type="file" accept="text/csv,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xls,.xlsx" className="border rounded px-3 py-2" />
          <button type="submit" className="btn btn-outline">Upload</button>
          <a
            className="link text-sm"
            href={`data:text/csv;charset=utf-8,${encodeURIComponent('full_name,participant_code,email,phone,gender,jabatan,divisi,asal,tanggal_lahir\n')}`}
            download={`participants_template.csv`}
          >
            Unduh Template CSV
          </a>
        </form>
      </section>

      {/* Add single participant */}
      <section className="card p-4">
        <div className="font-medium mb-3">Tambah Peserta</div>
        <form onSubmit={onAdd} className="grid sm:grid-cols-4 gap-3">
          <input className="border rounded px-3 py-2" placeholder="Nama lengkap" value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} required />
          <div>
            <div className="flex gap-2">
              <input
                className="border rounded px-3 py-2 w-full"
                placeholder="Participant code"
                value={form.participant_code}
                onChange={(e) => {
                  const v = e.target.value
                  setForm((f) => ({ ...f, participant_code: v }))
                  setCodeTouched(true)
                }}
              />
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  const g = generateCodeFromName(form.full_name, eventName)
                  setForm((f) => ({ ...f, participant_code: g }))
                  setCodeTouched(true)
                }}
              >
                Generate
              </button>
            </div>
            <div className="text-xs text-gray-500 mt-1">Kode dibuat otomatis dari nama (berbasis event) dan bisa diubah manual kapan saja.</div>
            {isAddCodeDuplicate && (
              <div className="text-xs text-red-700 mt-1">Kode sudah digunakan di daftar saat ini</div>
            )}
          </div>
          <input className="border rounded px-3 py-2" placeholder="Email (opsional)" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          <input className="border rounded px-3 py-2" placeholder="Telepon (opsional)" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          <div>
            <label className="text-sm text-gray-700">Jenis Kelamin</label>
            <select className="w-full border rounded px-3 py-2" value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value as any }))}>
              <option value="">Tidak diisi</option>
              <option value="L">Laki-laki</option>
              <option value="P">Perempuan</option>
            </select>
          </div>
          <input className="border rounded px-3 py-2" placeholder="Jabatan (opsional)" value={form.jabatan} onChange={(e) => setForm((f) => ({ ...f, jabatan: e.target.value }))} />
          <input className="border rounded px-3 py-2" placeholder="Divisi (opsional)" value={form.divisi} onChange={(e) => setForm((f) => ({ ...f, divisi: e.target.value }))} />
          <input className="border rounded px-3 py-2" placeholder="Asal (opsional)" value={form.asal} onChange={(e) => setForm((f) => ({ ...f, asal: e.target.value }))} />
          <input className="border rounded px-3 py-2" type="date" placeholder="Tanggal Lahir (opsional)" value={form.tanggal_lahir} onChange={(e) => setForm((f) => ({ ...f, tanggal_lahir: e.target.value }))} />
          <div className="sm:col-span-4">
            <button type="submit" disabled={saving || isAddCodeDuplicate} className="btn btn-gold">
              {saving ? 'Menyimpan…' : 'Tambah Peserta'}
            </button>
          </div>
        </form>
      </section>

      <div className="card">
        <div className="table-responsive">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left p-3 whitespace-nowrap">Nama</th>
              <th className="text-left p-3 whitespace-nowrap hidden md:table-cell">Email</th>
              <th className="text-left p-3 whitespace-nowrap hidden md:table-cell">Telepon</th>
              <th className="text-left p-3 whitespace-nowrap hidden lg:table-cell">Jenis Kelamin</th>
              <th className="text-left p-3 whitespace-nowrap hidden xl:table-cell">Jabatan</th>
              <th className="text-left p-3 whitespace-nowrap hidden xl:table-cell">Divisi</th>
              <th className="text-left p-3 whitespace-nowrap hidden 2xl:table-cell">Asal</th>
              <th className="text-left p-3 whitespace-nowrap hidden 2xl:table-cell">Tanggal Lahir</th>
              <th className="text-left p-3 whitespace-nowrap">Kode</th>
              <th className="text-left p-3 whitespace-nowrap">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="p-3" colSpan={5}>Memuat…</td></tr>
            ) : data.length === 0 ? (
              <tr><td className="p-3" colSpan={5}>Belum ada peserta</td></tr>
            ) : (
              data.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="p-3 align-middle">{p.full_name}</td>
                  <td className="p-3 align-middle hidden md:table-cell">{p.email || '-'}</td>
                  <td className="p-3 align-middle hidden md:table-cell">{p.phone || '-'}</td>
                  <td className="p-3 align-middle hidden lg:table-cell">{p.metadata?.gender === 'L' ? 'Laki-laki' : p.metadata?.gender === 'P' ? 'Perempuan' : '-'}</td>
                  <td className="p-3 align-middle hidden xl:table-cell">{p.metadata?.jabatan || '-'}</td>
                  <td className="p-3 align-middle hidden xl:table-cell">{p.metadata?.divisi || '-'}</td>
                  <td className="p-3 align-middle hidden 2xl:table-cell">{p.metadata?.asal || '-'}</td>
                  <td className="p-3 align-middle hidden 2xl:table-cell">{p.metadata?.tanggal_lahir || '-'}</td>
                  <td className="p-3 align-middle font-mono">{p.participant_code}</td>
                  <td className="p-3 align-middle whitespace-nowrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button className="btn btn-outline btn-sm" onClick={() => onEditOpen(p)}>Ubah</button>
                      <button className="btn btn-danger btn-sm" onClick={() => onDelete(p)}>Hapus</button>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={async () => {
                          try {
                            const text = `${eventId}:${p.participant_code}`
                            const dataUrl = await makeLabeledQR(text, p.full_name)
                            const blob = dataURLtoBlob(dataUrl)
                            const fileName = safeQRFileName(p.participant_code, p.full_name)
                            saveAs(blob, fileName)
                          } catch (e) {
                            console.error(e)
                            alert('Gagal membuat QR')
                          }
                        }}
                      >
                        Unduh QR
                      </button>
                      <button
                        className="btn btn-gold btn-sm"
                        disabled={sending.email && sending.pid === p.id}
                        onClick={() => doSendEmail([p.id])}
                      >
                        {sending.email && sending.pid === p.id ? 'Mengirim…' : 'Kirim Email'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Pagination */}
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

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded border max-w-lg w-full p-4 space-y-3">
            <div className="text-lg font-semibold">Edit Peserta</div>
            <form onSubmit={onEditSave} className="grid sm:grid-cols-2 gap-3">
              <input className="border rounded px-3 py-2 sm:col-span-2" placeholder="Nama lengkap" value={editForm.full_name} onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))} required />
              <div className="sm:col-span-2">
                <input className="border rounded px-3 py-2 w-full" placeholder="Participant code" value={editForm.participant_code} onChange={(e) => setEditForm((f) => ({ ...f, participant_code: e.target.value }))} required />
                {isEditCodeDuplicate && (
                  <div className="text-xs text-red-700 mt-1">Kode sudah digunakan di daftar saat ini</div>
                )}
              </div>
              <input className="border rounded px-3 py-2" placeholder="Email (opsional)" type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
              <input className="border rounded px-3 py-2" placeholder="Telepon (opsional)" value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} />
              <div className="sm:col-span-2">
                <label className="text-sm text-gray-700">Jenis Kelamin</label>
                <select className="w-full border rounded px-3 py-2" value={editForm.gender} onChange={(e) => setEditForm((f) => ({ ...f, gender: e.target.value as any }))}>
                  <option value="">Tidak diisi</option>
                  <option value="L">Laki-laki</option>
                  <option value="P">Perempuan</option>
                </select>
              </div>
              <input className="border rounded px-3 py-2" placeholder="Jabatan (opsional)" value={editForm.jabatan} onChange={(e) => setEditForm((f) => ({ ...f, jabatan: e.target.value }))} />
              <input className="border rounded px-3 py-2" placeholder="Divisi (opsional)" value={editForm.divisi} onChange={(e) => setEditForm((f) => ({ ...f, divisi: e.target.value }))} />
              <input className="border rounded px-3 py-2" placeholder="Asal (opsional)" value={editForm.asal} onChange={(e) => setEditForm((f) => ({ ...f, asal: e.target.value }))} />
              <input className="border rounded px-3 py-2" type="date" placeholder="Tanggal Lahir (opsional)" value={editForm.tanggal_lahir} onChange={(e) => setEditForm((f) => ({ ...f, tanggal_lahir: e.target.value }))} />
              <div className="sm:col-span-2 flex items-center justify-end gap-2 pt-1">
                <button type="button" className="rounded border px-3 py-1" onClick={() => setEditing(null)}>Batal</button>
                <button type="submit" disabled={updating || isEditCodeDuplicate} className="rounded bg-blue-600 text-white px-4 py-2 disabled:opacity-60">{updating ? 'Menyimpan…' : 'Simpan'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}
