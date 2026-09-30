'use client'

import { useMemo, useState } from 'react'
import { useDebouncedValue } from '@/lib/useDebouncedValue'

/**
 * Courses & Internships.
 *
 * A read-only board over leads, laid out like the Aptitude page: KPI strip,
 * stage tabs, search and a date range. Nothing here writes — a lead is
 * edited from Leads / CRM, and this page exists to see the programme book
 * at a glance.
 *
 * Tabs follow the lead's stage rather than its programme. The programme
 * split (course vs Internship vs unassigned) is still on show, in the KPI
 * strip and as the badge in each row's Programme column.
 */

const one = (x: any) => (Array.isArray(x) ? x[0] : x)

export type ProgramRow = {
  id: string
  name: string | null
  mobile: string | null
  email: string | null
  college: string | null
  status: string | null
  enquiry_date: string | null
  created_at: string | null
  courses: { id: string; name: string } | { id: string; name: string }[] | null
}

const PAGE_SIZE = 50

/** The one course that means "internship" rather than a taught course. */
const INTERNSHIP = 'internship'

const courseName = (r: ProgramRow) => one(r.courses)?.name ?? null
const isInternship = (r: ProgramRow) =>
  (courseName(r) ?? '').toLowerCase() === INTERNSHIP
const isCourse = (r: ProgramRow) => !!courseName(r) && !isInternship(r)
const isUnassigned = (r: ProgramRow) => !courseName(r)

/** Business date for the range filter, with a fallback for older rows. */
const dateOf = (r: ProgramRow) =>
  (r.enquiry_date ?? r.created_at ?? '').slice(0, 10)

const st = (r: ProgramRow) => (r.status ?? '').toLowerCase()

// The funnel as the Pipeline page defines it, plus a closing tab. The three
// dead-end statuses are grouped there so every lead is reachable from some
// tab — with only `lost` they would exist in All and nowhere else.
const CLOSED = ['lost', 'no_response', 'irrelevant', 'not_interested']

const TABS: { key: string; label: string; fn: (r: ProgramRow) => boolean }[] = [
  { key: 'all', label: 'All', fn: () => true },
  { key: 'new', label: 'New', fn: (r) => st(r) === 'new' },
  { key: 'contacted', label: 'Contacted', fn: (r) => st(r) === 'contacted' },
  { key: 'interested', label: 'Interested', fn: (r) => st(r) === 'interested' },
  { key: 'demo_scheduled', label: 'Demo', fn: (r) => st(r) === 'demo_scheduled' },
  { key: 'aptitude_shared', label: 'Aptitude', fn: (r) => st(r) === 'aptitude_shared' },
  { key: 'passed', label: 'Passed', fn: (r) => st(r) === 'passed' },
  { key: 'enrolled', label: 'Enrolled', fn: (r) => st(r) === 'enrolled' },
  { key: 'closed', label: 'Lost / Closed', fn: (r) => CLOSED.includes(st(r)) },
]

const STAGE_BADGE: Record<string, string> = {
  new: 'bg-slate-100 text-slate-600',
  contacted: 'bg-blue-50 text-blue-600',
  interested: 'bg-amber-50 text-amber-600',
  demo_scheduled: 'bg-violet-50 text-violet-600',
  aptitude_shared: 'bg-cyan-50 text-cyan-600',
  passed: 'bg-green-50 text-green-600',
  enrolled: 'bg-emerald-50 text-emerald-600',
  lost: 'bg-rose-50 text-rose-600',
  no_response: 'bg-slate-100 text-slate-500',
  irrelevant: 'bg-slate-100 text-slate-500',
  not_interested: 'bg-rose-50 text-rose-500',
}

const pretty = (s: string) => s.replace(/_/g, ' ')

