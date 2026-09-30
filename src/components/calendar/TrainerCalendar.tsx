import Link from 'next/link'
import {
  Brain,
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileCheck,
  GraduationCap,
} from 'lucide-react'
import { createClient } from '@/lib/api/server'
import { AddEventForm } from '@/components/calendar/AddEventForm'
import { trainerBatchIds, orNothing } from '@/lib/trainer'

/**
 * Calendar, for trainers.
 *
 * The shared calendar shows follow-ups and aptitude tests, which belong to
 * BD. A trainer's month is made of the classes they teach, the papers they
 * have scheduled, the homework that falls due, and their own tasks.
 *
 * Everything is scoped: sessions they logged, batches they run, tasks
 * assigned to them. The shared screen queried topics and events across the
 * whole organisation, so a trainer saw every colleague's.
 */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const pad = (n: number) => String(n).padStart(2, '0')

const TYPE_CLS: Record<string, string> = {
  Class: 'bg-blue-50 text-blue-600 border-blue-200',
  Holiday: 'bg-rose-50 text-rose-600 border-rose-200',
  Meeting: 'bg-amber-50 text-amber-600 border-amber-200',
  Test: 'bg-violet-50 text-violet-600 border-violet-200',
}

/** Each strand of a trainer's month, and the dot that marks it. */
const LEGEND = [
  { key: 'events', label: 'Events', dot: 'bg-blue-500' },
  { key: 'classes', label: 'Classes', dot: 'bg-indigo-500' },
  { key: 'assessments', label: 'Assessments', dot: 'bg-violet-500' },
  { key: 'assignments', label: 'Assignments', dot: 'bg-rose-500' },
  { key: 'tasks', label: 'Tasks', dot: 'bg-amber-500' },
] as const

const one = (x: any) => (Array.isArray(x) ? x[0] : x)

