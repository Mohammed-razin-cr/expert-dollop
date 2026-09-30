'use client'

import { useMemo, useState } from 'react'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowUpDown,
  BookOpen,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  MoreVertical,
  Plus,
  Search,
} from 'lucide-react'
import { createClient } from '@/lib/api/client'
import { currentWeek } from '@/lib/topics'
import type { BatchOption, TopicRow, TopicsStats } from '@/lib/topics'
import { fmtDate, pageWindow } from '@/lib/ui'
import { TopicFields, coveredToArray, emptyDraft, type TopicDraft } from './TopicForm'

/**
 * Daily topics — the list board.
 *
 * Everything the filters need is already on the page, so searching, date
 * ranges and paging happen in memory rather than as round trips. The list
 * is capped at 500 rows server-side, which is well past what a trainer
 * accumulates in a year.
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

export const STATUS_TONE: Record<string, string> = {
  completed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  upcoming: 'border-blue-200 bg-blue-50 text-blue-700',
}

export const STATUS_LABEL: Record<string, string> = {
  completed: 'Completed',
  upcoming: 'Upcoming',
}

const sel =
  'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-300'

export function TopicsManager({
  topics,
  stats,
  batches,
  trainerId,
}: {
  topics: TopicRow[]
  stats: TopicsStats
  batches: BatchOption[]
  trainerId: string
}) {
  const router = useRouter()
  const supabase = createClient()

  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<TopicDraft>(emptyDraft)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // `qInput` is what is typed and `q` is what the table is filtered by, a beat
  // behind it. The box stays instant; the filter runs once you pause.
  const [qInput, setQInput] = useState('')
  const q = useDebouncedValue(qInput)
  const [batch, setBatch] = useState('all')
  const [status, setStatus] = useState('all')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [newestFirst, setNewestFirst] = useState(true)
  const [page, setPage] = useState(1)
  const [menu, setMenu] = useState<string | null>(null)

  const resetFilters = () => {
    setQInput('')
    setBatch('all')
    setStatus('all')
    setStart('')
    setEnd('')
    setPage(1)
  }

  async function save() {
    if (!draft.topic.trim()) return setErr('Topic required')
    setBusy(true)
    setErr(null)
    // The batch name is written alongside the id: the student profile
    // matches a day's class on that free-text name, and would stop finding
    // topics logged from here if only the id were set.
    const name = batches.find((b) => b.id === draft.batchId)?.name ?? null
    const { error } = await supabase.from('topics').insert({
      date: draft.date,
      topic: draft.topic.trim(),
      description: draft.description.trim() || null,
      batch: name,
      batch_id: draft.batchId || null,
      status: draft.status,
      covered: coveredToArray(draft.covered),
      notes: draft.notes.trim() || null,
      trainer_id: trainerId,
    })
    setBusy(false)
    if (error) return setErr(error.message)
    setDraft(emptyDraft())
    setOpen(false)
    router.refresh()
  }

  async function remove(t: TopicRow) {
    setMenu(null)
    if (!confirm(`Delete "${t.topic}"?`)) return
    const { error } = await supabase
      .from('topics')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', t.id)
    if (error) return setErr(error.message)
    router.refresh()
  }

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const rows = topics.filter((t) => {
      if (needle) {
        const hay = `${t.topic} ${t.description ?? ''} ${t.batch ?? ''}`.toLowerCase()
        if (!hay.includes(needle)) return false
      }
      if (batch !== 'all' && t.batchId !== batch) return false
      if (status !== 'all' && t.status !== status) return false
      // Undated rows cannot satisfy a range, so a range filters them out.
      if (start && (!t.date || t.date < start)) return false
      if (end && (!t.date || t.date > end)) return false
      return true
    })
    return rows.sort((a, b) => {
      const cmp = (a.date ?? '').localeCompare(b.date ?? '')
      return newestFirst ? -cmp : cmp
    })
  }, [topics, q, batch, status, start, end, newestFirst])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, pageCount)
  const from = (current - 1) * PAGE_SIZE
  const slice = filtered.slice(from, from + PAGE_SIZE)

  // Each card narrows the table below to the rows it counted. The week
  // bounds come from the same currentWeek() the server counted with, so the
  // filtered table cannot disagree with the number on the card.
  const kpis: BoardKpi[] = [
    { label: 'Total Sessions', value: stats.totalSessions, Icon: BookOpen, tone: 'bg-blue-50 text-blue-600', onClick: resetFilters },
    {
      label: 'Topics This Week',
      value: stats.thisWeek,
      Icon: CalendarCheck,
      tone: 'bg-emerald-50 text-emerald-600',
      onClick: () => {
        const { start: s, end: e } = currentWeek()
        setStatus('all')
        setStart(s)
        setEnd(e)
        setPage(1)
      },
    },
    {
      label: 'Pending Topics',
      value: stats.pending,
      Icon: Clock,
      tone: 'bg-amber-50 text-amber-600',
      onClick: () => {
        setStart('')
        setEnd('')
        setStatus('upcoming')
        setPage(1)
      },
    },
  ]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Daily Topics</h1>
          <p className="text-sm text-slate-500">Track and manage topics covered in each session.</p>
        </div>
        {!open && (
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" /> Add Topic
          </button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {kpis.map((k) => {
          const face = (
            <>
              <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${k.tone}`}>
                <k.Icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs text-slate-500">{k.label}</p>
                <p className="text-2xl font-semibold text-slate-900">{k.value}</p>
              </div>
            </>
          )
          const box = 'flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4'
          return k.onClick ? (
            <button key={k.label} type="button" onClick={k.onClick}
              className={`${box} w-full text-left transition hover:border-blue-300 hover:shadow-sm`}>
              {face}
            </button>
          ) : (
            <div key={k.label} className={box}>{face}</div>
          )
        })}
      </div>

      {open && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Add Topic</h2>
          <TopicFields value={draft} onChange={setDraft} batches={batches} />
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
            placeholder="Search topics..."
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

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={start}
            onChange={(e) => {
              setStart(e.target.value)
              setPage(1)
            }}
            className={sel}
            aria-label="Start date"
          />
          <span className="text-slate-400">~</span>
          <input
            type="date"
            value={end}
            onChange={(e) => {
              setEnd(e.target.value)
              setPage(1)
            }}
            className={sel}
            aria-label="End date"
          />
        </div>

        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(1)
          }}
          className={sel}
        >
          <option value="all">All Status</option>
          <option value="completed">Completed</option>
          <option value="upcoming">Upcoming</option>
        </select>

        <button
          onClick={resetFilters}
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
                <th className="px-4 py-3 font-medium">
                  <button
                    onClick={() => setNewestFirst((v) => !v)}
                    className="inline-flex items-center gap-1 hover:text-slate-700"
                    title={newestFirst ? 'Newest first' : 'Oldest first'}
                  >
                    Date <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-4 py-3 font-medium">Topic</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">Trainer</th>
                <th className="px-4 py-3 font-medium">Batch</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {slice.map((t) => (
                <tr key={t.id} className="border-t border-slate-100">
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">{fmtDate(t.date)}</td>
                  <td className="px-4 py-2.5 font-medium text-slate-800">{t.topic}</td>
                  <td className="max-w-sm truncate px-4 py-2.5 text-slate-600">{t.description ?? '—'}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{t.trainer ?? '—'}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{t.batch ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-block rounded-md border px-2 py-0.5 text-xs font-medium ${STATUS_TONE[t.status]}`}
                    >
                      {STATUS_LABEL[t.status]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/topics/${t.id}`}
                        className="rounded-md border border-blue-200 px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
                      >
                        View
                      </Link>
                      <div className="relative">
                        <button
                          onClick={() => setMenu(menu === t.id ? null : t.id)}
                          className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                          aria-label="More actions"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                        {menu === t.id && (
                          <>
                            {/* Catches the click that dismisses the menu. */}
                            <button
                              className="fixed inset-0 z-10 cursor-default"
                              onClick={() => setMenu(null)}
                              aria-label="Close menu"
                            />
                            <div className="absolute right-0 z-20 mt-1 w-32 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                              <Link
                                href={`/topics/${t.id}?edit=1`}
                                className="block px-3 py-2 text-left text-xs text-slate-600 hover:bg-slate-50"
                              >
                                Edit
                              </Link>
                              <button
                                onClick={() => remove(t)}
                                className="block w-full px-3 py-2 text-left text-xs text-rose-600 hover:bg-rose-50"
                              >
                                Delete
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
              {!slice.length && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">
                    {topics.length ? 'No topics match these filters.' : 'No topics yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
            <p className="text-xs text-slate-500">
              Showing {from + 1} to {Math.min(from + PAGE_SIZE, filtered.length)} of {filtered.length} entries
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

      {err && !open && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{err}</p>
      )}
    </div>
  )
}
