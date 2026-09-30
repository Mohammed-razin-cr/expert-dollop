import { NextResponse } from 'next/server'
import { rpc } from '@/lib/auth/rpc'
import { buildSession } from '@/lib/auth/jwt'
import {
  recall, remember, singleFlight, RECHECK_DELAY_MS,
  type ConsumedToken,
} from '@/lib/auth/refreshGrace'

/**
 * POST /auth/v1/token?grant_type=password
 * POST /auth/v1/token?grant_type=refresh_token
 *
 * The GoTrue endpoint supabase-js uses for signInWithPassword() and for
 * silently refreshing an expired session.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GoTrue's error shape has changed across versions and supabase-js reads
 * whichever field it finds. Emit all of them so any client version shows
 * a sensible message instead of "undefined".
 */
function authError(message: string, status = 400, errorCode = 'invalid_grant') {
  return NextResponse.json(
    {
      code: status,
      error: errorCode,
      error_code: errorCode,
      error_description: message,
      msg: message,
      message,
    },
    { status },
  )
}

type AuthUser = { id: string; email?: string }

export async function POST(req: Request) {
  const grantType = new URL(req.url).searchParams.get('grant_type') ?? 'password'
  const body = await req.json().catch(() => null)
  if (!body) return authError('Malformed request body', 400, 'validation_failed')

  try {
    if (grantType === 'password') {
      const { email, password } = body
      if (!email || !password) {
        return authError('Email and password are required', 400, 'validation_failed')
      }

      const user = await rpc<AuthUser | null>('auth_sign_in', {
        p_email: String(email),
        p_password: String(password),
      })

      // Deliberately identical for "no such account", "no password set"
      // and "wrong password" — anything else reveals which addresses exist.
      if (!user) return authError('Invalid login credentials', 400, 'invalid_credentials')

      const refresh = await rpc<string>('auth_issue_refresh_token', { p_user: user.id })
      return NextResponse.json(buildSession(user, refresh))
    }

    if (grantType === 'refresh_token') {
      const token = body.refresh_token
      if (!token) return authError('refresh_token is required', 400, 'validation_failed')
      const presented = String(token)

      // Refreshes are not serialised: a page of server components, or a
      // second tab, can present the same token simultaneously. The database
      // function is single-use by design, so only one of them can win and
      // the rest would be told their session is dead. `refreshGrace` lets
      // the losers have the winner's session for a few seconds instead.
      const result = await singleFlight(presented, async (): Promise<ConsumedToken | null> => {
        const replayed = await recall(presented)
        if (replayed) return replayed

        // Single-use: this revokes the presented token and returns a new one.
        const fresh = await rpc<ConsumedToken | null>('auth_consume_refresh_token', {
          p_token: presented,
        })
        if (fresh) {
          await remember(presented, fresh)
          return fresh
        }

        // Nothing matched. Either the token is genuinely spent, or another
        // instance consumed it a moment ago and has not finished writing the
        // result yet. Look once more before calling it a dead session — this
        // delay is only ever paid on a refresh that is about to fail.
        await new Promise((r) => setTimeout(r, RECHECK_DELAY_MS))
        return recall(presented)
      })

      if (!result) return authError('Invalid Refresh Token', 400, 'refresh_token_not_found')

      return NextResponse.json(buildSession(result.user, result.refresh_token))
    }

    return authError(`Unsupported grant_type: ${grantType}`, 400, 'unsupported_grant_type')
  } catch (e) {
    console.error('[auth/token]', e)
    return authError('Authentication service error', 500, 'internal_error')
  }
}
