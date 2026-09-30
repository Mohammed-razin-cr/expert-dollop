'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/api/client'
import { REVENUE_SOURCES, receivedOf, num, revenueFingerprint } from '@/lib/revenue'

const inp = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100'
const lbl = 'mb-1 block text-[11px] uppercase text-slate-400'
const MODES = ['UPI', 'Cash', 'NEFT', 'Cheque']

// An UPDATE the row-level security policy filters out matches nothing and
// comes back without an error, so "no rows changed" is the only signal that
// the write was refused rather than applied.
const BLOCKED = 'Nothing was saved — the database refused this change. This collection belongs to another BD.'

export type RevenueRow = {
  id: string
  payment_date: string | null
  due_date: string | null
  date: string | null
  name: string
  phone: string | null
  program: string | null
  amt: number | null
  total_amt: number | null
  received_amount: number | null
  pending_amount: number | null
  deductions: number | null
  mode: string | null
  src: string | null
  status: string | null
  bd: string | null
}

export function EditRevenueForm({ row }: { row: RevenueRow }) {
  const router = useRouter()
  const supabase = createClient()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const [f, setF] = useState({
    // `payment_date` went in later than `date`, so older rows only have the
    // latter — open on whichever the list is showing.
    paymentDate: row.payment_date ?? row.date ?? '',
    dueDate: row.due_date ?? '',
    name: row.name ?? '',
    phone: row.phone ?? '',
    program: row.program ?? '',
    // Opens on the derived figures, so the form shows what the list shows
    // rather than the raw nulls behind a legacy row.
    totalAmount: String(num(row.total_amt ?? row.amt)),
    receivedAmount: String(receivedOf(row)),
    deductions: String(num(row.deductions)),
    mode: row.mode ?? 'UPI',
    src: row.src ?? 'Direct',
    status: row.status ?? 'Received',
  })
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }))

  const totalAmount = Number(f.totalAmount) || 0
  const deductions = Number(f.deductions) || 0
  const receivedAmount = Number(f.receivedAmount) || 0
  // A deduction reduces what the student still owes, so it comes off the
  // balance alongside what they have actually paid — the same rule the list
  // and the Add Revenue form use.
  const pendingAmount = Math.max(totalAmount - receivedAmount - deductions, 0)

  async function save() {
    if (!f.name.trim()) return setErr('Name is required')
    if (!f.paymentDate) return setErr('Payment date is required')
    if (!f.totalAmount) return setErr('Total amount is required')
    setErr(null)
    setBusy(true)

    const { data, error } = await supabase
      .from('revenue')
      .update({
        // `date` is NOT NULL and the Add form writes it alongside
        // payment_date; keep the two in step so the list's
        // `payment_date ?? date` fallback cannot show a stale day.
        date: f.paymentDate,
        payment_date: f.paymentDate,
        due_date: f.dueDate || null,

        name: f.name.trim(),
        phone: f.phone.trim() || null,
        program: f.program.trim() || null,

        // `amt` mirrors what the Add form stores there — the received
        // figure — so the two entry points leave the column meaning the
        // same thing.
        amt: receivedAmount,
        total_amt: totalAmount,
        received_amount: receivedAmount,
        pending_amount: pendingAmount,
        deductions: deductions,
        base: totalAmount,

        mode: f.mode,
        src: f.src,
        status: f.status,

        // An edit that moves the date, name, total or mode has to restamp this,
        // or the guard goes on matching the row's original details.
        fingerprint: revenueFingerprint(f.paymentDate, f.name, totalAmount, f.mode),
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      // .select() so a write the database silently refused is caught: an
      // UPDATE that RLS filters out matches no rows and returns no error.
      .select('id')

    setBusy(false)

    if (error) {
      // The unique index on fingerprint covers live rows only, so this
      // fires when an edit makes the row a duplicate of another one.
      if (error.code === '23505') {
        setErr('Another live entry already has this date, name, amount and mode.')
        return
      }
      setErr(error.message)
      return
    }
    if (!data?.length) {
      setErr(BLOCKED)
      return
    }

    router.push('/revenue')
    router.refresh()
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className={lbl}>Payment Date</label>
          <input className={inp} type="date" value={f.paymentDate} onChange={(e) => set('paymentDate', e.target.value)} />
        </div>
        <div>
          <label className={lbl}>Due Date</label>
          <input className={inp} type="date" value={f.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
        </div>
        <div>
          <label className={lbl}>Name *</label>
          <input className={inp} value={f.name} onChange={(e) => set('name', e.target.value)} />
        </div>
        <div>
          <label className={lbl}>Phone</label>
          <input className={inp} value={f.phone} onChange={(e) => set('phone', e.target.value)} />
        </div>

        <div>
          <label className={lbl}>Program / course</label>
          <input className={inp} value={f.program} onChange={(e) => set('program', e.target.value)} />
        </div>
        <div>
          <label className={lbl}>Total Amount</label>
          <input className={inp} type="number" value={f.totalAmount} onChange={(e) => set('totalAmount', e.target.value)} />
        </div>
        <div>
          <label className={lbl}>Received Amount</label>
          <input className={inp} type="number" value={f.receivedAmount} onChange={(e) => set('receivedAmount', e.target.value)} />
        </div>
        <div>
          <label className={lbl}>Deductions</label>
          <input className={inp} type="number" step="0.01" value={f.deductions} onChange={(e) => set('deductions', e.target.value)} />
        </div>

        {/* Read-only, and placed after the three figures it is derived from. */}
        <div>
          <label className={lbl}>Pending Amount</label>
          <input className={`${inp} bg-slate-100`} type="number" value={pendingAmount} readOnly />
        </div>
        <div>
          <label className={lbl}>Mode</label>
          <select className={inp} value={f.mode} onChange={(e) => set('mode', e.target.value)}>
            {MODES.map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className={lbl}>Source</label>
          <select className={inp} value={f.src} onChange={(e) => set('src', e.target.value)}>
            {REVENUE_SOURCES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className={lbl}>Status</label>
          <select className={inp} value={f.status} onChange={(e) => set('status', e.target.value)}>
            <option value="Pending">Pending</option>
            <option value="Received">Received</option>
          </select>
        </div>
      </div>

      {err && <p className="mt-3 text-sm text-rose-600">{err}</p>}

      <div className="mt-5 flex gap-2">
        <button onClick={save} disabled={busy} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
          {busy ? 'Saving…' : 'Save Changes'}
        </button>
        <a href="/revenue" className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600">Cancel</a>
      </div>
    </div>
  )
}
