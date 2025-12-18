import { NextResponse, type NextRequest } from 'next/server'

// Protect /admin routes by checking Supabase auth cookies exist
// Allows: /admin/login and static/assets
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  const isAdminPage = pathname.startsWith('/admin')
  const isAdminApi = pathname.startsWith('/api/admin')

  if (!isAdminPage && !isAdminApi) {
    return NextResponse.next()
  }

  // Allow login page without auth
  if (pathname.startsWith('/admin/login') || pathname.startsWith('/admin/register')) {
    return NextResponse.next()
  }

  // Heuristic: Supabase sets cookies named `sb-<project-ref>-auth-token` for v2
  // which contain access/refresh tokens JSON. If missing -> not logged in.
  const hasSbAuth = req.cookies.getAll().some((c) => c.name.includes('-auth-token') && c.name.startsWith('sb-'))

  if (!hasSbAuth) {
    // For API requests, return 401 JSON
    if (isAdminApi) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 })
    }
    // For pages, redirect to login
    const url = req.nextUrl.clone()
    url.pathname = '/admin/login'
    url.searchParams.set('redirectedFrom', pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
}
