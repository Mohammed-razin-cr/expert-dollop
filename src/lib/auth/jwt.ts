import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto'
import { envVar } from '@/lib/api/env'

/**
 * HS256 sign/verify, using the same secret PostgREST verifies with.
 * Node's crypto is enough here, so this adds no dependency.
 *
 * SERVER ONLY — never import from a client component.
 */

const b64url = (buf: Buffer | string) =>
  Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

const b64urlDecode = (s: string) =>
  Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')

export type Claims = {
  sub: string
  email?: string
  /** Must be 'authenticated' — PostgREST SET ROLEs to this. */
  role: string
  aud: string
  iat: number
  exp: number
  session_id?: string
  app_metadata?: Record<string, unknown>
  user_metadata?: Record<string, unknown>
}

export function jwtSecret(): string {
  const s = envVar('JWT_SECRET')
  if (!s) throw new Error('JWT_SECRET is not set')
  return s
}

export function signJwt(payload: Record<string, unknown>, secret = jwtSecret()): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = b64url(JSON.stringify(payload))
  const sig = b64url(createHmac('sha256', secret).update(`${header}.${body}`).digest())
  return `${header}.${body}.${sig}`
}

/** Returns the claims, or null if the token is malformed, mis-signed or expired. */
export function verifyJwt(token: string, secret = jwtSecret()): Claims | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [header, body, sig] = parts

  const expected = createHmac('sha256', secret).update(`${header}.${body}`).digest()
  let given: Buffer
  try {
    given = Buffer.from(sig.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
  } catch {
    return null
  }
  // Compare in constant time; lengths must match first or timingSafeEqual throws.
  if (given.length !== expected.length) return null
  if (!timingSafeEqual(given, expected)) return null

  let claims: Claims
  try {
    claims = JSON.parse(b64urlDecode(body))
  } catch {
    return null
  }
  if (typeof claims.exp === 'number' && claims.exp <= Math.floor(Date.now() / 1000)) return null
  return claims
}

/** Access-token lifetime in seconds. */
export const ACCESS_TOKEN_TTL = Number(
  process.env.JWT_EXPIRY ?? process.env.SUPABASE_JWT_EXPIRY ?? 3600,
)

type AuthUser = {
  id: string
  email?: string
  app_metadata?: Record<string, unknown>
  user_metadata?: Record<string, unknown>
}

/**
 * Build the session object supabase-js expects back from
 * POST /auth/v1/token. The `role: 'authenticated'` claim is what makes
 * PostgREST switch roles and apply the RLS policies.
 */
export function buildSession(user: AuthUser, refreshToken: string) {
  const now = Math.floor(Date.now() / 1000)
  const exp = now + ACCESS_TOKEN_TTL
  const access_token = signJwt({
    sub: user.id,
    email: user.email,
    role: 'authenticated',
    aud: 'authenticated',
    iat: now,
    exp,
    session_id: randomUUID(),
    app_metadata: user.app_metadata ?? {},
    user_metadata: user.user_metadata ?? {},
  })

  return {
    access_token,
    token_type: 'bearer',
    expires_in: ACCESS_TOKEN_TTL,
    expires_at: exp,
    refresh_token: refreshToken,
    user,
  }
}
