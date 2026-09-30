'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/api/client'

const SOURCES = ['just_dial', 'website', 'college', 'referral', 'social_media', 'walk_in']
const STATUSES = ['new', 'in_discussion', 'project_ordered', 'in_progress', 'delivered', 'declined']
const TEMPERATURES = ['Hot', 'Warm', 'Cold']
const RESPONSES = ['Interested', 'Not Interested', 'No Response', 'Will Call Back', 'Irrelevant']

type ProjectForm = {
  entry_date: string
  source: string
  category: string
  name: string
  mobile: string
  department: string
  college: string
  response: string
  remarks: string
  vendor_name: string
  vendor_cost: string
  vendor2_name: string
  vendor2_cost: string
  company_cost: string
  amount_paid: string
  referral_deduction: string
  status: string
  temperature: string
  project_name: string
  notes: string
}

const EMPTY: ProjectForm = {
  entry_date: '',
  source: 'website',
  category: '',
  name: '',
  mobile: '',
  department: '',
  college: '',
  response: '',
  remarks: '',
  vendor_name: '',
  vendor_cost: '',
  vendor2_name: '',
  vendor2_cost: '',
  company_cost: '',
  amount_paid: '',
  referral_deduction: '',
  status: 'new',
  temperature: '',
  project_name: '',
  notes: '',
}

export function AddProjectForm() {
  const router = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [f, setF] = useState<ProjectForm>(EMPTY)

  const set = (key: keyof ProjectForm, value: string) => setF((prev) => ({ ...prev, [key]: value }))

  async function save() {
    if (!f.name.trim()) {
      setError('Name is required')
      return
    }
    if (f.mobile && f.mobile.length !== 10) {
      setError('Mobile number must be exactly 10 digits')
      return
    }
    setSaving(true)
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user!.id).single()
    const { data, error } = await supabase
      .from('projects')
      .insert({
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
        owner_id: user?.id ?? null,
        updated_by: user?.id,
        updated_by_name: profile?.full_name,
      })
      .select('id')
      .single()

    setSaving(false)

    if (error) {
      setError(error.message)
      return
    }

    router.push(`/projects/${data.id}`)
  }

  const input = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100'
  const label = 'mb-1 block text-xs font-medium text-slate-500'

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className={label}>Date</label>
          <input className={input} type="date" value={f.entry_date} onChange={(e) => set('entry_date', e.target.value)} />
        </div>
        <div>
          <label className={label}>Source</label>
          <select className={input} value={f.source} onChange={(e) => set('source', e.target.value)}>
            {SOURCES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>Category</label>
          <input className={input} value={f.category} onChange={(e) => set('category', e.target.value)} />
        </div>

        <div>
          <label className={label}>Name *</label>
          <input className={input} value={f.name} onChange={(e) => set('name', e.target.value)} />
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
          />
        </div>
        <div>
          <label className={label}>Department</label>
          <input className={input} value={f.department} onChange={(e) => set('department', e.target.value)} />
        </div>

        <div>
          <label className={label}>College</label>
          <input className={input} value={f.college} onChange={(e) => set('college', e.target.value)} />
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

        <div>
          <label className={label}>Project Name</label>
          <input className={input} value={f.project_name} onChange={(e) => set('project_name', e.target.value)} />
        </div>
        <div>
          <label className={label}>Vendor Name</label>
          <input className={input} value={f.vendor_name} onChange={(e) => set('vendor_name', e.target.value)} />
        </div>
        <div>
          <label className={label}>Status</label>
          <select className={input} value={f.status} onChange={(e) => set('status', e.target.value)}>
            {STATUSES.map((s) => <option key={s} value={s}>{s.replaceAll('_', ' ')}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>Temperature</label>
          <select className={input} value={f.temperature} onChange={(e) => set('temperature', e.target.value)}>
            <option value="">—</option>
            {TEMPERATURES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div>
          <label className={label}>Vendor Cost (₹)</label>
          <input className={input} type="number" step="0.01" value={f.vendor_cost} onChange={(e) => set('vendor_cost', e.target.value)} />
        </div>
        <div>
          <label className={label}>Vendor 2 Name</label>
          <input className={input} value={f.vendor2_name} onChange={(e) => set('vendor2_name', e.target.value)} />
        </div>
        <div>
          <label className={label}>Vendor 2 Cost (₹)</label>
          <input className={input} type="number" step="0.01" value={f.vendor2_cost} onChange={(e) => set('vendor2_cost', e.target.value)} />
        </div>
        <div>
          <label className={label}>Company Cost (₹)</label>
          <input className={input} type="number" step="0.01" value={f.company_cost} onChange={(e) => set('company_cost', e.target.value)} />
        </div>
        <div>
          <label className={label}>Amount Paid (₹)</label>
          <input className={input} type="number" step="0.01" value={f.amount_paid} onChange={(e) => set('amount_paid', e.target.value)} />
        </div>
        <div>
          <label className={label}>Referral Deduction (₹)</label>
          <input className={input} type="number" step="0.01" value={f.referral_deduction} onChange={(e) => set('referral_deduction', e.target.value)} />
        </div>

        <div className="sm:col-span-2 lg:col-span-3">
          <label className={label}>Notes</label>
          <textarea className={input} rows={3} value={f.notes} onChange={(e) => set('notes', e.target.value)} />
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-4 flex gap-3">
        <button onClick={save} disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
          {saving ? 'Saving…' : 'Save Project'}
        </button>
        <button onClick={() => router.push('/projects')} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600">
          Cancel
        </button>
      </div>
    </div>
  )
}
