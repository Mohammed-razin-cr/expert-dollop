import { redirect } from 'next/navigation'
import { createClient } from '@/lib/api/server'
import { DataSafetyClient } from '@/components/datasafety/DataSafetyClient'
import type { Role } from '@/lib/rbac'

export default async function DataSafetyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  const role = ((me as any)?.role ?? 'student') as Role
  if (role !== 'admin' && role !== 'super_admin') redirect('/dashboard')
  return <DataSafetyClient />
}
