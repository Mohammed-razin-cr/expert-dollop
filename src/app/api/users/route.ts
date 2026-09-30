import { NextResponse } from 'next/server'
import { createClient } from '@/lib/api/server'
import { createAdminClient } from '@/lib/api/admin'
import { rpc } from '@/lib/auth/rpc'

// Only super_admin / admin may manage users.
async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = (profile as any)?.role
  return role === 'super_admin' || role === 'admin' ? user : null
}

export async function POST(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => null)
  if (!body?.email || !body?.password || !body?.full_name) {
    return NextResponse.json({ error: 'Name, email and password are required' }, { status: 400 })
  }
  const db = createAdminClient()

  // The specific role (role_key) and the base access level it inherits. The
  // base is what every RLS policy and screen reads; role_key is the label.
  // Resolved from the roles catalogue so a custom role lands on the right base.
  const roleKey = body.role_key || body.role || 'student'
  const { data: roleRow } = await db.from('roles').select('key, base').eq('key', roleKey).maybeSingle()
  const key = (roleRow as any)?.key ?? 'student'
  const base = (roleRow as any)?.base ?? 'student'

  const { data, error } = await db.auth.admin.createUser({
    email: body.email,
    password: body.password,
    email_confirm: true,
    // handle_new_user() seeds profiles.role from this; we set role_key just after.
    user_metadata: { full_name: body.full_name, role: base },
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (data.user) {
    await db.from('profiles').update({ role: base, role_key: key, department: body.department || null, full_name: body.full_name }).eq('id', data.user.id)
  }
  return NextResponse.json({ ok: true })
}

// Admin resets any user's password. No current password needed — this is an
// admin action, guarded by requireAdmin(). The target email is resolved from
// the profile id server-side, then set via the auth_set_password RPC.
export async function PATCH(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const id = body?.id ? String(body.id) : ''
  const password = body?.password ? String(body.password) : ''
  if (!id || !password) {
    return NextResponse.json({ error: 'User and new password are required' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const db = createAdminClient()
  const { data: prof } = await db.from('profiles').select('email').eq('id', id).single()
  const email = (prof as any)?.email
  if (!email) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  try {
    const ok = await rpc<boolean>('auth_set_password', { p_email: String(email), p_password: password })
    if (!ok) return NextResponse.json({ error: 'Could not set password' }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[api/users PATCH]', e)
    return NextResponse.json({ error: 'Could not set password' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  if (id === admin.id) return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 })

  const db = createAdminClient()
  const { error } = await db.auth.admin.deleteUser(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
