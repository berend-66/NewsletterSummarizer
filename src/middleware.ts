import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const password = process.env.AUTH_PASSWORD
  if (!password) return NextResponse.next()

  const authHeader = request.headers.get('authorization')
  if (authHeader) {
    const [scheme, encoded] = authHeader.split(' ')
    if (scheme === 'Basic' && encoded) {
      const decoded = atob(encoded)
      const [, pwd] = decoded.split(':')
      if (pwd === password) return NextResponse.next()
    }
  }

  const cookie = request.cookies.get('auth_token')
  if (cookie?.value === password) return NextResponse.next()

  if (request.nextUrl.pathname === '/api/auth/login') {
    return NextResponse.next()
  }

  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return new NextResponse('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Newsletter Digest"',
    },
  })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