export function ProgramsManager({ rows }: { rows: ProgramRow[] }) {
  const [tab, setTab] = useState('all')
  // `qInput` is what is typed and `q` is what the table is filtered by, a beat
  // behind it. The box stays instant; the filter runs once you pause.
  const [qInput, setQInput] = useState('')
  const q = useDebouncedValue(qInput)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)

  const k = useMemo(
    () => ({
      total: rows.length,
      courses: rows.filter(isCourse).length,
      internships: rows.filter(isInternship).length,
      unassigned: rows.filter(isUnassigned).length,
      contacted: rows.filter((r) => st(r) === 'contacted').length,
      interested: rows.filter((r) => st(r) === 'interested').length,
      enrolled: rows.filter((r) => st(r) === 'enrolled').length,
      closed: rows.filter((r) => CLOSED.includes(st(r))).length,
    }),
    [rows],
  )

  const filtered = useMemo(() => {
    const tf = TABS.find((t) => t.key === tab)!.fn
    return rows.filter((r) => {
      if (!tf(r)) return false
      if (q) {
        const s = q.toLowerCase()
        if (!`${r.name ?? ''} ${r.mobile ?? ''} ${r.college ?? ''}`.toLowerCase().includes(s)) return false
      }
      const d = dateOf(r)
      if (from && (!d || d < from)) return false
      if (to && (!d || d > to)) return false
      return true
    })
  }, [rows, tab, q, from, to])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  // Narrowing the filters can leave `page` past the end; clamp rather than
  // reset, so paging back out of a narrow filter keeps its place.
  const safePage = Math.min(page, totalPages)
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const kpis = [
    { label: 'Total Leads', value: k.total },
    { label: 'Courses', value: k.courses },
    { label: 'Internships', value: k.internships },
    { label: 'Unassigned', value: k.unassigned },
    { label: 'Contacted', value: k.contacted },
    { label: 'Interested', value: k.interested },
    { label: 'Enrolled', value: k.enrolled },
    { label: 'Lost / Closed', value: k.closed },
  ]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Courses &amp; Internships</h1>
          <p className="text-sm text-slate-500">
            {filtered.length.toLocaleString('en-IN')} of {rows.length.toLocaleString('en-IN')} leads
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {kpis.map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-[11px] text-slate-500">{s.label}</div>
            <div className="mt-0.5 text-lg font-semibold text-slate-900">
              {s.value.toLocaleString('en-IN')}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-white p-1 text-xs">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setPage(1) }}
              className={`rounded-md px-2.5 py-1.5 font-medium ${
                tab === t.key ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <input
          value={qInput}
          onChange={(e) => { setQInput(e.target.value); setPage(1) }}
          placeholder="Search name / phone / college…"
          className="rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-300"
        />
        <span className="text-xs text-slate-400">Enquiry date:</span>
        <input
          type="date"
          value={from}
          onChange={(e) => { setFrom(e.target.value); setPage(1) }}
          className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
        />
        <input
          type="date"
          value={to}
          onChange={(e) => { setTo(e.target.value); setPage(1) }}
          className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
        />
        {/* Keyed off what is typed, not the debounced term, so Clear appears
            with the first character rather than a beat later. */}
        {(from || to || qInput) && (
          <button
            onClick={() => { setFrom(''); setTo(''); setQInput(''); setPage(1) }}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600"
          >
            Clear
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-3 py-3 font-medium">Lead</th>
              <th className="px-3 py-3 font-medium">College</th>
              <th className="px-3 py-3 font-medium">Programme</th>
              <th className="px-3 py-3 font-medium">Stage</th>
              <th className="px-3 py-3 font-medium">Enquiry Date</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((r) => {
              const cn = courseName(r)
              return (
                <tr key={r.id} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-slate-800">{r.name ?? '—'}</div>
                    <div className="text-xs text-slate-400">{r.mobile ?? ''}</div>
                  </td>
                  <td className="px-3 py-2.5 text-slate-500">{r.college || '—'}</td>
                  <td className="px-3 py-2.5">
                    {cn ? (
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          isInternship(r) ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {cn}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">Unassigned</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {r.status ? (
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          STAGE_BADGE[st(r)] ?? 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {pretty(r.status)}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-slate-500">{dateOf(r) || '—'}</td>
                </tr>
              )
            })}
            {!filtered.length && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  No records in this view.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-500">Page {safePage} of {totalPages}</span>
        <div className="flex gap-2">
          <button
            onClick={() => setPage(Math.max(1, safePage - 1))}
            disabled={safePage === 1}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-600 disabled:opacity-50"
          >
            Previous
          </button>
          <button
            onClick={() => setPage(Math.min(totalPages, safePage + 1))}
            disabled={safePage === totalPages}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-600 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}
