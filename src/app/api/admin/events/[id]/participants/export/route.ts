import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

function toCsvRow(fields: (string | number | null | undefined)[]) {
  return fields
    .map((v) => {
      if (v === null || v === undefined) return ''
      const s = String(v)
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return '"' + s.replace(/"/g, '""') + '"'
      }
      return s
    })
    .join(',')
}

export async function GET(_req: NextRequest, context: any) {
  const { params } = (context || {}) as { params: { id: string } }
  const eventId = params.id

  const { data, error } = await supabaseAdmin
    .from('participants')
    .select('id, full_name, email, phone, participant_code, metadata')
    .eq('event_id', eventId)
    .order('full_name', { ascending: true })

  if (error) return new Response(`Error: ${error.message}`, { status: 400 })

  const header = ['id', 'full_name', 'email', 'phone', 'participant_code', 'gender']
  const rows: string[] = []
  rows.push(toCsvRow(header))
  for (const p of data || []) {
    rows.push(
      toCsvRow([
        (p as any).id,
        (p as any).full_name,
        (p as any).email,
        (p as any).phone,
        (p as any).participant_code,
        ((p as any).metadata?.gender === 'L' ? 'L' : (p as any).metadata?.gender === 'P' ? 'P' : ''),
      ])
    )
  }

  const csv = rows.join('\n')
  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="participants_${eventId}.csv"`,
    },
  })
}
