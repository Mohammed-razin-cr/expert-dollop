import { createClient } from '@/lib/api/server'
import { PlacementsManager } from '@/components/placements/PlacementsManager'
const one = (x: any) => (Array.isArray(x) ? x[0] : x)
export default async function PlacementsPage() {
  const supabase = await createClient()
  const [{ data: rows = [] }, { data: students = [] }] = await Promise.all([
    supabase.from('placements').select('id, company, role, ctc, offer_date, join_date, status, students(full_name)').is('deleted_at', null).order('created_at', { ascending: false }).limit(500),
    supabase.from('students').select('id, full_name').is('deleted_at', null).order('full_name').limit(500),
  ])
  const out = (rows ?? []).map((r: any) => ({ id: r.id, company: r.company, role: r.role, ctc: r.ctc, offer_date: r.offer_date, join_date: r.join_date, status: r.status, student: one(r.students)?.full_name ?? null }))
  return <PlacementsManager rows={out as any} students={(students ?? []) as any} />
}
