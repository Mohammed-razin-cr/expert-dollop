import { NextResponse } from 'next/server'
import { rpc, RpcError } from '@/lib/auth/rpc'
import { requireServiceRole } from '@/lib/auth/serviceRole'

/**
 * POST /auth/v1/admin/users
 *
 * Backs supabase.auth.admin.createUser(), called from /api/users when an
 * admin adds a staff member.
 *
 * Requires a service_role token. That key lives only on the server, so a
 * browser cannot reach this even with a valid user session.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const denied = requireServiceRole(req)
  if (denied) return denied

  const body = await req.json().catch(() => null)
  if (!body?.email || !body?.password) {
    return NextResponse.json(
      { code: 400, error: 'validation_failed', msg: 'Email and password are required' },
      { status: 400 },
    )
  }

  const meta = body.user_metadata ?? {}

  try {
    const user = await rpc('auth_create_user', {
      p_email: String(body.email),
      p_password: String(body.password),
      p_full_name: String(meta.full_name ?? ''),
      p_role: String(meta.role ?? 'student'),
    })
    return NextResponse.json(user)
  } catch (e) {
    if (e instanceof RpcError && e.code === '23505') {
      return NextResponse.json(
        {
          code: 422,
          error: 'email_exists',
          error_code: 'email_exists',
          msg: 'A user with this email address has already been registered',
        },
        { status: 422 },
      )
    }
    console.error('[auth/admin/users POST]', e)
    return NextResponse.json(
      { code: 500, error: 'internal_error', msg: 'Could not create user' },
      { status: 500 },
    )
  }
}
