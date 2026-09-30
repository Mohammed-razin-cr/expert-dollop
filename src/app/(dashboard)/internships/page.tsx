import { createClient } from '@/lib/api/server'
import { InternshipsManager } from '@/components/internships/InternshipsManager'
const one = (x: any) => (Array.isArray(x) ? x[0] : x)
export default async function InternshipsPage() {
  const supabase = await createClient()
  const [{ data: rows = [] }, { data: students = [] }] = await Promise.all([
    supabase.from('internships').select('id, company, role, start_date, end_date, stipend, status, students(full_name)').is('deleted_at', null).order('created_at', { ascending: false }).limit(500),
    supabase.from('students').select('id, full_name').is('deleted_at', null).order('full_name').limit(500),
  ])
  const out = (rows ?? []).map((r: any) => ({ id: r.id, company: r.company, role: r.role, start_date: r.start_date, end_date: r.end_date, stipend: r.stipend, status: r.status, student: one(r.students)?.full_name ?? null }))
  return <InternshipsManager rows={out as any} students={(students ?? []) as any} />
}
