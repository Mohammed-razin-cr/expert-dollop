import { NextResponse } from 'next/server'
import { rpc } from '@/lib/auth/rpc'
import { verifyJwt } from '@/lib/auth/jwt'

/**
 * GET /auth/v1/user
 *
 * Backs supabase.auth.getUser(), which the app calls on essentially every
 * page (38 call sites) and in the session middleware.
 *
 * The user is re-read from the database rather than reconstructed from the
 * token, so an account deleted mid-session stops authenticating
 * immediately instead of lasting until the token expires.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function unauthorized(message = 'invalid claim: missing sub claim') {
  return NextResponse.json(
    { code: 401, error: 'unauthorized', error_code: 'bad_jwt', msg: message, message },
    { status: 401 },
  )
}

export async function GET(req: Request) {
  const header = req.headers.get('authorization') ?? ''
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : ''
  if (!token) return unauthorized('missing authorization header')

  const claims = verifyJwt(token)
  if (!claims?.sub) return unauthorized()

  try {
    const user = await rpc<unknown | null>('auth_get_user', { p_id: claims.sub })
    if (!user) return unauthorized('user not found')
    return NextResponse.json(user)
  } catch (e) {
    console.error('[auth/user]', e)
    return NextResponse.json(
      { code: 500, error: 'internal_error', msg: 'Authentication service error' },
      { status: 500 },
    )
  }
}
