import { trainerBatchIds, orNothing, type DbClient, type Viewer } from '@/lib/trainer'

/**
 * Assignments — the board and one assignment's detail.
 *
 * A trainer sees assignments for batches they run; staff see all. Both the
 * board and the detail count submissions against the batch roster rather
 * than against the submission rows, so "3 / 7" means three of seven
 * students, not three of however many happen to have a row.
 */

const one = (x: any) => (Array.isArray(x) ? x[0] : x)

export type BatchOption = { id: string; name: string }
export type TopicOption = { id: string; topic: string; batchId: string | null }

/** Handed in, but carrying no mark yet. 'late' is still handed in. */
export const AWAITING = ['pending', 'submitted', 'late']

export type AssignmentRow = {
  id: string
  title: string
  batch: string | null
  batchId: string | null
  topic: string | null
  due_date: string | null
  /** Still accepting work — no due date, or one that has not passed. */
  open: boolean
  submitted: number
  graded: number
  roster: number
}

export type AssignmentsStats = {
  total: number
  open: number
  closed: number
  awaitingGrading: number
}

export type AssignmentsData = {
  rows: AssignmentRow[]
  stats: AssignmentsStats
  batches: BatchOption[]
  topics: TopicOption[]
}

const EMPTY: AssignmentsData = {
  rows: [],
  stats: { total: 0, open: 0, closed: 0, awaitingGrading: 0 },
  batches: [],
  topics: [],
}

const todayStr = () => new Date().toISOString().slice(0, 10)
const asDate = (v: unknown) => (v ? String(v).slice(0, 10) : null)

/** Batch ids in scope, or null when the viewer is not scoped at all. */
async function scopeBatches(supabase: DbClient, viewer: Viewer): Promise<string[] | null> {
  if (!viewer.scoped) return null
  return trainerBatchIds(supabase, viewer.id)
}

export async function loadAssignments(
  supabase: DbClient,
  viewer: Viewer,
): Promise<AssignmentsData> {
  const batchIds = await scopeBatches(supabase, viewer)
  if (batchIds && !batchIds.length) return EMPTY

  // Rows that *belong* to a batch are filtered on batch_id; the batches
  // themselves are filtered on their own id. Using batch_id for both is a
  // PostgREST error rather than an empty result, so the picker went blank.
  const narrow = (q: any) => (batchIds ? q.in('batch_id', orNothing(batchIds)) : q)
  const narrowBatches = (q: any) => (batchIds ? q.in('id', orNothing(batchIds)) : q)

  const [{ data: assignments = [] }, { data: enrolments = [] }, { data: batches = [] }, { data: topics = [] }] =
    await Promise.all([
      narrow(
        supabase
          .from('assignments')
          .select('id, title, due_date, batch_id, topic_id, batches(name), topics(topic)')
          .is('deleted_at', null)
          .order('due_date', { ascending: false, nullsFirst: false })
          .limit(500),
      ),
      narrow(supabase.from('enrollments').select('student_id, batch_id').is('deleted_at', null)),
      narrowBatches(supabase.from('batches').select('id, name').is('deleted_at', null).order('name')),
      narrow(
        supabase
          .from('topics')
          .select('id, topic, batch_id')
          .is('deleted_at', null)
          .order('date', { ascending: false })
          .limit(500),
      ),
    ])

  const rosterOf: Record<string, number> = {}
  for (const e of enrolments ?? []) {
    const r = e as any
    rosterOf[r.batch_id] = (rosterOf[r.batch_id] ?? 0) + 1
  }

  const ids = (assignments ?? []).map((a: any) => a.id)
  const { data: submissions = [] } = ids.length
    ? await supabase
        .from('assignment_submissions')
        .select('assignment_id, status')
        .in('assignment_id', ids)
        .is('deleted_at', null)
    : { data: [] }

  const tally: Record<string, { submitted: number; graded: number }> = {}
  for (const s of submissions ?? []) {
    const r = s as any
    const t = (tally[r.assignment_id] ??= { submitted: 0, graded: 0 })
    // 'pending' means a row exists but nothing was handed in yet.
    if (r.status === 'submitted' || r.status === 'graded' || r.status === 'late') t.submitted += 1
    if (r.status === 'graded') t.graded += 1
  }

  const today = todayStr()

  const rows: AssignmentRow[] = (assignments ?? []).map((a: any) => {
    const due = asDate(a.due_date)
    const t = tally[a.id] ?? { submitted: 0, graded: 0 }
    return {
      id: a.id,
      title: a.title,
      batch: one(a.batches)?.name ?? null,
      batchId: a.batch_id,
      topic: one(a.topics)?.topic ?? null,
      due_date: due,
      open: !due || due >= today,
      submitted: t.submitted,
      graded: t.graded,
      roster: rosterOf[a.batch_id] ?? 0,
    }
  })

  const awaitingGrading = (submissions ?? []).filter((s: any) => AWAITING.includes(s.status)).length

  return {
    rows,
    stats: {
      total: rows.length,
      open: rows.filter((r) => r.open).length,
      closed: rows.filter((r) => !r.open).length,
      awaitingGrading,
    },
    batches: (batches ?? []).map((b: any) => ({ id: b.id, name: b.name })),
    topics: (topics ?? []).map((t: any) => ({ id: t.id, topic: t.topic, batchId: t.batch_id })),
  }
}

