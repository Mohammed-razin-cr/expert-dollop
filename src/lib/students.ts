import { trainerBatchIds, type DbClient } from '@/lib/trainer'

/**
 * Data for the trainer Students board.
 *
 * Scoped to students enrolled in the trainer's own batches, matching every
 * other trainer screen. Course and batch come from the enrolment rather
 * than students.primary_course, because the batch is what the trainer
 * actually teaches them in — a student's stored "primary course" can be
 * something else entirely.
 *
 * Everything is loaded in one pass and aggregated in memory so the board
 * can filter and page client-side without further round trips.
 */

const one = (x: any) => (Array.isArray(x) ? x[0] : x)

export type TrainerStudentRow = {
  id: string
  name: string
  mobile: string | null
  email: string | null
  course: string | null
  batch: string | null
  attendancePct: number | null
  progress: number
  scorePct: number | null
  status: string
}

export type TrainerStudentStats = {
  total: number
  active: number
  lowAttendance: number
  pendingReviews: number
  avgScore: number | null
}

export type TrainerStudentData = {
  rows: TrainerStudentRow[]
  stats: TrainerStudentStats
  courses: string[]
  batches: string[]
}

const EMPTY: TrainerStudentData = {
  rows: [],
  stats: { total: 0, active: 0, lowAttendance: 0, pendingReviews: 0, avgScore: null },
  courses: [],
  batches: [],
}

/** Below this counts as "low attendance" on the KPI and the filter. */
export const LOW_ATTENDANCE = 75

export async function loadTrainerStudents(
  supabase: DbClient,
  trainerId: string,
): Promise<TrainerStudentData> {
  const batchIds = await trainerBatchIds(supabase, trainerId)
  if (!batchIds.length) return EMPTY

  const { data: enrolments = [] } = await supabase
    .from('enrollments')
    .select('student_id, progress, batch_id, batches(name, courses(name)), students(id, full_name, mobile, email, status)')
    .in('batch_id', batchIds)
    .is('deleted_at', null)

  const studentIds = [...new Set((enrolments ?? []).map((e: any) => e.student_id).filter(Boolean))] as string[]
  if (!studentIds.length) return EMPTY

  const [
    { data: attendance = [] },
    { data: assessments = [] },
    { data: assignments = [] },
    { data: batchAssessments = [] },
  ] = await Promise.all([
    supabase
      .from('attendance')
      .select('student_id, status')
      .in('batch_id', batchIds)
      .is('deleted_at', null),
    supabase
      .from('student_assessments')
      .select('student_id, score')
      .in('student_id', studentIds)
      .is('deleted_at', null),
    supabase.from('assignments').select('id').in('batch_id', batchIds).is('deleted_at', null),
    // Scheduled batch assessments — the other place scores live.
    supabase
      .from('assessments')
      .select('id, total_marks')
      .in('batch_id', batchIds)
      .is('deleted_at', null),
  ])

  const assessmentIds = (batchAssessments ?? []).map((a: any) => a.id)
  const { data: results = [] } = assessmentIds.length
    ? await supabase
        .from('assessment_results')
        .select('student_id, assessment_id, score')
        .in('student_id', studentIds)
        .in('assessment_id', assessmentIds)
        .is('deleted_at', null)
    : { data: [] }

  // Pending reviews: submissions on this trainer's assignments that still
  // need grading.
  let pendingReviews = 0
  const assignmentIds = (assignments ?? []).map((a: any) => a.id)
  if (assignmentIds.length) {
    const { count } = await supabase
      .from('assignment_submissions')
      .select('*', { count: 'exact', head: true })
      .in('assignment_id', assignmentIds)
      .in('status', ['pending', 'submitted'])
      .is('deleted_at', null)
    pendingReviews = count ?? 0
  }

  const att: Record<string, { total: number; here: number }> = {}
  for (const a of attendance ?? []) {
    const r = a as any
    // 'not_marked' is a placeholder for a day nobody marked, not an
    // absence — counting it would drag every rate down.
    if (r.status === 'not_marked') continue
    const g = (att[r.student_id] ??= { total: 0, here: 0 })
    g.total += 1
    if (r.status === 'present' || r.status === 'late') g.here += 1
  }

  // Scores live in two places and both count towards a student's average:
  // student_assessments (trainer-typed, already out of 100) and
  // assessment_results (raw marks against the paper's total_marks).
  // Reading only the first made the list show "—" for students who had
  // graded results all along.
  const marksById: Record<string, number> = {}
  for (const a of batchAssessments ?? []) marksById[(a as any).id] = Number((a as any).total_marks ?? 0)

  const score: Record<string, { sum: number; n: number }> = {}
  const addScore = (studentId: string, pct: number) => {
    const g = (score[studentId] ??= { sum: 0, n: 0 })
    g.sum += pct
    g.n += 1
  }

  for (const a of assessments ?? []) {
    const r = a as any
    if (r.score === null || r.score === undefined) continue
    addScore(r.student_id, Number(r.score))
  }

  for (const r of results ?? []) {
    const row = r as any
    if (row.score === null || row.score === undefined) continue
    const outOf = marksById[row.assessment_id] ?? 0
    addScore(row.student_id, outOf > 0 ? (Number(row.score) / outOf) * 100 : Number(row.score))
  }

  // A student enrolled in two of this trainer's batches would appear
  // twice; keep the first enrolment and let the rest fall away.
  const seen = new Set<string>()
  const rows: TrainerStudentRow[] = []
  for (const e of enrolments ?? []) {
    const r = e as any
    const s = one(r.students)
    if (!s?.id || seen.has(s.id)) continue
    seen.add(s.id)

    const b = one(r.batches)
    const a = att[s.id]
    const sc = score[s.id]

    rows.push({
      id: s.id,
      name: s.full_name ?? '—',
      mobile: s.mobile ?? null,
      email: s.email ?? null,
      course: one(b?.courses)?.name ?? null,
      batch: b?.name ?? null,
      attendancePct: a && a.total ? Math.round((a.here / a.total) * 100) : null,
      progress: Number(r.progress ?? 0),
      scorePct: sc && sc.n ? Math.round(sc.sum / sc.n) : null,
      status: s.status ?? 'active',
    })
  }

  rows.sort((x, y) => x.name.localeCompare(y.name))

  const scored = rows.filter((r) => r.scorePct !== null)

  return {
    rows,
    stats: {
      total: rows.length,
      active: rows.filter((r) => r.status === 'active').length,
      // Only counts students who actually have attendance recorded —
      // "not marked yet" is not the same as "poor attendance".
      lowAttendance: rows.filter((r) => r.attendancePct !== null && r.attendancePct < LOW_ATTENDANCE).length,
      pendingReviews,
      avgScore: scored.length
        ? Math.round(scored.reduce((s, r) => s + (r.scorePct as number), 0) / scored.length)
        : null,
    },
    courses: [...new Set(rows.map((r) => r.course).filter(Boolean))].sort() as string[],
    batches: [...new Set(rows.map((r) => r.batch).filter(Boolean))].sort() as string[],
  }
}
