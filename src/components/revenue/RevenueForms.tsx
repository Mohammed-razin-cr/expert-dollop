'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/api/client'
import { REVENUE_SOURCES, revenueFingerprint } from '@/lib/revenue'

const inp = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100'
const MODES = ['UPI', 'Cash', 'NEFT', 'Cheque']
const today = () => new Date().toISOString().slice(0, 10)

// An UPDATE the row-level security policy filters out matches nothing and
// comes back without an error, so "no rows changed" is the only signal that
// the write was refused rather than applied.
const BLOCKED = 'Nothing was saved — the database refused this change. This collection belongs to another BD.'

export function AddRevenueForm({ bdName }: { bdName: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [f, setF] = useState({
  date: today(),
  name: '',
  phone: '',
  program: '',

  totalAmount: '',
  receivedAmount: '',
  deductions: '',

  mode: 'UPI',
  src: 'Direct',
  status: 'Received'
})
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }))
  const totalAmount = Number(f.totalAmount) || 0

// Written off the balance — a referral payout, a discount, a waiver. The
// reason isn't modelled, only the figure.
const deductions = Number(f.deductions) || 0

// A blank "Received Amount" still means the entry is settled in full.
// With something written off, settling in full is paying the total less
// the deduction — not the whole total. Only a smaller number typed in
// makes it a partial/pending one.
const receivedAmount = f.receivedAmount.trim() === ''
  ? Math.max(totalAmount - deductions, 0)
  : Number(f.receivedAmount) || 0

// A deduction reduces what the student still owes, so it comes off the
// balance alongside what they've actually paid.
const pendingAmount = Math.max(
  totalAmount - receivedAmount - deductions,
  0
)

const dueDate = (() => {
  const d = new Date(f.date)
  d.setDate(d.getDate() + 30)
  return d
})()

const formattedDueDate = dueDate.toLocaleDateString('en-GB')
  async function save() {
    if (!f.name || !f.totalAmount) return setErr('Name and amount required')
    setErr(null)
    const amt = Number(f.totalAmount)
    const fp = revenueFingerprint(f.date, f.name, amt, f.mode)
    const { data: dup } = await supabase.from('revenue').select('id').eq('fingerprint', fp).is('deleted_at', null).maybeSingle()
    if (dup) return setErr('Duplicate entry (same date + name + amount + mode)')
    const { error } = await supabase.from('revenue').insert({
  rev_key: `rev_${Date.now()}_m`,
  txn_id: `TXN-${f.date.replace(/-/g, '')}-${Math.floor(100000 + Math.random() * 900000)}`,

  // Dates
  date: f.date,
  payment_date: f.date,
  due_date: dueDate.toISOString().split('T')[0],

  // Student Details
  name: f.name,
  phone: f.phone || null,
  program: f.program || null,

  // Revenue Details
  amt: receivedAmount,
  total_amt: Number(f.totalAmount),
  received_amount: receivedAmount,
  pending_amount: pendingAmount,
  deductions: deductions,

  base: Number(f.totalAmount),
  gst: 0,

  mode: f.mode,
  src: f.src,
  status: pendingAmount > 0 ? 'Pending' : 'Received',

  bd: bdName,
  verified: 'No',
  fingerprint: fp,
})
    if (error) return setErr(error.message)
    setF({
  date: today(),
  name: '',
  phone: '',
  program: '',

  

  totalAmount: '',
  receivedAmount: '',
  deductions: '',

  mode: 'UPI',
  src: 'Direct',
  status: 'Received'
})
    setOpen(false); router.refresh()
  }

  if (!open) return (
    <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"><Plus className="h-4 w-4" /> Add Revenue</button>
  )
  return (
    <div className="w-full rounded-xl border border-slate-200 bg-white p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div><label className="mb-1 block text-[11px] uppercase text-slate-400">Date</label><input className={inp} type="date" value={f.date} onChange={(e) => set('date', e.target.value)} /></div>
        <input className={inp} placeholder="Name *" value={f.name} onChange={(e) => set('name', e.target.value)} />
        <input className={inp} placeholder="Phone" value={f.phone} onChange={(e) => set('phone', e.target.value)} />
        <input className={inp} placeholder="Program / course" value={f.program} onChange={(e) => set('program', e.target.value)} />
         
         <div>
  <label className="mb-1 block text-[11px] uppercase text-slate-400">
    Total Amount
  </label>

  <input
    className={inp}
    type="number"
    placeholder="Total Amount (₹)"
    value={f.totalAmount}
    onChange={(e) => {
      set('totalAmount', e.target.value)
      
    }}
  />
</div>

<div>
  <label className="mb-1 block text-[11px] uppercase text-slate-400">
    Received Amount
  </label>

  <input
    className={inp}
    type="number"
    placeholder="Received Amount (₹)"
    value={f.receivedAmount}
    onChange={(e) => set('receivedAmount', e.target.value)}
  />
</div>

<div>
  <label className="mb-1 block text-[11px] uppercase text-slate-400">
    Deductions
  </label>

  <input
    className={inp}
    type="number"
    step="0.01"
    placeholder="Deductions (₹)"
    value={f.deductions}
    onChange={(e) => set('deductions', e.target.value)}
  />
</div>

{/* Read-only, and placed after the three figures it is derived from. */}
<div>
  <label className="mb-1 block text-[11px] uppercase text-slate-400">
    Pending Amount
  </label>

  <input
    className={`${inp} bg-slate-100`}
    type="number"
    value={pendingAmount}
    readOnly
  />
</div>

<div>
  <label className="mb-1 block text-[11px] uppercase text-slate-400">
    Due Date
  </label>

  <input
    className={`${inp} bg-slate-100`}
    type="text"
    value={formattedDueDate}
    readOnly
  />
</div>
        <select className={inp} value={f.mode} onChange={(e) => set('mode', e.target.value)}>{MODES.map((m) => <option key={m}>{m}</option>)}</select>
        <select className={inp} value={f.src} onChange={(e) => set('src', e.target.value)}>{REVENUE_SOURCES.map((s) => <option key={s}>{s}</option>)}</select>
        <select className={inp} value={f.status} onChange={(e) => set('status', e.target.value)}><option>Received</option><option>Pending</option></select>
      </div>
      
      {err && <p className="mt-2 text-sm text-rose-600">{err}</p>}
      <p className="mt-2 text-sm font-medium text-orange-600">
  Payment Due on: {formattedDueDate}
</p>
      <div className="mt-3 flex gap-2">
        <button onClick={save} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white">Save</button>
        <button onClick={() => { setOpen(false); setErr(null) }} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600">Cancel</button>
      </div>
    </div>
  )
}

