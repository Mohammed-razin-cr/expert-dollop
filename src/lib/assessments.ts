import { trainerBatchIds, orNothing, type DbClient, type Viewer } from '@/lib/trainer'
import type { Enum } from '@/lib/database.types'

/**
 * Assessments — the papers set for a batch, and how the class did on them.
 *
 * Not to be confused with student_assessments, the ad-hoc score log this
 * screen used to show. Everything here hangs off `assessments`, with marks
 * in `assessment_results`.
 *
 * Attempt counts and averages are worked out against the batch roster, so
 * "3 / 4" means three of four students sat it — not three of however many
 * happen to have a row.
 */

const one = (x: any) => (Array.isArray(x) ? x[0] : x)

export type BatchOption = { id: string; name: string }

/**
 * The kinds of paper the form offers. `type` is the `assessment_type`
 * Postgres enum underneath (quiz | assignment | mock_test | exam |
 * aptitude) — these must match its labels exactly, or the insert fails
 * with "invalid input value for enum assessment_type".
 */
export const ASSESSMENT_TYPES: readonly { label: string; value: Enum<'assessment_type'> }[] = [
  { label: 'Quiz', value: 'quiz' },
  { label: 'Assignment', value: 'assignment' },
  { label: 'Mock Test', value: 'mock_test' },
  { label: 'Exam', value: 'exam' },
  { label: 'Aptitude', value: 'aptitude' },
]

export type AssessmentRow = {
  id: string
  title: string
  batch: string | null
  batchId: string | null
  date: string | null
  topic: string | null
  totalMarks: number | null
  passingMarks: number | null
  type: string | null
  attempted: number
  roster: number
  /** Mean of the marks recorded, in marks — null when nobody has a score. */
  avgMarks: number | null
  /** The same mean as a percentage of the paper's total. */
  avgPct: number | null
  /** Pass when the class average reaches the pass mark. Null if unknowable. */
  passed: boolean | null
}

export type AssessmentsStats = {
  total: number
  upcoming: number
  unmarked: number
  avgPct: number | null
}

export type AssessmentsData = {
  rows: AssessmentRow[]
  stats: AssessmentsStats
  batches: BatchOption[]
}

const EMPTY: AssessmentsData = {
  rows: [],
  stats: { total: 0, upcoming: 0, unmarked: 0, avgPct: null },
  batches: [],
}

const asDate = (v: unknown) => (v ? String(v).slice(0, 10) : null)
const todayStr = () => new Date().toISOString().slice(0, 10)
const numOrNull = (v: unknown) => (v === null || v === undefined ? null : Number(v))

/** Batch ids in scope, or null when the viewer is not scoped at all. */
async function scopeBatches(supabase: DbClient, viewer: Viewer): Promise<string[] | null> {
  if (!viewer.scoped) return null
  return trainerBatchIds(supabase, viewer.id)
}

export async function loadAssessments(
  supabase: DbClient,
  viewer: Viewer,
): Promise<AssessmentsData> {
  const batchIds = await scopeBatches(supabase, viewer)
  if (batchIds && !batchIds.length) return EMPTY

  // Rows that belong to a batch filter on batch_id; the batches themselves
  // filter on their own id.
  const narrow = (q: any) => (batchIds ? q.in('batch_id', orNothing(batchIds)) : q)
  const narrowBatches = (q: any) => (batchIds ? q.in('id', orNothing(batchIds)) : q)

  const [{ data: assessments = [] }, { data: enrolments = [] }, { data: batches = [] }] =
    await Promise.all([
      narrow(
        supabase
          .from('assessments')
          .select(
            'id, title, batch_id, scheduled_at, topic, type, total_marks, passing_marks, created_at, batches(name)',
          )
          .is('deleted_at', null)
          .order('scheduled_at', { ascending: false, nullsFirst: false })
          .limit(500),
      ),
      narrow(supabase.from('enrollments').select('student_id, batch_id').is('deleted_at', null)),
      narrowBatches(supabase.from('batches').select('id, name').is('deleted_at', null).order('name')),
    ])

  const rosterOf: Record<string, number> = {}
  for (const e of enrolments ?? []) {
    const r = e as any
    rosterOf[r.batch_id] = (rosterOf[r.batch_id] ?? 0) + 1
  }

  const ids = (assessments ?? []).map((a: any) => a.id)
  const { data: results = [] } = ids.length
    ? await supabase
        .from('assessment_results')
        .select('assessment_id, score')
        .in('assessment_id', ids)
        .is('deleted_at', null)
    : { data: [] }

  const marks: Record<string, number[]> = {}
  for (const r of results ?? []) {
    const row = r as any
    if (row.score === null || row.score === undefined) continue
    ;(marks[row.assessment_id] ??= []).push(Number(row.score))
  }

  const today = todayStr()

  const rows: AssessmentRow[] = (assessments ?? []).map((a: any) => {
    const scored = marks[a.id] ?? []
    const total = numOrNull(a.total_marks)
    const passing = numOrNull(a.passing_marks)
    const avgMarks = scored.length
      ? Math.round((scored.reduce((s, n) => s + n, 0) / scored.length) * 10) / 10
      : null
    const avgPct = avgMarks !== null && total ? Math.round((avgMarks / total) * 100) : null

    return {
      id: a.id,
      title: a.title,
      batch: one(a.batches)?.name ?? null,
      batchId: a.batch_id,
      date: asDate(a.scheduled_at),
      topic: a.topic,
      totalMarks: total,
      passingMarks: passing,
      type: a.type,
      attempted: scored.length,
      roster: rosterOf[a.batch_id] ?? 0,
      avgMarks,
      avgPct,
      passed: avgMarks === null || passing === null ? null : avgMarks >= passing,
    }
  })

  const withAvg = rows.filter((r) => r.avgPct !== null)

  return {
    rows,
    stats: {
      total: rows.length,
      // No date means not scheduled yet, which is not the same as upcoming.
      upcoming: rows.filter((r) => r.date && r.date > today).length,
      unmarked: rows.filter((r) => r.attempted < r.roster).length,
      avgPct: withAvg.length
        ? Math.round(withAvg.reduce((s, r) => s + (r.avgPct as number), 0) / withAvg.length)
        : null,
    },
    batches: (batches ?? []).map((b: any) => ({ id: b.id, name: b.name })),
  }
}

