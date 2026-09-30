'use client'

import { Fragment, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronRight, UserPlus } from 'lucide-react'
import { createClient } from '@/lib/api/client'
import { ProjectRowActions } from './ProjectRowActions'

const STATUSES = ['new', 'in_discussion', 'project_ordered', 'in_progress', 'delivered', 'declined']
const META: Record<string, string> = {
  new: 'bg-blue-50 text-blue-600',
  in_discussion: 'bg-violet-50 text-violet-600',
  project_ordered: 'bg-cyan-50 text-cyan-600',
  in_progress: 'bg-amber-50 text-amber-600',
  delivered: 'bg-emerald-50 text-emerald-600',
  declined: 'bg-rose-50 text-rose-600',
}
const TEMPERATURES = ['Hot', 'Warm', 'Cold']
const tempCls = (t: string) =>
  /hot/i.test(t) ? 'text-rose-500' : /warm/i.test(t) ? 'text-amber-500' : /cold/i.test(t) ? 'text-sky-500' : 'text-slate-400'
const RESPONSES = ['Interested', 'Not Interested', 'No Response', 'Will Call Back', 'Irrelevant']

// Flattened on the server so a row crosses to the client as plain JSON —
// the nested owner join does not survive as-is.
export type ProjectRow = {
  id: string
  date: string | null
  name: string
  mobile: string | null
  college: string | null
  department: string | null
  project_name: string | null
  vendor_name: string | null
  owner_id: string | null
  owner_name: string | null
  status: string
  temperature: string | null
  delete_requested: boolean
  response: string | null
  remarks: string | null
  notes: string | null
}

const nice = (s: string | null) => (s ?? '').replaceAll('_', ' ')
// Nothing to bill while a project is still being talked about (new,
// in_discussion) or fell through (declined); project_ordered onward means
// the vendor engagement is committed, which is what gets invoiced.
const INVOICEABLE = new Set(['project_ordered', 'in_progress', 'delivered'])

