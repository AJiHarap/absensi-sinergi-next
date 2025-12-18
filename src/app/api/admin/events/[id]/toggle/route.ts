import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/server'

const PatchSchema = z.object({ is_active: z.boolean() })

export async function PATCH(req: NextRequest, context: any) {
  try {
    const { params } = (context || {}) as { params: { id: string } }
    const body = PatchSchema.parse(await req.json())
    const { error } = await supabaseAdmin
      .from('events')
      .update({ is_active: body.is_active })
      .eq('id', params.id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || 'Gagal update status' }, { status: 400 })
  }
}
