'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Save, UserPlus } from 'lucide-react'
import { createClient } from '@/lib/api/client'

const SOURCES = ['just_dial', 'website', 'college', 'referral', 'social_media', 'walk_in']
const STATUSES = ['new', 'in_discussion', 'project_ordered', 'in_progress', 'delivered', 'declined']
const TEMPERATURES = ['Hot', 'Warm', 'Cold']
const RESPONSES = ['Interested', 'Not Interested', 'No Response', 'Will Call Back', 'Irrelevant']
// Mirrors ProjectRows' INVOICEABLE — nothing to bill until the vendor
// engagement is committed (project_ordered onward), and a declined project
// never will be.
const INVOICEABLE = new Set(['project_ordered', 'in_progress', 'delivered'])

type BD = { id: string; full_name: string }
type HistoryRow = { id: string; from_owner: string | null; to_owner: string | null; changed_by: string | null; changed_at: string }

type Project = {
  id: string
  entry_date: string | null
  source: string | null
  category: string | null
  name: string
  mobile: string | null
  department: string | null
  college: string | null
  response: string | null
  remarks: string | null
  vendor_name: string | null
  vendor_cost: number | null
  vendor2_name: string | null
  vendor2_cost: number | null
  company_cost: number | null
  amount_paid: number | null
  referral_deduction: number | null
  status: string
  temperature: string | null
  project_name: string | null
  notes: string | null
  owner_id: string | null
  created_at: string | null
  updated_at: string | null
  updated_by_name: string | null
}

