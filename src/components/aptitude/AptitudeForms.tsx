'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/api/client'

// Selected / Not Selected are outcomes, not workflow statuses: they belong to
// the result picker below, which records the outcome proper. Leaving them in
// the status list let someone tag a row Selected with no result behind it.
const APT_STATUS_OPTIONS = [
  'Form Filled', 'Form Filled — Payment Verified', 'Payment Done',
  'Payment Done — Test Pending', 'Scheduled',
]
const APT_OUTCOME_STATUSES = ['Selected', 'Not Selected']
export const APT_STATUSES = [...APT_STATUS_OPTIONS, ...APT_OUTCOME_STATUSES]
const RESULTS = ['', 'Selected', 'Not Selected', 'Pending']
const inp = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100'

export function AddAptitudeForm() {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [f, setF] = useState({ name: '', phone: '', email: '', college: '', round: 'Round 1', status: 'Form Filled', payment_amt: '99', payment_done: false })
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }))

  async function save() {
    if (!f.name) return setErr('Name required')
    setErr(null)
    const { error } = await supabase.from('aptitude').insert({
      apt_key: `apt_${Date.now()}_m`, name: f.name, phone: f.phone || null, email: f.email || null,
      college: f.college || null, round: f.round, status: f.status, bd: 'Sangeetha',
      source: 'Manual', mode: 'Online', apt_date: new Date().toISOString().slice(0, 10),
      payment_amt: Number(f.payment_amt || 0), payment_done: f.payment_done,
      payment_mode: f.payment_done ? 'UPI' : null,
    })
    if (error) return setErr(error.message)
    setF({ name: '', phone: '', email: '', college: '', round: 'Round 1', status: 'Form Filled', payment_amt: '99', payment_done: false })
    setOpen(false); router.refresh()
  }

  if (!open) return (
    <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"><Plus className="h-4 w-4" /> Add Candidate</button>
  )
  return (
    <div className="w-full rounded-xl border border-slate-200 bg-white p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input className={inp} placeholder="Name *" value={f.name} onChange={(e) => set('name', e.target.value)} />
        <input className={inp} placeholder="Phone" value={f.phone} onChange={(e) => set('phone', e.target.value)} />
        <input className={inp} placeholder="Email" value={f.email} onChange={(e) => set('email', e.target.value)} />
        <input className={inp} placeholder="College" value={f.college} onChange={(e) => set('college', e.target.value)} />
        <select className={inp} value={f.round} onChange={(e) => set('round', e.target.value)}><option>Round 1</option><option>Round 2</option></select>
        <select className={inp} value={f.status} onChange={(e) => set('status', e.target.value)}>{APT_STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}</select>
        <input className={inp} type="number" placeholder="Fee (₹)" value={f.payment_amt} onChange={(e) => set('payment_amt', e.target.value)} />
        <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={f.payment_done} onChange={(e) => set('payment_done', e.target.checked)} /> Payment done</label>
      </div>
      {err && <p className="mt-2 text-sm text-rose-600">{err}</p>}
      <div className="mt-3 flex gap-2">
        <button onClick={save} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white">Save</button>
        <button onClick={() => { setOpen(false); setErr(null) }} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600">Cancel</button>
      </div>
    </div>
  )
}

export function AptRowControls({ id, status, result, payment_done }: { id: string; status: string; result: string | null; payment_done: boolean }) {
  const router = useRouter()
  const supabase = createClient()
  const upd = (fields: any) => supabase.from('aptitude').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', id).then(() => router.refresh())
  return (
    <div className="flex items-center gap-1.5">
      <select defaultValue={status} onChange={(e) => upd({ status: e.target.value })} className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs max-w-[150px]">
        {(APT_STATUS_OPTIONS.includes(status) ? APT_STATUS_OPTIONS : [...APT_STATUS_OPTIONS, status]).map((s) => <option key={s}>{s}</option>)}
      </select>
      <select defaultValue={result ?? ''} onChange={(e) => upd({ result: e.target.value })} className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs">
        {RESULTS.map((r) => <option key={r} value={r}>{r || 'result…'}</option>)}
      </select>
      <button onClick={() => upd({ payment_done: !payment_done, payment_mode: !payment_done ? 'UPI' : null })}
        className={`rounded-md px-2 py-1 text-xs font-medium ${payment_done ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
        {payment_done ? '₹ Paid' : 'Unpaid'}
      </button>
    </div>
  )
}
