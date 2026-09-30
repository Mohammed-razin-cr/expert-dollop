'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import {
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Loader2,
  Search,
  Users,
  XCircle,
} from 'lucide-react'
import { createClient } from '@/lib/api/client'
import { printDoc } from '@/lib/printDoc'
import { pctLabel } from '@/lib/format'
import { LOW_ATTENDANCE } from '@/lib/students'
import { AttendanceDonut } from '@/components/charts/AttendanceDonut'
import { pageWindow } from '@/lib/ui'
import { esc, pair, reportHeader, section, today, TABLE_CSS } from '@/lib/reportHtml'

/**
 * Manual attendance marking for a trainer's own batches.
 *
 * The whole screen works off two fetches per batch — the roster, and every
 * attendance row that batch has ever had. That second fetch is what makes
 * the "Attendance %" column, the summary and the low-attendance panel
 * possible without a query per student, and it means changing the date
 * re-derives the day's marks in memory rather than hitting the network.
 */

type Batch = { id: string; name: string }
type Student = { id: string; full_name: string }
type Mark = 'present' | 'absent' | 'late'
type AttRow = { student_id: string; date: string; status: string }

const MARKS: {
  key: Mark
  label: string
  idle: string
  on: string
  dot: string
  color: string
}[] = [
  {
    key: 'present',
    label: 'Present',
    idle: 'border-emerald-200 text-emerald-600 hover:bg-emerald-50',
    on: 'border-emerald-500 bg-emerald-500 text-white',
    dot: 'bg-emerald-500',
    color: '#10b981',
  },
  {
    key: 'absent',
    label: 'Absent',
    idle: 'border-rose-200 text-rose-600 hover:bg-rose-50',
    on: 'border-rose-500 bg-rose-500 text-white',
    dot: 'bg-rose-500',
    color: '#ef4444',
  },
  {
    key: 'late',
    label: 'Late',
    idle: 'border-slate-200 text-slate-600 hover:bg-slate-50',
    on: 'border-amber-500 bg-amber-500 text-white',
    dot: 'bg-amber-500',
    color: '#f59e0b',
  },
]

const PAGE_SIZE = 8

const todayStr = () => new Date().toISOString().slice(0, 10)
const day = (d: string) => String(d).slice(0, 10)

/**
 * The marking sheet as stored: students with no saved status are simply
 * absent from the map, which is what "not marked yet" looks like.
 */
const fromStored = (roster: Student[], stored: Record<string, Mark>) =>
  Object.fromEntries(
    roster.filter((s) => stored[s.id]).map((s) => [s.id, stored[s.id]]),
  ) as Record<string, Mark>

