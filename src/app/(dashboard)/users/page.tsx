import { redirect } from 'next/navigation'
import { createClient } from '@/lib/api/server'
import { UserManager } from '@/components/users/UserManager'

export default async function UsersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  const role = (me as any)?.role
  if (role !== 'super_admin' && role !== 'admin') redirect('/dashboard')

  const [{ data: users = [] }, { data: roles = [] }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, email, role, role_key, department, status')
      .order('role'),
    supabase.from('roles').select('key, label, base, is_builtin, sort').order('sort').order('label'),
  ])

  return <UserManager users={(users ?? []) as any} roles={(roles ?? []) as any} currentUserId={user!.id} />
}
