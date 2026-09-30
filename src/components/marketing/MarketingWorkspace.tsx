'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertCircle, ArrowRight, CalendarDays, Check, CheckCircle2, ClipboardList,
  Clock3, Clapperboard, FileText, Image, Megaphone, PanelsTopLeft, Pencil,
  Plus, Search, Share2, Trash2, X,
} from 'lucide-react'
import { createClient } from '@/lib/api/client'
import { MARKETING_TYPES, type MarketingTask, type MarketingType } from '@/lib/marketing-shared'

const icons: Record<string, typeof ClipboardList> = { video: Clapperboard, poster: Image, brochure: PanelsTopLeft, seo: Search, blog: FileText, social: Share2, campaign: Megaphone, other: ClipboardList }
const statusText = { pending: 'To do', in_progress: 'In progress', done: 'Done', cancelled: 'Cancelled' }
const statusTone = { pending: 'bg-amber-50 text-amber-700', in_progress: 'bg-blue-50 text-blue-700', done: 'bg-emerald-50 text-emerald-700', cancelled: 'bg-slate-100 text-slate-500' }
const inputClass = 'w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-400 focus-visible:outline-2 focus-visible:outline-blue-500'

type Form = { title: string; description: string; marketing_type: MarketingType; due_date: string; status: MarketingTask['status']; priority: MarketingTask['priority'] }
const blank: Form = { title: '', description: '', marketing_type: 'video', due_date: '', status: 'pending', priority: 'medium' }
const formatDate = (date: string | null) => date ? new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No due date'
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)

