import { NextResponse } from 'next/server'
import { createClient } from '@/lib/api/server'

/**
 * POST /auth/signout
 *
 * Clears the session cookies and sends the browser to /login.
 *
 * The Location header is deliberately relative. `new URL('/login',
 * request.url)` looks equivalent, but behind Railway's proxy the standalone
 * server sees its own bind address rather than the public host, so the
 * absolute URL came out as `https://0.0.0.0:3000/login` — the browser then
 * failed to load it and showed an error page instead of the login screen.
 * A relative Location is resolved by the browser against the address it
 * actually requested, so it is correct on every host without the app having
 * to be told its own origin.
 */
export async function POST() {
  const supabase = await createClient()

  // A logout button must land on /login even if the revoke call fails —
  // the cookies are cleared either way, so there is nothing to report.
  try {
    await supabase.auth.signOut()
  } catch (e) {
    console.error('[auth/signout]', e)
  }

  return new NextResponse(null, { status: 303, headers: { Location: '/login' } })
}
