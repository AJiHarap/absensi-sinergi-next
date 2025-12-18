import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/server'

const BodySchema = z.object({ userId: z.string().min(1) })

// Provision the very first admin account. Safe because Service Role bypasses RLS.
// Logic: if admins table is empty, insert the given userId as admin.
export async function POST(req: NextRequest) {
  try {
    const { userId } = BodySchema.parse(await req.json())

    // Check if there is any admin already
    const { data: existing, error: countErr } = await supabaseAdmin
      .from('admins')
      .select('id', { count: 'exact', head: true })
    if (countErr) throw countErr

    // If count is 0, allow provisioning
    // Note: select with head:true returns no rows; we use error to detect issues, not count.
    // Supabase JS v2 doesn't return count when head:true; as a fallback, do a normal select limited.
    if (existing === null) {
      const { data: admins, error: listErr } = await supabaseAdmin
        .from('admins')
        .select('id')
        .limit(1)
      if (listErr) throw listErr
      if ((admins?.length ?? 0) > 0) {
        return NextResponse.json({ ok: false, message: 'Admin sudah ada' }, { status: 403 })
      }
    }

    const { error: insertErr } = await supabaseAdmin
      .from('admins')
      .insert({ id: userId, role: 'admin' })
    if (insertErr) throw insertErr

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message || 'Provision gagal' }, { status: 400 })
  }
}
