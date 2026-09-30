import { notFound } from 'next/navigation'
import { createClient } from '@/lib/api/server'
import { getViewer } from '@/lib/trainer'
import { isBD, isStaff } from '@/lib/rbac'
import { BatchDetail } from '@/components/courses/BatchDetail'

const one = (x: any) => (Array.isArray(x) ? x[0] : x)

/**
 * Batch detail — where "View Batch" lands.
 *
 * Everything the six tabs need is assembled here in one pass and
 * aggregated in memory, rather than each tab firing its own round trip.
 * A batch is a few hundred attendance rows at most, so this is cheaper
 * than six queries and keeps the tab switch instant.
 *
 * A trainer can only open a batch they run, and a student cannot open one
 * at all — someone else's 404s rather than 403s, so the URL never confirms
 * the batch exists. Staff and BD see every batch on the Batches screen, so
 * they can open every batch here too.
 */
export default async function BatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const viewer = await getViewer(supabase)

  const { data: batch } = await supabase
    .from('batches')
    .select(
      'id, name, trainer_id, start_date, end_date, capacity, progress, status, courses(name), profiles(full_name)',
    )
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!batch) notFound()
  // `viewer.scoped` means "not super_admin/admin", but the test below
  // narrows by trainer_id — which is trainer scoping. A BD is never a
  // batch's trainer, so this 404'd them on every batch they opened from a
  // list they are allowed to see in full. Ask for the role the test is
  // actually about; the same correction loadCoursesAndBatches carries.
  const scopeToTrainer = !isStaff(viewer.role) && !isBD(viewer.role)
  if (scopeToTrainer && (batch as any).trainer_id !== viewer.id) notFound()

  const [{ data: enrolments = [] }, { data: attendance = [] }, { data: assignments = [] }, { data: materials = [] }] =
    await Promise.all([
      supabase
        .from('enrollments')
        .select('id, status, progress, enrolled_at, students(id, full_name, email, mobile)')
        .eq('batch_id', id)
        .is('deleted_at', null),
      supabase
        .from('attendance')
        .select('student_id, status, date')
        .eq('batch_id', id)
        .is('deleted_at', null),
      supabase
        .from('assignments')
        .select('id, title, description, due_date, created_at')
        .eq('batch_id', id)
        .is('deleted_at', null)
        .order('due_date', { ascending: true, nullsFirst: false }),
      supabase
        .from('materials')
        .select('id, title, type, file_url, created_at, profiles(full_name)')
        .eq('batch_id', id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
    ])

  const assignmentIds = (assignments ?? []).map((a: any) => a.id)
  const assignmentTitle: Record<string, string> = {}
  for (const a of assignments ?? []) assignmentTitle[(a as any).id] = (a as any).title

  const { data: submissions = [] } = assignmentIds.length
    ? await supabase
        .from('assignment_submissions')
        .select('id, assignment_id, student_id, status, score, submitted_at')
        .in('assignment_id', assignmentIds)
        .is('deleted_at', null)
    : { data: [] }

  const studentIds = (enrolments ?? []).map((e: any) => one(e.students)?.id).filter(Boolean)

  const { data: assessments = [] } = studentIds.length
    ? await supabase
        .from('student_assessments')
        .select('id, student_id, date, topic, score, result, remarks')
        .in('student_id', studentIds)
        .is('deleted_at', null)
        .order('date', { ascending: false })
    : { data: [] }

  // ---- aggregate per student -------------------------------------------
  type Agg = { total: number; here: number; last: string | null }
  const att: Record<string, Agg> = {}
  for (const a of attendance ?? []) {
    const r = (a as any)
    if (r.status === 'not_marked') continue // placeholder, not an absence
    const g = (att[r.student_id] ??= { total: 0, here: 0, last: null })
    g.total += 1
    if (r.status === 'present' || r.status === 'late') g.here += 1
    if (r.date && (!g.last || r.date > g.last)) g.last = r.date
  }

  const subsByStudent: Record<string, { done: number; lastAt: string | null }> = {}
  for (const s of submissions ?? []) {
    const r = (s as any)
    const g = (subsByStudent[r.student_id] ??= { done: 0, lastAt: null })
    // "done" means handed in — submitted or already graded.
    if (r.status === 'submitted' || r.status === 'graded') g.done += 1
    if (r.submitted_at && (!g.lastAt || r.submitted_at > g.lastAt)) g.lastAt = r.submitted_at
  }

  const scoreByStudent: Record<string, { sum: number; n: number }> = {}
  for (const a of assessments ?? []) {
    const r = (a as any)
    if (r.score === null || r.score === undefined) continue
    const g = (scoreByStudent[r.student_id] ??= { sum: 0, n: 0 })
    g.sum += Number(r.score)
    g.n += 1
  }

  const nameById: Record<string, string> = {}
  const students = (enrolments ?? []).map((e: any) => {
    const s = one(e.students)
    const sid = s?.id as string
    nameById[sid] = s?.full_name ?? '—'
    const a = att[sid]
    const sub = subsByStudent[sid]
    const sc = scoreByStudent[sid]
    // "Last active" is the most recent trace of them: a class attended or
    // an assignment handed in.
    const lastSubmitted = sub?.lastAt ? sub.lastAt.slice(0, 10) : null
    const lastActive = [a?.last, lastSubmitted].filter(Boolean).sort().pop() ?? null

    return {
      id: sid,
      name: s?.full_name ?? '—',
      email: s?.email ?? null,
      mobile: s?.mobile ?? null,
      status: e.status as string,
      progress: Number(e.progress ?? 0),
      attendancePct: a && a.total ? Math.round((a.here / a.total) * 100) : null,
      present: a?.here ?? 0,
      sessions: a?.total ?? 0,
      submitted: sub?.done ?? 0,
      assignmentsTotal: assignmentIds.length,
      avgScore: sc && sc.n ? Math.round(sc.sum / sc.n) : null,
      lastActive,
    }
  })

  const batchTotal = Object.values(att).reduce((s, g) => s + g.total, 0)
  const batchHere = Object.values(att).reduce((s, g) => s + g.here, 0)

  const pending = (submissions ?? [])
    .filter((s: any) => s.status === 'pending' || s.status === 'submitted')
    .map((s: any) => ({
      id: s.id,
      student: nameById[s.student_id] ?? '—',
      assignment: assignmentTitle[s.assignment_id] ?? '—',
      status: s.status as string,
      submitted_at: s.submitted_at ? String(s.submitted_at).slice(0, 10) : null,
    }))

  const b = batch as any

  return (
    <BatchDetail
      backHref={viewer.role === 'trainer' ? '/courses?tab=batches' : '/batches'}
      batch={{
        id: b.id,
        name: b.name,
        course: one(b.courses)?.name ?? null,
        trainer: one(b.profiles)?.full_name ?? null,
        start_date: b.start_date,
        end_date: b.end_date,
        capacity: b.capacity,
        progress: Number(b.progress ?? 0),
        status: b.status,
      }}
      stats={{
        enrolled: students.length,
        attendancePct: batchTotal ? Math.round((batchHere / batchTotal) * 100) : null,
        pendingReviews: pending.length,
        materials: (materials ?? []).length,
        assignments: assignmentIds.length,
      }}
      students={students}
      assignments={(assignments ?? []).map((a: any) => {
        const forA = (submissions ?? []).filter((s: any) => s.assignment_id === a.id)
        return {
          id: a.id,
          title: a.title,
          description: a.description,
          due_date: a.due_date ? String(a.due_date).slice(0, 10) : null,
          submitted: forA.filter((s: any) => s.status === 'submitted' || s.status === 'graded').length,
          graded: forA.filter((s: any) => s.status === 'graded').length,
          cohort: students.length,
        }
      })}
      materials={(materials ?? []).map((m: any) => ({
        id: m.id,
        title: m.title,
        type: m.type,
        uploaded_by: one(m.profiles)?.full_name ?? null,
        created_at: m.created_at ? String(m.created_at).slice(0, 10) : null,
      }))}
      assessments={(assessments ?? []).map((a: any) => ({
        id: a.id,
        student: nameById[a.student_id] ?? '—',
        date: a.date,
        topic: a.topic,
        score: a.score === null ? null : Number(a.score),
        result: a.result,
        remarks: a.remarks,
      }))}
      pending={pending}
    />
  )
}
