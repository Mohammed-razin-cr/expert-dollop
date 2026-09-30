import { trainerBatchIds, type DbClient } from '@/lib/trainer'

/**
 * Full profile for one student, as their trainer sees it.
 *
 * Everything the five tabs need is loaded in one pass, so switching tabs
 * costs nothing. Scoped to the trainer's own batches — see
 * loadTrainerStudentDetail for how that is enforced.
 */

const one = (x: any) => (Array.isArray(x) ? x[0] : x)

export type StudentNote = { id: string; note: string; author: string | null; created_at: string }
/** `topic` is the class covered that day, matched from the topics log. */
export type AttendanceMark = { date: string; status: string; topic: string | null }
export type PerformanceRow = {
  id: string
  date: string | null
  topic: string | null
  score: number | null
  result: string | null
  remarks: string | null
}
export type AssignmentRow = {
  id: string
  title: string
  due_date: string | null
  status: string
  score: number | null
  submitted_at: string | null
}
export type MaterialRow = { id: string; title: string; type: string | null; created_at: string | null }

/**
 * One assessment result, from either source:
 *   - `assessments` + `assessment_results` — scheduled tests for the batch
 *   - `student_assessments` — scores a trainer types in directly
 * Both are the same thing to a trainer, so they are merged and scored as
 * a percentage.
 */
export type AssessmentResultRow = {
  id: string
  name: string
  scorePct: number | null
  date: string | null
}

export type TrainerStudentDetail = {
  student: {
    id: string
    name: string
    email: string | null
    mobile: string | null
    dob: string | null
    status: string
    guardian_name: string | null
    guardian_mobile: string | null
    about: string | null
    course: string | null
    batch: string | null
    enrolled_at: string | null
    progress: number
  }
  stats: {
    attendancePct: number | null
    progress: number
    avgScore: number | null
    assignmentsDone: number
    assignmentsTotal: number
    assessmentsDone: number
    assessmentsTotal: number
    /** present + late — a late student was still in the class */
    classesAttended: number
    classesMissed: number
    /** attended + missed; excludes days nobody marked */
    classesTotal: number
  }
  attendance: AttendanceMark[]
  performance: PerformanceRow[]
  /** Merged assessment results, newest first. */
  assessmentResults: AssessmentResultRow[]
  assignments: AssignmentRow[]
  materials: MaterialRow[]
  notes: StudentNote[]
}

/**
 * Returns null when the student is not enrolled in any of this trainer's
 * batches. The caller turns that into a 404, so the URL never confirms
 * whether a given student id exists.
 */
