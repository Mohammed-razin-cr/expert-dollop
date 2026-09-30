import { redirect } from 'next/navigation'
import { createClient } from '@/lib/api/server'
import { SettingsClient } from '@/components/settings/SettingsClient'
import type { Role } from '@/lib/rbac'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  const role = ((me as any)?.role ?? 'student') as Role
  if (role !== 'admin' && role !== 'super_admin') redirect('/dashboard')

  const { data: rows = [] } = await supabase.from('app_settings').select('key, value')
  const initial: Record<string, string> = {}
  for (const r of rows ?? []) initial[(r as any).key] = (r as any).value ?? ''
  return <SettingsClient initial={initial} />
}
