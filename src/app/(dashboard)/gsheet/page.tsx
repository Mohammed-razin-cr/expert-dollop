import { redirect } from 'next/navigation'
import { createClient } from '@/lib/api/server'
// import { GSheetSyncClient } from '@/components/gsheet/GSheetSyncClient'
import { GSheetSyncClient } from './Gsheetsyncclient'
import { type Role, BD_ROLES } from '@/lib/rbac'

export default async function GSheetPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  const role = ((me as any)?.role ?? 'student') as Role
  if (role === 'trainer' || role === 'student') redirect('/dashboard')

  // Courses come along so the importer can turn a sheet's Course text into
  // the id leads.course_interest actually holds.
  const [{ data: setting }, { data: bds = [] }, { data: courses = [] }] = await Promise.all([
    supabase.from('app_settings').select('value').eq('key', 'gsheet_url').maybeSingle(),
    supabase.from('profiles').select('id, full_name').in('role', BD_ROLES).order('full_name'),
    supabase.from('courses').select('id, name').order('name'),
  ])

  return <GSheetSyncClient initialUrl={(setting as any)?.value ?? ''} bds={(bds ?? []) as any} courses={(courses ?? []) as any} role={role} myId={user!.id} />
}
