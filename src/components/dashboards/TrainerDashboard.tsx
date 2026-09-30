import {
  BookOpen,
  Users,
  GraduationCap,
  CalendarCheck,
  ClipboardList,
  FileCheck,
  Eye,
} from 'lucide-react'
import { createClient } from '@/lib/api/server'
import Link from 'next/link'

function StatCard({
  icon: Icon,
  label,
  value,
  tint,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  tint: string
  href?: string
})
{
  return (
    <Link href={href || "#"}>
      <div className="cursor-pointer rounded-xl border border-slate-200 bg-white p-4 transition hover:shadow-md hover:border-slate-300">
        <div className="flex items-center gap-3">
          <div className={`grid h-10 w-10 place-items-center rounded-lg ${tint}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500">{label}</p>
            <p className="text-xl font-semibold text-slate-900">{value}</p>
          </div>
        </div>
      </div>
    </Link>
  )
}

function Panel({
    title,
    action,
    actionHref,
    children,
    className = '',
  }: {
    title: string
    action?: string
    actionHref?: string
    children: React.ReactNode
    className?: string
  }){
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-5 ${className}`}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {action &&
          (actionHref ? (
            <Link
              href={actionHref}
              className="text-xs font-medium text-blue-600 hover:underline"
            >
              {action}
            </Link>
          ) : (
            <span className="text-xs font-medium text-blue-600">{action}</span>
          ))}
      </div>
      {children}
    </section>
  )
}

function Bar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs text-slate-500">{value}%</span>
    </div>
  )
}

const pill = (text: string, cls: string) => (
  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{text}</span>
)

const firstOfMonth = () => {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}
const todayStr = () => new Date().toISOString().slice(0, 10)

