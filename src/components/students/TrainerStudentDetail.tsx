'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, CalendarCheck, TrendingUp, Star, ClipboardList, FileCheck, Mail, Phone, Plus,
  MessageSquare, Download,
  File, FileText, FileType, Presentation, Video, Sheet, Link as LinkIcon,
} from 'lucide-react'
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { createClient } from '@/lib/api/client'
import { printDoc } from '@/lib/printDoc'
import { dash, section, pair, reportHeader, today, esc, TABLE_CSS } from '@/lib/reportHtml'
import type { TrainerStudentDetail, AssessmentResultRow } from '@/lib/studentDetail'

/**
 * Student profile as their trainer sees it.
 *
 * Separate from StudentDetail, which is the BD/admin editing screen —
 * nothing here changes what those roles see. Read-only apart from notes,
 * which trainers add themselves.
 */

const TABS = ['Profile', 'Attendance', 'Performance', 'Assignments', 'Materials'] as const
type Tab = (typeof TABS)[number]

const initials = (n: string) => n.trim().slice(0, 2).toUpperCase() || '?'

const fmt = (d: string | null) =>
  d
    ? new Date(d + 'T00:00:00').toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—'

const ATT_CHIP: Record<string, string> = {
  present: 'bg-emerald-50 text-emerald-700',
  late: 'bg-amber-50 text-amber-700',
  absent: 'bg-rose-50 text-rose-700',
  not_marked: 'bg-slate-100 text-slate-500',
}
const ATT_LABEL: Record<string, string> = {
  present: 'Present',
  late: 'Late',
  absent: 'Absent',
  not_marked: 'Not marked',
}
// "Handed in" states read green, "still owed" states read amber. A row
// with no submission at all and one explicitly marked pending both mean
// the same thing to a trainer, so both show as Pending.
const SUB_LABEL: Record<string, string> = {
  graded: 'Graded',
  submitted: 'Submitted',
  pending: 'Pending',
  late: 'Late',
  not_submitted: 'Pending',
}
const SUB_CHIP: Record<string, string> = {
  graded: 'bg-emerald-50 text-emerald-700',
  submitted: 'bg-emerald-50 text-emerald-700',
  pending: 'bg-amber-50 text-amber-700',
  late: 'bg-orange-50 text-orange-700',
  not_submitted: 'bg-amber-50 text-amber-700',
}

const th = 'px-5 py-3 font-medium'
const td = 'px-5 py-3.5'

/**
 * Icon and colour for a material, chosen from its type. `type` is free
 * text, so this matches loosely and falls back to a generic file.
 */
function fileIcon(type: string | null) {
  const t = (type ?? '').toLowerCase()
  if (t.includes('pdf')) return { Icon: FileType, tone: 'text-rose-500' }
  if (t.includes('ppt') || t.includes('slide')) return { Icon: Presentation, tone: 'text-orange-500' }
  if (t.includes('video') || t.includes('mp4')) return { Icon: Video, tone: 'text-purple-500' }
  if (t.includes('link') || t.includes('url')) return { Icon: LinkIcon, tone: 'text-blue-500' }
  if (t.includes('doc') || t.includes('word')) return { Icon: FileText, tone: 'text-sky-500' }
  if (t.includes('sheet') || t.includes('xls') || t.includes('csv')) {
    return { Icon: Sheet, tone: 'text-emerald-500' }
  }
  return { Icon: File, tone: 'text-slate-400' }
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-4 py-2">
      <span className="w-32 shrink-0 text-sm text-slate-500">{label}</span>
      <span className="min-w-0 text-sm font-medium text-slate-800">{value ?? '—'}</span>
    </div>
  )
}

function Empty({ cols, children }: { cols: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={cols} className="px-5 py-10 text-center text-slate-400">
        {children}
      </td>
    </tr>
  )
}

/**
 * Score over time.
 *
 * Oldest to newest, so the line reads left-to-right as progress. Results
 * without a date cannot be placed on a timeline and are left out of the
 * chart — they still appear in the table beside it.
 */
