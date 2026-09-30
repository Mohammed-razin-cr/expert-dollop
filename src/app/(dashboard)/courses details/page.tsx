import { createClient } from '@/lib/api/server'
import { CourseManager } from '@/components/courses/CourseManager'

const one = (x: any) => (Array.isArray(x) ? x[0] : x)

export default async function CoursesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: me } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single()
  const [{ data: courses = [] }, { data: batches = [] }, { data: trainers = [] }] = await Promise.all([
    supabase.from('courses').select('id, name, code, domain, fee, duration_weeks, status').order('name'),
    supabase.from('batches').select('id, name, start_date, end_date, capacity, progress, status, courses(name), profiles(full_name)').order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, full_name').eq('role', 'trainer').order('full_name'),
  ])

  // batch counts per course
  const counts: Record<string, number> = {}
  for (const b of batches ?? []) {
    const cn = one((b as any).courses)?.name
    if (cn) counts[cn] = (counts[cn] ?? 0) + 1
  }

  const coursesOut = (courses ?? []).map((c: any) => ({ ...c, batch_count: counts[c.name] ?? 0 }))
  const batchesOut = (batches ?? []).map((b: any) => ({
    id: b.id, name: b.name, course: one(b.courses)?.name ?? null, trainer: one(b.profiles)?.full_name ?? null,
    start_date: b.start_date, end_date: b.end_date, capacity: b.capacity, progress: b.progress, status: b.status,
  }))
  const courseOpts = (courses ?? []).map((c: any) => ({ id: c.id, name: c.name }))
  return (
    <CourseManager
      courses={coursesOut as any}
      batches={batchesOut as any}
      trainers={(trainers ?? []) as any}
      courseOpts={courseOpts}
      role={(me as any)?.role ?? ''}
    />
  )
}
