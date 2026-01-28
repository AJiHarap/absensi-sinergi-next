"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabaseClient } from '@/lib/supabase/client'

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabaseClient.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/admin')
    })
  }, [router])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    router.replace('/admin')
  }

  return (
    <main className="max-w-md mx-auto">
      <div className="flex items-center justify-center mb-3">
        <Image src="/logo-sinergi.png" alt="Logo" width={56} height={56} style={{ objectFit: 'contain' }} />
      </div>
      <h1 className="text-2xl font-semibold mb-2 text-center">Login Admin</h1>
      <p className="text-center text-gray-600 text-sm mb-4">Masuk untuk mengelola event, peserta, dan kehadiran.</p>
      <form onSubmit={onSubmit} className="space-y-4 bg-white p-6 rounded border shadow-sm">
        <div>
          <label className="block text-sm mb-1">Email</label>
          <input
            type="email"
            className="w-full rounded border px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Password</label>
          <input
            type="password"
            className="w-full rounded border px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-blue-600 hover:bg-blue-700 transition text-white px-4 py-2 disabled:opacity-60"
        >
          {loading ? 'Masuk…' : 'Masuk'}
        </button>
      </form>
      <p className="text-center text-xs text-gray-500 mt-3">Lupa akun? Hubungi admin sistem untuk bantuan.</p>
    </main>
  )
}
