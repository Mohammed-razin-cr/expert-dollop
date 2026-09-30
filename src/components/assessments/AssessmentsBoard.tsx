'use client'

import { useMemo, useState } from 'react'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import Link from 'next/link'
import { ClipboardCheck, Plus, Search } from 'lucide-react'
import { fmtDate } from '@/lib/ui'
import type { AssessmentRow, AssessmentsStats, BatchOption } from '@/lib/assessments'

/**
 * Assessments — the papers set for a batch.
 *
 * Attempts and averages come from marks already recorded; a paper nobody
 * has sat shows dashes rather than zeroes, because "no score yet" and
 * "scored nothing" are different things.
 */

const sel =
  'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-300'

export function AssessmentsBoard({
  rows,
  stats,
  batches,
  initialStatus = 'all',
}: {
  rows: AssessmentRow[]
  stats: AssessmentsStats
  batches: BatchOption[]
  /** Pre-applied filter, so a dashboard card lands on what it counted. */
  initialStatus?: string
}) {
  // `qInput` is what is typed and `q` is what the table is filtered by, a beat
  // behind it. The box stays instant; the filter runs once you pause.
  const [qInput, setQInput] = useState('')
  const q = useDebouncedValue(qInput)
  const [batch, setBatch] = useState('all')
  const [status, setStatus] = useState(initialStatus)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return rows.filter((r) => {
      if (needle) {
        const hay = `${r.title} ${r.topic ?? ''} ${r.batch ?? ''}`.toLowerCase()
        if (!hay.includes(needle)) return false
      }
      if (batch !== 'all' && r.batchId !== batch) return false
      if (status === 'unmarked' && r.attempted >= r.roster) return false
      if (status === 'marked' && r.attempted < r.roster) return false
      // An undated paper cannot satisfy a range, so a range filters it out.
      if (start && (!r.date || r.date < start)) return false
      if (end && (!r.date || r.date > end)) return false
      return true
    })
  }, [rows, q, batch, status, start, end])

  const reset = () => {
    setQInput('')
    setBatch('all')
    setStatus('all')
    setStart('')
    setEnd('')
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Assessments</h1>
          <p className="text-sm text-slate-500">
            {stats.total} {stats.total === 1 ? 'paper' : 'papers'}
            {stats.unmarked > 0 && ` · ${stats.unmarked} still to mark`}
            {stats.avgPct !== null && ` · class average ${stats.avgPct}%`}
          </p>
        </div>
        <Link
          href="/assessments/new"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> Add Assessment
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Search assessments..."
            className="w-56 rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-blue-300"
          />
        </div>

        <select value={batch} onChange={(e) => setBatch(e.target.value)} className={sel}>
          <option value="all">All Batches</option>
          {batches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className={sel}
            aria-label="Start date"
          />
          <span className="text-slate-400">~</span>
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className={sel}
            aria-label="End date"
          />
        </div>

        <select value={status} onChange={(e) => setStatus(e.target.value)} className={sel}>
          <option value="all">All Status</option>
          <option value="unmarked">Still to mark</option>
          <option value="marked">Fully marked</option>
        </select>

        <button
          onClick={reset}
          className="rounded-lg border border-blue-200 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50"
        >
          Reset
        </button>
      </div>

      {/* List */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Assessment</th>
                <th className="px-4 py-3 font-medium">Batch</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Topic</th>
                <th className="px-4 py-3 font-medium">Total Marks</th>
                <th className="px-4 py-3 font-medium">Passing Marks</th>
                <th className="px-4 py-3 font-medium">Students Attempted</th>
                <th className="px-4 py-3 font-medium">Average Score</th>
                <th className="px-4 py-3 font-medium">Result</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-slate-800">{r.title}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{r.batch ?? '—'}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">{fmtDate(r.date)}</td>
                  <td className="max-w-[12rem] truncate px-4 py-2.5 text-slate-600">{r.topic ?? '—'}</td>
                  <td className="px-4 py-2.5 text-slate-600">{r.totalMarks ?? '—'}</td>
                  <td className="px-4 py-2.5 text-slate-600">{r.passingMarks ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <span className={r.attempted < r.roster ? 'font-medium text-amber-600' : 'text-slate-600'}>
                      {r.attempted} / {r.roster}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">
                    {r.avgPct === null ? '—' : `${r.avgPct}%`}
                  </td>
                  <td className="px-4 py-2.5">
                    {r.passed === null ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      <span
                        className={`inline-block rounded-md border px-2 py-0.5 text-xs font-medium ${
                          r.passed
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-rose-200 bg-rose-50 text-rose-700'
                        }`}
                      >
                        {r.passed ? 'Pass' : 'Fail'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/assessments/${r.id}`}
                      className="rounded-md border border-blue-200 px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!filtered.length && (
          <div className="py-16 text-center">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-blue-50 text-blue-500">
              <ClipboardCheck className="h-7 w-7" />
            </span>
            <p className="mt-4 text-sm font-medium text-slate-700">
              {rows.length ? 'No assessments match these filters.' : 'No assessments yet.'}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              {rows.length
                ? 'Try widening the date range or clearing the search.'
                : 'Create your first assessment to get started.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