export function ProjectDetail({
  project,
  bds,
  allProfiles,
  history,
  currentUserId,
  role,
}: {
  project: Project
  bds: BD[]
  allProfiles: BD[]
  history: HistoryRow[]
  currentUserId: string
  role: string
}) {
  const router = useRouter()
  const supabase = createClient()
  const isAdmin = role === 'admin' || role === 'super_admin'
  const isBdEquivalent = role === 'bd' || role === 'counsellor'
  const nameOf = (id: string | null) => (id ? allProfiles.find((p) => p.id === id)?.full_name ?? 'Unknown' : 'Unassigned')
  const [ownerId, setOwnerId] = useState(project.owner_id)
  // Mirrors leads: admin or the current owner may edit; any other
  // BD/counsellor gets a read-only form and a Take Over banner instead.
  const canEdit = isAdmin || ownerId === currentUserId
  const canTakeOver = isBdEquivalent && !canEdit
  const [takingOver, setTakingOver] = useState(false)
  const [f, setF] = useState({
    entry_date: project.entry_date ?? '',
    source: project.source ?? 'website',
    category: project.category ?? '',
    name: project.name ?? '',
    mobile: project.mobile ?? '',
    department: project.department ?? '',
    college: project.college ?? '',
    response: project.response ?? '',
    remarks: project.remarks ?? '',
    vendor_name: project.vendor_name ?? '',
    vendor_cost: project.vendor_cost?.toString() ?? '',
    vendor2_name: project.vendor2_name ?? '',
    vendor2_cost: project.vendor2_cost?.toString() ?? '',
    company_cost: project.company_cost?.toString() ?? '',
    amount_paid: project.amount_paid?.toString() ?? '',
    referral_deduction: project.referral_deduction?.toString() ?? '',
    status: project.status ?? 'new',
    temperature: project.temperature ?? '',
    project_name: project.project_name ?? '',
    notes: project.notes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const set = (key: keyof typeof f, value: string) => {
    setF((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  async function save() {
    if (!canEdit) return
    if (!f.name.trim()) {
      setError('Name is required')
      return
    }
    setSaving(true)
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user!.id).single()
    const { data, error } = await supabase
      .from('projects')
      .update({
        entry_date: f.entry_date || null,
        source: f.source || null,
        category: f.category || null,
        name: f.name.trim(),
        mobile: f.mobile || null,
        department: f.department || null,
        college: f.college || null,
        response: f.response || null,
        remarks: f.remarks || null,
        vendor_name: f.vendor_name || null,
        vendor_cost: f.vendor_cost ? Number(f.vendor_cost) : null,
        vendor2_name: f.vendor2_name || null,
        vendor2_cost: f.vendor2_cost ? Number(f.vendor2_cost) : null,
        company_cost: f.company_cost ? Number(f.company_cost) : null,
        amount_paid: f.amount_paid ? Number(f.amount_paid) : null,
        referral_deduction: f.referral_deduction ? Number(f.referral_deduction) : null,
        status: f.status,
        temperature: f.temperature || null,
        project_name: f.project_name || null,
        notes: f.notes || null,
        // Reassigning is an admin action — see the Owner select below, which
        // only an admin sees. Everyone else's write leaves owner_id alone,
        // which the tightened projects_bd_write policy requires anyway: it
        // is already ownerId === currentUserId or this save button wouldn't
        // be enabled at all.
        ...(isAdmin && { owner_id: ownerId }),
        updated_by: user?.id,
        updated_by_name: profile?.full_name,
      })
      .eq('id', project.id)
      // .select() so an RLS refusal (e.g. a stale canEdit) comes back as
      // zero rows rather than a silent success.
      .select('id')

    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    if (!data?.length) {
      setError('Nothing was saved — the database refused this change. You may no longer have access to this project.')
      return
    }
    setSaved(true)
    router.refresh()
  }

  async function takeOver() {
    if (!canTakeOver || takingOver) return
    if (!confirm(`Take over this project from ${nameOf(ownerId)}? It will be reassigned to you.`)) return
    setTakingOver(true)
    setError(null)
    const { data, error } = await supabase.from('projects').update({ owner_id: currentUserId }).eq('id', project.id).select('id')
    setTakingOver(false)
    if (error) {
      setError(error.message)
      return
    }
    if (!data?.length) {
      setError('Could not take over — you may not have permission on this project.')
      return
    }
    setOwnerId(currentUserId)
    router.refresh()
  }

  // Imported rows keep whatever the sheet said ("Just dail", "Bharath sir"),
  // which is not one of the canonical options. Offer that value too, or the
  // select would render blank and quietly rewrite the source on the next save.
  const sourceOptions = f.source && !SOURCES.includes(f.source) ? [f.source, ...SOURCES] : SOURCES

  const input = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100'
  const label = 'mb-1 block text-xs font-medium text-slate-500'

  return (
    <div className="space-y-6">
      <Link href="/projects" className="text-blue-600 hover:underline">← Back to Projects</Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <p className="text-slate-500">{project.project_name || 'Project details'}</p>
        </div>
        <div className="flex items-center gap-2">
          {INVOICEABLE.has(project.status) && (
            <Link href={`/invoicing?project_id=${project.id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100">
              Generate Invoice
            </Link>
          )}
          {canEdit && (
            <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
              <Save className="h-3.5 w-3.5" /> {saving ? 'Saving…' : 'Save'}{saved && ' ✓'}
            </button>
          )}
        </div>
      </div>

      {canTakeOver && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
          <p className="text-amber-800">
            This project is assigned to <strong>{nameOf(ownerId)}</strong>. Take it over to edit it.
          </p>
          <button onClick={takeOver} disabled={takingOver} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50">
            <UserPlus className="h-4 w-4" /> {takingOver ? 'Taking over…' : 'Take Over Project'}
          </button>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
        <p>
          <strong>Owner:</strong> {nameOf(ownerId)}
        </p>
        <p className="mt-1">
          <strong>Project Created On:</strong>{' '}
          {project.created_at ? new Date(project.created_at).toLocaleString('en-IN') : '—'}
        </p>
        <p className="mt-1">
          <strong>Last Updated By:</strong>{' '}
          {project.updated_by_name ?? 'Not updated yet'}
        </p>
        <p className="mt-1">
          <strong>Last Updated On:</strong>{' '}
          {project.updated_at ? new Date(project.updated_at).toLocaleString('en-IN') : '—'}
        </p>

        {history.length > 0 && (
          <div className="mt-3 border-t border-slate-200 pt-3">
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
              Assignment History
              <span className="ml-1 font-normal normal-case tracking-normal text-slate-400">· newest first</span>
            </p>
            <ul className="space-y-1">
              {history.map((h, i) => {
                // The query orders changed_at desc, so the first row is the
                // change that produced today's owner — see LeadDetail for
                // why this is only badged when it still agrees with ownerId.
                const isCurrent = i === 0 && h.to_owner === ownerId
                return (
                  <li key={h.id} className={isCurrent ? 'text-slate-800' : 'text-slate-500'}>
                    {isCurrent && (
                      <span className="mr-1.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                        Current
                      </span>
                    )}
                    <strong>{nameOf(h.from_owner)}</strong> → <strong>{nameOf(h.to_owner)}</strong>
                    {' · by '}{nameOf(h.changed_by)}
                    {' · '}{new Date(h.changed_at).toLocaleString('en-IN')}
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {/* Admin only, same reasoning as LeadDetail's Assigned BD field —
              reassigning is an admin action; everyone else already learns
              whose project this is from the Owner line above or the
              take-over banner. */}
          {isAdmin && (
            <div>
              <label className={label}>Owner</label>
              <select className={input} value={ownerId ?? ''} onChange={(e) => setOwnerId(e.target.value || null)}>
                <option value="">Unassigned</option>
                {bds.map((b) => <option key={b.id} value={b.id}>{b.full_name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className={label}>Date</label>
            <input className={input} type="date" value={f.entry_date} onChange={(e) => set('entry_date', e.target.value)} disabled={!canEdit} />
          </div>
          <div>
            <label className={label}>Source</label>
            <select className={input} value={f.source} onChange={(e) => set('source', e.target.value)} disabled={!canEdit}>
              {sourceOptions.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Category</label>
            <input className={input} value={f.category} onChange={(e) => set('category', e.target.value)} disabled={!canEdit} />
          </div>

          <div>
            <label className={label}>Name *</label>
            <input className={input} value={f.name} onChange={(e) => set('name', e.target.value)} disabled={!canEdit} />
          </div>
          <div>
            <label className={label}>Mobile</label>
            <input
              className={input}
              type="tel"
              inputMode="numeric"
              maxLength={10}
              value={f.mobile}
              onChange={(e) => set('mobile', e.target.value.replace(/\D/g, '').slice(0, 10))}
              disabled={!canEdit}
            />
          </div>
          <div>
            <label className={label}>Department</label>
            <input className={input} value={f.department} onChange={(e) => set('department', e.target.value)} disabled={!canEdit} />
          </div>

          <div>
            <label className={label}>College</label>
            <input className={input} value={f.college} onChange={(e) => set('college', e.target.value)} disabled={!canEdit} />
          </div>
          <div>
            <label className={label}>Response</label>
            <select className={input} value={f.response} onChange={(e) => set('response', e.target.value)} disabled={!canEdit}>
              <option value="">—</option>
              {RESPONSES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Remarks</label>
            <input className={input} value={f.remarks} onChange={(e) => set('remarks', e.target.value)} disabled={!canEdit} />
          </div>

          <div>
            <label className={label}>Project Name</label>
            <input className={input} value={f.project_name} onChange={(e) => set('project_name', e.target.value)} disabled={!canEdit} />
          </div>
          <div>
            <label className={label}>Vendor Name</label>
            <input className={input} value={f.vendor_name} onChange={(e) => set('vendor_name', e.target.value)} disabled={!canEdit} />
          </div>
          <div>
            <label className={label}>Status</label>
            <select className={input} value={f.status} onChange={(e) => set('status', e.target.value)} disabled={!canEdit}>
              {STATUSES.map((s) => <option key={s} value={s}>{s.replaceAll('_', ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Temperature</label>
            <select className={input} value={f.temperature} onChange={(e) => set('temperature', e.target.value)} disabled={!canEdit}>
              <option value="">—</option>
              {!!f.temperature && !TEMPERATURES.includes(f.temperature) && (
                <option value={f.temperature}>{f.temperature}</option>
              )}
              {TEMPERATURES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className={label}>Vendor Cost (₹)</label>
            <input className={input} type="number" step="0.01" value={f.vendor_cost} onChange={(e) => set('vendor_cost', e.target.value)} disabled={!canEdit} />
          </div>
          <div>
            <label className={label}>Vendor 2 Name</label>
            <input className={input} value={f.vendor2_name} onChange={(e) => set('vendor2_name', e.target.value)} disabled={!canEdit} />
          </div>
          <div>
            <label className={label}>Vendor 2 Cost (₹)</label>
            <input className={input} type="number" step="0.01" value={f.vendor2_cost} onChange={(e) => set('vendor2_cost', e.target.value)} disabled={!canEdit} />
          </div>
          <div>
            <label className={label}>Company Cost (₹)</label>
            <input className={input} type="number" step="0.01" value={f.company_cost} onChange={(e) => set('company_cost', e.target.value)} disabled={!canEdit} />
          </div>
          <div>
            <label className={label}>Amount Paid (₹)</label>
            <input className={input} type="number" step="0.01" value={f.amount_paid} onChange={(e) => set('amount_paid', e.target.value)} disabled={!canEdit} />
          </div>
          <div>
            <label className={label}>Referral Deduction (₹)</label>
            <input className={input} type="number" step="0.01" value={f.referral_deduction} onChange={(e) => set('referral_deduction', e.target.value)} disabled={!canEdit} />
          </div>

          <div className="sm:col-span-2 lg:col-span-3">
            <label className={label}>Notes</label>
            <textarea className={input} rows={3} value={f.notes} onChange={(e) => set('notes', e.target.value)} disabled={!canEdit} />
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  )
}
