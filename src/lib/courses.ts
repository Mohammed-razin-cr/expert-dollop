import { orNothing, trainerBatchIds, type Viewer } from '@/lib/trainer'

/**
 * Shared loader for the Courses and Batches screens.
 *
 * Both routes render the same CourseManager and need the same four
 * datasets, so the query lives here rather than being duplicated — and
 * the trainer scoping can only be applied one way.
 *
 * A trainer sees the batches they run and the courses those batches
 * belong to. Staff see the whole catalogue, and so does BD — the course
 * list is what they sell from, so scoping it to batches they run (they run
 * none) is what left their Courses Details screen empty.
 */

const one = (x: any) => (Array.isArray(x) ? x[0] : x)

type Supabase = import("./trainer").DbClient

export async function loadCoursesAndBatches(supabase: Supabase, viewer: Viewer) {
  // `viewer.scoped` means "not super_admin/admin", but the only narrowing
  // below is by `trainer_id` — which is trainer scoping. A BD matches no
  // batch as trainer, so the filter emptied both lists rather than
  // narrowing them. Ask for the role the filter is actually about.
  // A counsellor is BD-equivalent and matches no batch as trainer either,
  // so it is excluded from trainer scoping the same way a BD is.
  const scopeToTrainer = viewer.scoped && viewer.role !== 'bd' && viewer.role !== 'counsellor'

  let batchesQ = supabase
    .from('batches')
    .select(
      'id, name, course_id, start_date, end_date, capacity, progress, status, courses(name), profiles(full_name)',
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (scopeToTrainer) batchesQ = batchesQ.eq('trainer_id', viewer.id)

  const { data: batches = [] } = await batchesQ

  let coursesQ = supabase
    .from('courses')
    .select('id, name, code, domain, fee, duration_weeks, status')
    .is('deleted_at', null)
    .order('name')

  if (scopeToTrainer) {
    const courseIds = [...new Set((batches ?? []).map((b: any) => b.course_id).filter(Boolean))]
    coursesQ = coursesQ.in('id', orNothing(courseIds as string[]))
  }

  const [{ data: courses = [] }, { data: trainers = [] }] = await Promise.all([
    coursesQ,
    supabase.from('profiles').select('id, full_name').eq('role', 'trainer').order('full_name'),
  ])

  // Batch counts come from the same (already scoped) list, so a trainer's
  // course row shows their batch count, not the organisation's.
  const counts: Record<string, number> = {}
  for (const b of batches ?? []) {
    const cn = one((b as any).courses)?.name
    if (cn) counts[cn] = (counts[cn] ?? 0) + 1
  }

  return {
    courses: (courses ?? []).map((c: any) => ({ ...c, batch_count: counts[c.name] ?? 0 })),
    batches: (batches ?? []).map((b: any) => ({
      id: b.id,
      name: b.name,
      course: one(b.courses)?.name ?? null,
      trainer: one(b.profiles)?.full_name ?? null,
      start_date: b.start_date,
      end_date: b.end_date,
      capacity: b.capacity,
      progress: b.progress,
      status: b.status,
    })),
    trainers: (trainers ?? []) as { id: string; full_name: string }[],
    courseOpts: (courses ?? []).map((c: any) => ({ id: c.id, name: c.name })),
  }
}

export type TrainerStats = {
  courses: number
  batches: number
  students: number
  pendingReviews: number
  materials: number
}

/**
 * Headline numbers for the trainer Courses board.
 *
 * All five are scoped to the trainer's own batches — "Total Students" means
 * students they teach, not the organisation's roll.
 *
 * `pendingReviews` counts submissions on their assignments that still need
 * grading (pending or submitted, i.e. not yet graded).
 */
export async function loadTrainerStats(
  supabase: Supabase,
  trainerId: string,
): Promise<TrainerStats> {
  const batchIds = await trainerBatchIds(supabase, trainerId)

  if (!batchIds.length) {
    // No batches yet: everything downstream is zero, and skipping the
    // queries avoids `.in()` on an empty list.
    const { count: mats } = await supabase
      .from('materials')
      .select('*', { count: 'exact', head: true })
      .eq('uploaded_by', trainerId)
      .is('deleted_at', null)
    return { courses: 0, batches: 0, students: 0, pendingReviews: 0, materials: mats ?? 0 }
  }

  const [{ data: batchRows = [] }, { data: enrolments = [] }, { data: assignments = [] }, { count: mats }] =
    await Promise.all([
      supabase.from('batches').select('course_id').in('id', batchIds).is('deleted_at', null),
      supabase.from('enrollments').select('student_id').in('batch_id', batchIds).is('deleted_at', null),
      supabase.from('assignments').select('id').in('batch_id', batchIds).is('deleted_at', null),
      supabase
        .from('materials')
        .select('*', { count: 'exact', head: true })
        .or(`uploaded_by.eq.${trainerId},batch_id.in.(${batchIds.join(',')})`)
        .is('deleted_at', null),
    ])

  const assignmentIds = (assignments ?? []).map((a: any) => a.id)
  let pendingReviews = 0
  if (assignmentIds.length) {
    const { count } = await supabase
      .from('assignment_submissions')
      .select('*', { count: 'exact', head: true })
      .in('assignment_id', assignmentIds)
      .in('status', ['pending', 'submitted'])
      .is('deleted_at', null)
    pendingReviews = count ?? 0
  }

  return {
    courses: new Set((batchRows ?? []).map((b: any) => b.course_id).filter(Boolean)).size,
    batches: batchIds.length,
    students: new Set((enrolments ?? []).map((e: any) => e.student_id)).size,
    pendingReviews,
    materials: mats ?? 0,
  }
}

export type BatchStat = { enrolled: number; attendancePct: number | null }

/**
 * Per-batch enrolment and attendance, keyed by batch id.
 *
 * Attendance counts `present` and `late` as attended — a late student was
 * there. Batches with no attendance marked yet return null rather than 0%,
 * so "not started" is not shown as "everybody missed it".
 */
export async function loadBatchStats(
  supabase: Supabase,
  batchIds: string[],
): Promise<Record<string, BatchStat>> {
  const out: Record<string, BatchStat> = {}
  if (!batchIds.length) return out

  const [{ data: enrolments = [] }, { data: attendance = [] }] = await Promise.all([
    supabase.from('enrollments').select('batch_id, student_id').in('batch_id', batchIds).is('deleted_at', null),
    supabase.from('attendance').select('batch_id, status').in('batch_id', batchIds).is('deleted_at', null),
  ])

  const students: Record<string, Set<string>> = {}
  for (const e of enrolments ?? []) {
    const b = (e as any).batch_id
    ;(students[b] ??= new Set()).add((e as any).student_id)
  }

  const marks: Record<string, { total: number; here: number }> = {}
  for (const a of attendance ?? []) {
    const b = (a as any).batch_id
    const m = (marks[b] ??= { total: 0, here: 0 })
    // 'not_marked' rows are placeholders, not an absence — exclude them
    // from the denominator or every unmarked day drags the average down.
    if ((a as any).status === 'not_marked') continue
    m.total += 1
    if ((a as any).status === 'present' || (a as any).status === 'late') m.here += 1
  }

  for (const id of batchIds) {
    const m = marks[id]
    out[id] = {
      enrolled: students[id]?.size ?? 0,
      attendancePct: m && m.total ? Math.round((m.here / m.total) * 100) : null,
    }
  }
  return out
}

export type EnrolledStudent = { id: string; full_name: string }

/**
 * Who is enrolled in each of these batches, keyed by batch id.
 *
 * The batch form needs the current roll to open with the right students
 * ticked, and the batches table needs the count. Both come from this one
 * query rather than one per batch.
 */
export async function loadBatchEnrolments(
  supabase: Supabase,
  batchIds: string[],
): Promise<Record<string, EnrolledStudent[]>> {
  const out: Record<string, EnrolledStudent[]> = {}
  if (!batchIds.length) return out

  const { data: rows = [] } = await supabase
    .from('enrollments')
    .select('batch_id, students(id, full_name)')
    .in('batch_id', batchIds)
    .is('deleted_at', null)

  for (const r of rows ?? []) {
    const s = one((r as any).students)
    if (!s?.id) continue
    ;(out[(r as any).batch_id] ??= []).push({ id: s.id, full_name: s.full_name ?? '—' })
  }
  for (const list of Object.values(out)) list.sort((a, b) => a.full_name.localeCompare(b.full_name))
  return out
}
