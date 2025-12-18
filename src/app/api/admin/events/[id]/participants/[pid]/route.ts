import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { z } from 'zod'

const PatchSchema = z.object({
  full_name: z.string().min(1).optional(),
  participant_code: z.string().min(1).optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  gender: z.enum(['L', 'P']).nullable().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string; pid: string } }) {
  try {
    const eventId = params.id
    const pid = params.pid
    const body = PatchSchema.parse(await req.json())

    const updates: any = {}
    if (body.full_name !== undefined) updates.full_name = body.full_name
    if (body.participant_code !== undefined) updates.participant_code = body.participant_code
    if (body.email !== undefined) updates.email = body.email
    if (body.phone !== undefined) updates.phone = body.phone

    // Merge metadata.gender if provided
    if (body.gender !== undefined) {
      const { data: existing } = await supabaseAdmin
        .from('participants')
        .select('metadata')
        .eq('event_id', eventId)
        .eq('id', pid)
        .single()
      const currentMeta = (existing?.metadata as any) || {}
      updates.metadata = { ...currentMeta, gender: body.gender }
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

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; pid: string } }) {
  try {
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
