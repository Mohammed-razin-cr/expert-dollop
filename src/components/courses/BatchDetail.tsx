'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, TrendingUp, CalendarCheck, ClipboardCheck, FileText, ClipboardList, Search,
} from 'lucide-react'
import { useDebouncedValue } from '@/lib/useDebouncedValue'

/**
 * Batch detail, six tabs over one already-loaded dataset.
 *
 * Everything is read-only: this is the trainer's window onto a batch, not
 * an editing surface. Marking attendance, grading and uploading each have
 * their own screen.
 */

type Batch = {
  id: string
  name: string
  course: string | null
  trainer: string | null
  start_date: string | null
  end_date: string | null
  capacity: number | null
  progress: number
  status: string
}
type Stats = {
  enrolled: number
  attendancePct: number | null
  pendingReviews: number
  materials: number
  assignments: number
}
type Student = {
  id: string
  name: string
  email: string | null
  mobile: string | null
  status: string
  progress: number
  attendancePct: number | null
  present: number
  sessions: number
  submitted: number
  assignmentsTotal: number
  avgScore: number | null
  lastActive: string | null
}
type Assignment = {
  id: string
  title: string
  description: string | null
  due_date: string | null
  submitted: number
  graded: number
  cohort: number
}
type Material = {
  id: string
  title: string
  type: string | null
  uploaded_by: string | null
  created_at: string | null
}
type Assessment = {
  id: string
  student: string
  date: string | null
  topic: string | null
  score: number | null
  result: string | null
  remarks: string | null
}
type Pending = {
  id: string
  student: string
  assignment: string
  status: string
  submitted_at: string | null
}

const TABS = [
  'Students',
  'Performance',
  'Attendance',
  'Assignments',
  'Materials Shared',
  'Pending Reviews',
] as const
type Tab = (typeof TABS)[number]

/** The tabs that list students, and so are what the search box narrows. */
const SEARCHABLE: Tab[] = ['Students', 'Performance', 'Attendance']

const fmt = (d: string | null) =>
  d
    ? new Date(d + 'T00:00:00').toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—'

/** Two letters from the first name, as in the design. */
const initials = (name: string) => name.trim().slice(0, 2).toUpperCase() || '?'

function attendanceTone(pct: number) {
  if (pct >= 90) return 'text-emerald-600'
  if (pct >= 75) return 'text-amber-600'
  return 'text-rose-600'
}

function ProgressBar({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value))
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-28 shrink-0 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-blue-600" style={{ width: `${v}%` }} />
      </div>
      <span className="text-xs text-slate-600">{v}%</span>
    </div>
  )
}

const th = 'px-5 py-3 font-medium'
const td = 'px-5 py-3.5'

function Empty({ cols, children }: { cols: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={cols} className="px-5 py-10 text-center text-slate-400">
        {children}
      </td>
    </tr>
  )
}

