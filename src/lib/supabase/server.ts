import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Lazy initialize the Supabase admin client so that importing this module
// during Next.js build (when env vars may not be injected) does not throw.
let _admin: SupabaseClient | null = null

function ensureAdmin(): SupabaseClient {
  if (_admin) return _admin
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('supabaseUrl is required.')
  }
  _admin = createClient(url, key, { auth: { persistSession: false } })
  return _admin
}

// Export a proxy so existing code can keep calling supabaseAdmin.from(...)
export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = ensureAdmin()
    // @ts-expect-error dynamic property access passthrough
    const value = (client as any)[prop]
    return typeof value === 'function' ? value.bind(client) : value
  },
})
