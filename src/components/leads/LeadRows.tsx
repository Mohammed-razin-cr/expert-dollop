'use client'

import { Fragment, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarClock, ChevronDown, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/api/client'
import { isBD, isStaff, type Role } from '@/lib/rbac'
import type { Enum } from '@/lib/database.types'
import { LeadRowActions } from './LeadRowActions'

/**
 * The leads table body, with each row's status chip opening that lead
 * underneath it.
 *
 * The same shape the Projects list uses: the chip is the way in, the panel
 * edits in place, and the full record stays on /leads/[id]. What is here is
 * the handful of fields that change while working a list — where the lead
 * stands, how warm it is, when to ring next, and why — so a status can be
 * moved on without leaving the list and losing the filters.
 */

const STATUSES: Enum<'lead_status'>[] = [
  'new', 'contacted', 'interested', 'demo_scheduled', 'aptitude_shared',
  'passed', 'enrolled', 'no_response', 'irrelevant', 'not_interested', 'lost',
]

// Stored capitalised and lowercase both ("Cold" 1623, "cold" 69), so the
// options carry the capitalised spelling and matching stays case-blind.
const TEMPERATURES = ['Hot', 'Warm', 'Cold']

const META: Record<string, string> = {
  new: 'bg-blue-50 text-blue-600', contacted: 'bg-amber-50 text-amber-600', interested: 'bg-emerald-50 text-emerald-600',
  demo_scheduled: 'bg-violet-50 text-violet-600', aptitude_shared: 'bg-cyan-50 text-cyan-600', passed: 'bg-green-50 text-green-600',
  enrolled: 'bg-blue-50 text-blue-600', no_response: 'bg-slate-100 text-slate-500', irrelevant: 'bg-slate-100 text-slate-400',
  not_interested: 'bg-rose-50 text-rose-500', lost: 'bg-slate-100 text-slate-500',
}

const tempCls = (t: string) =>
  /hot/i.test(t) ? 'text-rose-500' : /warm/i.test(t) ? 'text-amber-500' : /cold/i.test(t) ? 'text-sky-500' : 'text-slate-400'

const nice = (s: string | null) => (s ?? '').replaceAll('_', ' ')

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

const DAY = 24 * 60 * 60 * 1000

/**
 * How long a lead has sat untouched, as a colour on its Last Updated date:
 * over a week yellow, over two orange, over three red. Anything fresher
 * keeps the plain grey text.
 */
function staleness(d: string | null): { cls: string; days: number } {
  const days = d ? Math.floor((Date.now() - new Date(d).getTime()) / DAY) : 0
  const cls =
    days > 21 ? 'rounded-full bg-red-600 px-2 py-0.5 font-semibold text-white'
    : days > 14 ? 'rounded-full bg-orange-500 px-2 py-0.5 font-semibold text-white'
    : days > 7 ? 'rounded-full bg-yellow-300 px-2 py-0.5 font-semibold text-yellow-900'
    : ''
  return { cls, days }
}

/** YYYY-MM-DD in India, whatever timezone the server happens to run in. */
const istDay = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })

/**
 * Where the lead's next follow-up stands against today — the same split the
 * Follow-ups page's Today / Overdue tabs make, so the two pages agree.
 */
function followupDue(d: string | null): 'today' | 'overdue' | null {
  if (!d) return null
  const due = istDay(new Date(d))
  const today = istDay(new Date())
  return due < today ? 'overdue' : due === today ? 'today' : null
}

/** `next_followup_at` is a timestamp; the date input wants YYYY-MM-DD. */
const dateInput = (d: string | null) => (d ? String(d).slice(0, 10) : '')

/**
 * The link into a lead, carrying the list it was opened from.
 *
 * `returnQs` is this list's own query string, built on the server — tab,
 * search term, stage, BD, course, date range, drill-down and page number. It
 * rides along as `back` so the detail page's Close/X/Delete return to this
 * exact list rather than a reset /leads, which is what made every edit cost a
 * round of reapplying filters.
 *
 * Deliberately not read off `window.location`: these rows are server-rendered,
 * so touching `window` during render either crashes the server pass outright
 * or hydrates to a different href than the server sent.
 */
