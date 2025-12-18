import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const eventId = params.id
  const { searchParams } = new URL(req.url)
  const code = (searchParams.get('code') || '').trim()
  if (!code) return NextResponse.json({ ok: false, message: 'code is required' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('participants')
    .select('id, participant_code')
    .eq('event_id', eventId)
    .eq('participant_code', code)
    .limit(1)
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 400 })

  return NextResponse.json({ ok: true, exists: (data?.length ?? 0) > 0, id: data?.[0]?.id || null })
}
