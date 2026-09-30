import { redirect } from 'next/navigation'
import { createClient } from '@/lib/api/server'
import { TrainerAssignManager } from '@/components/trainer-assign/TrainerAssignManager'
import { loadBatchEnrolments } from '@/lib/courses'
import { isBD, isStaff, type Role } from '@/lib/rbac'

const one = (x: any) => (Array.isArray(x) ? x[0] : x)

/**
 * Trainer Assignment — which trainer runs which batch.
 *
 * Assigning a trainer to a student one row at a time is what this screen
 * used to do; teaching is organised by batch, and `batches.trainer_id` is
 * what every other screen reads as "the trainer", so that column is what
 * this now sets.
 *
 * Assigning a trainer is BD work as much as admin work, so the BD module
 * gets the same screen with the same controls. Trainers and students are
 * sent away — it is not their screen. The write goes through
 * /api/batches, which repeats this check server side; the gate here only
 * decides what is rendered.
 */
export default async function TrainerAssignPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user!.id).single()

  const role = (me as any)?.role as Role | undefined
  const canManage = isStaff(role) || isBD(role)
  if (!canManage) redirect('/dashboard')

  const [{ data: batches = [] }, { data: trainers = [] }] = await Promise.all([
    supabase
      .from('batches')
      .select('id, name, trainer_id, start_date, end_date, capacity, status, courses(name)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, full_name').eq('role', 'trainer').order('full_name'),
  ])

  // The head count comes from the enrolments, the same source the Batches
  // screen counts from, so the two cannot disagree.
  const enrolled = await loadBatchEnrolments(
    supabase,
    (batches ?? []).map((b: any) => b.id),
  )

  const rows = (batches ?? []).map((b: any) => ({
    id: b.id,
    name: b.name,
    course: one(b.courses)?.name ?? null,
    trainer_id: b.trainer_id ?? null,
    start_date: b.start_date,
    end_date: b.end_date,
    capacity: b.capacity,
    status: b.status as string,
    enrolled: (enrolled[b.id] ?? []).length,
  }))

  return (
    <TrainerAssignManager
      rows={rows}
      trainers={(trainers ?? []) as { id: string; full_name: string }[]}
      canManage
    />
  )
}