export async function TrainerCalendar({
  userId,
  month,
  day,
}: {
  userId: string
  month?: string
  day?: string
}) {
  const supabase = await createClient()
  const now = new Date()

  const [yStr, mStr] = (month ?? `${now.getFullYear()}-${pad(now.getMonth() + 1)}`).split('-')
  let year = parseInt(yStr, 10) || now.getFullYear()
  let m = (parseInt(mStr, 10) || now.getMonth() + 1) - 1
  if (m < 0) {
    m = 11
    year--
  } else if (m > 11) {
    m = 0
    year++
  }

  const daysInMonth = new Date(year, m + 1, 0).getDate()
  const leadBlanks = new Date(year, m, 1).getDay()
  const monthKey = `${year}-${pad(m + 1)}`
  const startISO = `${monthKey}-01`
  const endISO = `${monthKey}-${pad(daysInMonth)}`
  const todayISO = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`

  const selected =
    day && /^\d{4}-\d{2}-\d{2}$/.test(day) && day.startsWith(monthKey)
      ? day
      : todayISO.startsWith(monthKey)
        ? todayISO
        : startISO

  const batchIds = await trainerBatchIds(supabase, userId)
  const inMyBatches = orNothing(batchIds)

  const [
    { data: events = [] },
    { data: topics = [] },
    { data: assessments = [] },
    { data: assignments = [] },
    { data: tasks = [] },
  ] = await Promise.all([
    supabase
      .from('calendar_events')
      .select('id, date, title, type, time, batch')
      .eq('trainer_id', userId)
      .gte('date', startISO)
      .lte('date', endISO)
      .is('deleted_at', null)
      .order('time'),
    supabase
      .from('topics')
      .select('date, topic, batch, status')
      .eq('trainer_id', userId)
      .gte('date', startISO)
      .lte('date', endISO)
      .is('deleted_at', null),
    supabase
      .from('assessments')
      .select('id, title, scheduled_at, total_marks, batches(name)')
      .in('batch_id', inMyBatches)
      .gte('scheduled_at', startISO)
      .lte('scheduled_at', `${endISO}T23:59:59`)
      .is('deleted_at', null),
    supabase
      .from('assignments')
      .select('id, title, due_date, batches(name)')
      .in('batch_id', inMyBatches)
      .gte('due_date', startISO)
      .lte('due_date', `${endISO}T23:59:59`)
      .is('deleted_at', null),
    supabase
      .from('tasks')
      .select('id, title, due_date, status, priority')
      .eq('assigned_to', userId)
      .gte('due_date', startISO)
      .lte('due_date', endISO)
      .is('deleted_at', null),
  ])

  const byDate = <T,>(rows: T[], key: (r: T) => string | null) => {
    const map: Record<string, T[]> = {}
    for (const r of rows) {
      const d = key(r)
      if (d) (map[d] ??= []).push(r)
    }
    return map
  }

  const evMap = byDate(events ?? [], (e: any) => e.date)
  const classMap = byDate(topics ?? [], (t: any) => t.date)
  const assessMap = byDate(assessments ?? [], (a: any) => a.scheduled_at?.slice(0, 10) ?? null)
  const assignMap = byDate(assignments ?? [], (a: any) => a.due_date?.slice(0, 10) ?? null)
  const taskMap = byDate(tasks ?? [], (t: any) => t.due_date?.slice(0, 10) ?? null)

  const cells: (number | null)[] = [
    ...Array(leadBlanks).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const prevM = `${m === 0 ? year - 1 : year}-${pad(m === 0 ? 12 : m)}`
  const nextM = `${m === 11 ? year + 1 : year}-${pad(m === 11 ? 1 : m + 2)}`
  const selPretty = new Date(`${selected}T00:00:00`).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const selEv = evMap[selected] ?? []
  const selClass = classMap[selected] ?? []
  const selAssess = assessMap[selected] ?? []
  const selAssign = assignMap[selected] ?? []
  const selTask = taskMap[selected] ?? []
  const selCount = selEv.length + selClass.length + selAssess.length + selAssign.length + selTask.length

  const Section = ({
    icon: Icon,
    title,
    color,
    empty,
    children,
  }: {
    icon: typeof CalendarDays
    title: string
    color: string
    empty: string
    children: React.ReactNode | null
  }) => (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
        <Icon className={`h-3.5 w-3.5 ${color}`} /> {title}
      </div>
      {children ?? <p className="text-xs text-slate-300">{empty}</p>}
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Calendar</h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
            {LEGEND.map((l) => (
              <span key={l.key} className="flex items-center gap-1">
                <span className={`h-1.5 w-1.5 rounded-full ${l.dot}`} /> {l.label}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/calendar?m=${prevM}`} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <span className="min-w-[150px] text-center text-sm font-semibold text-slate-800">
            {MONTHS[m]} {year}
          </span>
          <Link href={`/calendar?m=${nextM}`} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50">
            <ChevronRight className="h-4 w-4" />
          </Link>
          <Link href="/calendar" className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
            Today
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Month grid */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white lg:col-span-2">
          <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50 text-center text-xs font-medium text-slate-500">
            {DOW.map((d) => (
              <div key={d} className="py-2">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((d, i) => {
              if (d === null)
                return <div key={i} className="min-h-[84px] border-b border-r border-slate-100 bg-slate-50/40" />
              const iso = `${monthKey}-${pad(d)}`
              const isToday = iso === todayISO
              const isSel = iso === selected
              const dots = [
                evMap[iso]?.length ? 'bg-blue-500' : '',
                classMap[iso]?.length ? 'bg-indigo-500' : '',
                assessMap[iso]?.length ? 'bg-violet-500' : '',
                assignMap[iso]?.length ? 'bg-rose-500' : '',
                taskMap[iso]?.length ? 'bg-amber-500' : '',
              ].filter(Boolean)
              return (
                <Link
                  key={i}
                  href={`/calendar?m=${monthKey}&d=${iso}`}
                  className={`min-h-[84px] border-b border-r border-slate-100 p-2 transition hover:bg-blue-50/40 ${
                    isSel ? 'bg-blue-50/60 ring-2 ring-inset ring-blue-500' : isToday ? 'bg-amber-50/40' : ''
                  }`}
                >
                  <div
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                      isToday ? 'bg-blue-600 text-white' : isSel ? 'text-blue-700' : 'text-slate-600'
                    }`}
                  >
                    {d}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {dots.map((c, k) => (
                      <span key={k} className={`h-1.5 w-1.5 rounded-full ${c}`} />
                    ))}
                  </div>
                </Link>
              )
            })}
          </div>
        </div>

        {/* Selected-day agenda */}
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <CalendarClock className="h-5 w-5 text-blue-600" />
            <div>
              <div className="text-sm font-semibold text-slate-900">{selPretty}</div>
              <div className="text-xs text-slate-400">{selCount} item(s)</div>
            </div>
          </div>

          <Section icon={CalendarDays} title="Events" color="text-blue-500" empty="No events">
            {selEv.length ? (
              <div className="space-y-1">
                {selEv.map((e: any, k: number) => (
                  <div
                    key={k}
                    className={`rounded-lg border px-2 py-1.5 text-xs ${TYPE_CLS[e.type] ?? 'border-slate-200 bg-slate-50 text-slate-600'}`}
                  >
                    <b>
                      {e.time ? `${e.time} · ` : ''}
                      {e.title}
                    </b>
                    {e.batch ? <span className="opacity-70"> · {e.batch}</span> : null}
                  </div>
                ))}
              </div>
            ) : null}
          </Section>

          <Section icon={GraduationCap} title="Classes" color="text-indigo-500" empty="No classes">
            {selClass.length ? (
              <div className="space-y-1">
                {selClass.map((t: any, k: number) => (
                  <div key={k} className="rounded-lg bg-indigo-50 px-2 py-1.5 text-xs text-indigo-700">
                    {t.topic}
                    {t.batch ? <span className="opacity-70"> · {t.batch}</span> : null}
                  </div>
                ))}
              </div>
            ) : null}
          </Section>

          <Section icon={FileCheck} title="Assessments" color="text-violet-500" empty="No assessments">
            {selAssess.length ? (
              <div className="space-y-1">
                {selAssess.map((a: any, k: number) => (
                  <div key={k} className="flex justify-between rounded-lg bg-violet-50 px-2 py-1.5 text-xs text-violet-700">
                    <span>{a.title}</span>
                    <span className="opacity-70">
                      {one(a.batches)?.name ?? ''}
                      {a.total_marks ? ` · ${a.total_marks}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </Section>

          <Section icon={ClipboardList} title="Assignments Due" color="text-rose-500" empty="No assignments due">
            {selAssign.length ? (
              <div className="space-y-1">
                {selAssign.map((a: any, k: number) => (
                  <div key={k} className="flex justify-between rounded-lg bg-rose-50 px-2 py-1.5 text-xs text-rose-700">
                    <span>{a.title}</span>
                    <span className="opacity-70">{one(a.batches)?.name ?? ''}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </Section>

          <Section icon={Brain} title="My Tasks" color="text-amber-500" empty="No tasks due">
            {selTask.length ? (
              <div className="space-y-1">
                {selTask.map((t: any, k: number) => (
                  <div key={k} className="flex justify-between rounded-lg bg-amber-50 px-2 py-1.5 text-xs text-amber-700">
                    <span className={t.status === 'done' ? 'line-through opacity-60' : ''}>{t.title}</span>
                    <span className="opacity-70">{t.priority ?? ''}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </Section>

          <div className="border-t border-slate-100 pt-3">
            <AddEventForm trainerId={userId} />
          </div>
        </div>
      </div>
    </div>
  )
}
