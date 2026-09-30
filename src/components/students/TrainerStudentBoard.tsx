'use client'

import { useEffect, useMemo, useState } from 'react'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import Link from 'next/link'
import { Search, Users, UserCheck, CalendarX, ClipboardCheck, FileBarChart } from 'lucide-react'
import { LOW_ATTENDANCE, type TrainerStudentRow, type TrainerStudentStats } from '@/lib/students'

/**
 * Students board for trainers.
 *
 * A separate component from the shared /students page, which stays exactly
 * as it was for BD, admin and super_admin — nothing here can change what
 * they see.
 *
 * Read-only: a trainer looks students up here and opens one for detail.
 * Adding and editing students belongs to BD and admin.
 */

/** A card with an action filters the list below it; the rest are plain. */
type BoardKpi = {
  label: string
  value: string | number
  Icon: React.ComponentType<{ className?: string }>
  tone: string
  onClick?: () => void
  href?: string
}

const PAGE_SIZE = 10

const initials = (name: string) => name.trim().slice(0, 2).toUpperCase() || '?'

/** Stable pastel per student, so the same person keeps the same colour. */
const AVATAR_TONES = [
  'bg-purple-100 text-purple-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-sky-100 text-sky-700',
  'bg-rose-100 text-rose-700',
  'bg-indigo-100 text-indigo-700',
]
function toneFor(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return AVATAR_TONES[h % AVATAR_TONES.length]
}

function attendanceTone(pct: number) {
  if (pct >= 90) return 'text-emerald-600'
  if (pct >= LOW_ATTENDANCE) return 'text-amber-600'
  return 'text-rose-600'
}

const sel =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-300'

