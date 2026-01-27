import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { z } from 'zod'

const PatchSchema = z.object({
  full_name: z.string().min(1).optional(),
  participant_code: z.string().min(1).optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  gender: z.enum(['L', 'P']).nullable().optional(),
  jabatan: z.string().nullable().optional(),
  divisi: z.string().nullable().optional(),
  asal: z.string().nullable().optional(),
  tanggal_lahir: z.string().nullable().optional(),
})

export async function PATCH(req: NextRequest, context: any) {
  try {
    const { params } = (context || {}) as { params: { id: string; pid: string } }
    const eventId = params.id
    const pid = params.pid
    const body = PatchSchema.parse(await req.json())

    const updates: any = {}
    if (body.full_name !== undefined) updates.full_name = body.full_name
    if (body.participant_code !== undefined) updates.participant_code = body.participant_code
    if (body.email !== undefined) updates.email = body.email
    if (body.phone !== undefined) updates.phone = body.phone

    // Merge metadata fields if provided
    if (body.gender !== undefined || body.jabatan !== undefined || body.divisi !== undefined || body.asal !== undefined || body.tanggal_lahir !== undefined) {
      const { data: existing } = await supabaseAdmin
        .from('participants')
        .select('metadata')
        .eq('event_id', eventId)
        .eq('id', pid)
        .single()
      const currentMeta = (existing?.metadata as any) || {}
      const nextMeta: any = { ...currentMeta }
      if (body.gender !== undefined) nextMeta.gender = body.gender
      if (body.jabatan !== undefined) nextMeta.jabatan = body.jabatan || null
      if (body.divisi !== undefined) nextMeta.divisi = body.divisi || null
      if (body.asal !== undefined) nextMeta.asal = body.asal || null
      if (body.tanggal_lahir !== undefined) nextMeta.tanggal_lahir = body.tanggal_lahir || null
      updates.metadata = nextMeta
    }

    const { error } = await supabaseAdmin
      .from('participants')
      .update(updates)
      .eq('event_id', eventId)
      .eq('id', pid)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || 'Gagal mengubah peserta' }, { status: 400 })
  }
}

export async function DELETE(_req: NextRequest, context: any) {
  try {
    const { params } = (context || {}) as { params: { id: string; pid: string } }
    const eventId = params.id
    const pid = params.pid

    // Also cascade delete seat assignment if any (seat_assignments has FK ON DELETE CASCADE to participants in schema?)
    // Our schema sets seat_assignments.participant_id REFERENCES participants(id) ON DELETE CASCADE
    const { error } = await supabaseAdmin
      .from('participants')
      .delete()
      .eq('event_id', eventId)
      .eq('id', pid)
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || 'Gagal menghapus peserta' }, { status: 400 })
  }
}