export function MarketingWorkspace({ userId, firstName, tasks, error, mode, category, preview = false }: {
  userId: string
  firstName: string
  tasks: MarketingTask[]
  error: string | null
  mode: 'dashboard' | 'work'
  category?: string
  preview?: boolean
}) {
  const router = useRouter()
  const [dialog, setDialog] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState<Form>(blank)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('active')
  const currentType = MARKETING_TYPES.find((type) => type.key === category)
  const workHref = (type?: string) => preview
    ? `/marketing-preview?view=work${type ? `&category=${type}` : ''}`
    : `/marketing${type ? `?category=${type}` : ''}`
  const day = today()
  const scopedTasks = mode === 'work' && currentType
    ? tasks.filter((task) => task.marketing_type === currentType.key)
    : tasks

  const counts = {
    open: scopedTasks.filter((task) => task.status === 'pending' || task.status === 'in_progress').length,
    progress: scopedTasks.filter((task) => task.status === 'in_progress').length,
    done: scopedTasks.filter((task) => task.status === 'done').length,
    overdue: scopedTasks.filter((task) => task.due_date && task.due_date < day && task.status !== 'done' && task.status !== 'cancelled').length,
  }

  const visible = scopedTasks.filter((task) => {
    if (status === 'active' && (task.status === 'done' || task.status === 'cancelled')) return false
    if (status !== 'active' && status !== 'all' && task.status !== status) return false
    return `${task.title} ${task.description ?? ''}`.toLowerCase().includes(search.toLowerCase())
  }).sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'))

  function openNew(type?: MarketingType) {
    setForm({ ...blank, marketing_type: type ?? currentType?.key ?? 'video' })
    setEditing(null)
    setActionError(null)
    setDialog(true)
  }

  function openEdit(task: MarketingTask) {
    setForm({ title: task.title, description: task.description ?? '', marketing_type: (MARKETING_TYPES.find((type) => type.key === task.marketing_type)?.key ?? 'other'), due_date: task.due_date ?? '', status: task.status, priority: task.priority })
    setEditing(task.id)
    setActionError(null)
    setDialog(true)
  }

  async function save() {
    if (!form.title.trim()) { setActionError('Add a task title.'); return }
    setBusy(true)
    setActionError(null)
    const client = createClient()
    const payload = { title: form.title.trim(), description: form.description.trim() || null, marketing_type: form.marketing_type, due_date: form.due_date || null, status: form.status, priority: form.priority }
    const result = editing
      ? await client.from('tasks').update(payload).eq('id', editing).eq('assigned_to', userId).eq('related_type', 'digital_marketing')
      : await client.from('tasks').insert({ ...payload, assigned_to: userId, created_by: userId, related_type: 'digital_marketing' })
    setBusy(false)
    if (result.error) { setActionError(result.error.message); return }
    setDialog(false)
    router.refresh()
  }

  async function changeStatus(task: MarketingTask, next: MarketingTask['status']) {
    setActionError(null)
    const { error: updateError } = await createClient().from('tasks').update({ status: next }).eq('id', task.id).eq('assigned_to', userId).eq('related_type', 'digital_marketing')
    if (updateError) setActionError(updateError.message)
    else router.refresh()
  }

  async function remove(task: MarketingTask) {
    if (!window.confirm(`Delete "${task.title}"?`)) return
    setActionError(null)
    const { error: deleteError } = await createClient().from('tasks').update({ deleted_at: new Date().toISOString() }).eq('id', task.id).eq('assigned_to', userId).eq('related_type', 'digital_marketing')
    if (deleteError) setActionError(deleteError.message)
    else router.refresh()
  }

  const TaskRows = ({ rows }: { rows: MarketingTask[] }) => rows.length ? (
    <div className="divide-y divide-slate-100">
      {rows.map((task) => {
        const type = MARKETING_TYPES.find((item) => item.key === task.marketing_type) ?? MARKETING_TYPES[7]
        const Icon = icons[type.key] ?? ClipboardList
        const overdue = task.due_date && task.due_date < day && task.status !== 'done' && task.status !== 'cancelled'
        return <div key={task.id} className="grid grid-cols-[36px_minmax(0,1fr)] items-center gap-x-3 gap-y-2 px-4 py-3 hover:bg-slate-50/70 sm:flex sm:flex-nowrap">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-blue-50 text-blue-700"><Icon className="h-4 w-4" /></span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900">{task.title}</p>
            <p className="mt-0.5 truncate text-xs text-slate-500">{type.label}{task.description ? ` · ${task.description}` : ''}</p>
          </div>
          <div className="col-start-2 flex flex-wrap items-center gap-2 sm:contents">
            <span className={`flex items-center gap-1 text-xs ${overdue ? 'text-rose-600' : 'text-slate-500'}`}><CalendarDays className="h-3.5 w-3.5" />{formatDate(task.due_date)}</span>
            <span className={`min-w-20 rounded px-2 py-1 text-center text-xs font-medium ${statusTone[task.status]}`}>{statusText[task.status]}</span>
          </div>
          {!preview && <div className="col-start-2 flex items-center gap-1 sm:col-auto">
            {task.status !== 'done' && <button type="button" onClick={() => changeStatus(task, task.status === 'pending' ? 'in_progress' : 'done')} title={task.status === 'pending' ? 'Start task' : 'Mark done'} aria-label={task.status === 'pending' ? 'Start task' : 'Mark done'} className="rounded p-1.5 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700"><Check className="h-4 w-4" /></button>}
            <button type="button" onClick={() => openEdit(task)} title="Edit task" aria-label="Edit task" className="rounded p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-700"><Pencil className="h-4 w-4" /></button>
            <button type="button" onClick={() => remove(task)} title="Delete task" aria-label="Delete task" className="rounded p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700"><Trash2 className="h-4 w-4" /></button>
          </div>}
        </div>
      })}
    </div>
  ) : <div className="px-5 py-12 text-center text-sm text-slate-500">No tasks here yet.</div>

  return <div className="mx-auto max-w-7xl space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-xl font-semibold text-slate-900">{mode === 'dashboard' ? 'Digital Marketing Dashboard' : currentType ? `${currentType.label} Tasks` : 'Marketing Tasks'}</h1><p className="mt-1 text-sm text-slate-500">{mode === 'dashboard' ? `Welcome back, ${firstName}.` : 'Plan, track and complete your deliverables.'}</p></div>
      {!preview && <button type="button" onClick={() => openNew()} className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"><Plus className="h-4 w-4" />New task</button>}
    </div>
    {(error || actionError) && <div role="alert" className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"><AlertCircle className="h-4 w-4 shrink-0" />{actionError ?? error}</div>}

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Open tasks', value: counts.open, icon: ClipboardList, tone: 'bg-blue-50 text-blue-700' },
          { label: 'In progress', value: counts.progress, icon: Clock3, tone: 'bg-cyan-50 text-cyan-700' },
          { label: 'Completed', value: counts.done, icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-700' },
          { label: 'Overdue', value: counts.overdue, icon: AlertCircle, tone: 'bg-rose-50 text-rose-700' },
        ].map((stat) => <div key={stat.label} className="flex items-center gap-3 rounded-md border border-slate-200 bg-white p-4"><span className={`grid h-10 w-10 place-items-center rounded-md ${stat.tone}`}><stat.icon className="h-5 w-5" /></span><div><p className="text-xs text-slate-500">{stat.label}</p><p className="text-xl font-semibold text-slate-900">{stat.value}</p></div></div>)}
    </div>
    {mode === 'dashboard' && <>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
        <section className="overflow-hidden rounded-md border border-slate-200 bg-white"><div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><h2 className="text-sm font-semibold text-slate-900">Upcoming work</h2><Link href={preview ? '/marketing-preview?view=work' : '/marketing'} className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline">View all<ArrowRight className="h-3.5 w-3.5" /></Link></div><TaskRows rows={tasks.filter((task) => task.status !== 'done' && task.status !== 'cancelled').sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999')).slice(0, 5)} /></section>
        <section className="rounded-md border border-slate-200 bg-white"><div className="border-b border-slate-100 px-4 py-3"><h2 className="text-sm font-semibold text-slate-900">Work by type</h2></div><div className="divide-y divide-slate-100">{MARKETING_TYPES.map((type) => { const Icon = icons[type.key] ?? ClipboardList; const amount = tasks.filter((task) => task.marketing_type === type.key && task.status !== 'done' && task.status !== 'cancelled').length; return <Link key={type.key} href={preview ? `/marketing-preview?view=work&category=${type.key}` : `/marketing?category=${type.key}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50"><Icon className="h-4 w-4 text-slate-500" /><span className="flex-1 text-sm text-slate-700">{type.label}</span><span className="text-xs font-medium text-slate-500">{amount}</span><ArrowRight className="h-3.5 w-3.5 text-slate-400" /></Link> })}</div></section>
      </div>
    </>}

    {mode === 'work' && <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Work type" value={currentType?.key ?? 'all'} onChange={(event) => router.push(workHref(event.target.value === 'all' ? undefined : event.target.value))} className={`${inputClass} w-full md:hidden`}><option value="all">All tasks</option>{MARKETING_TYPES.map((type) => <option key={type.key} value={type.key}>{type.label}</option>)}</select>
        <div className="flex w-full flex-wrap items-center gap-2 md:ml-auto md:w-auto">
          <select aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value)} className={`${inputClass} w-full sm:w-auto`}><option value="active">Active</option><option value="all">All statuses</option><option value="pending">To do</option><option value="in_progress">In progress</option><option value="done">Done</option></select>
          <div className="relative min-w-48 flex-1 lg:w-56 lg:flex-none"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tasks" aria-label="Search tasks" className={`${inputClass} w-full pl-9`} /></div>
        </div>
      </div>
      <section className="overflow-hidden rounded-md border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 text-xs text-slate-500"><span>{visible.length} task{visible.length === 1 ? '' : 's'}</span><span>Sorted by due date</span></div><TaskRows rows={visible} />
      </section>
    </div>}

    {dialog && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setDialog(false) }}><div role="dialog" aria-modal="true" aria-labelledby="marketing-task-title" className="w-full max-w-lg rounded-md bg-white p-5 shadow-xl"><div className="flex items-center justify-between"><h2 id="marketing-task-title" className="text-base font-semibold text-slate-900">{editing ? 'Edit task' : 'New marketing task'}</h2><button type="button" onClick={() => setDialog(false)} aria-label="Close" className="rounded p-1 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button></div><div className="mt-5 grid gap-4"><label className="text-xs font-medium text-slate-600">Title<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className={`mt-1 ${inputClass}`} placeholder="e.g. September launch poster" /></label><label className="text-xs font-medium text-slate-600">Work type<select value={form.marketing_type} onChange={(event) => setForm({ ...form, marketing_type: event.target.value as MarketingType })} className={`mt-1 ${inputClass}`}>{MARKETING_TYPES.map((type) => <option key={type.key} value={type.key}>{type.label}</option>)}</select></label><label className="text-xs font-medium text-slate-600">Details<textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className={`mt-1 ${inputClass}`} placeholder="Brief, channel, or deliverable notes" /></label><div className="grid grid-cols-2 gap-3"><label className="text-xs font-medium text-slate-600">Due date<input type="date" value={form.due_date} onChange={(event) => setForm({ ...form, due_date: event.target.value })} className={`mt-1 ${inputClass}`} /></label><label className="text-xs font-medium text-slate-600">Priority<select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as Form['priority'] })} className={`mt-1 ${inputClass}`}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label></div><label className="text-xs font-medium text-slate-600">Status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as Form['status'] })} className={`mt-1 ${inputClass}`}><option value="pending">To do</option><option value="in_progress">In progress</option><option value="done">Done</option><option value="cancelled">Cancelled</option></select></label></div>{actionError && <p role="alert" className="mt-3 text-sm text-rose-700">{actionError}</p>}<div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setDialog(false)} className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Cancel</button><button type="button" onClick={save} disabled={busy} className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50">{busy ? 'Saving...' : 'Save task'}</button></div></div></div>}
  </div>
}
