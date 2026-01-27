import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function POST(req: NextRequest, context: any) {
  try {
    const { params } = (context || {}) as { params: { id: string } }
    const eventId = params.id

    const contentType = req.headers.get('content-type') || ''
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ ok: false, message: 'Harap unggah file CSV (multipart/form-data)' }, { status: 400 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ ok: false, message: 'File tidak ditemukan' }, { status: 400 })

    // Detect Excel vs CSV
    const lowerName = (file.name || '').toLowerCase()
    const isExcel = lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || /sheet|excel/i.test(file.type || '')
    type Row = { full_name: string; participant_code?: string; email?: string; phone?: string; gender?: string; jabatan?: string; divisi?: string; asal?: string; tanggal_lahir?: string }
    const rows: Row[] = []

    if (isExcel) {
      try {
        // dynamic import to avoid bundling if unused
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const XLSX = (await import('xlsx')).default || (await import('xlsx'))
        const ab = await file.arrayBuffer()
        const wb = XLSX.read(new Uint8Array(ab), { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const json = XLSX.utils.sheet_to_json(ws, { defval: '' }) as any[]
        for (const r of json) {
          rows.push({
            full_name: (r.full_name || r['Full Name'] || r['Nama'] || '').toString().trim(),
            participant_code: (r.participant_code || r['Participant Code'] || r['Kode'] || '').toString().trim(),
            email: (r.email || '').toString().trim(),
            phone: (r.phone || '').toString().trim(),
            gender: (r.gender || '').toString().trim(),
            jabatan: (r.jabatan || r['Jabatan'] || '').toString().trim(),
            divisi: (r.divisi || r['Divisi'] || '').toString().trim(),
            asal: (r.asal || r['Asal'] || '').toString().trim(),
            tanggal_lahir: (r.tanggal_lahir || r['Tanggal Lahir'] || r['tgl_lahir'] || '').toString().trim(),
          })
        }
      } catch (e: any) {
        return NextResponse.json({ ok: false, message: 'Gagal membaca Excel. Pasang dependency xlsx (npm i xlsx).' }, { status: 400 })
      }
    } else {
      const text = await file.text()
      // Very simple CSV parser (comma-separated, RFC4180-light). Expect header row with: full_name,participant_code,email,phone,gender,jabatan,divisi,asal,tanggal_lahir
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
      if (lines.length === 0) return NextResponse.json({ ok: false, message: 'CSV kosong' }, { status: 400 })
      const header = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''))
      const idx = {
        full_name: header.findIndex((h) => h.toLowerCase() === 'full_name'),
        participant_code: header.findIndex((h) => h.toLowerCase() === 'participant_code'),
        email: header.findIndex((h) => h.toLowerCase() === 'email'),
        phone: header.findIndex((h) => h.toLowerCase() === 'phone'),
        gender: header.findIndex((h) => h.toLowerCase() === 'gender'),
        jabatan: header.findIndex((h) => h.toLowerCase() === 'jabatan'),
        divisi: header.findIndex((h) => h.toLowerCase() === 'divisi'),
        asal: header.findIndex((h) => h.toLowerCase() === 'asal'),
        tanggal_lahir: header.findIndex((h) => h.toLowerCase() === 'tanggal_lahir'),
      }
      if (idx.full_name < 0) return NextResponse.json({ ok: false, message: 'Kolom full_name wajib ada' }, { status: 400 })
      for (let i = 1; i < lines.length; i++) {
        const raw = lines[i]
        if (!raw.trim()) continue
        const cols = parseCsvLine(raw, header.length)
        rows.push({
          full_name: getVal(cols, idx.full_name),
          participant_code: idx.participant_code >= 0 ? getVal(cols, idx.participant_code) : '',
          email: idx.email >= 0 ? getVal(cols, idx.email) : '',
          phone: idx.phone >= 0 ? getVal(cols, idx.phone) : '',
          gender: idx.gender >= 0 ? getVal(cols, idx.gender) : '',
          jabatan: idx.jabatan >= 0 ? getVal(cols, idx.jabatan) : '',
          divisi: idx.divisi >= 0 ? getVal(cols, idx.divisi) : '',
          asal: idx.asal >= 0 ? getVal(cols, idx.asal) : '',
          tanggal_lahir: idx.tanggal_lahir >= 0 ? getVal(cols, idx.tanggal_lahir) : '',
        })
      }
    }

    // load event for acronym
    const { data: evt, error: evtErr } = await supabaseAdmin
      .from('events')
      .select('id, name')
      .eq('id', eventId)
      .single()
    if (evtErr) throw evtErr
    const eventName: string = (evt as any)?.name || 'EVENT'
    const eventAcronym = (title: string) => {
      const words = (title || '').toUpperCase().replace(/[^A-Z0-9\s]/g, '').trim().split(/\s+/)
      const letters = words.filter(w => /[A-Z]/.test(w)).slice(0, 2).map(w => w[0]).join('')
      const digits = ((title || '').match(/\d+/g) || []).join('').slice(0, 4)
      return (letters + digits).slice(0, 6) || 'EV'
    }
    const acr = eventAcronym(eventName)
    const rand4 = () => String(Math.floor(1000 + Math.random() * 9000))

    let success = 0
    let failed = 0
    const errors: Array<{ line: number; message: string }> = []

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      const full_name = (r.full_name || '').trim()
      const participant_code_raw = (r.participant_code || '').trim()
      const email = (r.email || '').trim()
      const phone = (r.phone || '').trim()
      const gender = (r.gender || '').trim()
      const jabatan = (r.jabatan || '').trim()
      const divisi = (r.divisi || '').trim()
      const asal = (r.asal || '').trim()
      const tanggal_lahir = (r.tanggal_lahir || '').trim()
      if (!full_name) { failed++; errors.push({ line: i + 2, message: 'full_name kosong' }); continue }

      const initials = full_name.trim().toUpperCase().split(/\s+/).map(p => p[0]).join('').slice(0, 2) || 'P'
      let finalCode = (participant_code_raw || '').trim()

      // ensure uniqueness per event
      const exists = async (code: string) => {
        const { error } = await supabaseAdmin
          .from('participants')
          .select('id', { head: true, count: 'exact' })
          .eq('event_id', eventId)
          .eq('participant_code', code)
        if (error) throw error
        return true // if no error, head returns ok and count is not accessible here; rely on upsert conflict
      }
      if (!finalCode) finalCode = `${acr}-${initials}-${rand4()}`

      try {
        const { error } = await supabaseAdmin
          .from('participants')
          .upsert(
            [{
              event_id: eventId,
              full_name,
              participant_code: finalCode,
              email: email || null,
              phone: phone || null,
              metadata: (() => {
                const m: any = {}
                if (gender) m.gender = gender
                if (jabatan) m.jabatan = jabatan
                if (divisi) m.divisi = divisi
                if (asal) m.asal = asal
                if (tanggal_lahir) m.tanggal_lahir = tanggal_lahir
                return Object.keys(m).length ? m : undefined
              })(),
            }],
            { onConflict: 'event_id,participant_code' }
          )
          .select('id')
        if (error) throw error
        success++
      } catch (e: any) {
        failed++
        errors.push({ line: i + 2, message: e?.message || 'Gagal menyimpan' })
      }
    }

    return NextResponse.json({ ok: true, data: { success, failed, errors } })
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || 'Gagal import CSV' }, { status: 400 })
  }
}

function getVal(cols: string[], idx: number) {
  if (idx < 0) return ''
  return (cols[idx] || '').trim().replace(/^"|"$/g, '')
}

// Basic CSV parser supporting quoted commas
function parseCsvLine(line: string, minCols: number) {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++ } else { inQuotes = !inQuotes }
    } else if (ch === ',' && !inQuotes) {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  while (out.length < minCols) out.push('')
  return out
}
