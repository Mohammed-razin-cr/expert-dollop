import { NextResponse } from 'next/server'
import { rpc } from '@/lib/auth/rpc'
import { requireServiceRole } from '@/lib/auth/serviceRole'

/**
 * DELETE /auth/v1/admin/users/:id
 *
 * Backs supabase.auth.admin.deleteUser(), called from /api/users.
 * Deleting the auth user cascades to public.profiles via profiles_id_fkey.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = requireServiceRole(req)
  if (denied) return denied

  const { id } = await ctx.params

  try {
    const ok = await rpc<boolean>('auth_delete_user', { p_id: id })
    if (!ok) {
      return NextResponse.json(
        { code: 404, error: 'user_not_found', msg: 'User not found' },
        { status: 404 },
      )
    }
    return NextResponse.json({})
  } catch (e) {
    console.error('[auth/admin/users DELETE]', e)
    return NextResponse.json(
      { code: 500, error: 'internal_error', msg: 'Could not delete user' },
      { status: 500 },
    )
  }
}
