"use client"

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabaseClient } from '@/lib/supabase/client'

export default function Header() {
  const [hasSession, setHasSession] = useState<boolean | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    let mounted = true
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined
    if (!url || !anon) {
      console.error('Env Supabase tidak tersedia di client. Pastikan NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY di-set di Vercel.');
      setHasSession(false)
      return () => { mounted = false }
    }
    supabaseClient.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setHasSession(!!data.session)
      setUserEmail(data.session?.user?.email ?? null)
    })
    const { data: sub } = supabaseClient.auth.onAuthStateChange((_e, session) => {
      setHasSession(!!session)
      setUserEmail(session?.user?.email ?? null)
    })
    return () => {
      mounted = false
      try { sub.subscription.unsubscribe() } catch {}
    }
  }, [])

  const onLogout = async () => {
    const ok = typeof window !== 'undefined' ? window.confirm('Yakin ingin keluar dari akun admin?') : true
    if (!ok) return
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined
    if (!url || !anon) return
    await supabaseClient.auth.signOut()
    router.push('/')
  }

  // Show header on all pages, including admin routes

  return (
    <header className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur shadow-sm">
      <div className="container py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 min-w-0">
          <img src="/logo-sinergi.png" alt="Logo" className="h-8 w-auto object-contain" />
          {/* brand text removed as requested */}
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-4 text-sm">
          <Link className="hover:underline" href="/">Beranda</Link>
          <Link className="hover:underline" href="/scan">Scan</Link>
          {hasSession === null ? null : hasSession ? (
            <>
              <Link className="hover:underline" href="/admin/events">Event</Link>
              {userEmail && <span className="text-gray-600 truncate max-w-[220px]">{userEmail}</span>}
              <button onClick={onLogout} className="btn btn-outline btn-sm">Keluar</button>
            </>
          ) : (
            <Link className="hover:underline" href="/admin/login">Masuk Admin</Link>
          )}
        </nav>

        {/* Mobile toggler */}
        <button
          className="md:hidden inline-flex items-center justify-center rounded border px-3 py-2"
          aria-label="Toggle menu"
          onClick={() => setMenuOpen((v) => !v)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t bg-white/90 backdrop-blur">
          <div className="container py-2 flex flex-col gap-2 text-sm">
            <Link className="py-2" href="/" onClick={() => setMenuOpen(false)}>Beranda</Link>
            <Link className="py-2" href="/scan" onClick={() => setMenuOpen(false)}>Scan</Link>
            {hasSession ? (
              <>
                <Link className="py-2" href="/admin/events" onClick={() => setMenuOpen(false)}>Event</Link>
                {userEmail && <span className="py-1 text-gray-600">{userEmail}</span>}
                <button onClick={() => { setMenuOpen(false); onLogout() }} className="btn btn-outline btn-sm self-start">Keluar</button>
              </>
            ) : (
              <Link className="py-2" href="/admin/login" onClick={() => setMenuOpen(false)}>Masuk Admin</Link>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
