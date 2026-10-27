import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export const config = {
  matcher: ['/calendario', '/esercizi', '/inbox', '/lavagna', '/oggi', '/quaderno'],
}

export default function middleware(req: NextRequest): NextResponse {
  const session = req.cookies.get('session_id')
  if (!session) {
    return NextResponse.redirect(new URL('/api/auth/login', req.url))
  }
  return NextResponse.next()
}