export function TrainerStudentBoard({
  rows,
  stats,
  courses,
  batches,
}: {
  rows: TrainerStudentRow[]
  stats: TrainerStudentStats
  courses: string[]
  batches: string[]
}) {
  // `draft` is what is typed; `q` is what the table is filtered by, a beat
  // behind it. The box stays instant and the filter runs once you pause, so
  // the list narrows on "pre" without waiting for the rest of the name.
  const [draft, setDraft] = useState('')
  const q = useDebouncedValue(draft)
  const [course, setCourse] = useState('all')
  const [batch, setBatch] = useState('all')
  const [attendance, setAttendance] = useState('all')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return rows.filter((r) => {
      if (needle) {
        const hay = `${r.name} ${r.mobile ?? ''} ${r.email ?? ''}`.toLowerCase()
        if (!hay.includes(needle)) return false
      }
      if (course !== 'all' && r.course !== course) return false
      if (batch !== 'all' && r.batch !== batch) return false
      if (status !== 'all' && r.status !== status) return false
      if (attendance !== 'all') {
        if (r.attendancePct === null) return false
        if (attendance === 'low' && r.attendancePct >= LOW_ATTENDANCE) return false
        if (attendance === 'ok' && (r.attendancePct < LOW_ATTENDANCE || r.attendancePct >= 90)) return false
        if (attendance === 'high' && r.attendancePct < 90) return false
      }
      return true
    })
  }, [rows, q, course, batch, attendance, status])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const firstRow = filtered.length ? (safePage - 1) * PAGE_SIZE + 1 : 0
  const lastRow = Math.min(safePage * PAGE_SIZE, filtered.length)

  // A new term goes back to page 1 — page 4 of the old result is rarely page 4
  // of the new one, and is usually past the end of it.
  useEffect(() => {
    setPage(1)
  }, [q])

  function reset() {
    setDraft('')
    setCourse('all')
    setBatch('all')
    setAttendance('all')
    setStatus('all')
    setPage(1)
  }

  // The first three narrow the table to the students they counted. Pending
  // Reviews counts assignment submissions rather than students, so it leaves
  // for the grading queue instead. An average has nothing to filter to.
  const kpis: BoardKpi[] = [
    { label: 'Total Students', value: stats.total, Icon: Users, tone: 'bg-purple-50 text-purple-600', onClick: reset },
    {
      label: 'Active Students',
      value: stats.active,
      Icon: UserCheck,
      tone: 'bg-emerald-50 text-emerald-600',
      onClick: () => { setAttendance('all'); setStatus('active'); setPage(1) },
    },
    {
      label: `Low Attendance (<${LOW_ATTENDANCE}%)`,
      value: stats.lowAttendance,
      Icon: CalendarX,
      tone: 'bg-amber-50 text-amber-600',
      onClick: () => { setStatus('all'); setAttendance('low'); setPage(1) },
    },
    { label: 'Pending Reviews', value: stats.pendingReviews, Icon: ClipboardCheck, tone: 'bg-rose-50 text-rose-600', href: '/assignments?status=ungraded' },
    { label: 'Avg. Score (%)', value: stats.avgScore === null ? '—' : stats.avgScore, Icon: FileBarChart, tone: 'bg-sky-50 text-sky-600' },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Students</h1>
        <p className="text-sm text-slate-500">
          {stats.total} {stats.total === 1 ? 'student' : 'students'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((k) => {
          const face = (
            <>
              <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${k.tone}`}>
                <k.Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-semibold text-slate-900">{k.value}</p>
                <p className="truncate text-xs text-slate-500">{k.label}</p>
              </div>
            </>
          )
          const box = 'flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4'
          const live = `${box} w-full text-left transition hover:border-blue-300 hover:shadow-sm`
          if (k.onClick) return <button key={k.label} type="button" onClick={k.onClick} className={live}>{face}</button>
          if (k.href) return <Link key={k.label} href={k.href} className={live}>{face}</Link>
          return <div key={k.label} className={box}>{face}</div>
        })}
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-500">Search</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Search by name or email or mobile…"
                className={`${sel} pl-9`}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Course</label>
            <select className={sel} value={course} onChange={(e) => { setCourse(e.target.value); setPage(1) }}>
              <option value="all">All Courses</option>
              {courses.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Batch</label>
            <select className={sel} value={batch} onChange={(e) => { setBatch(e.target.value); setPage(1) }}>
              <option value="all">All Batches</option>
              {batches.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Attendance</label>
            <select className={sel} value={attendance} onChange={(e) => { setAttendance(e.target.value); setPage(1) }}>
              <option value="all">All</option>
              <option value="high">90% and above</option>
              <option value="ok">{LOW_ATTENDANCE}–89%</option>
              <option value="low">Below {LOW_ATTENDANCE}%</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Status</label>
            <select className={sel} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}>
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* The Search button is gone with the term applying itself as you type
            — the selects beside it already applied on change, so it had nothing
            left to do. Reset still clears the lot in one go. */}
        <div className="mt-3 flex gap-2">
          <button
            onClick={reset}
            className="rounded-lg border border-slate-200 px-5 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 text-left text-xs text-slate-500">
              <tr>
                <th className="px-5 py-3.5 font-medium">Name</th>
                <th className="px-5 py-3.5 font-medium">Course</th>
                <th className="px-5 py-3.5 font-medium">Batch</th>
                <th className="px-5 py-3.5 font-medium">Attendance</th>
                <th className="px-5 py-3.5 font-medium">Progress</th>
                <th className="px-5 py-3.5 font-medium">Score (%)</th>
                <th className="px-5 py-3.5 font-medium">Status</th>
                <th className="px-5 py-3.5 font-medium">View Student</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((s) => (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[11px] font-semibold ${toneFor(s.id)}`}>
                        {initials(s.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900">{s.name}</p>
                        <p className="text-xs text-slate-500">{s.mobile ?? '—'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-slate-600">{s.course ?? '—'}</td>
                  <td className="px-5 py-4 text-slate-600">{s.batch ?? '—'}</td>
                  <td className="px-5 py-4">
                    {s.attendancePct === null ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      <span className={`font-medium ${attendanceTone(s.attendancePct)}`}>{s.attendancePct}%</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-28 shrink-0 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-blue-600"
                          style={{ width: `${Math.max(0, Math.min(100, s.progress))}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-600">{s.progress}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    {s.scorePct === null ? <span className="text-slate-400">—</span> : `${s.scorePct}%`}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      s.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                    }`}>
                      {s.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <Link
                      href={`/students/${s.id}`}
                      className="inline-block whitespace-nowrap rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50"
                    >
                      View Student
                    </Link>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-slate-400">
                    {rows.length
                      ? 'No students match these filters.'
                      : 'No students yet — they appear here once enrolled in one of your batches.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3">
            <p className="text-xs text-slate-500">
              Showing {firstRow} to {lastRow} of {filtered.length} student{filtered.length === 1 ? '' : 's'}
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(Math.max(1, safePage - 1))}
                  disabled={safePage === 1}
                  className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-500 disabled:opacity-40"
                >
                  ‹
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`min-w-[28px] rounded-md px-2 py-1 text-xs font-medium ${
                      p === safePage
                        ? 'bg-blue-600 text-white'
                        : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setPage(Math.min(totalPages, safePage + 1))}
                  disabled={safePage === totalPages}
                  className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-500 disabled:opacity-40"
                >
                  ›
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
