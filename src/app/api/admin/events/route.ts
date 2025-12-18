import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/server'

const CreateEventSchema = z.object({
  name: z.string().min(1),
  start_at: z.string().optional(),
  end_at: z.string().optional(),
  is_active: z.boolean().optional().default(true),
})

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('events')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, data })
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json()
    const body = CreateEventSchema.parse(json)
    const { data, error } = await supabaseAdmin
      .from('events')
      .insert({
        name: body.name,
        start_at: body.start_at ? new Date(body.start_at).toISOString() : null,
        end_at: body.end_at ? new Date(body.end_at).toISOString() : null,
        is_active: body.is_active,
      })
      .select('id')
      .single()
    if (error) throw error
    return NextResponse.json({ ok: true, data })
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || 'Gagal membuat event' }, { status: 400 })
  }
}
