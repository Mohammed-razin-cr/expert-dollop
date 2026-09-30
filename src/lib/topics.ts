import type { DbClient, Viewer } from '@/lib/trainer'

/**
 * Daily topics — the list board and one session's detail.
 *
 * A trainer sees only the sessions they logged; staff see every trainer's,
 * which is the point of the screen in the admin sidebar. That single rule
 * is applied by `scope()` below and nowhere else.
 */

const one = (x: any) => (Array.isArray(x) ? x[0] : x)

export type TopicStatus = 'completed' | 'upcoming'

export type TopicRow = {
  id: string
  date: string | null
  topic: string
  description: string | null
  batch: string | null
  batchId: string | null
  trainer: string | null
  status: TopicStatus
}

export type TopicsStats = {
  totalSessions: number
  thisWeek: number
  pending: number
}

export type BatchOption = { id: string; name: string }

export type TopicsData = {
  rows: TopicRow[]
  stats: TopicsStats
  batches: BatchOption[]
}

/** Monday-to-Sunday bounds of the current week, as date strings. */
export function currentWeek(now = new Date()): { start: string; end: string } {
  const dow = (now.getUTCDay() + 6) % 7 // Monday = 0
  const base = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const day = 86_400_000
  return {
    start: new Date(base - dow * day).toISOString().slice(0, 10),
    end: new Date(base + (6 - dow) * day).toISOString().slice(0, 10),
  }
}

const asStatus = (v: unknown): TopicStatus => (v === 'upcoming' ? 'upcoming' : 'completed')

export async function loadTopics(supabase: DbClient, viewer: Viewer): Promise<TopicsData> {
  let topicsQ = supabase
    .from('topics')
    .select('id, date, topic, description, batch, batch_id, status, profiles(full_name)')
    .is('deleted_at', null)
    .order('date', { ascending: false })
    .limit(500)

  // The batch picker offers only batches the viewer can file a topic
  // against, so a trainer cannot log a session for someone else's class.
  let batchesQ = supabase
    .from('batches')
    .select('id, name, status')
    .is('deleted_at', null)
    .order('name')

  if (viewer.scoped) {
    topicsQ = topicsQ.eq('trainer_id', viewer.id)
    batchesQ = batchesQ.eq('trainer_id', viewer.id)
  }

  const [{ data: topics = [] }, { data: batches = [] }] = await Promise.all([topicsQ, batchesQ])

  const rows: TopicRow[] = (topics ?? []).map((t: any) => ({
    id: t.id,
    date: t.date ? String(t.date).slice(0, 10) : null,
    topic: t.topic,
    description: t.description,
    batch: t.batch,
    batchId: t.batch_id,
    trainer: one(t.profiles)?.full_name ?? null,
    status: asStatus(t.status),
  }))

  const { start, end } = currentWeek()

  return {
    rows,
    stats: {
      totalSessions: rows.length,
      thisWeek: rows.filter((r) => r.date && r.date >= start && r.date <= end).length,
      pending: rows.filter((r) => r.status === 'upcoming').length,
    },
    batches: (batches ?? []).map((b: any) => ({ id: b.id, name: b.name })),
  }
}

// ---------------------------------------------------------------------
// One session
// ---------------------------------------------------------------------

export type TopicMaterial = {
  id: string
  title: string
  type: string | null
  file_url: string | null
  file_size: number | null
}

export type TopicAssignment = {
  id: string
  title: string
  due_date: string | null
  /** Submissions actually handed in, against the size of the batch. */
  submitted: number
  roster: number
  /** Derived from the due date — assignments carry no status of their own. */
  open: boolean
}

export type TopicDetailData = {
  topic: {
    id: string
    date: string | null
    topic: string
    description: string | null
    batch: string | null
    batchId: string | null
    trainer: string | null
    status: TopicStatus
    covered: string[]
    notes: string | null
    created_at: string
    updated_at: string
  }
  materials: TopicMaterial[]
  assignments: TopicAssignment[]
  batches: BatchOption[]
}

/**
 * Returns null when the topic does not exist, or belongs to another
 * trainer. The caller turns that into a 404, so the URL never confirms
 * whether a given topic id exists.
 */
export async function loadTopicDetail(
  supabase: DbClient,
  viewer: Viewer,
  topicId: string,
): Promise<TopicDetailData | null> {
  let q = supabase
    .from('topics')
    .select(
      'id, date, topic, description, batch, batch_id, status, covered, notes, created_at, updated_at, profiles(full_name)',
    )
    .eq('id', topicId)
    .is('deleted_at', null)

  if (viewer.scoped) q = q.eq('trainer_id', viewer.id)

  const { data: t } = await q.maybeSingle()
  if (!t) return null

  const row = t as any
  const batchId: string | null = row.batch_id

  let batchesQ = supabase
    .from('batches')
    .select('id, name')
    .is('deleted_at', null)
    .order('name')
  if (viewer.scoped) batchesQ = batchesQ.eq('trainer_id', viewer.id)

  const [{ data: materials = [] }, { data: assignments = [] }, { data: batches = [] }] =
    await Promise.all([
      supabase
        .from('materials')
        .select('id, title, type, file_url, file_size')
        .eq('topic_id', topicId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      supabase
        .from('assignments')
        .select('id, title, due_date')
        .eq('topic_id', topicId)
        .is('deleted_at', null)
        .order('due_date', { ascending: true, nullsFirst: false }),
      batchesQ,
    ])

  // "25 / 31" — how many handed in, out of how many are in the class.
  const assignmentIds = (assignments ?? []).map((a: any) => a.id)
  const [{ data: submissions = [] }, { count: roster }] = await Promise.all([
    assignmentIds.length
      ? supabase
          .from('assignment_submissions')
          .select('assignment_id, status')
          .in('assignment_id', assignmentIds)
          .is('deleted_at', null)
      : Promise.resolve({ data: [] }),
    batchId
      ? supabase
          .from('enrollments')
          .select('*', { count: 'exact', head: true })
          .eq('batch_id', batchId)
          .is('deleted_at', null)
      : Promise.resolve({ count: 0 }),
  ])

  const handedIn: Record<string, number> = {}
  for (const s of submissions ?? []) {
    const r = s as any
    if (r.status !== 'submitted' && r.status !== 'graded') continue
    handedIn[r.assignment_id] = (handedIn[r.assignment_id] ?? 0) + 1
  }

  const todayStr = new Date().toISOString().slice(0, 10)

  return {
    topic: {
      id: row.id,
      date: row.date ? String(row.date).slice(0, 10) : null,
      topic: row.topic,
      description: row.description,
      batch: row.batch,
      batchId,
      trainer: one(row.profiles)?.full_name ?? null,
      status: asStatus(row.status),
      covered: (row.covered ?? []) as string[],
      notes: row.notes,
      created_at: row.created_at,
      updated_at: row.updated_at,
    },
    materials: (materials ?? []).map((m: any) => ({
      id: m.id,
      title: m.title,
      type: m.type,
      file_url: m.file_url,
      file_size: m.file_size === null || m.file_size === undefined ? null : Number(m.file_size),
    })),
    assignments: (assignments ?? []).map((a: any) => {
      const due = a.due_date ? String(a.due_date).slice(0, 10) : null
      return {
        id: a.id,
        title: a.title,
        due_date: due,
        submitted: handedIn[a.id] ?? 0,
        roster: roster ?? 0,
        open: !due || due >= todayStr,
      }
    }),
    batches: (batches ?? []).map((b: any) => ({ id: b.id, name: b.name })),
  }
}