export function AttendanceClient() {
  const supabase = createClient()

  const [uid, setUid] = useState<string | null>(null)
  const [batches, setBatches] = useState<Batch[]>([])
  const [batch, setBatch] = useState('')
  const [date, setDate] = useState(todayStr())

  const [roster, setRoster] = useState<Student[]>([])
  const [attRows, setAttRows] = useState<AttRow[]>([])
  const [marks, setMarks] = useState<Record<string, Mark>>({})

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // `qInput` is what is typed and `q` is what the roster is filtered by, a beat
  // behind it. The box stays instant; the filter runs once you pause.
  const [qInput, setQInput] = useState('')
  const q = useDebouncedValue(qInput)
  const [page, setPage] = useState(1)
  const [showAllLow, setShowAllLow] = useState(false)

  // ---- load ------------------------------------------------------------

  useEffect(() => {
    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return setLoading(false)
      setUid(user.id)
      const { data } = await supabase
        .from('batches')
        .select('id, name')
        .eq('trainer_id', user.id)
        .is('deleted_at', null)
        .order('name')
      setBatches(data ?? [])
      if (data?.length) setBatch(data[0].id)
      else setLoading(false)
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /** Every attendance row for the batch — the history the stats are built from. */
  const loadAttendance = useCallback(async () => {
    if (!batch) return
    const { data } = await supabase
      .from('attendance')
      .select('student_id, date, status')
      .eq('batch_id', batch)
      .is('deleted_at', null)
    setAttRows((data ?? []) as AttRow[])
  }, [batch]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadBatch = useCallback(async () => {
    if (!batch) {
      setRoster([])
      setAttRows([])
      return
    }
    setLoading(true)
    setErr(null)
    const [{ data: enr }] = await Promise.all([
      supabase
        .from('enrollments')
        .select('student_id, students(id, full_name)')
        .eq('batch_id', batch)
        .is('deleted_at', null),
      loadAttendance(),
    ])
    const students: Student[] = (enr ?? [])
      .map((e: any) => (Array.isArray(e.students) ? e.students[0] : e.students))
      .filter(Boolean)
      .sort((a: Student, b: Student) => a.full_name.localeCompare(b.full_name))
    setRoster(students)
    setPage(1)
    setShowAllLow(false)
    setLoading(false)
  }, [batch, loadAttendance])

  useEffect(() => {
    loadBatch()
  }, [loadBatch])

  // ---- derived ---------------------------------------------------------

  /**
   * Attendance rate per student, across the batch's whole history.
   * 'not_marked' is a placeholder for a day nobody marked, not an absence —
   * counting it would drag every rate down.
   */
  const history = useMemo(() => {
    const m: Record<string, { total: number; here: number }> = {}
    for (const r of attRows) {
      if (r.status === 'not_marked') continue
      const g = (m[r.student_id] ??= { total: 0, here: 0 })
      g.total += 1
      if (r.status === 'present' || r.status === 'late') g.here += 1
    }
    return m
  }, [attRows])

  const pctFor = useCallback(
    (id: string) => {
      const g = history[id]
      return g && g.total ? Math.round((g.here / g.total) * 100) : null
    },
    [history],
  )

  /** What is already stored for the selected date. */
  const savedMarks = useMemo(() => {
    const m: Record<string, Mark> = {}
    for (const r of attRows) {
      if (day(r.date) !== date) continue
      if (r.status === 'not_marked') continue
      m[r.student_id] = r.status as Mark
    }
    return m
  }, [attRows, date])

  // Start from what is stored and nothing more. A student with no mark is
  // left blank rather than assumed present — otherwise an untouched sheet
  // reads as a full house, and the trainer cannot tell a class they marked
  // from one they never opened.
  //
  // This also re-runs straight after a save, once the re-read lands, which
  // is why the "Saved" flash is cleared elsewhere: doing it here would wipe
  // the confirmation before anyone saw it.
  useEffect(() => {
    setMarks(fromStored(roster, savedMarks))
  }, [roster, savedMarks])

  // Moving to another batch or day is a fresh sheet, not a saved one.
  useEffect(() => {
    setSaved(false)
  }, [batch, date])

  const counts = useMemo(() => {
    const c: Record<Mark, number> = { present: 0, absent: 0, late: 0 }
    for (const s of roster) {
      const m = marks[s.id]
      if (m) c[m] += 1
    }
    return c
  }, [roster, marks])

  const total = roster.length
  const marked = counts.present + counts.absent + counts.late
  const unmarked = total - marked

  /** The day's attendance rate, out of what has actually been marked. */
  const dayRate = marked ? Math.round(((counts.present + counts.late) / marked) * 100) : null

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return needle ? roster.filter((s) => s.full_name.toLowerCase().includes(needle)) : roster
  }, [roster, q])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, pageCount)
  const from = (current - 1) * PAGE_SIZE
  const slice = filtered.slice(from, from + PAGE_SIZE)

  const lowAttendance = useMemo(
    () =>
      roster
        .map((s) => ({ ...s, pct: pctFor(s.id) }))
        .filter((s): s is Student & { pct: number } => s.pct !== null && s.pct < LOW_ATTENDANCE)
        .sort((a, b) => a.pct - b.pct),
    [roster, pctFor],
  )

  const batchName = batches.find((b) => b.id === batch)?.name ?? ''

  // ---- actions ---------------------------------------------------------

  const setAll = (status: Mark) =>
    setMarks(Object.fromEntries(roster.map((s) => [s.id, status])) as Record<string, Mark>)

  /** Clicking the mark a student already has clears it back to unmarked. */
  const toggle = (studentId: string, mark: Mark) =>
    setMarks((prev) => {
      const next = { ...prev }
      if (next[studentId] === mark) delete next[studentId]
      else next[studentId] = mark
      return next
    })

  /** Back to what is stored for this date — discards unsaved clicks. */
  const reset = () => setMarks(fromStored(roster, savedMarks))

  async function save() {
    if (!uid || !roster.length) return
    setSaving(true)
    setSaved(false)
    setErr(null)
    // Anyone left untouched is stored as 'not_marked' — the status the
    // enum has for exactly this, and one the attendance rate ignores.
    const rows = roster.map((s) => ({
      batch_id: batch,
      student_id: s.id,
      date,
      status: marks[s.id] ?? 'not_marked',
      marked_by: uid,
    }))
    const { error } = await supabase
      .from('attendance')
      .upsert(rows, { onConflict: 'batch_id,student_id,date' })
    if (error) {
      setSaving(false)
      return setErr(error.message)
    }
    // Re-read so the Attendance % column reflects what was just saved.
    await loadAttendance()
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  function viewReport() {
    printDoc(
      `Attendance — ${batchName || 'Batch'}`,
      buildAttendanceReport({
        batchName,
        date,
        rows: roster.map((s) => ({
          name: s.full_name,
          pct: pctFor(s.id),
          mark: marks[s.id],
        })),
        counts,
        low: lowAttendance.map((s) => ({ name: s.full_name, pct: s.pct })),
      }),
    )
  }

  // ---- render ----------------------------------------------------------

  const kpis = [
    { label: 'Total Students', value: total, sub: null, Icon: Users, tone: 'bg-blue-50 text-blue-600' },
    { label: 'Present', value: counts.present, sub: pctLabel(counts.present, total), Icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-600' },
    { label: 'Absent', value: counts.absent, sub: pctLabel(counts.absent, total), Icon: XCircle, tone: 'bg-rose-50 text-rose-600' },
    { label: 'Late', value: counts.late, sub: pctLabel(counts.late, total), Icon: Clock, tone: 'bg-amber-50 text-amber-600' },
  ]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Attendance (Manual Marking)</h1>
          <p className="text-sm text-slate-500">Mark daily attendance for your batches.</p>
        </div>
        <button
          onClick={viewReport}
          disabled={!roster.length}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <Download className="h-4 w-4" /> View Attendance Report
        </button>
      </div>

      {/* Batch, date and the bulk actions */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-400">Batch</label>
          <select
            value={batch}
            onChange={(e) => setBatch(e.target.value)}
            className="min-w-[190px] rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-300"
          >
            {batches.length === 0 && <option value="">No batches</option>}
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-400">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-300"
          />
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {unmarked > 0 && (
            <span className="mr-1 text-xs font-medium text-amber-600">
              {unmarked} unmarked
            </span>
          )}
          <button
            onClick={() => setAll('present')}
            disabled={!roster.length}
            className="rounded-lg border border-emerald-200 px-3.5 py-2 text-sm font-medium text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
          >
            All Present
          </button>
          <button
            onClick={() => setAll('absent')}
            disabled={!roster.length}
            className="rounded-lg border border-rose-200 px-3.5 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
          >
            All Absent
          </button>
          <button
            onClick={reset}
            disabled={!roster.length}
            className="rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Reset
          </button>
          <button
            onClick={save}
            disabled={saving || !roster.length}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : null}
            {saved ? 'Saved' : 'Save Attendance'}
          </button>
        </div>
      </div>

      {err && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{err}</p>
      )}

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${k.tone}`}>
              <k.Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs text-slate-500">{k.label}</p>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-semibold text-slate-900">{k.value}</p>
                {k.sub && <span className="text-xs text-slate-400">{k.sub}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Roster */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={qInput}
              onChange={(e) => {
                setQInput(e.target.value)
                setPage(1)
              }}
              placeholder="Search student..."
              className="w-64 rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-blue-300"
            />
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            {MARKS.map((m) => (
              <span key={m.key} className="flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-full ${m.dot}`} /> {m.label}
              </span>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid place-items-center py-12 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : !roster.length ? (
          <div className="py-12 text-center text-sm text-slate-400">
            {batches.length ? 'No students enrolled in this batch.' : 'You have no batches yet.'}
          </div>
        ) : !filtered.length ? (
          <div className="py-12 text-center text-sm text-slate-400">No student matches that search.</div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="w-14 px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Student Name</th>
                  <th className="px-4 py-3 font-medium">Attendance %</th>
                  <th className="px-4 py-3 font-medium">Status (Mark)</th>
                </tr>
              </thead>
              <tbody>
                {slice.map((s, i) => {
                  const pct = pctFor(s.id)
                  return (
                    <tr key={s.id} className="border-t border-slate-100">
                      <td className="px-4 py-2.5 text-slate-400">{from + i + 1}</td>
                      <td className="px-4 py-2.5 font-medium text-slate-800">{s.full_name}</td>
                      <td className="px-4 py-2.5">
                        {pct === null ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <span className={pct < LOW_ATTENDANCE ? 'font-medium text-rose-600' : 'text-slate-700'}>
                            {pct}%
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex gap-2">
                          {MARKS.map((m) => (
                            <button
                              key={m.key}
                              onClick={() => toggle(s.id, m.key)}
                              className={`rounded-lg border px-4 py-1.5 text-xs font-medium transition-colors ${
                                marks[s.id] === m.key ? m.on : `bg-white ${m.idle}`
                              }`}
                            >
                              {m.label}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
              <p className="text-xs text-slate-500">
                Showing {from + 1} to {Math.min(from + PAGE_SIZE, filtered.length)} of {filtered.length} students
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(current - 1)}
                  disabled={current === 1}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {pageWindow(current, pageCount).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`h-8 min-w-8 rounded-lg px-2 text-xs font-medium ${
                      p === current
                        ? 'bg-blue-600 text-white'
                        : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setPage(current + 1)}
                  disabled={current === pageCount}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Summary and the students to worry about */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-800">Attendance Summary</h2>
          <AttendanceDonut
            data={MARKS.map((m) => ({ name: m.label, value: counts[m.key], color: m.color }))}
            overall={dayRate}
            overallLabel="Attendance"
          />
          {unmarked > 0 && (
            <p className="mt-4 text-xs text-slate-400">
              {marked} of {total} marked — the rate is out of those {marked}.
            </p>
          )}
        </div>

        <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">
            Low Attendance Students (&lt; {LOW_ATTENDANCE}%)
          </h2>
          {lowAttendance.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">
              No one is below {LOW_ATTENDANCE}%.
            </p>
          ) : (
            <>
              <ol className="divide-y divide-slate-100">
                {(showAllLow ? lowAttendance : lowAttendance.slice(0, 3)).map((s, i) => (
                  <li key={s.id} className="flex items-center gap-3 py-2.5 text-sm">
                    <span className="w-4 text-slate-400">{i + 1}</span>
                    <span className="text-slate-700">{s.full_name}</span>
                    <span className="ml-auto font-medium text-rose-600">{s.pct}%</span>
                  </li>
                ))}
              </ol>
              {lowAttendance.length > 3 && (
                <button
                  onClick={() => setShowAllLow((v) => !v)}
                  className="mx-auto mt-4 rounded-lg border border-slate-200 px-4 py-1.5 text-xs font-medium text-blue-600 hover:bg-slate-50"
                >
                  {showAllLow ? 'Show Less' : `View All (${lowAttendance.length})`}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Printable attendance sheet for the selected batch and date — the day's
 * marking, each student's running rate, and who is falling behind.
 */
function buildAttendanceReport(d: {
  batchName: string
  date: string
  rows: { name: string; pct: number | null; mark?: Mark }[]
  counts: Record<Mark, number>
  low: { name: string; pct: number }[]
}): string {
  const total = d.rows.length
  const unmarked = d.rows.filter((r) => !r.mark).length
  const label = (m?: Mark) => (m ? (MARKS.find((x) => x.key === m)?.label ?? m) : 'Not marked')
  const when = new Date(`${d.date}T00:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return `
  ${reportHeader(
    d.batchName || 'Attendance',
    `Attendance for ${esc(when)}`,
    `Attendance report · generated ${today()}`,
  )}

  <h2 style="margin:22px 0 0;font-size:14px;color:#0f172a">Summary</h2>
  <table style="${TABLE_CSS}">
    <tbody>
      ${pair('Total Students', total)}
      ${pair('Present', `${d.counts.present} (${pctLabel(d.counts.present, total)})`)}
      ${pair('Absent', `${d.counts.absent} (${pctLabel(d.counts.absent, total)})`)}
      ${pair('Late', `${d.counts.late} (${pctLabel(d.counts.late, total)})`)}
      ${unmarked ? pair('Not marked', unmarked) : ''}
    </tbody>
  </table>

  ${section(
    'Marking',
    ['#', 'Student', 'Attendance %', 'Status'],
    d.rows.map((r, i) => [i + 1, r.name, r.pct === null ? null : `${r.pct}%`, label(r.mark)]),
    'No students enrolled in this batch.',
  )}

  ${section(
    `Low Attendance (below ${LOW_ATTENDANCE}%)`,
    ['#', 'Student', 'Attendance %'],
    d.low.map((s, i) => [i + 1, s.name, `${s.pct}%`]),
    'No one is below the threshold.',
  )}`
}