export function BatchDetail({
  backHref,
  batch,
  stats,
  students,
  assignments,
  materials,
  assessments,
  pending,
}: {
  backHref: string
  batch: Batch
  stats: Stats
  students: Student[]
  assignments: Assignment[]
  materials: Material[]
  assessments: Assessment[]
  pending: Pending[]
}) {
  const [tab, setTab] = useState<Tab>('Students')
  // `qInput` is what is typed and `q` is what the tables are filtered by, a
  // beat behind it. The box stays instant; the filter runs once you pause.
  const [qInput, setQInput] = useState('')
  const q = useDebouncedValue(qInput)

  const needle = q.trim().toLowerCase()
  // One filtered roll drives all three student tabs, so switching between
  // them keeps showing the same people.
  const shown = useMemo(() => {
    if (!needle) return students
    return students.filter((s) =>
      [s.name, s.email, s.mobile].some((v) => (v ?? '').toLowerCase().includes(needle)),
    )
  }, [students, needle])
  // Assessment History sits under Performance and is per student, so the
  // same term narrows it rather than leaving rows for people no longer listed.
  const shownAssessments = useMemo(() => {
    if (!needle) return assessments
    return assessments.filter((a) => a.student.toLowerCase().includes(needle))
  }, [assessments, needle])

  /** Empty-state wording: nobody enrolled is a different thing from nobody
   *  matching what was typed. */
  const noMatch = needle !== '' && students.length > 0

  const kpis = [
    { label: 'Batch Progress', value: `${batch.progress}%`, Icon: TrendingUp, tone: 'bg-blue-50 text-blue-600' },
    { label: 'Attendance', value: stats.attendancePct === null ? '—' : `${stats.attendancePct}%`, Icon: CalendarCheck, tone: 'bg-amber-50 text-amber-600' },
    { label: 'Pending Reviews', value: stats.pendingReviews, Icon: ClipboardCheck, tone: 'bg-purple-50 text-purple-600' },
    { label: 'Materials Shared', value: stats.materials, Icon: FileText, tone: 'bg-sky-50 text-sky-600' },
    { label: 'Assignments', value: stats.assignments, Icon: ClipboardList, tone: 'bg-rose-50 text-rose-600' },
  ]

  return (
    <div className="space-y-5">
      <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Back to Batches
      </Link>

      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-slate-900">{batch.name}</h1>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium capitalize text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {batch.status}
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {batch.course ?? '—'} <span className="mx-1.5 text-slate-300">•</span>
          Trainer: {batch.trainer ?? 'Unassigned'} <span className="mx-1.5 text-slate-300">•</span>
          {stats.enrolled} / {batch.capacity ?? '—'} Students
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((k) => (
          <div key={k.label} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
            <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${k.tone}`}>
              <k.Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xl font-semibold text-slate-900">{k.value}</p>
              <p className="truncate text-xs text-slate-500">{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex overflow-x-auto border-b border-slate-100">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`whitespace-nowrap border-b-2 px-5 py-3.5 text-sm font-medium transition-colors ${
                tab === t
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {SEARCHABLE.includes(tab) && (
          <div className="border-b border-slate-100 px-5 py-3">
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
                placeholder="Search students by name, email or mobile…"
                aria-label="Search students in this batch"
                className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              />
            </div>
            {needle && (
              <p className="mt-1.5 text-xs text-slate-500">
                {shown.length} of {students.length} {students.length === 1 ? 'student' : 'students'}
              </p>
            )}
          </div>
        )}

        <div className="overflow-x-auto">
          {tab === 'Students' && (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr>
                  <th className={th}>Name</th>
                  <th className={th}>Email</th>
                  <th className={th}>Attendance</th>
                  <th className={th}>Progress</th>
                  <th className={th}>Assignments</th>
                  <th className={th}>Last Active</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((s) => (
                  <tr key={s.id} className="border-t border-slate-100">
                    <td className={td}>
                      <div className="flex items-center gap-3">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600">
                          {initials(s.name)}
                        </span>
                        <Link href={`/students/${s.id}`} className="font-medium text-slate-900 hover:text-blue-600">
                          {s.name}
                        </Link>
                      </div>
                    </td>
                    <td className={`${td} text-slate-600`}>{s.email ?? '—'}</td>
                    <td className={td}>
                      {s.attendancePct === null ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <span className={`font-medium ${attendanceTone(s.attendancePct)}`}>{s.attendancePct}%</span>
                      )}
                    </td>
                    <td className={td}><ProgressBar value={s.progress} /></td>
                    <td className={`${td} text-slate-600`}>
                      {s.assignmentsTotal ? `${s.submitted} / ${s.assignmentsTotal}` : '—'}
                    </td>
                    <td className={`${td} whitespace-nowrap text-slate-600`}>{fmt(s.lastActive)}</td>
                  </tr>
                ))}
                {!shown.length && (
                  <Empty cols={6}>
                    {noMatch ? 'No student matches that search.' : 'Nobody is enrolled in this batch yet.'}
                  </Empty>
                )}
              </tbody>
            </table>
          )}

          {tab === 'Performance' && (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr>
                  <th className={th}>Student</th>
                  <th className={th}>Avg Score</th>
                  <th className={th}>Progress</th>
                  <th className={th}>Attendance</th>
                  <th className={th}>Assignments</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((s) => (
                  <tr key={s.id} className="border-t border-slate-100">
                    <td className={`${td} font-medium text-slate-900`}>{s.name}</td>
                    <td className={td}>
                      {s.avgScore === null ? (
                        <span className="text-slate-400">Not assessed</span>
                      ) : (
                        <span className={`font-medium ${s.avgScore >= 50 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {s.avgScore}
                        </span>
                      )}
                    </td>
                    <td className={td}><ProgressBar value={s.progress} /></td>
                    <td className={`${td} text-slate-600`}>
                      {s.attendancePct === null ? '—' : `${s.attendancePct}%`}
                    </td>
                    <td className={`${td} text-slate-600`}>
                      {s.assignmentsTotal ? `${s.submitted} / ${s.assignmentsTotal}` : '—'}
                    </td>
                  </tr>
                ))}
                {!shown.length && (
                  <Empty cols={5}>
                    {noMatch ? 'No student matches that search.' : 'No students to report on.'}
                  </Empty>
                )}
              </tbody>
            </table>
          )}

          {tab === 'Attendance' && (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr>
                  <th className={th}>Student</th>
                  <th className={th}>Attended</th>
                  <th className={th}>Sessions</th>
                  <th className={th}>Rate</th>
                  <th className={th}>Last Seen</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((s) => (
                  <tr key={s.id} className="border-t border-slate-100">
                    <td className={`${td} font-medium text-slate-900`}>{s.name}</td>
                    <td className={`${td} text-slate-600`}>{s.present}</td>
                    <td className={`${td} text-slate-600`}>{s.sessions}</td>
                    <td className={td}>
                      {s.attendancePct === null ? (
                        <span className="text-slate-400">Not marked</span>
                      ) : (
                        <span className={`font-medium ${attendanceTone(s.attendancePct)}`}>{s.attendancePct}%</span>
                      )}
                    </td>
                    <td className={`${td} whitespace-nowrap text-slate-600`}>{fmt(s.lastActive)}</td>
                  </tr>
                ))}
                {!shown.length && (
                  <Empty cols={5}>
                    {noMatch ? 'No student matches that search.' : 'No attendance recorded for this batch.'}
                  </Empty>
                )}
              </tbody>
            </table>
          )}

          {tab === 'Assignments' && (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr>
                  <th className={th}>Assignment</th>
                  <th className={th}>Due</th>
                  <th className={th}>Submitted</th>
                  <th className={th}>Graded</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => (
                  <tr key={a.id} className="border-t border-slate-100">
                    <td className={td}>
                      <p className="font-medium text-slate-900">{a.title}</p>
                      {a.description && <p className="mt-0.5 text-xs text-slate-500">{a.description}</p>}
                    </td>
                    <td className={`${td} whitespace-nowrap text-slate-600`}>{fmt(a.due_date)}</td>
                    <td className={`${td} text-slate-600`}>{a.submitted} / {a.cohort}</td>
                    <td className={`${td} text-slate-600`}>{a.graded} / {a.cohort}</td>
                  </tr>
                ))}
                {!assignments.length && <Empty cols={4}>No assignments set for this batch yet.</Empty>}
              </tbody>
            </table>
          )}

          {tab === 'Materials Shared' && (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr>
                  <th className={th}>Title</th>
                  <th className={th}>Type</th>
                  <th className={th}>Shared By</th>
                  <th className={th}>Added</th>
                </tr>
              </thead>
              <tbody>
                {materials.map((m) => (
                  <tr key={m.id} className="border-t border-slate-100">
                    <td className={`${td} font-medium text-slate-900`}>{m.title}</td>
                    <td className={`${td} uppercase text-slate-500`}>{m.type ?? '—'}</td>
                    <td className={`${td} text-slate-600`}>{m.uploaded_by ?? '—'}</td>
                    <td className={`${td} whitespace-nowrap text-slate-600`}>{fmt(m.created_at)}</td>
                  </tr>
                ))}
                {!materials.length && (
                  <Empty cols={4}>
                    Nothing shared with this batch yet — upload from the Materials screen.
                  </Empty>
                )}
              </tbody>
            </table>
          )}

          {tab === 'Pending Reviews' && (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr>
                  <th className={th}>Student</th>
                  <th className={th}>Assignment</th>
                  <th className={th}>Status</th>
                  <th className={th}>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100">
                    <td className={`${td} font-medium text-slate-900`}>{p.student}</td>
                    <td className={`${td} text-slate-600`}>{p.assignment}</td>
                    <td className={td}>
                      <span className={`rounded-md px-2 py-1 text-xs font-medium ${
                        p.status === 'submitted' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {p.status === 'submitted' ? 'Awaiting review' : 'Not submitted'}
                      </span>
                    </td>
                    <td className={`${td} whitespace-nowrap text-slate-600`}>{fmt(p.submitted_at)}</td>
                  </tr>
                ))}
                {!pending.length && <Empty cols={4}>Nothing waiting to be reviewed.</Empty>}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {tab === 'Performance' && shownAssessments.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-3.5 text-sm font-semibold text-slate-800">
            Assessment History
          </div>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-500">
              <tr>
                <th className={th}>Student</th>
                <th className={th}>Date</th>
                <th className={th}>Topic</th>
                <th className={th}>Score</th>
                <th className={th}>Result</th>
                <th className={th}>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {shownAssessments.map((a) => (
                <tr key={a.id} className="border-t border-slate-100">
                  <td className={`${td} font-medium text-slate-900`}>{a.student}</td>
                  <td className={`${td} whitespace-nowrap text-slate-600`}>{fmt(a.date)}</td>
                  <td className={`${td} text-slate-600`}>{a.topic ?? '—'}</td>
                  <td className={`${td} text-slate-600`}>{a.score ?? '—'}</td>
                  <td className={`${td} text-slate-600`}>{a.result ?? '—'}</td>
                  <td className={`${td} text-slate-500`}>{a.remarks ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
