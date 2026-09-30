import { createClient } from '@/lib/api/server'
import { AptitudeManager, type AptRow } from '@/components/aptitude/AptitudeManager'
import type { Role } from '@/lib/rbac'

export default async function AptitudePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: me } = await supabase.from('profiles').select('role, full_name').eq('id', user!.id).single()
  const role = ((me as any)?.role ?? 'student') as Role
  const myName = (me as any)?.full_name ?? ''

  let q = supabase.from('aptitude')
    .select('id, apt_key, lead_ref, name, phone, email, college, cgpa, goal, bd, round, status, result, score, venue, mode, apt_date, next_action, remarks, invite_sent, payment_done, payment_verified_ai, payment_amt, payment_mode, payment_txn, payment_date')
    .is('deleted_at', null).order('apt_date', { ascending: false }).limit(1000)
  if (role === 'bd' || role === 'counsellor') q = q.eq('bd', myName)
  const { data: rows = [] } = await q

  return <AptitudeManager rows={(rows ?? []) as AptRow[]} role={role} bdName={myName} />
}