function ScoreTrend({ results }: { results: AssessmentResultRow[] }) {
  const points = results
    .filter((r) => r.date && r.scorePct !== null)
    .map((r) => ({ date: r.date as string, score: r.scorePct as number, name: r.name }))
    .sort((a, b) => a.date.localeCompare(b.date))

  if (points.length < 2) {
    return (
      <div className="grid h-56 place-items-center text-center text-sm text-slate-400">
        {points.length === 1
          ? 'Only one dated result so far — a trend appears once there are two.'
          : 'No dated results yet.'}
      </div>
    )
  }

  const short = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 12, bottom: 4, left: -18 }}>
          <CartesianGrid stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={short}
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 20, 40, 60, 80, 100]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            formatter={(v: any) => [`${v}%`, 'Score']}
            labelFormatter={(d: any) => short(String(d))}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke="#2563eb"
            strokeWidth={2}
            dot={{ r: 4, fill: '#2563eb' }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/**
 * Attendance donut plus the counts behind it.
 *
 * Purpose-built rather than reusing components/charts/AttendanceDonut —
 * that one is shared with other screens and shows percentages in its
 * legend, where this needs raw class counts. Changing it would alter
 * screens outside the trainer module.
 */
function AttendanceSummary({
  attended,
  missed,
  total,
  pct,
}: {
  attended: number
  missed: number
  total: number
  pct: number | null
}) {
  const slices = total
    ? [
        { name: 'Attended', value: attended, color: '#10b981' },
        { name: 'Missed', value: missed, color: '#ef4444' },
      ].filter((s) => s.value > 0)
    : [{ name: 'No data', value: 1, color: '#e2e8f0' }]

  const rows = [
    { label: 'Classes Attended', value: attended, color: '#10b981' },
    { label: 'Classes Missed', value: missed, color: '#ef4444' },
    { label: 'Total Classes', value: total, color: '#cbd5e1' },
  ]

  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative h-44 w-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={slices} dataKey="value" innerRadius={58} outerRadius={82} paddingAngle={2} stroke="none">
              {slices.map((s, i) => (
                <Cell key={i} fill={s.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="text-center">
            <p className="text-2xl font-semibold text-slate-900">{pct === null ? '—' : `${pct}%`}</p>
            <p className="text-[11px] text-slate-400">Attendance</p>
          </div>
        </div>
      </div>

      <div className="min-w-[200px] flex-1">
        <ul className="space-y-3 text-sm">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: r.color }} />
              <span className="text-slate-600">{r.label}</span>
              <span className="ml-auto font-semibold text-slate-900">{r.value}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3 text-sm">
          <span className="text-slate-600">Attendance %</span>
          <span className="ml-auto font-semibold text-slate-900">{pct === null ? '—' : `${pct}%`}</span>
        </div>
      </div>
    </div>
  )
}

/**
 * Printable student report.
 *
 * Rendered as HTML and opened through printDoc, the same helper the
 * invoice printing uses — the browser's own "Save as PDF" turns it into a
 * PDF, so no PDF library is needed.
 */
function buildReportHTML(d: TrainerStudentDetail): string {
  const { student: s, stats } = d

  return `
  ${reportHeader(
    s.name,
    `${dash(s.course)} &nbsp;•&nbsp; ${dash(s.batch)} &nbsp;•&nbsp; ${esc(s.status === 'active' ? 'Active' : 'Inactive')}`,
    `Student report · generated ${today()}`,
  )}

  <h2 style="margin:22px 0 0;font-size:14px;color:#0f172a">Summary</h2>
  <table style="${TABLE_CSS}">
    <tbody>
      ${pair('Attendance', stats.attendancePct === null ? 'Not marked' : `${stats.attendancePct}%`)}
      ${pair('Progress', `${stats.progress}%`)}
      ${pair('Average Score', stats.avgScore === null ? 'Not assessed' : `${stats.avgScore}%`)}
      ${pair('Assignments', `${stats.assignmentsDone} of ${stats.assignmentsTotal}`)}
      ${pair('Assessments', `${stats.assessmentsDone} of ${stats.assessmentsTotal}`)}
    </tbody>
  </table>

  <h2 style="margin:22px 0 0;font-size:14px;color:#0f172a">Profile</h2>
  <table style="${TABLE_CSS}">
    <tbody>
      ${pair('Email', s.email)}
      ${pair('Mobile', s.mobile)}
      ${pair('Date of Birth', s.dob)}
      ${pair('Enrollment Date', s.enrolled_at)}
      ${pair('Guardian Name', s.guardian_name)}
      ${pair('Guardian Mobile', s.guardian_mobile)}
      ${pair('About', s.about)}
    </tbody>
  </table>

  ${section(
    'Attendance',
    ['Date', 'Status'],
    d.attendance.map((a) => [a.date, ATT_LABEL[a.status] ?? a.status]),
    'No attendance recorded.',
  )}

  ${section(
    'Performance',
    ['Date', 'Topic', 'Score', 'Result', 'Remarks'],
    d.performance.map((p) => [p.date, p.topic, p.score, p.result, p.remarks]),
    'No assessments recorded.',
  )}

  ${section(
    'Assignments',
    ['Assignment', 'Due', 'Status', 'Submitted', 'Score'],
    d.assignments.map((a) => [a.title, a.due_date, SUB_LABEL[a.status] ?? a.status, a.submitted_at, a.score]),
    'No assignments set for this batch.',
  )}

  ${section(
    'Notes',
    ['Date', 'Author', 'Note'],
    d.notes.map((n) => [n.created_at, n.author, n.note]),
    'No notes.',
  )}`
}

export function TrainerStudentDetailView({ data }: { data: TrainerStudentDetail }) {
  const router = useRouter()
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>('Profile')
  const [showAllAttendance, setShowAllAttendance] = useState(false)
  const [showAllAssessments, setShowAllAssessments] = useState(false)
  const [showAllAssignments, setShowAllAssignments] = useState(false)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const { student: s, stats } = data

  function downloadReport() {
    printDoc(`Student Report — ${s.name}`, buildReportHTML(data))
  }

  async function addNote() {
    if (!draft.trim()) return setErr('Write something first')
    setBusy(true)
    setErr(null)
    const { data: auth } = await supabase.auth.getUser()
    const { error } = await supabase.from('student_notes').insert({
      student_id: s.id,
      note: draft.trim(),
      created_by: auth?.user?.id ?? null,
    })
    setBusy(false)
    if (error) return setErr(error.message)
    setDraft('')
    setAdding(false)
    router.refresh()
  }

  const kpis = [
    { label: 'Attendance', value: stats.attendancePct === null ? '—' : `${stats.attendancePct}%`, Icon: CalendarCheck, tone: 'bg-emerald-50 text-emerald-600' },
    { label: 'Progress', value: `${stats.progress}%`, Icon: TrendingUp, tone: 'bg-blue-50 text-blue-600' },
    { label: 'Average Score', value: stats.avgScore === null ? '—' : `${stats.avgScore}%`, Icon: Star, tone: 'bg-amber-50 text-amber-600' },
    { label: 'Assignments', value: `${stats.assignmentsDone} / ${stats.assignmentsTotal}`, Icon: ClipboardList, tone: 'bg-purple-50 text-purple-600' },
    { label: 'Assessments', value: `${stats.assessmentsDone} / ${stats.assessmentsTotal}`, Icon: FileCheck, tone: 'bg-rose-50 text-rose-600' },
  ]

  return (
    <div className="space-y-5">
      <Link href="/students" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Back to Students
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-purple-100 text-lg font-semibold text-purple-700">
            {initials(s.name)}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-semibold text-slate-900">{s.name}</h1>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                s.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
              }`}>
                {s.status === 'active' ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-slate-500">
              {s.course ?? '—'} <span className="mx-1.5 text-slate-300">•</span> {s.batch ?? '—'}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-4 text-sm text-slate-500">
              {s.email && (
                <a href={`mailto:${s.email}`} className="inline-flex items-center gap-1.5 hover:text-slate-800">
                  <Mail className="h-3.5 w-3.5" /> {s.email}
                </a>
              )}
              {s.mobile && (
                <a href={`tel:${s.mobile}`} className="inline-flex items-center gap-1.5 hover:text-slate-800">
                  <Phone className="h-3.5 w-3.5" /> {s.mobile}
                </a>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Disabled until there is something to message through — there
              is no messaging backend yet. Left visible so the action is
              discoverable once it exists. */}
          <button
            type="button"
            disabled
            title="Messaging is not set up yet"
            className="flex cursor-not-allowed items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-400"
          >
            <MessageSquare className="h-4 w-4" /> Message Student
          </button>
          <button
            type="button"
            onClick={downloadReport}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Download className="h-4 w-4" /> Download Report
          </button>
        </div>
      </div>

      {/* KPIs */}
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

      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`whitespace-nowrap border-b-2 px-6 py-3 text-sm font-medium transition-colors ${
              tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Profile' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2">
            <h2 className="mb-3 text-sm font-semibold text-slate-800">Basic Information</h2>
            <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
              <div>
                <Field label="Name" value={s.name} />
                <Field label="Email" value={s.email ?? '—'} />
                <Field label="Mobile" value={s.mobile ?? '—'} />
                <Field label="Date of Birth" value={fmt(s.dob)} />
                <Field
                  label="Status"
                  value={
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      s.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                    }`}>
                      {s.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  }
                />
              </div>
              <div>
                <Field label="Course" value={s.course ?? '—'} />
                <Field label="Batch" value={s.batch ?? '—'} />
                <Field label="Enrollment Date" value={fmt(s.enrolled_at)} />
                <Field label="Guardian Name" value={s.guardian_name ?? '—'} />
                <Field label="Guardian Mobile" value={s.guardian_mobile ?? '—'} />
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="mb-2 text-sm font-semibold text-slate-800">About Student</h2>
              <p className="text-sm text-slate-600">{s.about ?? '—'}</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="mb-2 text-sm font-semibold text-slate-800">Notes</h2>

              {data.notes.length ? (
                <ul className="mb-3 space-y-3">
                  {data.notes.map((n) => (
                    <li key={n.id} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                      <p className="text-sm text-slate-700">{n.note}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {n.author ?? 'Unknown'} · {fmt(n.created_at)}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mb-3 text-sm text-slate-500">—</p>
              )}

              {adding ? (
                <div className="space-y-2">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Add a note about this student…"
                    className="h-24 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                  />
                  {err && <p className="text-sm text-rose-600">{err}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={addNote}
                      disabled={busy}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                    >
                      {busy ? 'Saving…' : 'Save Note'}
                    </button>
                    <button
                      onClick={() => { setAdding(false); setErr(null); setDraft('') }}
                      className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAdding(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <Plus className="h-4 w-4" /> Add Note
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'Attendance' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold text-slate-800">Attendance Summary</h2>
            <AttendanceSummary
              attended={stats.classesAttended}
              missed={stats.classesMissed}
              total={stats.classesTotal}
              pct={stats.attendancePct}
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white">
            <h2 className="border-b border-slate-100 px-5 py-3.5 text-sm font-semibold text-slate-800">
              Attendance History
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-100 text-left text-xs text-slate-500">
                  <tr>
                    <th className={th}>Date</th>
                    <th className={th}>Topic / Class</th>
                    <th className={th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(showAllAttendance ? data.attendance : data.attendance.slice(0, 5)).map((a, i) => (
                    <tr key={`${a.date}-${i}`} className="border-t border-slate-100">
                      <td className={`${td} whitespace-nowrap text-slate-700`}>{fmt(a.date)}</td>
                      <td className={`${td} text-slate-600`}>{a.topic ?? '—'}</td>
                      <td className={td}>
                        <span className={`rounded-md px-2 py-1 text-xs font-medium ${ATT_CHIP[a.status] ?? ''}`}>
                          {ATT_LABEL[a.status] ?? a.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!data.attendance.length && (
                    <Empty cols={3}>No attendance recorded for this student yet.</Empty>
                  )}
                </tbody>
              </table>
            </div>

            {data.attendance.length > 5 && (
              <div className="border-t border-slate-100 px-5 py-3.5 text-center">
                <button
                  onClick={() => setShowAllAttendance((v) => !v)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  {showAllAttendance
                    ? 'Show Recent Only'
                    : `View Full Attendance (${data.attendance.length})`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'Performance' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold text-slate-800">Score Trend</h2>
            <ScoreTrend results={data.assessmentResults} />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white">
            <h2 className="border-b border-slate-100 px-5 py-3.5 text-sm font-semibold text-slate-800">
              Assessment Results
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-100 text-left text-xs text-slate-500">
                  <tr>
                    <th className={th}>Assessment</th>
                    <th className={th}>Score</th>
                    <th className={th}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {(showAllAssessments ? data.assessmentResults : data.assessmentResults.slice(0, 5)).map((r) => (
                    <tr key={r.id} className="border-t border-slate-100">
                      <td className={`${td} font-medium text-slate-900`}>{r.name}</td>
                      <td className={td}>
                        {r.scorePct === null ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <span className={`font-medium ${r.scorePct >= 50 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {r.scorePct}%
                          </span>
                        )}
                      </td>
                      <td className={`${td} whitespace-nowrap text-slate-600`}>{fmt(r.date)}</td>
                    </tr>
                  ))}
                  {!data.assessmentResults.length && (
                    <Empty cols={3}>No assessments recorded for this student yet.</Empty>
                  )}
                </tbody>
              </table>
            </div>

            {data.assessmentResults.length > 5 && (
              <div className="border-t border-slate-100 px-5 py-3.5 text-center">
                <button
                  onClick={() => setShowAllAssessments((v) => !v)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  {showAllAssessments
                    ? 'Show Recent Only'
                    : `View All Assessments (${data.assessmentResults.length})`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'Assignments' && (
        <div className="rounded-xl border border-slate-200 bg-white">
          <h2 className="border-b border-slate-100 px-5 py-3.5 text-sm font-semibold text-slate-800">
            Assignments
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 text-left text-xs text-slate-500">
                <tr>
                  <th className={`${th} w-12`}>#</th>
                  <th className={th}>Assignment</th>
                  <th className={th}>Due Date</th>
                  <th className={th}>Status</th>
                  <th className={th}>Score</th>
                </tr>
              </thead>
              <tbody>
                {(showAllAssignments ? data.assignments : data.assignments.slice(0, 5)).map((a, i) => (
                  <tr key={a.id} className="border-t border-slate-100">
                    <td className={`${td} text-slate-400`}>{i + 1}</td>
                    <td className={`${td} font-medium text-slate-900`}>{a.title}</td>
                    <td className={`${td} whitespace-nowrap text-slate-600`}>{fmt(a.due_date)}</td>
                    <td className={td}>
                      <span className={`rounded-md px-2.5 py-1 text-xs font-medium ${SUB_CHIP[a.status] ?? ''}`}>
                        {SUB_LABEL[a.status] ?? a.status}
                      </span>
                    </td>
                    <td className={td}>
                      {a.score === null ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <span className={`font-medium ${a.score >= 50 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {a.score}%
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {!data.assignments.length && <Empty cols={5}>No assignments set for this batch yet.</Empty>}
              </tbody>
            </table>
          </div>

          {data.assignments.length > 5 && (
            <div className="border-t border-slate-100 px-5 py-3.5 text-center">
              <button
                onClick={() => setShowAllAssignments((v) => !v)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                {showAllAssignments
                  ? 'Show Recent Only'
                  : `View All Assignments (${data.assignments.length})`}
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'Materials' && (
        <div className="rounded-xl border border-slate-200 bg-white">
          <h2 className="border-b border-slate-100 px-5 py-3.5 text-sm font-semibold text-slate-800">
            Materials Shared
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 text-left text-xs text-slate-500">
                <tr>
                  <th className={th}>Material</th>
                  <th className={th}>Type</th>
                  <th className={th}>Shared On</th>
                </tr>
              </thead>
              <tbody>
                {data.materials.map((m) => {
                  const { Icon, tone } = fileIcon(m.type)
                  return (
                    <tr key={m.id} className="border-t border-slate-100">
                      <td className={td}>
                        <div className="flex items-center gap-3">
                          <Icon className={`h-5 w-5 shrink-0 ${tone}`} />
                          <span className="font-medium text-slate-900">{m.title}</span>
                        </div>
                      </td>
                      <td className={`${td} uppercase text-slate-500`}>{m.type ?? '—'}</td>
                      <td className={`${td} whitespace-nowrap text-slate-600`}>{fmt(m.created_at)}</td>
                    </tr>
                  )
                })}
                {!data.materials.length && (
                  <Empty cols={3}>Nothing shared with this batch yet — upload from the Materials screen.</Empty>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
