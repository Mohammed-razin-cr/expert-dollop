import { notFound } from 'next/navigation'
import { createClient } from '@/lib/api/server'
import { StudentDetail } from '@/components/students/StudentDetail'
import { TrainerStudentDetailView } from '@/components/students/TrainerStudentDetail'
import { getViewer } from '@/lib/trainer'
import { loadTrainerStudentDetail } from '@/lib/studentDetail'

/**
 * Student detail.
 *
 * Trainers get their own read-mostly profile — attendance, performance,
 * assignments, materials and notes for a student they actually teach.
 * Every other role falls through to the original editing screen below,
 * unchanged.
 */
export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const viewer = await getViewer(supabase)

  if (viewer.role === 'trainer') {
    const data = await loadTrainerStudentDetail(supabase, viewer.id, id)
    // null means the student is not in any of this trainer's batches.
    // 404 rather than 403, so the URL never confirms the id exists.
    if (!data) notFound()
    return <TrainerStudentDetailView data={data} />
  }

  // ---------------------------------------------------------------------
  // Original screen — unchanged. BD / admin / super_admin path.
  // ---------------------------------------------------------------------
  const { data: student } = await supabase
    .from('students')
    .select('id, full_name, mobile, email, status, primary_course, track, program, batch_name, trainer_name, source_lead, joined_at')
    .eq('id', id)
    .is('deleted_at', null)
    .single()
  if (!student) notFound()

  const [{ data: courses = [] }, { data: trainers = [] }, { data: apt = [] }] = await Promise.all([
    supabase.from('courses').select('id, name').order('name'),
    supabase.from('profiles').select('full_name').eq('role', 'trainer').order('full_name'),
    (student as any).mobile
      ? supabase
          .from('aptitude')
          .select('id, round, status, apt_date')
          .eq('phone', (student as any).mobile)
          .is('deleted_at', null)
          .order('apt_date', { ascending: false })
      : Promise.resolve({ data: [] }),
  ])
  const trainerNames = (trainers ?? []).map((t: any) => t.full_name).filter(Boolean)
  return (
    <StudentDetail
      student={student as any}
      courses={(courses ?? []) as any}
      trainers={trainerNames}
      aptitude={(apt ?? []) as any}
    />
  )
}