// ---------- data + render ----------
export async function TrainerDashboard({ userId }: { userId: string }) {
  const supabase = await createClient()

  const { data: batches = [] } = await supabase
    .from('batches')
    .select('id, name, progress, course_id, courses(name)')
    .eq('trainer_id', userId)

  const batchIds = (batches ?? []).map((b: any) => b.id)
  const one = (x: any) => (Array.isArray(x) ? x[0] : x)
  const courseName = (b: any) => one(b.courses)?.name ?? '—'

  // parallel fetches scoped to this trainer's batches
  const [
    { data: enr = [] },
    { data: att = [] },
    { data: assess = [] },
    { data: tasks = [] },
    { data: assignments = [] },
  ] = await Promise.all([
      supabase
        .from('enrollments')
        .select('student_id, batch_id, students(id, full_name, mobile)')
        .in('batch_id', batchIds.length ? batchIds : ['00000000-0000-0000-0000-000000000000']),
      supabase
        .from('attendance')
        .select('student_id, batch_id, date, status')
        .in('batch_id', batchIds.length ? batchIds : ['00000000-0000-0000-0000-000000000000'])
        .gte('date', firstOfMonth()),
      supabase
        .from('assessments')
        .select('id, batch_id, title')
        .in('batch_id', batchIds.length ? batchIds : ['00000000-0000-0000-0000-000000000000']),
      supabase
        .from('tasks')
        .select('id, title, batch_id, due_date, status')
        .eq('assigned_to', userId)
        .eq('status', 'pending'),
      supabase
        .from('assignments')
        .select('id')
        .in('batch_id', batchIds.length ? batchIds : ['00000000-0000-0000-0000-000000000000'])
        .is('deleted_at', null),
    ])

  // Work actually waiting on this trainer: homework handed in but not yet
  // marked. 'late' counts — a late submission is still a submission, and
  // still needs grading.
  const assignmentIds = (assignments ?? []).map((a: any) => a.id)
  const { count: ungraded } = assignmentIds.length
    ? await supabase
        .from('assignment_submissions')
        .select('*', { count: 'exact', head: true })
        .in('assignment_id', assignmentIds)
        .in('status', ['pending', 'submitted', 'late'])
        .is('deleted_at', null)
    : { count: 0 }
  // PostgREST returns null, not 0, when the count is unavailable.
  const assignmentsPending = ungraded ?? 0

  const assessIds = (assess ?? []).map((a: any) => a.id)
  const { data: results = [] } =
    assessIds.length > 0
      ? await supabase
          .from('assessment_results')
          .select('assessment_id, student_id, score')
          .in('assessment_id', assessIds)
      : { data: [] }

  // ----- KPIs -----
  const courseCount = new Set((batches ?? []).map((b: any) => b.course_id)).size
  const studentIds = new Set((enr ?? []).map((e: any) => e.student_id))
  const totalStudents = studentIds.size

  const todayRows = (att ?? []).filter((a: any) => a.date === todayStr())
  const markedToday = todayRows.filter((a: any) => a.status !== 'not_marked')
  const presentToday = markedToday.filter((a: any) => a.status === 'present').length
  const attendanceToday = markedToday.length
    ? Math.round((presentToday / markedToday.length) * 100)
    : 0

  // ----- attendance donut (month) -----
  const counts = { present: 0, absent: 0, late: 0, not_marked: 0 }
  ;(att ?? []).forEach((a: any) => {
    if (a.status in counts) (counts as any)[a.status] += 1
  })
  const marked = counts.present + counts.absent + counts.late
  // const overallAttendance = marked ? Math.round((counts.present / marked) * 100) : 0
  // const donut = [
  //   { name: 'Present', value: counts.present, color: '#10b981' },
  //   { name: 'Absent', value: counts.absent, color: '#f43f5e' },
  //   { name: 'Late', value: counts.late, color: '#f59e0b' },
  //   { name: 'Not Marked', value: counts.not_marked, color: '#cbd5e1' },
  // ]

  // ----- performance by batch -----
  const batchOfAssessment: Record<string, string> = {}
  ;(assess ?? []).forEach((a: any) => (batchOfAssessment[a.id] = a.batch_id))
  const scoresByBatch: Record<string, number[]> = {}
  const scoresByStudent: Record<string, number[]> = {}
  ;(results ?? []).forEach((r: any) => {
    const bId = batchOfAssessment[r.assessment_id]
    if (bId && r.score != null) (scoresByBatch[bId] ??= []).push(Number(r.score))
    if (r.score != null) (scoresByStudent[r.student_id] ??= []).push(Number(r.score))
  })
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0)
  const perfBars = (batches ?? []).map((b: any) => ({
    label: b.name.replace(' - ', '\n'),
    score: avg(scoresByBatch[b.id] ?? []),
  }))
  const allScores = (results ?? []).map((r: any) => Number(r.score)).filter((n: number) => !isNaN(n))
  const avgScore = avg(allScores)
  const highScore = allScores.length ? Math.max(...allScores) : 0
  const lowScore = allScores.length ? Math.min(...allScores) : 0

  // ----- per-batch student counts -----
  const studentsPerBatch: Record<string, Set<string>> = {}
  ;(enr ?? []).forEach((e: any) => (studentsPerBatch[e.batch_id] ??= new Set()).add(e.student_id))

  // ----- students needing attention -----
  const attByStudent: Record<string, { present: number; marked: number }> = {}
  ;(att ?? []).forEach((a: any) => {
    if (a.status === 'not_marked') return
    const s = (attByStudent[a.student_id] ??= { present: 0, marked: 0 })
    s.marked += 1
    if (a.status === 'present') s.present += 1
  })
  const studentName: Record<string, any> = {}
  ;(enr ?? []).forEach((e: any) => {
    const st = one(e.students)
    if (st) studentName[e.student_id] = st
  })
  const batchNameOfStudent: Record<string, string> = {}
  ;(enr ?? []).forEach((e: any) => {
    const b = (batches ?? []).find((x: any) => x.id === e.batch_id)
    if (b) batchNameOfStudent[e.student_id] = b.name
  })
  const needsAttention = [...studentIds]
    .map((id: any) => {
      const a = attByStudent[id]
      const attPct = a && a.marked ? Math.round((a.present / a.marked) * 100) : 0
      const sc = avg(scoresByStudent[id] ?? [])
      return { id, attPct, score: sc, name: studentName[id]?.full_name ?? '—', batch: batchNameOfStudent[id] ?? '—' }
    })
    .filter((s) => s.attPct < 70 || (s.score > 0 && s.score < 60))
    .sort((a, b) => a.attPct - b.attPct)
    .slice(0, 4)

  // ----- derived "today's schedule" from batches -----
  const slots = ['10:00 AM', '12:00 PM', '02:00 PM', '04:00 PM']
  const schedule = (batches ?? []).slice(0, 4).map((b: any, i: number) => ({
    time: slots[i] ?? '—',
    name: b.name,
    topic: courseName(b),
    status: i === 0 ? 'In Progress' : 'Upcoming',
  }))

  /**
   * An assessment is still pending while anyone in the batch has no score
   * against it. Counting every assessment instead — which this card used
   * to do — meant the figure could never fall, however much marking was
   * done.
   */
  const rosterOf: Record<string, Set<string>> = {}
  ;(enr ?? []).forEach((e: any) => (rosterOf[e.batch_id] ??= new Set()).add(e.student_id))

  const gradedOf: Record<string, number> = {}
  ;(results ?? []).forEach((r: any) => {
    if (r.score != null) gradedOf[r.assessment_id] = (gradedOf[r.assessment_id] ?? 0) + 1
  })

  const assessmentsPending = (assess ?? []).filter(
    (a: any) => (gradedOf[a.id] ?? 0) < (rosterOf[a.batch_id]?.size ?? 0),
  ).length

  return (
    <div className="space-y-5">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard icon={Users} label="Active Batches" value={batches?.length ?? 0} tint="bg-emerald-50 text-emerald-600" href="/courses?tab=batches&status=active"/>
        <StatCard icon={GraduationCap} label="Total Students" value={totalStudents} tint="bg-blue-50 text-blue-600" href="/students?mine=true"/>
        <StatCard icon={CalendarCheck} label="Attendance Today" value={`${attendanceToday}%`} tint="bg-amber-50 text-amber-600" href="/attendance"/>
        {/* Each card lands on the screen that owns its figure, filtered to
            the work it counted: homework on the Assignments board, papers
            on the Assessments marking queue. */}
        <StatCard icon={ClipboardList} label="Assignments to Grade" value={assignmentsPending} tint="bg-rose-50 text-rose-600" href="/assignments?status=ungraded"/>
        <StatCard icon={FileCheck} label="Assessments to Mark" value={assessmentsPending} tint="bg-blue-50 text-blue-600" href="/assessments?status=unmarked"/>
      </div>

      {/* row 2 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* <Panel title="My Batches" action="View All"> */}
        <Panel title="My Batches"action="View All" actionHref="/courses?tab=batches&status=active">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400">
                <th className="pb-2 font-medium">Batch</th>
                <th className="pb-2 font-medium">Students</th>
                <th className="pb-2 font-medium">Progress</th>
              </tr>
            </thead>
            <tbody>
              {(batches ?? []).map((b: any) => (
                <tr key={b.id} className="border-t border-slate-100">
                  <td className="py-2.5">
                    <p className="font-medium text-slate-800">{b.name}</p>
                    <p className="text-xs text-slate-400">{courseName(b)}</p>
                  </td>
                  <td className="py-2.5 text-slate-600">{studentsPerBatch[b.id]?.size ?? 0}</td>
                  <td className="py-2.5"><Bar value={b.progress ?? 0} /></td>
                </tr>
              ))}
              {!batches?.length && <tr><td className="py-3 text-slate-400">No batches assigned.</td></tr>}
            </tbody>
          </table>
        </Panel>

        <Panel title="Today's Schedule" action="View Calendar" actionHref="/calendar">
          <ul className="space-y-3">
            {schedule.map((s, i) => (
              <li key={i} className="flex items-center gap-3">
                <span className="w-16 shrink-0 text-xs font-medium text-blue-600">{s.time}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{s.name}</p>
                  <p className="truncate text-xs text-slate-400">{s.topic}</p>
                </div>
                {s.status === 'In Progress'
                  ? pill('In Progress', 'bg-emerald-50 text-emerald-600')
                  : pill('Upcoming', 'bg-amber-50 text-amber-600')}
              </li>
            ))}
            {!schedule.length && <li className="text-sm text-slate-400">No sessions today.</li>}
          </ul>
        </Panel>

         {/* <Panel title="Pending Tasks" action="View All"> */}
         <Panel title="Pending Tasks" action="View All" actionHref="/tasks">
          <ul className="space-y-2.5 text-sm">
            {(tasks ?? []).map((t: any) => (
              <li key={t.id} className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-slate-700">{t.title}</span>
                {pill('Pending', 'bg-amber-50 text-amber-600')}
              </li>
            ))}
            {!tasks?.length && <li className="text-slate-400">No pending tasks.</li>}
          </ul>
        </Panel>
      </div>     
      {/* row 4 */}
      {/* <Panel title="Students Needing Attention" action="View All"> */}
      <Panel title="Students Needing Attention" action="View All" actionHref="/students?mine=true">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-400">
              <th className="pb-2 font-medium">Student</th>
              <th className="pb-2 font-medium">Batch</th>
              <th className="pb-2 font-medium">Attendance</th>
              <th className="pb-2 font-medium">Avg Score</th>
              <th className="pb-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {needsAttention.map((s) => (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="py-2.5 font-medium text-slate-800">{s.name}</td>
                <td className="py-2.5 text-slate-600">{s.batch}</td>
                <td className="py-2.5">{pill(`${s.attPct}%`, 'bg-rose-50 text-rose-600')}</td>
                <td className="py-2.5">{pill(`${s.score}%`, 'bg-amber-50 text-amber-600')}</td>
                <td className="py-2.5">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Eye className="h-4 w-4" />
                    <button className="rounded-md border border-blue-200 px-2 py-0.5 text-xs text-blue-600">
                      Message
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!needsAttention.length && (
              <tr><td className="py-3 text-slate-400">Everyone's on track. 🎉</td></tr>
            )}
          </tbody>
        </table>
      </Panel>
    </div>
  )
}
