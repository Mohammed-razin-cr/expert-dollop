'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Plus, X, ClipboardList, ClipboardCheck, UploadCloud, CalendarDays, BarChart3,
  CheckSquare, Clock, RefreshCw, CheckCircle2, RotateCcw, Pencil, Check, Trash2, Calendar,
} from 'lucide-react'
import { createClient } from '@/lib/api/client'
import type { Enum } from '@/lib/database.types'

type User = { id: string; full_name: string }
type Batch = { id: string; name: string }
type Task = {
  id: string
  title: string
  description: string | null
  due_date: string | null
  status: Enum<'task_status'>
  priority: Enum<'task_priority'>
  batch_id: string | null
  batch: string | null
  assigned_to: string | null
  assignee: string | null
  created_by: string | null
}

const PAGE_SIZE = 5

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  done: 'Completed',
  cancelled: 'Cancelled',
}
const STATUS_CHIP: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  in_progress: 'bg-blue-50 text-blue-700',
  done: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-slate-100 text-slate-500',
}
const STATUS_DOT: Record<string, string> = {
  pending: 'bg-amber-500',
  in_progress: 'bg-blue-500',
  done: 'bg-emerald-500',
  cancelled: 'bg-slate-400',
}
const PRIORITY_LABEL: Record<string, string> = { high: 'High', medium: 'Medium', low: 'Low' }
const PRIORITY_CHIP: Record<string, string> = {
  high: 'bg-rose-50 text-rose-700',
  medium: 'bg-amber-50 text-amber-700',
  low: 'bg-blue-50 text-blue-700',
}

/**
 * Pick an icon from the task title. Purely cosmetic — it gives the board
 * the visual variety of the design without inventing a field to store.
 */
function taskIcon(title: string) {
  const t = title.toLowerCase()
  if (/test|exam|quiz|mock/.test(t)) return { Icon: ClipboardCheck, tone: 'bg-purple-50 text-purple-600' }
  if (/upload|material|notes|ppt/.test(t)) return { Icon: UploadCloud, tone: 'bg-emerald-50 text-emerald-600' }
  if (/review|assignment|grade/.test(t)) return { Icon: ClipboardList, tone: 'bg-blue-50 text-blue-600' }
  if (/topic|plan|schedule/.test(t)) return { Icon: CalendarDays, tone: 'bg-orange-50 text-orange-600' }
  if (/report|attendance|analytic/.test(t)) return { Icon: BarChart3, tone: 'bg-rose-50 text-rose-600' }
  return { Icon: CheckSquare, tone: 'bg-slate-100 text-slate-500' }
}

const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—'

/** Days from today to `iso`, negative when overdue. */
function daysUntil(iso: string, todayISO: string) {
  const a = Date.parse(iso + 'T00:00:00')
  const b = Date.parse(todayISO + 'T00:00:00')
  return Math.round((a - b) / 86_400_000)
}

function relativeDue(iso: string, todayISO: string) {
  const d = daysUntil(iso, todayISO)
  if (d < 0) return { text: `Overdue by ${-d} day${d === -1 ? '' : 's'}`, tone: 'text-rose-600' }
  if (d === 0) return { text: 'Today', tone: 'text-amber-600' }
  if (d === 1) return { text: 'Tomorrow', tone: 'text-amber-600' }
  if (d <= 3) return { text: `${d} days left`, tone: 'text-rose-600' }
  return { text: `In ${d} days`, tone: 'text-slate-400' }
}

const inp =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100'
const sel =
  'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 outline-none focus:border-blue-300'

const EMPTY_FORM = {
  title: '',
  batch_id: '',
  description: '',
  due_date: '',
  priority: 'medium' as Enum<'task_priority'>,
  status: 'pending' as Enum<'task_status'>,
}

