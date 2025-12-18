"use client"

import { useState } from 'react'
import { supabaseClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function AdminRegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setLoading(true)
    try {
      const { data, error } = await supabaseClient.auth.signUp({ email, password })
      if (error) throw error

      const userId = data.user?.id
      const hasSession = !!data.session

      if (!userId) {
        setMessage('Pendaftaran berhasil. Silakan cek email Anda untuk konfirmasi, lalu login kembali.')
        return
      }

      // Provision as admin for the first user (server will only allow when no admin exists)
      const resp = await fetch('/api/admin/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const json = await resp.json()
      if (!json.ok) {
        // Not fatal; user created but not provisioned as admin. They may need to be whitelisted later.
        setMessage('Akun dibuat. Silakan login. (Catatan: provisioning admin mungkin perlu dilakukan oleh admin lain)')
      }

      if (hasSession) {
        router.replace('/admin')
      } else {
        setMessage('Pendaftaran berhasil. Silakan cek email Anda untuk konfirmasi, lalu login kembali.')
      }
    } catch (e: any) {
      setError(e?.message || 'Gagal membuat akun')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="max-w-md mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Daftar Admin Pertama</h1>
        <p className="text-sm text-gray-600 mt-1">Gunakan ini untuk membuat akun admin pertama. Setelah ada admin, pendaftaran bisa ditutup atau dibatasi.</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4 bg-white p-6 rounded border">
        <div>
          <label className="block text-sm mb-1">Email</label>
          <input type="email" className="w-full rounded border px-3 py-2" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm mb-1">Password</label>
          <input type="password" className="w-full rounded border px-3 py-2" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>}
        {message && <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded p-2">{message}</div>}
        <button type="submit" disabled={loading} className="w-full rounded bg-blue-600 text-white px-4 py-2 disabled:opacity-60">
          {loading ? 'Mendaftarkan…' : 'Daftar'}
        </button>
      </form>

      <div className="text-center text-sm text-gray-600">
        Sudah punya akun? <a href="/admin/login" className="text-blue-700 underline">Masuk di sini</a>
      </div>
    </main>
  )
}
