import { NextResponse } from 'next/server'
import { rpc } from '@/lib/auth/rpc'
import { verifyJwt } from '@/lib/auth/jwt'

/**
 * POST /auth/v1/logout
 *
 * Backs supabase.auth.signOut(). Revokes the user's refresh tokens so the
 * session cannot be silently resurrected by a refresh.
 *
 * Always answers 204, even for a bad or absent token: signing out is not
 * an operation a caller should be able to probe for validity.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const header = req.headers.get('authorization') ?? ''
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : ''

  if (token) {
    const claims = verifyJwt(token)
    if (claims?.sub) {
      try {
        await rpc('auth_revoke_user_tokens', { p_user: claims.sub })
      } catch (e) {
        // The client is signing out regardless; log and move on.
        console.error('[auth/logout]', e)
      }
    }
  }

  return new NextResponse(null, { status: 204 })
}