// ---------------------------------------------------------------------
// One assignment
// ---------------------------------------------------------------------

export type SubmissionRow = {
  /** null when nothing has been recorded for this student yet. */
  id: string | null
  studentId: string
  student: string
  /** 'not_submitted' is synthesised for a student with no row at all. */
  status: string
  submitted_at: string | null
  score: number | null
}

export type AssignmentDetailData = {
  assignment: {
    id: string
    title: string
    description: string | null
    due_date: string | null
    batch: string | null
    batchId: string | null
    topic: string | null
    topicId: string | null
    open: boolean
    created_at: string
    updated_at: string
  }
  submissions: SubmissionRow[]
  batches: BatchOption[]
  topics: TopicOption[]
}

/**
 * Returns null when the assignment does not exist or belongs to a batch
 * the viewer does not run. The caller turns that into a 404, so the URL
 * never confirms whether a given id exists.
 */
export async function loadAssignmentDetail(
  supabase: DbClient,
  viewer: Viewer,
  assignmentId: string,
): Promise<AssignmentDetailData | null> {
  const batchIds = await scopeBatches(supabase, viewer)
  if (batchIds && !batchIds.length) return null

  const { data: a } = await supabase
    .from('assignments')
    .select('id, title, description, due_date, batch_id, topic_id, created_at, updated_at, batches(name), topics(topic)')
    .eq('id', assignmentId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!a) return null

  const row = a as any
  if (batchIds && !batchIds.includes(row.batch_id)) return null

  const narrow = (q: any) => (batchIds ? q.in('batch_id', orNothing(batchIds)) : q)
  const narrowBatches = (q: any) => (batchIds ? q.in('id', orNothing(batchIds)) : q)

  const [{ data: enrolments = [] }, { data: submissions = [] }, { data: batches = [] }, { data: topics = [] }] =
    await Promise.all([
      supabase
        .from('enrollments')
        .select('student_id, students(id, full_name)')
        .eq('batch_id', row.batch_id)
        .is('deleted_at', null),
      supabase
        .from('assignment_submissions')
        .select('id, student_id, status, submitted_at, score')
        .eq('assignment_id', assignmentId)
        .is('deleted_at', null),
      narrowBatches(supabase.from('batches').select('id, name').is('deleted_at', null).order('name')),
      narrow(
        supabase
          .from('topics')
          .select('id, topic, batch_id')
          .is('deleted_at', null)
          .order('date', { ascending: false })
          .limit(500),
      ),
    ])

  const subFor: Record<string, any> = {}
  for (const s of submissions ?? []) subFor[(s as any).student_id] = s

  // Driven by the roster, so a student who handed in nothing still appears
  // — that absence is the thing a trainer needs to see.
  const rows: SubmissionRow[] = (enrolments ?? [])
    .map((e: any) => {
      const s = one(e.students)
      if (!s?.id) return null
      const sub = subFor[s.id]
      return {
        id: sub?.id ?? null,
        studentId: s.id,
        student: s.full_name,
        status: sub?.status ?? 'not_submitted',
        submitted_at: asDate(sub?.submitted_at),
        score: sub?.score === null || sub?.score === undefined ? null : Number(sub.score),
      }
    })
    .filter(Boolean) as SubmissionRow[]

  rows.sort((x, y) => x.student.localeCompare(y.student))

  const due = asDate(row.due_date)

  return {
    assignment: {
      id: row.id,
      title: row.title,
      description: row.description,
      due_date: due,
      batch: one(row.batches)?.name ?? null,
      batchId: row.batch_id,
      topic: one(row.topics)?.topic ?? null,
      topicId: row.topic_id,
      open: !due || due >= todayStr(),
      created_at: row.created_at,
      updated_at: row.updated_at,
    },
    submissions: rows,
    batches: (batches ?? []).map((b: any) => ({ id: b.id, name: b.name })),
    topics: (topics ?? []).map((t: any) => ({ id: t.id, topic: t.topic, batchId: t.batch_id })),
  }
}
