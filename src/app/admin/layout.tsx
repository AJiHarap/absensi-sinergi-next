"use client"

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabaseClient } from '@/lib/supabase/client'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    let mounted = true
    const run = async () => {
      try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined
        const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined
        if (!url || !anon) {
          console.error('Env Supabase (NEXT_PUBLIC_*) tidak tersedia. Pastikan sudah di-set di Vercel dan telah redeploy.')
          if (pathname !== '/admin/login') router.replace('/admin/login')
          return
        }
        const { data } = await supabaseClient.auth.getSession()
        if (!mounted) return
        const has = !!data.session
        setAuthed(has)
        // Do not require auth for /admin/login
        if (!has && pathname !== '/admin/login') {
          router.replace('/admin/login')
        }
      } finally {
        if (mounted) setChecking(false)
      }
    }
    run()
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined
    if (!url || !anon) return () => { mounted = false }
    const { data: sub } = supabaseClient.auth.onAuthStateChange((_e, session) => {
      setAuthed(!!session)
      if (!session && pathname !== '/admin/login') router.replace('/admin/login')
      if (session && pathname === '/admin/login') router.replace('/admin/events')
    })
    return () => { try { sub.subscription.unsubscribe() } catch {}; mounted = false }
  }, [pathname, router])

  // For /admin/login: render children directly (global Header + root main already active)
  if (pathname === '/admin/login') {
    return <>{children}</>
  }

  // While checking auth, render nothing (avoid layout jump)
  if (checking) {
    return null
  }

  // If not authed, component will redirect; render nothing meanwhile
  if (!authed) return null

  // Use global Header and root layout's main container; just render children
  return <>{children}</>
}
