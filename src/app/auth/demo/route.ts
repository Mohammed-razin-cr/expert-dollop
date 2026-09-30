import { NextResponse, type NextRequest } from 'next/server'
import { DEMO_EMAIL, DEMO_SESSION_COOKIE, isDemoMode } from '@/lib/demo'

const DEMO_PASSWORD = 'Electrobtech@123'

export async function POST(request: NextRequest) {
  if (!isDemoMode()) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  if (email !== DEMO_EMAIL || password !== DEMO_PASSWORD) {
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set(DEMO_SESSION_COOKIE, 'active', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 12,
  })
  return response
}