const leadHref = (id: string, returnQs: string) =>
  returnQs ? `/leads/${id}?back=${encodeURIComponent(returnQs)}` : `/leads/${id}`

export type LeadRow = {
  id: string
  name: string
  mobile: string | null
  course: string | null
  category: string | null
  temperature: string | null
  status: string
  updated_at: string | null
  created_at: string | null
  delete_requested: boolean
  assigned_bd: string | null
  remarks: string | null
  next_followup_at: string | null
}

const BLOCKED =
  'Nothing was saved — the database refused this change. A lead assigned to somebody else is theirs to edit.'

export function LeadRows({
  rows,
  role,
  myName,
  currentUserId,
  returnQs,
}: {
  rows: LeadRow[]
  role: Role
  myName: string
  currentUserId: string
  /** This list's own query string, for the round trip back from a lead. */
  returnQs: string
}) {
  const [open, setOpen] = useState<string | null>(null)

  return (
    <>
      {rows.map((l) => {
        const expanded = open === l.id
        // `leads_staff` gives admin every lead; `leads_bd_write` gives a BD
        // only the ones assigned to them. Offering the editor on somebody
        // else's lead would produce a refusal, so it opens read-only instead.
        const canEdit = isStaff(role) || (isBD(role) && l.assigned_bd === currentUserId)
        const lastUpdated = l.updated_at || l.created_at
        const stale = staleness(lastUpdated)
        const due = followupDue(l.next_followup_at)

        return (
          <Fragment key={l.id}>
            <tr className="border-t border-slate-100 hover:bg-slate-50/60">
              <td className="px-4 py-2.5 text-slate-500">
                <span
                  className={`whitespace-nowrap ${stale.cls}`}
                  title={stale.cls ? `Not updated for ${stale.days} days` : undefined}
                  // Server and browser can straddle a day boundary.
                  suppressHydrationWarning
                >
                  {fmtDate(lastUpdated)}
                </span>
              </td>
              <td className="px-4 py-2.5 font-medium">
                <Link href={leadHref(l.id, returnQs)} className="text-blue-600 hover:underline">{l.name}</Link>
                {due && (
                  <span
                    className={`ml-2 inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 align-middle text-[11px] font-medium ${
                      due === 'overdue' ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'
                    }`}
                    title={`Next follow-up: ${fmtDate(l.next_followup_at)}`}
                    suppressHydrationWarning
                  >
                    <CalendarClock className="h-3 w-3" />
                    {due === 'overdue' ? 'Overdue' : 'Follow-up today'}
                  </span>
                )}
              </td>
              <td className="px-4 py-2.5 text-slate-600">{l.mobile ?? '—'}</td>
              <td className="px-4 py-2.5 text-slate-600">{l.course ?? '—'}</td>
              <td className={`px-4 py-2.5 font-medium ${tempCls(l.temperature ?? '')}`}>
                {l.temperature || '—'}
              </td>
              <td className="px-4 py-2.5">
                {/* The chip is the way in: clicking any status opens that
                    lead under the row. */}
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : l.id)}
                  aria-expanded={expanded}
                  title={expanded ? 'Hide lead' : 'Open lead'}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium hover:brightness-95 ${META[l.status] ?? 'bg-slate-100 text-slate-500'}`}
                >
                  {nice(l.status)}
                  {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                </button>
              </td>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <Link href={leadHref(l.id, returnQs)} className="text-xs font-medium text-blue-600 hover:underline">Open</Link>
                  <LeadRowActions leadId={l.id} role={role} myName={myName} canEdit={canEdit} deleteRequested={l.delete_requested} />
                </div>
              </td>
            </tr>

            {expanded && (
              <tr className="border-t border-slate-100 bg-slate-50">
                <td colSpan={7} className="px-4 py-4">
                  <LeadPanel
                    row={l}
                    canEdit={canEdit}
                    currentUserId={currentUserId}
                    myName={myName}
                    returnQs={returnQs}
                    onClose={() => setOpen(null)}
                  />
                </td>
              </tr>
            )}
          </Fragment>
        )
      })}
    </>
  )
}

function LeadPanel({
  row,
  canEdit,
  currentUserId,
  myName,
  returnQs,
  onClose,
}: {
  row: LeadRow
  canEdit: boolean
  currentUserId: string
  myName: string
  returnQs: string
  onClose: () => void
}) {
  const router = useRouter()
  const supabase = createClient()
  const [f, setF] = useState({
    status: row.status,
    temperature: row.temperature ?? '',
    next_followup_at: dateInput(row.next_followup_at),
    remarks: row.remarks ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }))

  const dirty =
    f.status !== row.status ||
    f.temperature !== (row.temperature ?? '') ||
    f.next_followup_at !== dateInput(row.next_followup_at) ||
    f.remarks !== (row.remarks ?? '')

  async function save() {
    setSaving(true)
    setError(null)
    // .select() so a row-level-security refusal comes back as zero rows.
    // Without it an edit to somebody else's lead reports success and
    // changes nothing — the trap the detail page already guards against.
    const { data, error } = await supabase
      .from('leads')
      .update({
        // Always one of STATUSES or the value the row arrived with, both of
        // which are lead_status; the state holds it as a plain string.
        // Saving an edit on a still-"new" lead counts as first contact,
        // matching the detail page's save() and its follow-up logger —
        // unless the BD picked a different stage in this same edit.
        status: (f.status === 'new' ? 'contacted' : f.status) as Enum<'lead_status'>,
        temperature: f.temperature || null,
        next_followup_at: f.next_followup_at ? new Date(f.next_followup_at).toISOString() : null,
        remarks: f.remarks.trim() || null,
        // Stamped the way the detail page stamps it, so the list's Last
        // Updated column and "who touched this" agree however it was edited.
        updated_by: currentUserId,
        updated_by_name: myName,
      })
      .eq('id', row.id)
      .select('id')

    setSaving(false)
    if (error) return setError(error.message)
    if (!data?.length) return setError(BLOCKED)
    onClose()
    router.refresh()
  }

  const input =
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100'
  const label = 'mb-1 block text-xs font-medium text-slate-500'

  // Somebody who may not edit this lead still gets to read what is on it.
  if (!canEdit) {
    return (
      <div className="space-y-3">
        <p className="text-xs font-medium text-slate-500">
          {row.name} · assigned to somebody else, so it opens read-only
        </p>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          {([
            ['Status', nice(row.status)],
            ['Temperature', row.temperature],
            ['Next Follow-up', row.next_followup_at ? fmtDate(row.next_followup_at) : null],
            ['Remarks', row.remarks],
          ] as const).map(([name, value]) => (
            <div key={name}>
              <dt className="text-xs font-medium text-slate-500">{name}</dt>
              <dd className="whitespace-pre-wrap text-slate-700">{value || '—'}</dd>
            </div>
          ))}
        </dl>
        <Link href={leadHref(row.id, returnQs)} className="inline-block text-xs font-medium text-blue-600 hover:underline">
          Open the full lead
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-slate-500">{row.name}</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
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
            {/* The stored value keeps its own spelling until it is changed,
                so a lowercase "cold" still shows rather than blanking. */}
            {!!f.temperature && !TEMPERATURES.includes(f.temperature) && (
              <option value={f.temperature}>{f.temperature}</option>
            )}
            {TEMPERATURES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>Next Follow-up</label>
          <input
            className={input}
            type="date"
            value={f.next_followup_at}
            onChange={(e) => set('next_followup_at', e.target.value)}
          />
        </div>
        <div className="flex items-end">
          <Link href={leadHref(row.id, returnQs)} className="pb-2 text-xs font-medium text-blue-600 hover:underline">
            Open the full lead
          </Link>
        </div>
      </div>

      <div>
        <label className={label}>Remarks</label>
        <textarea className={input} rows={2} value={f.remarks} onChange={(e) => set('remarks', e.target.value)} />
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
        <button
          onClick={onClose}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
