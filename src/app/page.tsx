"use client"

import { useEffect, useState } from 'react'
import { supabaseClient } from '@/lib/supabase/client'

export default function HomePage() {
  const [hasSession, setHasSession] = useState<boolean | null>(null)

  useEffect(() => {
    let mounted = true
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined
    if (!url || !anon) {
      console.error('Env Supabase (NEXT_PUBLIC_*) tidak tersedia di client. Menyembunyikan tombol admin.');
      setHasSession(false)
      return () => { mounted = false }
    }
    supabaseClient.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setHasSession(!!data.session)
    })
    const { data: sub } = supabaseClient.auth.onAuthStateChange((_e, session) => {
      setHasSession(!!session)
    })
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  return (
    <div className="space-y-10">
      <section className="rounded-xl overflow-hidden brand-gradient bg-white border">
        <div className="px-6 py-12 sm:px-10 sm:py-16 flex flex-col items-center text-center gap-6">
          <img src="/logo-sinergi.png" alt="Logo" className="h-16 sm:h-20 object-contain" />
          <h1 className="text-3xl sm:text-4xl font-semibold text-gray-900">
            Sistem Absensi QR Berkelas
          </h1>
          <p className="max-w-2xl text-gray-600">
            Aplikasi absensi canggih untuk event: cepat, akurat, realtime, dan mudah digunakan dari perangkat apa pun.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <a href="/scan" className="btn btn-dark">Mulai Scan</a>
            {!hasSession && (
              <a href="/admin/login" className="btn btn-gold">Masuk Admin</a>
            )}
          </div>
        </div>
      </section>

      {hasSession && (
        <section className="grid sm:grid-cols-3 gap-4">
          <div className="card">
            <div className="card-header font-medium text-gray-800">Kelola Event</div>
            <div className="card-body text-sm text-gray-600">Buat dan aktifkan event, atur kursi dan meja, serta pantau kehadiran.</div>
          </div>
          <div className="card">
            <div className="card-header font-medium text-gray-800">Import/Export</div>
            <div className="card-body text-sm text-gray-600">Import peserta dari CSV, unduh laporan kehadiran, dan QR massal.</div>
          </div>
          <div className="card">
            <div className="card-header font-medium text-gray-800">Scan Tanpa Ribet</div>
            <div className="card-body text-sm text-gray-600">Scan cukup dengan kode peserta. Sistem otomatis mendeteksi event aktif.</div>
          </div>
        </section>
      )}
    </div>
  )
}