export function ProjectRows({
  rows,
  role,
  myName,
  currentUserId,
}: {
  rows: ProjectRow[]
  role: string
  myName: string
  currentUserId: string
}) {
  const [open, setOpen] = useState<string | null>(null)
  const isStaff = role === 'admin' || role === 'super_admin'
  const isBdEquivalent = role === 'bd' || role === 'counsellor'

  return (
    <>
      {rows.map((r) => {
        const expanded = open === r.id
        // Mirrors leads: an admin or the project's own owner may edit it;
        // any other BD/counsellor reaches the row read-only until they take
        // it over (see DetailsPanel's read-only branch below).
        const isOwner = !!r.owner_id && r.owner_id === currentUserId
        const rowCanEdit = isStaff || isOwner
        const rowCanTakeOver = isBdEquivalent && !rowCanEdit
        return (
          // A project takes a second row while its details panel is open, so
          // the key belongs on the fragment holding both.
          <Fragment key={r.id}>
            <tr className="border-t border-slate-100 hover:bg-slate-50/60">
              <td className="px-4 py-2.5 text-slate-500">
                {r.date
                  ? new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                  : '—'}
              </td>
              <td className="px-4 py-2.5 font-medium">
                <Link href={`/projects/${r.id}`} className="text-blue-600 hover:underline">{r.name}</Link>
              </td>
              <td className="px-4 py-2.5 text-slate-600">{r.mobile ?? '—'}</td>
              <td className="px-4 py-2.5 text-slate-600">{r.college ?? '—'}</td>
              <td className="px-4 py-2.5 text-slate-600">{r.department ?? '—'}</td>
              <td className="px-4 py-2.5 text-slate-600">{r.project_name ?? '—'}</td>
              <td className="px-4 py-2.5 text-slate-600">{r.vendor_name ?? '—'}</td>
              <td className="px-4 py-2.5 text-slate-600">{r.owner_name ?? '—'}</td>
              <td className="px-4 py-2.5">
                {/* The chip is the way in: clicking any status opens that
                    project's response, remarks and notes under the row. */}
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : r.id)}
                  aria-expanded={expanded}
                  title={expanded ? 'Hide details' : 'Show details'}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium hover:brightness-95 ${META[r.status] ?? 'bg-slate-100 text-slate-500'}`}
                >
                  {nice(r.status)}
                  {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                </button>
              </td>
              <td className={`px-4 py-2.5 font-medium ${tempCls(r.temperature ?? '')}`}>
                {r.temperature || '—'}
              </td>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <Link href={`/projects/${r.id}`} className="text-xs font-medium text-blue-600 hover:underline">Open</Link>
                  {(isStaff || isBdEquivalent) && INVOICEABLE.has(r.status) && (
                    <Link href={`/invoicing?project_id=${r.id}`} className="text-xs font-medium text-emerald-600 hover:underline">Invoice</Link>
                  )}
                  <ProjectRowActions projectId={r.id} role={role} myName={myName} canEdit={rowCanEdit} deleteRequested={r.delete_requested} />
                </div>
              </td>
            </tr>
            {expanded && (
              <tr className="border-t border-slate-100 bg-slate-50">
                <td colSpan={11} className="px-4 py-4">
                  <DetailsPanel row={r} canEdit={rowCanEdit} canTakeOver={rowCanTakeOver} onClose={() => setOpen(null)} />
                </td>
              </tr>
            )}
          </Fragment>
        )
      })}
    </>
  )
}

function DetailsPanel({
  row,
  canEdit,
  canTakeOver,
  onClose,
}: {
  row: ProjectRow
  canEdit: boolean
  canTakeOver: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const supabase = createClient()
  const [f, setF] = useState({
    status: row.status,
    temperature: row.temperature ?? '',
    response: row.response ?? '',
    remarks: row.remarks ?? '',
    notes: row.notes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [takingOver, setTakingOver] = useState(false)

  const set = (key: keyof typeof f, value: string) => setF((prev) => ({ ...prev, [key]: value }))

  async function takeOver() {
    if (!canTakeOver || takingOver) return
    if (!confirm(`Take over "${row.name}" from ${row.owner_name ?? 'its current owner'}? It will be reassigned to you.`)) return
    setTakingOver(true)
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    // .select() so an RLS refusal comes back as zero rows rather than a
    // silent success — same guard as save() below.
    const { data, error } = await supabase.from('projects').update({ owner_id: user!.id }).eq('id', row.id).select('id')
    setTakingOver(false)
    if (error) return setError(error.message)
    if (!data?.length) return setError('Could not take over — you may not have permission on this project.')
    onClose()
    router.refresh()
  }

  const dirty =
    f.status !== row.status ||
    f.temperature !== (row.temperature ?? '') ||
    f.response !== (row.response ?? '') ||
    f.remarks !== (row.remarks ?? '') ||
    f.notes !== (row.notes ?? '')

  async function save() {
    setSaving(true)
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user!.id).single()
    // .select() so an RLS refusal comes back as zero rows rather than a
    // silent success — the same guard the delete request uses.
    const { data, error } = await supabase
      .from('projects')
      .update({
        status: f.status,
        temperature: f.temperature || null,
        response: f.response.trim() || null,
        remarks: f.remarks.trim() || null,
        notes: f.notes.trim() || null,
        updated_by: user?.id,
        updated_by_name: profile?.full_name,
      })
      .eq('id', row.id)
      .select('id')
    setSaving(false)
    if (error) return setError(error.message)
    if (!data?.length) return setError('Could not save — you may not have permission on this project.')
    onClose()
    router.refresh()
  }

  const input = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100'
  const label = 'mb-1 block text-xs font-medium text-slate-500'

  // Anyone who may not edit the project still gets to read what is on it;
  // the same three fields, just as text.
  if (!canEdit) {
    return (
      <div className="space-y-3">
        <p className="text-xs font-medium text-slate-500">{row.name}</p>
        {canTakeOver && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs">
            <p className="text-amber-800">
              Assigned to <strong>{row.owner_name ?? 'Unassigned'}</strong>. Take it over to edit it.
            </p>
            <button
              onClick={takeOver}
              disabled={takingOver}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              <UserPlus className="h-3.5 w-3.5" /> {takingOver ? 'Taking over…' : 'Take Over Project'}
            </button>
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          {([['Temperature', row.temperature], ['Response', row.response], ['Remarks', row.remarks], ['Notes', row.notes]] as const).map(
            ([name, value]) => (
              <div key={name}>
                <dt className="text-xs font-medium text-slate-500">{name}</dt>
                <dd className="whitespace-pre-wrap text-slate-700">{value || '—'}</dd>
              </div>
            ),
          )}
        </dl>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-slate-500">{row.name}</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className={label}>Status</label>
          <select className={input} value={f.status} onChange={(e) => set('status', e.target.value)}>
            {STATUSES.map((s) => <option key={s} value={s}>{nice(s)}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>Temperature</label>
          <select className={input} value={f.temperature} onChange={(e) => set('temperature', e.target.value)}>
            <option value="">—</option>
            {!!f.temperature && !TEMPERATURES.includes(f.temperature) && (
              <option value={f.temperature}>{f.temperature}</option>
            )}
            {TEMPERATURES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>Response</label>
          <select className={input} value={f.response} onChange={(e) => set('response', e.target.value)}>
            <option value="">—</option>
            {RESPONSES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>Remarks</label>
          <input className={input} value={f.remarks} onChange={(e) => set('remarks', e.target.value)} />
        </div>
      </div>

      <div>
        <label className={label}>Notes</label>
        <textarea className={input} rows={2} value={f.notes} onChange={(e) => set('notes', e.target.value)} />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          onClick={save}
          disabled={saving || !dirty}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
          Cancel
        </button>
      </div>
    </div>
  )
}
