import { NextResponse } from 'next/server'
import { verifyJwt } from '@/lib/auth/jwt'

/**
 * Rejects a request that isn't carrying a service_role token.
 *
 * Returns the 403 response to send, or null when the caller may proceed.
 *
 * Lives here rather than in a route file because a Next route module may
 * only export the HTTP verb handlers and a fixed set of config values —
 * exporting a helper alongside them fails the generated route type check.
 */
export function requireServiceRole(req: Request): NextResponse | null {
  const header = req.headers.get('authorization') ?? ''
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : ''
  const claims = token ? verifyJwt(token) : null

  if (claims?.role !== 'service_role') {
    return NextResponse.json(
      { code: 403, error: 'forbidden', error_code: 'not_admin', msg: 'User not allowed' },
      { status: 403 },
    )
  }
  return null
}