export function VerifyBadge({ id, verified, canVerify }: { id: string; verified: string; canVerify: boolean }) {
  const router = useRouter()
  const supabase = createClient()
  const [v, setV] = useState(verified || 'No')
  const cls: Record<string, string> = { Yes: 'bg-emerald-50 text-emerald-600', No: 'bg-amber-50 text-amber-600', Rejected: 'bg-rose-50 text-rose-600' }
  async function cycle() {
    if (!canVerify) return
    const next = v === 'No' ? 'Yes' : v === 'Yes' ? 'Rejected' : 'No'
    setV(next)

    const { error } = await supabase
      .from('revenue')
      .update({ verified: next })
      .eq('id', id)

    if (error) {
      console.error(error)
      return
    }

    router.refresh()
  }
  return (
    <button onClick={cycle} disabled={!canVerify} className={`rounded-full px-2.5 py-1 text-xs font-medium ${cls[v] ?? ''} ${canVerify ? 'cursor-pointer' : 'cursor-default'}`}>{v}</button>
  )
}

export function DeleteRevenueButton({
  id,
  canEdit,
}: {
  id: string
  canEdit: boolean
}) {
  const router = useRouter()
  const supabase = createClient()

  // A collection is the BD's own to remove, or an admin's. Everyone else
  // saw a button whose write the database refused without a word, so the
  // record looked deleted until the page reloaded it unchanged.
  if (!canEdit) return null

 async function handleDelete() {
  const confirmed = window.confirm(
    'Are you sure you want to delete this revenue record?'
  )

  if (!confirmed) return

  const { data, error } = await supabase
    .from('revenue')
    .update({
      deleted_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id')

  if (error) {
  console.error('Failed to delete revenue:', error)
  alert(error.message)
  return
}
  // An UPDATE that row-level security filters out matches no rows and
  // comes back without an error, so an empty result is the only signal
  // that the delete was refused rather than applied.
  if (!data?.length) {
    alert(BLOCKED)
    return
  }
  router.refresh()
}

  return (
    <button
      onClick={handleDelete}
      className="rounded bg-red-100 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-200"
    >
      Delete
    </button>
  )
}
export function RevenueStatusSelect({
  id,
  status,
  canEdit,
}: {
  id: string
  status: string
  canEdit: boolean
}) {
  const router = useRouter()
  const supabase = createClient()
  const [value, setValue] = useState(status)

  async function changeStatus(next: string) {
    const prev = value
    setValue(next)

    const { data, error } = await supabase
      .from("revenue")
      .update({ status: next })
      .eq("id", id)
      .select('id')

    if (error) {
      console.error(error)
      setValue(prev)
      alert(error.message)
      return
    }
    // Refused by row-level security: no rows matched, no error raised. Put
    // the dropdown back so it stops showing a status the row doesn't have.
    if (!data?.length) {
      setValue(prev)
      alert(BLOCKED)
      return
    }

    router.refresh()
  }

  // Status is an edit like any other, so it follows the same rule: only the
  // BD the collection belongs to, or an admin, may move it.
  if (!canEdit) {
    return (
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
          value === 'Received'
            ? 'bg-emerald-50 text-emerald-600'
            : 'bg-amber-50 text-amber-600'
        }`}
      >
        {value}
      </span>
    )
  }

  return (
    <select
      className={inp}
      value={value}
      onChange={(e) => changeStatus(e.target.value)}
    >
      <option value="Pending">Pending</option>
      <option value="Received">Received</option>
    </select>
  )
}
