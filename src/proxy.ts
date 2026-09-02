import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/', '/formations', '/verify', '/login', '/register', '/forgot-password']
const ADMIN_PATHS = ['/admin']
const DASHBOARD_PATHS = ['/dashboard']

export default auth(function middleware(req: NextRequest & { auth: { user?: { role?: string } } | null }) {
  const { pathname } = req.nextUrl
  const session = req.auth

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  )

  // Let API routes and Next internals pass
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next()
  }

  // Not authenticated → redirect to login (except public)
  if (!session?.user && !isPublic) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Admin routes → require ADMIN role (server-side, not just UI)
  if (ADMIN_PATHS.some((p) => pathname.startsWith(p))) {
    if (session?.user?.role !== 'ADMIN' && session?.user?.role !== 'INSTRUCTOR') {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
  }

  // Dashboard routes → require auth
  if (DASHBOARD_PATHS.some((p) => pathname.startsWith(p))) {
    if (!session?.user) {
      return NextResponse.redirect(new URL('/login', req.url))
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public/).*)'],
}
