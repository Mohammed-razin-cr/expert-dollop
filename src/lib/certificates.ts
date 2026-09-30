import { trainerBatchIds, orNothing, type DbClient, type Viewer } from '@/lib/trainer'

/**
 * Certificate requests — review and approval.
 *
 * Completion and assessment score are not stored on the request: they are
 * read live from the enrolment and the marks, so a request raised weeks
 * ago is judged on where the student stands today rather than on a stale
 * snapshot.
 */

const one = (x: any) => (Array.isArray(x) ? x[0] : x)

/**
 * What qualifies for a certificate.
 *
 * These are a starting rule, not a policy handed down from anywhere — they
 * live here as one named pair so the threshold can be changed in a single
 * place once the real rule is decided.
 */
export const ELIGIBILITY = { minCompletion: 90, minScore: 70 }

export type CertStatus = 'Pending' | 'Approved' | 'Rejected' | 'Sent'

export type CertRow = {
  id: string
  studentId: string
  student: string
  email: string | null
  batch: string | null
  batchId: string | null
  course: string | null
  type: string
  /** Enrolment progress, 0-100. */
  completion: number
  /** Mean assessment score as a percentage, null when never assessed. */
  score: number | null
  eligible: boolean
  status: CertStatus
  requestedOn: string
  certificateId: string | null
  notes: string | null
  reviewedBy: string | null
  reviewedAt: string | null
}

export type CertStats = {
  total: number
  pending: number
  approved: number
  rejected: number
}

export type Option = { id: string; name: string }

export type CertificatesData = {
  rows: CertRow[]
  stats: CertStats
  batches: Option[]
  courses: Option[]
  /** Students the trainer may raise a request for. */
  students: {
    id: string
    name: string
    batchId: string | null
    batch: string | null
    course: string | null
    completion: number
    score: number | null
    eligible: boolean
  }[]
}

const EMPTY: CertificatesData = {
  rows: [],
  stats: { total: 0, pending: 0, approved: 0, rejected: 0 },
  batches: [],
  courses: [],
  students: [],
}

const asStatus = (v: unknown): CertStatus =>
  v === 'Approved' || v === 'Rejected' || v === 'Sent' ? v : 'Pending'

export const isEligible = (completion: number, score: number | null) =>
  completion >= ELIGIBILITY.minCompletion && score !== null && score >= ELIGIBILITY.minScore