export async function loadTrainerStudentDetail(
  supabase: DbClient,
  trainerId: string,
  studentId: string,
): Promise<TrainerStudentDetail | null> {
  const batchIds = await trainerBatchIds(supabase, trainerId)
  if (!batchIds.length) return null

  const { data: enrolment } = await supabase
    .from('enrollments')
    .select('progress, enrolled_at, batch_id, batches(id, name, courses(name))')
    .eq('student_id', studentId)
    .in('batch_id', batchIds)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle()

  if (!enrolment) return null

  const e = enrolment as any
  const batchId = e.batch_id
  const b = one(e.batches)

  const { data: s } = await supabase
    .from('students')
    .select('id, full_name, email, mobile, dob, status, guardian_name, guardian_mobile, about')
    .eq('id', studentId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!s) return null

  const [
    { data: attendance = [] },
    { data: perf = [] },
    { data: assignments = [] },
    { data: materials = [] },
    { data: notes = [] },
    { data: batchAssessments = [] },
  ] = await Promise.all([
    supabase.from('attendance').select('date, status').eq('student_id', studentId).eq('batch_id', batchId).is('deleted_at', null).order('date', { ascending: false }),
    supabase.from('student_assessments').select('id, date, topic, score, result, remarks').eq('student_id', studentId).is('deleted_at', null).order('date', { ascending: false }),
    supabase.from('assignments').select('id, title, due_date').eq('batch_id', batchId).is('deleted_at', null).order('due_date', { ascending: true, nullsFirst: false }),
    supabase.from('materials').select('id, title, type, created_at').eq('batch_id', batchId).is('deleted_at', null).order('created_at', { ascending: false }),
    supabase.from('student_notes').select('id, note, created_at, profiles(full_name)').eq('student_id', studentId).is('deleted_at', null).order('created_at', { ascending: false }),
    supabase.from('assessments').select('id, title, total_marks, scheduled_at, created_at').eq('batch_id', batchId).is('deleted_at', null),
  ])

  // topics.batch is the batch NAME as free text, not a foreign key, so the
  // class covered on a given day is matched on name + date. Falls back to
  // null when nothing was logged that day.
  const { data: topics = [] } = b?.name
    ? await supabase
        .from('topics')
        .select('date, topic')
        .eq('batch', b.name)
        .is('deleted_at', null)
    : { data: [] }

  const topicByDate: Record<string, string> = {}
  for (const t of topics ?? []) {
    const r = t as any
    if (r.date && r.topic) topicByDate[String(r.date).slice(0, 10)] = r.topic
  }

  const assignmentIds = (assignments ?? []).map((a: any) => a.id)
  const { data: submissions = [] } = assignmentIds.length
    ? await supabase
        .from('assignment_submissions')
        .select('assignment_id, status, score, submitted_at')
        .eq('student_id', studentId)
        .in('assignment_id', assignmentIds)
        .is('deleted_at', null)
    : { data: [] }

  const assessmentIds = (batchAssessments ?? []).map((a: any) => a.id)
  const { data: results = [] } = assessmentIds.length
    ? await supabase
        .from('assessment_results')
        .select('id, assessment_id, status, score')
        .eq('student_id', studentId)
        .in('assessment_id', assessmentIds)
        .is('deleted_at', null)
    : { data: [] }

  // ---- merge both assessment sources into one list ---------------------
  const assessmentById: Record<string, any> = {}
  for (const a of batchAssessments ?? []) assessmentById[(a as any).id] = a

  const merged: AssessmentResultRow[] = []

  for (const r of results ?? []) {
    const row = r as any
    const a = assessmentById[row.assessment_id]
    if (!a) continue
    const outOf = Number(a.total_marks ?? 0)
    merged.push({
      id: row.id,
      name: a.title ?? 'Assessment',
      // Stored as marks; show as a percentage of the paper's total so it
      // sits on the same scale as everything else.
      scorePct:
        row.score === null || row.score === undefined
          ? null
          : outOf > 0
            ? Math.round((Number(row.score) / outOf) * 100)
            : Number(row.score),
      date: (a.scheduled_at ?? a.created_at) ? String(a.scheduled_at ?? a.created_at).slice(0, 10) : null,
    })
  }

  for (const p of perf ?? []) {
    const row = p as any
    merged.push({
      id: row.id,
      name: row.topic ?? 'Assessment',
      // student_assessments scores are already out of 100.
      scorePct: row.score === null || row.score === undefined ? null : Math.round(Number(row.score)),
      date: row.date ? String(row.date).slice(0, 10) : null,
    })
  }

  // Newest first; undated rows sink to the bottom.
  merged.sort((x, y) => (y.date ?? '').localeCompare(x.date ?? ''))

  const mergedScored = merged.filter((m) => m.scorePct !== null)

  const subByAssignment: Record<string, any> = {}
  for (const sub of submissions ?? []) subByAssignment[(sub as any).assignment_id] = sub

  // 'not_marked' rows are placeholders for unmarked days, not absences —
  // excluded from both the total and the rate.
  let attTotal = 0
  let attHere = 0
  for (const a of attendance ?? []) {
    const st = (a as any).status
    if (st === 'not_marked') continue
    attTotal += 1
    if (st === 'present' || st === 'late') attHere += 1
  }

  const scored = (perf ?? []).filter((p: any) => p.score !== null && p.score !== undefined)
  const st = s as any

  return {
    student: {
      id: st.id,
      name: st.full_name,
      email: st.email,
      mobile: st.mobile,
      dob: st.dob,
      status: st.status ?? 'active',
      guardian_name: st.guardian_name,
      guardian_mobile: st.guardian_mobile,
      about: st.about,
      course: one(b?.courses)?.name ?? null,
      batch: b?.name ?? null,
      enrolled_at: e.enrolled_at,
      progress: Number(e.progress ?? 0),
    },
    stats: {
      attendancePct: attTotal ? Math.round((attHere / attTotal) * 100) : null,
      progress: Number(e.progress ?? 0),
      // Averages both sources. Reading only student_assessments made this
      // show "—" for students who had graded results all along.
      avgScore: mergedScored.length
        ? Math.round(
            mergedScored.reduce((t, m) => t + (m.scorePct as number), 0) / mergedScored.length,
          )
        : null,
      assignmentsDone: (submissions ?? []).filter(
        (x: any) => x.status === 'submitted' || x.status === 'graded',
      ).length,
      assignmentsTotal: assignmentIds.length,
      assessmentsDone: (results ?? []).filter(
        (r: any) => r.status === 'graded' || r.status === 'submitted',
      ).length,
      assessmentsTotal: assessmentIds.length,
      classesAttended: attHere,
      classesMissed: attTotal - attHere,
      classesTotal: attTotal,
    },
    attendance: (attendance ?? []).map((a: any) => ({
      date: a.date,
      status: a.status,
      topic: topicByDate[String(a.date).slice(0, 10)] ?? null,
    })),
    performance: (perf ?? []).map((p: any) => ({
      id: p.id,
      date: p.date,
      topic: p.topic,
      score: p.score === null ? null : Number(p.score),
      result: p.result,
      remarks: p.remarks,
    })),
    assessmentResults: merged,
    assignments: (assignments ?? []).map((a: any) => {
      const sub = subByAssignment[a.id]
      return {
        id: a.id,
        title: a.title,
        due_date: a.due_date ? String(a.due_date).slice(0, 10) : null,
        status: sub?.status ?? 'not_submitted',
        score: sub?.score === null || sub?.score === undefined ? null : Number(sub.score),
        submitted_at: sub?.submitted_at ? String(sub.submitted_at).slice(0, 10) : null,
      }
    }),
    materials: (materials ?? []).map((m: any) => ({
      id: m.id,
      title: m.title,
      type: m.type,
      created_at: m.created_at ? String(m.created_at).slice(0, 10) : null,
    })),
    notes: (notes ?? []).map((n: any) => ({
      id: n.id,
      note: n.note,
      author: one(n.profiles)?.full_name ?? null,
      created_at: String(n.created_at).slice(0, 10),
    })),
  }
}