// ---------------------------------------------------------------------
// One assessment
// ---------------------------------------------------------------------

export type ResultRow = {
  /** null when nothing has been recorded for this student yet. */
  id: string | null
  studentId: string
  student: string
  score: number | null
  /** Against the paper's pass mark; null while unmarked or unknowable. */
  passed: boolean | null
}

export type AssessmentDetailData = {
  assessment: {
    id: string
    title: string
    description: string | null
    topic: string | null
    type: string | null
    date: string | null
    batch: string | null
    batchId: string | null
    totalMarks: number | null
    passingMarks: number | null
    durationMinutes: number | null
    created_at: string
    updated_at: string
  }
  results: ResultRow[]
  batches: BatchOption[]
}

/**
 * Returns null when the paper does not exist or belongs to a batch the
 * viewer does not run. The caller turns that into a 404, so the URL never
 * confirms whether a given id exists.
 */
export async function loadAssessmentDetail(
  supabase: DbClient,
  viewer: Viewer,
  assessmentId: string,
): Promise<AssessmentDetailData | null> {
  const batchIds = await scopeBatches(supabase, viewer)
  if (batchIds && !batchIds.length) return null

  const { data: a } = await supabase
    .from('assessments')
    .select(
      'id, title, description, topic, type, scheduled_at, batch_id, total_marks, passing_marks, duration_minutes, created_at, updated_at, batches(name)',
    )
    .eq('id', assessmentId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!a) return null

  const row = a as any
  if (batchIds && !batchIds.includes(row.batch_id)) return null

  const narrowBatches = (q: any) => (batchIds ? q.in('id', orNothing(batchIds)) : q)

  const [{ data: enrolments = [] }, { data: results = [] }, { data: batches = [] }] =
    await Promise.all([
      supabase
        .from('enrollments')
        .select('student_id, students(id, full_name)')
        .eq('batch_id', row.batch_id)
        .is('deleted_at', null),
      supabase
        .from('assessment_results')
        .select('id, student_id, score')
        .eq('assessment_id', assessmentId)
        .is('deleted_at', null),
      narrowBatches(supabase.from('batches').select('id, name').is('deleted_at', null).order('name')),
    ])

  const resultFor: Record<string, any> = {}
  for (const r of results ?? []) resultFor[(r as any).student_id] = r

  const passing = numOrNull(row.passing_marks)

  // Driven by the roster, so a student with no score still has a line —
  // that gap is what the trainer is looking for.
  const rows: ResultRow[] = (enrolments ?? [])
    .map((e: any) => {
      const s = one(e.students)
      if (!s?.id) return null
      const existing = resultFor[s.id]
      const score = existing?.score === null || existing?.score === undefined ? null : Number(existing.score)
      return {
        id: existing?.id ?? null,
        studentId: s.id,
        student: s.full_name,
        score,
        passed: score === null || passing === null ? null : score >= passing,
      }
    })
    .filter(Boolean) as ResultRow[]

  rows.sort((x, y) => x.student.localeCompare(y.student))

  return {
    assessment: {
      id: row.id,
      title: row.title,
      description: row.description,
      topic: row.topic,
      type: row.type,
      date: asDate(row.scheduled_at),
      batch: one(row.batches)?.name ?? null,
      batchId: row.batch_id,
      totalMarks: numOrNull(row.total_marks),
      passingMarks: passing,
      durationMinutes: numOrNull(row.duration_minutes),
      created_at: row.created_at,
      updated_at: row.updated_at,
    },
    results: rows,
    batches: (batches ?? []).map((b: any) => ({ id: b.id, name: b.name })),
  }
}

/** Batches a trainer may set a paper for — used by the create form. */
export async function loadBatchOptions(
  supabase: DbClient,
  viewer: Viewer,
): Promise<BatchOption[]> {
  const batchIds = await scopeBatches(supabase, viewer)
  if (batchIds && !batchIds.length) return []

  let q = supabase.from('batches').select('id, name').is('deleted_at', null).order('name')
  if (batchIds) q = q.in('id', orNothing(batchIds))

  const { data = [] } = await q
  return (data ?? []).map((b: any) => ({ id: b.id, name: b.name }))
}