export async function loadCertificates(
  supabase: DbClient,
  viewer: Viewer,
): Promise<CertificatesData> {
  const batchIds = viewer.scoped ? await trainerBatchIds(supabase, viewer.id) : null
  if (batchIds && !batchIds.length) return EMPTY

  // The enrolment is the source of batch, course and completion.
  let enrolQ = supabase
    .from('enrollments')
    .select('student_id, batch_id, progress, batches(id, name, courses(id, name)), students(id, full_name, email)')
    .is('deleted_at', null)
  if (batchIds) enrolQ = enrolQ.in('batch_id', orNothing(batchIds))

  const { data: enrolments = [] } = await enrolQ

  type Enrol = {
    studentId: string
    name: string
    email: string | null
    batchId: string
    batch: string
    courseId: string | null
    course: string | null
    completion: number
  }

  const enrolOf: Record<string, Enrol> = {}
  for (const e of enrolments ?? []) {
    const r = e as any
    const s = one(r.students)
    const b = one(r.batches)
    if (!s?.id) continue
    // First enrolment wins, matching the students board.
    if (enrolOf[s.id]) continue
    const c = one(b?.courses)
    enrolOf[s.id] = {
      studentId: s.id,
      name: s.full_name,
      email: s.email ?? null,
      batchId: r.batch_id,
      batch: b?.name ?? '—',
      courseId: c?.id ?? null,
      course: c?.name ?? null,
      completion: Number(r.progress ?? 0),
    }
  }

  const studentIds = Object.keys(enrolOf)
  const scopedBatchIds = batchIds ?? [...new Set(Object.values(enrolOf).map((e) => e.batchId))]

  // Scores, from the same two sources the rest of the app averages.
  const { data: papers = [] } = scopedBatchIds.length
    ? await supabase
        .from('assessments')
        .select('id, total_marks')
        .in('batch_id', orNothing(scopedBatchIds))
        .is('deleted_at', null)
    : { data: [] }

  const paperIds = (papers ?? []).map((a: any) => a.id)
  const outOf: Record<string, number> = {}
  for (const a of papers ?? []) outOf[(a as any).id] = Number((a as any).total_marks ?? 0)

  const { data: results = [] } = paperIds.length && studentIds.length
    ? await supabase
        .from('assessment_results')
        .select('assessment_id, student_id, score')
        .in('assessment_id', paperIds)
        .in('student_id', studentIds)
        .is('deleted_at', null)
    : { data: [] }

  const pct: Record<string, number[]> = {}
  for (const r of results ?? []) {
    const row = r as any
    if (row.score === null || row.score === undefined) continue
    const total = outOf[row.assessment_id] ?? 0
    ;(pct[row.student_id] ??= []).push(total > 0 ? (Number(row.score) / total) * 100 : Number(row.score))
  }

  const scoreOf = (id: string) => {
    const xs = pct[id]
    return xs?.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null
  }

  // Requests themselves.
  //
  // The profiles embed must name its foreign key: cert_requests reaches
  // profiles through both created_by and reviewed_by, so a bare
  // `profiles(...)` is ambiguous and PostgREST answers 300, which arrives
  // here as no data at all. The reviewer is the one worth showing.
  let reqQ = supabase
    .from('cert_requests')
    .select(
      'id, student_id, batch_id, type, request_date, status, notes, certificate_id, reviewed_at, students(full_name, email), profiles!cert_requests_reviewed_by_fkey(full_name)',
    )
    .is('deleted_at', null)
    .order('request_date', { ascending: false })
    .limit(500)
  if (studentIds.length) reqQ = reqQ.in('student_id', orNothing(studentIds))
  else if (batchIds) return { ...EMPTY }

  const { data: requests = [] } = await reqQ

  const rows: CertRow[] = (requests ?? []).map((r: any) => {
    const e = enrolOf[r.student_id]
    const completion = e?.completion ?? 0
    const score = scoreOf(r.student_id)
    return {
      id: r.id,
      studentId: r.student_id,
      student: one(r.students)?.full_name ?? e?.name ?? '—',
      email: one(r.students)?.email ?? e?.email ?? null,
      batch: e?.batch ?? null,
      batchId: r.batch_id ?? e?.batchId ?? null,
      course: e?.course ?? null,
      type: r.type,
      completion,
      score,
      eligible: isEligible(completion, score),
      status: asStatus(r.status),
      requestedOn: r.request_date,
      certificateId: r.certificate_id,
      notes: r.notes,
      reviewedBy: one(r.profiles)?.full_name ?? null,
      reviewedAt: r.reviewed_at,
    }
  })

  const already = new Set(
    rows.filter((r) => r.status !== 'Rejected').map((r) => r.studentId),
  )

  return {
    rows,
    stats: {
      total: rows.length,
      pending: rows.filter((r) => r.status === 'Pending').length,
      approved: rows.filter((r) => r.status === 'Approved' || r.status === 'Sent').length,
      rejected: rows.filter((r) => r.status === 'Rejected').length,
    },
    batches: [...new Map(Object.values(enrolOf).map((e) => [e.batchId, e.batch])).entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    courses: [
      ...new Map(
        Object.values(enrolOf)
          .filter((e) => e.courseId && e.course)
          .map((e) => [e.courseId as string, e.course as string]),
      ).entries(),
    ]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    // Anyone without a live request, so New Request cannot duplicate one.
    students: Object.values(enrolOf)
      .filter((e) => !already.has(e.studentId))
      .map((e) => {
        const score = scoreOf(e.studentId)
        return {
          id: e.studentId,
          name: e.name,
          batchId: e.batchId,
          batch: e.batch,
          course: e.course,
          completion: e.completion,
          score,
          eligible: isEligible(e.completion, score),
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name)),
  }
}

/**
 * "CERT-AIML-2026-0004" — a readable number derived from the batch and the
 * year, with a sequence that makes it unique. The unique index on
 * certificate_id is the real guard; this only has to be plausible and
 * collision-resistant.
 */
export function makeCertificateId(batchName: string | null, seq: number) {
  const slug = (batchName ?? 'GEN')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, 6) || 'GEN'
  return `CERT-${slug}-${new Date().getFullYear()}-${String(seq).padStart(4, '0')}`
}
