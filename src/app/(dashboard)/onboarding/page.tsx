import { createClient } from '@/lib/api/server'
import { OnboardingManager } from '@/components/onboarding/OnboardingManager'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const [{ data: students = [] }, { data: rows = [] }] = await Promise.all([
    supabase.from('students').select(`id,full_name,intern_id,college,branch,degree,semester,program`),
    supabase.from('onboarding').select('id, intern_id, intern_name, role, status, token, accepted_at, created_at').is('deleted_at', null).order('created_at', { ascending: false }).limit(500)])
  return <OnboardingManager students={(students ?? []) as any} rows={(rows ?? []) as any} userId={user!.id} />
}
