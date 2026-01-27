import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { z } from 'zod'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest, context: any) {
  const { params } = (context || {}) as { params: { id: string } }
  const eventId = params.id
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim()
  const sort = (searchParams.get('sort') || 'full_name.asc').trim()
  const page = Math.max(1, Number(searchParams.get('page') || '1'))
  const pageSize = Math.max(1, Math.min(100, Number(searchParams.get('pageSize') || '20')))
  const exportType = (searchParams.get('export') || '').trim() // 'csv' | 'excel'

  // parse sort as column.direction, fallback to full_name.asc
  let [col, dir] = sort.split('.')
  const allowedCols = new Set(['full_name', 'participant_code', 'email'])
  if (!allowedCols.has(col)) col = 'full_name'
  const ascending = dir !== 'desc'

  let query = supabaseAdmin
    .from('participants')
    .select('id, full_name, email, phone, participant_code, metadata', { count: 'exact' })
    .eq('event_id', eventId)

  if (q) {
    // Single OR across all desired fields (including metadata JSONB text fields)
    const like = `%${q}%`
    query = (query as any).or([
      `full_name.ilike.${like}`,
      `participant_code.ilike.${like}`,
      `email.ilike.${like}`,
      `phone.ilike.${like}`,
      `metadata->>jabatan.ilike.${like}`,
      `metadata->>divisi.ilike.${like}`,
      `metadata->>asal.ilike.${like}`,
      `metadata->>tanggal_lahir.ilike.${like}`,
    ].join(','))
  }

  // Export flow (ignore pagination)
  if (exportType === 'csv' || exportType === 'excel') {
    const { data, error } = await query.order(col as any, { ascending })
    if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 400 })
    const rows = (data || []).map((r: any) => ({
      full_name: r.full_name || '',
      participant_code: r.participant_code || '',
      email: r.email || '',
      phone: r.phone || '',
      gender: r.metadata?.gender || '',
      jabatan: r.metadata?.jabatan || '',
      divisi: r.metadata?.divisi || '',
      asal: r.metadata?.asal || '',
      tanggal_lahir: r.metadata?.tanggal_lahir || '',
    }))
    if (exportType === 'csv') {
      const header = 'full_name,participant_code,email,phone,gender,jabatan,divisi,asal,tanggal_lahir\n'
      const csv = header + rows.map(r => [
        JSON.stringify(r.full_name),
        JSON.stringify(r.participant_code),
        JSON.stringify(r.email),
        JSON.stringify(r.phone),
        JSON.stringify(r.gender),
        JSON.stringify(r.jabatan),
        JSON.stringify(r.divisi),
        JSON.stringify(r.asal),
        JSON.stringify(r.tanggal_lahir),
      ].join(',')).join('\n')
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="participants_${eventId}.csv"`,
        },
      })
    } else {
      // Build real XLSX workbook
      const header = ['full_name','participant_code','email','phone','gender','jabatan','divisi','asal','tanggal_lahir']
      const aoa: any[][] = [header]
      for (const r of rows) {
        aoa.push([r.full_name, r.participant_code, r.email, r.phone, r.gender, r.jabatan, r.divisi, r.asal, r.tanggal_lahir])
      }
      const ws = XLSX.utils.aoa_to_sheet(aoa)
      // Set simple column widths
      ;(ws as any)['!cols'] = [
        { wch: 28 }, // full_name
        { wch: 22 }, // code
        { wch: 28 }, // email
        { wch: 16 }, // phone
        { wch: 10 }, // gender
        { wch: 18 }, // jabatan
        { wch: 18 }, // divisi
        { wch: 18 }, // asal
        { wch: 14 }, // tanggal_lahir
      ]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Participants')
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
      return new NextResponse(buf as any, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="participants_${eventId}.xlsx"`,
          'Cache-Control': 'no-store',
        },
      })
    }
  }

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const { data, error, count } = await query
    .order(col as any, { ascending })
    .range(from, to)
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, data, page, pageSize, total: count ?? 0 })
}

const PostSchema = z.object({
  full_name: z.string().min(1),
  participant_code: z.string().optional().nullable(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  gender: z.enum(['L', 'P']).nullable().optional(), // L = Laki-laki, P = Perempuan
  jabatan: z.string().nullable().optional(),
  divisi: z.string().nullable().optional(),
  asal: z.string().nullable().optional(),
  tanggal_lahir: z.string().nullable().optional(),
})

export async function POST(req: NextRequest, context: any) {
  try {
    const { params } = (context || {}) as { params: { id: string } }
    const eventId = params.id
    const { full_name, participant_code, email, phone, gender, jabatan, divisi, asal, tanggal_lahir } = PostSchema.parse(await req.json())

    // Build event acronym for server-side code generation
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
    const initials = full_name.trim().toUpperCase().split(/\s+/).map(p => p[0]).join('').slice(0, 2) || 'P'
    const rand4 = () => String(Math.floor(1000 + Math.random() * 9000))

    // Ensure unique participant_code per event
    let finalCode = (participant_code || '').trim()
    let attempts = 0
    const exists = async (code: string) => {
      const { data: hit, error: hitErr } = await supabaseAdmin
        .from('participants')
        .select('id', { head: true, count: 'exact' })
        .eq('event_id', eventId)
        .eq('participant_code', code)
      if (hitErr) throw hitErr
      return (hit as any) !== null
    }

    if (!finalCode) finalCode = `${acr}-${initials}-${rand4()}`
    while (attempts < 5 && (await exists(finalCode))) {
      finalCode = `${acr}-${initials}-${rand4()}`
      attempts++
    }

    const meta: any = {}
    if (typeof gender === 'string') meta.gender = gender
    if (jabatan !== undefined) meta.jabatan = jabatan || null
    if (divisi !== undefined) meta.divisi = divisi || null
    if (asal !== undefined) meta.asal = asal || null
    if (tanggal_lahir !== undefined) meta.tanggal_lahir = tanggal_lahir || null

    const { data, error } = await supabaseAdmin
      .from('participants')
      .upsert(
        [{ event_id: eventId, full_name, participant_code: finalCode, email: email ?? null, phone: phone ?? null, metadata: Object.keys(meta).length ? meta : undefined }],
        { onConflict: 'event_id,participant_code' }
      )
      .select('id')
      .single()
    if (error) throw error
    return NextResponse.json({ ok: true, data })
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || 'Gagal menyimpan peserta' }, { status: 400 })
  }
}

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