export function TasksManager({
  tasks,
  users,
  batches,
  userId,
  role,
}: {
  tasks: Task[]
  users: User[]
  batches: Batch[]
  userId: string
  role: string
}) {
  const router = useRouter()
  const supabase = createClient()

  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [f, setF] = useState(EMPTY_FORM)

  const [scope, setScope] = useState('all')
  const [status, setStatus] = useState('all')
  const [priority, setPriority] = useState('all')
  const [range, setRange] = useState('all')
  const [page, setPage] = useState(1)

  /**
   * "Today" is resolved after mount. Computing it during render would use
   * the server's timezone for the SSR pass and the browser's on hydration,
   * which mismatches across timezones. Until then, relative labels are
   * simply omitted — the absolute date always shows.
   */
  const [todayISO, setTodayISO] = useState<string | null>(null)
  useEffect(() => {
    const d = new Date()
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
    setTodayISO(local.toISOString().slice(0, 10))
  }, [])

  const kpis = useMemo(
    () => ({
      total: tasks.length,
      pending: tasks.filter((t) => t.status === 'pending').length,
      in_progress: tasks.filter((t) => t.status === 'in_progress').length,
      done: tasks.filter((t) => t.status === 'done').length,
    }),
    [tasks],
  )

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (scope === 'assigned' && t.assigned_to !== userId) return false
      if (scope === 'created' && t.created_by !== userId) return false
      if (status !== 'all' && t.status !== status) return false
      if (priority !== 'all' && t.priority !== priority) return false

      if (range !== 'all' && todayISO) {
        if (!t.due_date) return false
        const d = daysUntil(t.due_date, todayISO)
        if (range === 'overdue' && d >= 0) return false
        if (range === 'today' && d !== 0) return false
        if (range === 'week' && (d < 0 || d > 7)) return false
        if (range === 'month' && (d < 0 || d > 30)) return false
      }
      return true
    })
  }, [tasks, scope, status, priority, range, todayISO, userId])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const firstRow = filtered.length ? (safePage - 1) * PAGE_SIZE + 1 : 0
  const lastRow = Math.min(safePage * PAGE_SIZE, filtered.length)

  const upcoming = useMemo(() => {
    if (!todayISO) return []
    return tasks
      .filter((t) => t.due_date && t.status !== 'done' && t.status !== 'cancelled')
      .filter((t) => daysUntil(t.due_date!, todayISO) >= 0)
      .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1))
      .slice(0, 3)
  }, [tasks, todayISO])

  const filtersActive = scope !== 'all' || status !== 'all' || priority !== 'all' || range !== 'all'
  function resetFilters() {
    setScope('all')
    setStatus('all')
    setPriority('all')
    setRange('all')
    setPage(1)
  }

  function startAdd() {
    setEditingId(null)
    setF(EMPTY_FORM)
    setErr(null)
    setOpen(true)
  }

  function startEdit(t: Task) {
    setEditingId(t.id)
    setF({
      title: t.title,
      batch_id: t.batch_id ?? '',
      description: t.description ?? '',
      due_date: t.due_date ?? '',
      priority: t.priority ?? 'medium',
      status: t.status,
    })
    setErr(null)
    setOpen(true)
  }

  async function save() {
    if (!f.title.trim()) return setErr('Task title is required')
    if (!f.due_date) return setErr('Due date is required')

    setBusy(true)
    setErr(null)

    const payload = {
      title: f.title.trim(),
      description: f.description.trim() || null,
      batch_id: f.batch_id || null,
      due_date: f.due_date,
      priority: f.priority,
      status: f.status,
    }

    const { error } = editingId
      ? await supabase.from('tasks').update(payload).eq('id', editingId)
      : await supabase.from('tasks').insert({ ...payload, assigned_to: userId, created_by: userId })

    setBusy(false)
    if (error) return setErr(error.message)

    setF(EMPTY_FORM)
    setEditingId(null)
    setOpen(false)
    router.refresh()
  }

  async function markComplete(id: string) {
    // Without this check a rejected write left the row looking unchanged
    // after the refresh, with nothing said about why.
    const { error } = await supabase.from('tasks').update({ status: 'done' }).eq('id', id)
    if (error) return setErr(error.message)
    setErr(null)
    router.refresh()
  }

  async function remove(id: string) {
    if (!confirm('Delete this task?')) return
    // Soft delete — every other screen filters on deleted_at, so a hard
    // delete here would be the odd one out and unrecoverable.
    const { error } = await supabase
      .from('tasks')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return setErr(error.message)
    setOpen(false)
    setEditingId(null)
    router.refresh()
  }

  const kpiCards = [
    { label: 'Total Tasks', value: kpis.total, sub: 'All assigned tasks', Icon: ClipboardList, tone: 'bg-blue-50 text-blue-600' },
    { label: 'Pending', value: kpis.pending, sub: 'Tasks pending', Icon: Clock, tone: 'bg-amber-50 text-amber-600' },
    { label: 'In Progress', value: kpis.in_progress, sub: 'Tasks in progress', Icon: RefreshCw, tone: 'bg-indigo-50 text-indigo-600' },
    { label: 'Completed', value: kpis.done, sub: 'Tasks completed', Icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-600' },
  ]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">My Tasks</h1>
          <p className="text-sm text-slate-500">
            {role === 'trainer'
              ? 'Manage your tasks and stay on top of your teaching responsibilities.'
              : 'Manage your tasks and stay on top of your responsibilities.'}
          </p>
        </div>
        <button
          onClick={startAdd}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> Add Task
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((k) => (
          <div key={k.label} className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5">
            <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${k.tone}`}>
              <k.Icon className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-slate-500">{k.label}</p>
              <p className="text-2xl font-semibold text-slate-900">{k.value}</p>
              <p className="truncate text-xs text-slate-400">{k.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select className={sel} value={scope} onChange={(e) => { setScope(e.target.value); setPage(1) }}>
          <option value="all">All Tasks</option>
          <option value="assigned">Assigned to me</option>
          <option value="created">Created by me</option>
        </select>
        <select className={sel} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}>
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="done">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select className={sel} value={priority} onChange={(e) => { setPriority(e.target.value); setPage(1) }}>
          <option value="all">All Priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select className={sel} value={range} onChange={(e) => { setRange(e.target.value); setPage(1) }}>
          <option value="all">Any Time</option>
          <option value="overdue">Overdue</option>
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
        </select>
        <button
          onClick={resetFilters}
          disabled={!filtersActive}
          className="ml-auto flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white"
        >
          <RotateCcw className="h-4 w-4" /> Reset Filters
        </button>
      </div>

      <div className="flex flex-col gap-5 xl:flex-row">
        {/* Task table */}
        <div className="min-w-0 flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Task</th>
                  <th className="px-4 py-3 font-medium">Related To</th>
                  <th className="px-4 py-3 font-medium">Due Date</th>
                  <th className="px-4 py-3 font-medium">Priority</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((t) => {
                  const { Icon, tone } = taskIcon(t.title)
                  const rel = t.due_date && todayISO ? relativeDue(t.due_date, todayISO) : null
                  const isDone = t.status === 'done'
                  return (
                    <tr key={t.id} className="border-t border-slate-100 align-top">
                      <td className="px-4 py-3">
                        <div className="flex gap-3">
                          <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${tone}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900">{t.title}</p>
                            {t.description && (
                              <p className="mt-0.5 text-xs text-slate-500">{t.description}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {t.batch ? (
                          <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                            {t.batch}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="text-slate-700">{fmtDate(t.due_date)}</p>
                        {/* A task that is finished or dropped cannot be
                            overdue — the countdown only applies to live work. */}
                        {rel && !isDone && t.status !== 'cancelled' && (
                          <p className={`text-xs ${rel.tone}`}>{rel.text}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-md px-2 py-1 text-xs font-medium ${PRIORITY_CHIP[t.priority] ?? ''}`}>
                          {PRIORITY_LABEL[t.priority] ?? t.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ${STATUS_CHIP[t.status] ?? ''}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[t.status] ?? ''}`} />
                          {STATUS_LABEL[t.status] ?? t.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => startEdit(t)}
                            className="flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs text-blue-600 hover:bg-blue-50"
                          >
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </button>
                          <button
                            onClick={() => markComplete(t.id)}
                            disabled={isDone}
                            className="flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs text-emerald-600 hover:bg-emerald-50 disabled:text-slate-400 disabled:hover:bg-white"
                          >
                            <Check className="h-3.5 w-3.5" /> {isDone ? 'Completed' : 'Mark Complete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {!filtered.length && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                      {tasks.length ? 'No tasks match these filters.' : 'No tasks yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {filtered.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
              <p className="text-xs text-slate-500">
                Showing {firstRow} to {lastRow} of {filtered.length} task{filtered.length === 1 ? '' : 's'}
              </p>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(1)}
                    disabled={safePage === 1}
                    className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-500 disabled:opacity-40"
                  >
                    «
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
                    onClick={() => setPage(totalPages)}
                    disabled={safePage === totalPages}
                    className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-500 disabled:opacity-40"
                  >
                    »
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Add / Edit panel */}
        {open && (
          <div className="w-full shrink-0 rounded-xl border border-slate-200 bg-white p-5 xl:w-80">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">
                {editingId ? 'Edit Task' : 'Add New Task'}
              </h2>
              <button onClick={() => { setOpen(false); setErr(null) }} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Task Title <span className="text-rose-500">*</span>
                </label>
                <input className={inp} placeholder="Enter task title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Related To</label>
                <select className={inp} value={f.batch_id} onChange={(e) => setF({ ...f, batch_id: e.target.value })}>
                  <option value="">Select batch…</option>
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
                <textarea className={`${inp} h-24 resize-none`} placeholder="Enter task description…" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Due Date <span className="text-rose-500">*</span>
                </label>
                <input className={inp} type="date" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Priority <span className="text-rose-500">*</span>
                </label>
                <select className={inp} value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value as Enum<'task_priority'> })}>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
                <select className={inp} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as Enum<'task_status'> })}>
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="done">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            {err && <p className="mt-3 text-sm text-rose-600">{err}</p>}

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => { setOpen(false); setErr(null) }}
                className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={busy}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {busy ? 'Saving…' : editingId ? 'Update Task' : 'Save Task'}
              </button>
            </div>

            {editingId && (
              <button
                onClick={() => remove(editingId)}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-rose-200 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50"
              >
                <Trash2 className="h-4 w-4" /> Delete Task
              </button>
            )}
          </div>
        )}
      </div>

      {/* Upcoming */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">Upcoming Tasks</h2>
          <Link
            href="/calendar"
            className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
          >
            <Calendar className="h-3.5 w-3.5" /> View Calendar
          </Link>
        </div>
        <div className="divide-y divide-slate-100">
          {upcoming.map((t) => {
            const rel = relativeDue(t.due_date!, todayISO!)
            const d = new Date(t.due_date + 'T00:00:00')
            return (
              <div key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-slate-50 leading-none">
                  <span className="text-sm font-semibold text-slate-800">{d.getDate()}</span>
                  <span className="text-[10px] uppercase text-slate-400">
                    {d.toLocaleDateString('en-GB', { month: 'short' })}
                  </span>
                </div>
                <p className="min-w-0 flex-1 truncate font-medium text-slate-800">{t.title}</p>
                {t.batch && (
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">{t.batch}</span>
                )}
                <span className={`text-xs ${rel.tone}`}>{rel.text}</span>
                <span className={`rounded-md px-2 py-1 text-xs font-medium ${PRIORITY_CHIP[t.priority] ?? ''}`}>
                  {PRIORITY_LABEL[t.priority] ?? t.priority}
                </span>
              </div>
            )
          })}
          {!upcoming.length && (
            <p className="px-4 py-6 text-center text-sm text-slate-400">Nothing coming up.</p>
          )}
        </div>
      </div>
    </div>
  )
}
