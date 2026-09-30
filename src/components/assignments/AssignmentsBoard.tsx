'use client'

import { useMemo, useState } from 'react'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Loader2,
  Plus,
  Search,
} from 'lucide-react'
import { createClient } from '@/lib/api/client'
import { fmtDate, pageWindow } from '@/lib/ui'
import type { AssignmentRow, AssignmentsStats, BatchOption, TopicOption } from '@/lib/assignments'

/**
 * Assignments — the board.
 *
 * Everything the filters need is on the page already, so search, batch and
 * status are applied in memory. Submission counts read "handed in / class
 * size", which is why an assignment for a batch with no students shows
 * 0 / 0 rather than looking overdue.
 */

const PAGE_SIZE = 10

const sel =
  'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-300'
const field =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-300'

export function AssignmentsBoard({
  rows,
  stats,
  batches,
  topics,
  userId,
  initialStatus = 'all',
}: {
  rows: AssignmentRow[]
  stats: AssignmentsStats
  batches: BatchOption[]
  topics: TopicOption[]
  userId: string
  /** Pre-applied filter, so a dashboard card lands on what it counted. */
  initialStatus?: string
}) {
  const router = useRouter()
  const supabase = createClient()

  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState({ title: '', batchId: '', topicId: '', due: '', description: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // `qInput` is what is typed and `q` is what the table is filtered by, a beat
  // behind it. The box stays instant; the filter runs once you pause.
  const [qInput, setQInput] = useState('')
  const q = useDebouncedValue(qInput)
  const [batch, setBatch] = useState('all')
  const [status, setStatus] = useState(initialStatus)
  const [page, setPage] = useState(1)

  // Only sessions belonging to the chosen batch can be linked — an
  // assignment filed against another batch's topic would be nonsense.
  const topicChoices = useMemo(
    () => (draft.batchId ? topics.filter((t) => t.batchId === draft.batchId) : []),
    [topics, draft.batchId],
  )

  async function save() {
    if (!draft.title.trim()) return setErr('Title required')
    if (!draft.batchId) return setErr('Pick a batch — that is who the assignment is for')
    setBusy(true)
    setErr(null)
    const { error } = await supabase.from('assignments').insert({
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      due_date: draft.due || null,
      batch_id: draft.batchId,
      topic_id: draft.topicId || null,
      created_by: userId,
    })
    setBusy(false)
    if (error) return setErr(error.message)
    setDraft({ title: '', batchId: '', topicId: '', due: '', description: '' })
    setOpen(false)
    router.refresh()
  }

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return rows.filter((r) => {
      if (needle) {
        const hay = `${r.title} ${r.batch ?? ''} ${r.topic ?? ''}`.toLowerCase()
        if (!hay.includes(needle)) return false
      }
      if (batch !== 'all' && r.batchId !== batch) return false
      if (status === 'open' && !r.open) return false
      if (status === 'closed' && r.open) return false
      if (status === 'ungraded' && r.submitted - r.graded === 0) return false
      return true
    })
  }, [rows, q, batch, status])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, pageCount)
  const from = (current - 1) * PAGE_SIZE
  const slice = filtered.slice(from, from + PAGE_SIZE)

  const kpis = [
    { label: 'Total Assignments', value: stats.total, Icon: ClipboardList, tone: 'bg-blue-50 text-blue-600' },
    { label: 'Open', value: stats.open, Icon: Clock, tone: 'bg-emerald-50 text-emerald-600' },
    { label: 'Closed', value: stats.closed, Icon: ClipboardCheck, tone: 'bg-slate-100 text-slate-600' },
    { label: 'Awaiting Grading', value: stats.awaitingGrading, Icon: ClipboardCheck, tone: 'bg-rose-50 text-rose-600' },
  ]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Assignments</h1>
          <p className="text-sm text-slate-500">Homework set for your batches, and who has handed it in.</p>
        </div>
        {!open && (
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" /> New Assignment
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${k.tone}`}>
              <k.Icon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs text-slate-500">{k.label}</p>
              <p className="text-2xl font-semibold text-slate-900">{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      {open && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">New Assignment</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <input
              className={field}
              placeholder="Title *"
              value={draft.title}
              onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))}
            />
            <select
              className={field}
              value={draft.batchId}
              onChange={(e) => setDraft((p) => ({ ...p, batchId: e.target.value, topicId: '' }))}
            >
              <option value="">Batch *…</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <select
              className={field}
              value={draft.topicId}
              onChange={(e) => setDraft((p) => ({ ...p, topicId: e.target.value }))}
              disabled={!draft.batchId}
            >
              <option value="">
                {draft.batchId ? 'Session (optional)…' : 'Pick a batch first'}
              </option>
              {topicChoices.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.topic}
                </option>
              ))}
            </select>
            <input
              className={field}
              type="date"
              value={draft.due}
              onChange={(e) => setDraft((p) => ({ ...p, due: e.target.value }))}
              aria-label="Due date"
            />
          </div>
          <input
            className={`${field} mt-3`}
            placeholder="Description"
            value={draft.description}
            onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
          />
          {err && <p className="mt-2 text-sm text-rose-600">{err}</p>}
          <div className="mt-3 flex gap-2">
            <button
              onClick={save}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save
            </button>
            <button
              onClick={() => {
                setOpen(false)
                setErr(null)
              }}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={qInput}
            onChange={(e) => {
              setQInput(e.target.value)
              setPage(1)
            }}
            placeholder="Search assignments..."
            className="w-56 rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-blue-300"
          />
        </div>
        <select
          value={batch}
          onChange={(e) => {
            setBatch(e.target.value)
            setPage(1)
          }}
          className={sel}
        >
          <option value="all">All Batches</option>
          {batches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(1)
          }}
          className={sel}
        >
          <option value="all">All Status</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
          <option value="ungraded">Has ungraded work</option>
        </select>
        <button
          onClick={() => {
            setQInput('')
            setBatch('all')
            setStatus('all')
            setPage(1)
          }}
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
                <th className="px-4 py-3 font-medium">Assignment</th>
                <th className="px-4 py-3 font-medium">Batch</th>
                <th className="px-4 py-3 font-medium">Session</th>
                <th className="px-4 py-3 font-medium">Due Date</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Submitted</th>
                <th className="px-4 py-3 font-medium">Graded</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {slice.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-4 py-2.5 font-medium text-slate-800">{r.title}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{r.batch ?? '—'}</td>
                  <td className="max-w-[14rem] truncate px-4 py-2.5 text-slate-600">{r.topic ?? '—'}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">{fmtDate(r.due_date)}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-block rounded-md border px-2 py-0.5 text-xs font-medium ${
                        r.open
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-slate-200 bg-slate-50 text-slate-600'
                      }`}
                    >
                      {r.open ? 'Open' : 'Closed'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {r.submitted} / {r.roster}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={r.submitted > r.graded ? 'font-medium text-rose-600' : 'text-slate-600'}>
                      {r.graded} / {r.submitted}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/assignments/${r.id}`}
                      className="rounded-md border border-blue-200 px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
              {!slice.length && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-400">
                    {rows.length ? 'No assignments match these filters.' : 'No assignments yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
            <p className="text-xs text-slate-500">
              Showing {from + 1} to {Math.min(from + PAGE_SIZE, filtered.length)} of {filtered.length} assignments
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
        )}
      </div>
    </div>
  )
}
