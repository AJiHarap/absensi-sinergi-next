import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// DELETE /api/admin/events/[id]
export async function DELETE(_req: NextRequest, context: any) {
  try {
    const { params } = (context || {}) as { params: { id: string } }
    const eventId = params.id

    // This will cascade delete participants, seats, seat_assignments, attendance_logs due to FK ON DELETE CASCADE in schema
    const { error } = await supabaseAdmin
      .from('events')
      .delete()
      .eq('id', eventId)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || 'Gagal menghapus event' }, { status: 400 })
  }
}
