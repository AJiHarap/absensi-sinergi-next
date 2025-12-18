"use client"

import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/browser'
import { z } from 'zod'

const ScanResultSchema = z.object({
  ok: z.boolean(),
  message: z.string().optional(),
  data: z
    .object({
      participant_name: z.string(),
      event_id: z.string(),
      table_number: z.number().nullable(),
      seat_number: z.number().nullable(),
      total_scans: z.number().optional(),
    })
    .optional(),
})

export default function ScanPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null)
  const [scanning, setScanning] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [lastResult, setLastResult] = useState<z.infer<typeof ScanResultSchema>['data'] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [loadingDevices, setLoadingDevices] = useState(false)
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('')
  const [fastMode, setFastMode] = useState(true)
  const decodingRef = useRef(false)
  const [recent, setRecent] = useState<Array<{ participant_name: string; participant_code: string; event_id: string; table_number: number | null; seat_number: number | null; scanned_at: string }>>([])
  const [activeEvents, setActiveEvents] = useState<Array<{ id: string; name: string }>>([])
  const [selectedEventId, setSelectedEventId] = useState<string>('')
  const [flashOK, setFlashOK] = useState(false)

  useEffect(() => {
    const reader = new BrowserMultiFormatReader()
    codeReaderRef.current = reader
    return () => {
      const anyReader = reader as any
      if (anyReader && typeof anyReader.reset === 'function') {
        try { anyReader.reset() } catch {}
      }
      // Stop any active streams on page unmount
      const stream = (videoRef.current?.srcObject as MediaStream | null) || null
      if (stream) {
        try { stream.getTracks().forEach((t) => t.stop()) } catch {}
      }
    }
  }, [])

  // Auto-stop camera when tab becomes hidden
  useEffect(() => {
    const onVisChange = () => {
      if (document.hidden) {
        stopScan()
      }
    }
    document.addEventListener('visibilitychange', onVisChange)
    return () => document.removeEventListener('visibilitychange', onVisChange)
  }, [])

  // Enumerate cameras (will request permission once for labels)
  const refreshDevices = async () => {
    try {
      setLoadingDevices(true)
      setError(null)
      // Ask permission once to get device labels
      try {
        const test = await navigator.mediaDevices.getUserMedia({ video: true })
        test.getTracks().forEach((t) => t.stop())
      } catch {}
      const list = await navigator.mediaDevices.enumerateDevices()
      const vids = list.filter((d) => d.kind === 'videoinput')
      setDevices(vids)
      // pick preferred or first
      const preferred = typeof window !== 'undefined' ? localStorage.getItem('preferred_camera_id') || '' : ''
      const chosen = vids.find((d) => d.deviceId === preferred) || vids[0]
      setSelectedDeviceId(chosen?.deviceId || '')
    } catch (e: any) {
      setError(e?.message || 'Gagal memuat daftar kamera')
    } finally {
      setLoadingDevices(false)
    }
  }

  useEffect(() => {
    refreshDevices()
    // Re-enumerate when device list changes (e.g., DroidCam plugged)
    const handler = () => refreshDevices()
    navigator.mediaDevices?.addEventListener?.('devicechange', handler)
    return () => navigator.mediaDevices?.removeEventListener?.('devicechange', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load active events and select one
  useEffect(() => {
    const loadEvents = async () => {
      try {
        const res = await fetch('/api/admin/events', { cache: 'no-store' })
        const json = await res.json()
        if (json?.ok && Array.isArray(json.data)) {
          const act = (json.data as any[]).filter((e) => e.is_active)
          setActiveEvents(act.map((e) => ({ id: e.id as string, name: e.name as string })))
          const preferred = (typeof window !== 'undefined' ? localStorage.getItem('preferred_active_event') : '') || ''
          const chosen = act.find((e) => e.id === preferred) || act[0]
          setSelectedEventId(chosen?.id || '')
        }
      } catch {}
    }
    loadEvents()
  }, [])

  // Poll recent attendance logs
  useEffect(() => {
    let stop = false
    const loadRecent = async () => {
      try {
        const res = await fetch('/api/attendance/recent', { cache: 'no-store' })
        const json = await res.json()
        if (json?.ok && Array.isArray(json.data)) setRecent(json.data)
      } catch {}
    }
    loadRecent()
    const t = setInterval(loadRecent, 5000)
    return () => { stop = true; clearInterval(t) }
  }, [])

  const startScan = async () => {
    setError(null)
    setLastResult(null)
    try {
      setScanning(true)
      const deviceId = selectedDeviceId || devices[0]?.deviceId
      if (!deviceId) throw new Error('Kamera tidak ditemukan')
      if (fastMode) {
        decodingRef.current = false
        await codeReaderRef.current!.decodeFromVideoDevice(deviceId, videoRef.current!, async (result, err) => {
          if (decodingRef.current) return
          if (result) {
            decodingRef.current = true
            const text = result.getText()
            try { await submitCode(text) } finally {
              // small cooldown to avoid duplicate scans
              setTimeout(() => { decodingRef.current = false }, 800)
            }
          }
        })
      } else {
        const result = await codeReaderRef.current!.decodeOnceFromVideoDevice(
          deviceId,
          videoRef.current!
        )
        const text = result.getText()
        await submitCode(text)
      }
    } catch (e) {
      if (e instanceof NotFoundException) {
        setError('Kode tidak terbaca, coba lagi.')
      } else if (e instanceof Error) {
        setError(e.message)
      } else {
        setError('Terjadi kesalahan saat scanning.')
      }
    } finally {
      if (!fastMode) {
        setScanning(false)
        const r: any = codeReaderRef.current
        if (r && typeof r.reset === 'function') {
          try { r.reset() } catch {}
        }
        const stream = (videoRef.current?.srcObject as MediaStream | null) || null
        if (stream) {
          try { stream.getTracks().forEach((t) => t.stop()) } catch {}
          try { if (videoRef.current) videoRef.current.srcObject = null } catch {}
        }
      }
    }
  }

  const stopScan = () => {
    const r: any = codeReaderRef.current
    // Ask ZXing to stop continuous mode if active, then reset
    try { r?.stopContinuousDecode?.() } catch {}
    try { r?.reset?.() } catch {}
    // Stop media tracks
    const stream = (videoRef.current?.srcObject as MediaStream | null) || null
    if (stream) {
      try { stream.getTracks().forEach((t) => t.stop()) } catch {}
    }
    // Clear and pause video element to release camera
    try {
      if (videoRef.current) {
        try { videoRef.current.pause() } catch {}
        // @ts-ignore
        try { videoRef.current.srcObject = null } catch {}
        // @ts-ignore
        try { (videoRef.current as any).src = '' } catch {}
        try { videoRef.current.load() } catch {}
      }
    } catch {}
    decodingRef.current = false
    setScanning(false)
  }

  const submitCode = async (text: string) => {
    setError(null)
    setLastResult(null)
    try {
      // QR format yang didukung: `eventId:participantCode` atau cukup `participantCode`
      let parsedEventId: string | undefined = undefined
      let participantCode = text.trim()
      if (text.includes(':')) {
        const [evt, code] = text.split(':')
        parsedEventId = evt
        participantCode = code
      }

      // Force current selected active event if available
      const forceEvent = selectedEventId || parsedEventId
      const res = await fetch('/api/attendance/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: forceEvent, participantCode }),
      })
      const json = await res.json()
      const parsed = ScanResultSchema.safeParse(json)
      if (!parsed.success) throw new Error('Respon server tidak valid')
      if (!parsed.data.ok) throw new Error(parsed.data.message || 'Scan gagal')
      setLastResult(parsed.data.data ?? null)
      // Success feedback: beep + flash
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(880, ctx.currentTime)
        gain.gain.setValueAtTime(0.0001, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01)
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start()
        osc.stop(ctx.currentTime + 0.16)
        setFlashOK(true)
        setTimeout(() => setFlashOK(false), 150)
      } catch {}
      // Immediately refresh recent list after a success
      try {
        const res2 = await fetch('/api/attendance/recent', { cache: 'no-store' })
        const j2 = await res2.json()
        if (j2?.ok && Array.isArray(j2.data)) setRecent(j2.data)
      } catch {}
    } catch (e) {
      if (e instanceof Error) setError(e.message)
      else setError('Terjadi kesalahan.')
    }
  }

  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-semibold">Scan Kehadiran</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <div className="relative">
            <video ref={videoRef} className="w-full rounded border bg-black aspect-video" />
            {flashOK && (
              <div className="absolute inset-0 rounded bg-green-400/40 pointer-events-none animate-pulse" />
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              className="rounded border px-3 py-2 flex-1"
              value={selectedDeviceId}
              onChange={(e) => {
                const id = e.target.value
                setSelectedDeviceId(id)
                try { localStorage.setItem('preferred_camera_id', id) } catch {}
              }}
            >
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || 'Kamera'}
                </option>
              ))}
              {devices.length === 0 && <option>Pilih kamera tidak tersedia</option>}
            </select>
            <button
              type="button"
              className="rounded border px-3 py-2"
              onClick={refreshDevices}
              disabled={loadingDevices}
            >
              {loadingDevices ? 'Memuat kamera…' : 'Refresh Kamera'}
            </button>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              className="rounded border px-3 py-2 flex-1"
              value={selectedEventId}
              onChange={(e) => {
                setSelectedEventId(e.target.value)
                try { localStorage.setItem('preferred_active_event', e.target.value) } catch {}
              }}
            >
              {activeEvents.map((ev) => (
                <option key={ev.id} value={ev.id}>{ev.name}</option>
              ))}
              {activeEvents.length === 0 && <option>Tidak ada event aktif</option>}
            </select>
            <div className="text-xs text-gray-600 flex items-center">Event aktif</div>
          </div>
          <button
            className="rounded bg-blue-600 text-white px-4 py-2 disabled:opacity-60"
            onClick={startScan}
            disabled={scanning}
          >
            {scanning ? 'Memindai…' : 'Mulai Scan Kamera'}
          </button>
          <button
            className="rounded bg-gray-700 text-white px-4 py-2 disabled:opacity-60"
            onClick={stopScan}
            disabled={!scanning}
          >
            Hentikan Scan
          </button>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={fastMode} onChange={(e) => setFastMode(e.target.checked)} />
            Mode cepat (scan berkelanjutan)
          </label>
          <p className="text-xs text-gray-500">Dukungan QR: <code>eventId:participantCode</code> atau cukup <code>participantCode</code>. Sistem akan otomatis mendeteksi event aktif.</p>
        </div>
        <div className="space-y-4">
          {error && (
            <div className="rounded border border-red-300 bg-red-50 p-3 text-red-800">{error}</div>
          )}
          {lastResult && (
            <div className="rounded border border-green-300 bg-green-50 p-4 space-y-1">
              <div className="text-xs text-green-700">Scan berhasil</div>
              <div className="text-xl font-semibold text-green-900">{lastResult.participant_name}</div>
              <div className="text-green-800">
                Posisi duduk: meja {lastResult.table_number ?? '-'} kursi {lastResult.seat_number ?? '-'}
              </div>
              {typeof lastResult.total_scans === 'number' && (
                <div className="text-green-700 text-sm">Total scan: {lastResult.total_scans}</div>
              )}
            </div>
          )}
          <div className="rounded border bg-white p-3">
            <div className="font-medium mb-2">Terakhir Hadir</div>
            <ul className="space-y-2 max-h-64 overflow-auto">
              {recent.map((r, idx) => (
                <li key={idx} className="text-sm flex items-center justify-between">
                  <div>
                    <div className="font-medium">{r.participant_name}</div>
                    <div className="text-gray-600">{r.participant_code} • Meja {r.table_number ?? '-'} Kursi {r.seat_number ?? '-'}</div>
                  </div>
                  <div className="text-xs text-gray-500">{new Date(r.scanned_at).toLocaleTimeString()}</div>
                </li>
              ))}
              {recent.length === 0 && (
                <li className="text-sm text-gray-500">Belum ada data hadir</li>
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* Manual input moved to bottom */}
      <div className="space-y-2">
        <div className="text-sm text-gray-700">Input Manual (QR text / Participant Code)</div>
        <div className="flex gap-2">
          <input
            className="w-full rounded border px-3 py-2"
            placeholder="Tempelkan teks QR atau masukkan participant code"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
          />
          <button
            className="rounded bg-gray-800 text-white px-4 py-2 disabled:opacity-60"
            onClick={() => submitCode(manualCode)}
            disabled={!manualCode}
          >
            Submit Manual
          </button>
        </div>
      </div>
    </main>
  )
}
