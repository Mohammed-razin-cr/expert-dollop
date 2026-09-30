'use client'

import { useState, useMemo } from 'react'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import { useRouter } from 'next/navigation'
import { Plus, IndianRupee, Undo2, ClipboardCheck, Send, CalendarClock, Trash2, X } from 'lucide-react'
import { createClient } from '@/lib/api/client'
import type { Role } from '@/lib/rbac'
import { revenueFingerprint } from '@/lib/revenue'

export type AptRow = {
  id: string; apt_key: string | null; lead_ref: string | null; name: string; phone: string | null; email: string | null
  college: string | null; cgpa: string | null; goal: string | null; bd: string | null; round: string; status: string
  result: string | null; score: string | null; venue: string | null; mode: string | null; apt_date: string | null
  next_action: string | null; remarks: string | null; invite_sent: boolean; payment_done: boolean
  payment_verified_ai: boolean; payment_amt: number; payment_mode: string | null; payment_txn: string | null; payment_date: string | null
}

// The outcomes are only ever recorded through the Result dialog, which writes
// the result and the matching status together. Offering them in the row picker
// let someone mark a row Selected with no result behind it, so the picker now
// carries the workflow statuses alone.
const STATUS_OPTIONS = ['Scheduled', 'Form Sent', 'Form Filled', 'Payment Done']
const OUTCOME_STATUSES = ['Selected', 'Not Selected', 'Re-Test']
const STATUSES = [...STATUS_OPTIONS, ...OUTCOME_STATUSES]
const STATUS_RANK: Record<string, number> = { Scheduled: 1, 'Form Sent': 2, 'Form Filled': 3, 'Payment Done': 4, Selected: 5, 'Not Selected': 5, 'Re-Test': 5 }
const RESULTS = ['Selected', 'Not Selected', 'Re-Test', 'Not Attended']
const MODES = ['UPI', 'Cash', 'NEFT', 'Cheque', 'Online']
const ROUNDS = ['Round 1', 'Round 2', 'Round 3']
const inr = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN')
const inp = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100'

// Only a recorded payment counts as paid — matching the status text alone
// let someone tag a row "Payment Done" with no amount and no revenue row
// ever created (see the status <select> below, which now routes through
// the real payment flow instead of writing this text directly).
const isPaid = (r: AptRow) => r.payment_done || r.payment_verified_ai
const isFilled = (r: AptRow) => (r.status || '').includes('Form Filled') && !isPaid(r)
const isSent = (r: AptRow) => r.status === 'Form Sent' || r.invite_sent
const isPending = (r: AptRow) => !r.result && !isPaid(r) && !isFilled(r) && !isSent(r)

const TABS: { key: string; label: string; fn: (r: AptRow) => boolean }[] = [
  { key: 'all', label: 'All Rounds', fn: () => true },
  { key: 'pending', label: 'Pending', fn: isPending },
  { key: 'sent', label: 'Form Sent', fn: isSent },
  { key: 'filled', label: 'Form Filled', fn: isFilled },
  { key: 'paid', label: 'Payment Done', fn: isPaid },
  { key: 'selected', label: 'Selected', fn: (r) => r.result === 'Selected' },
  { key: 'not_selected', label: 'Not Selected', fn: (r) => r.result === 'Not Selected' },
  { key: 'not_attended', label: 'Not Attended', fn: (r) => r.result === 'Not Attended' },
  { key: 'retest', label: 'Re-Test', fn: (r) => r.result === 'Re-Test' },
]

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between"><h3 className="text-base font-semibold text-slate-900">{title}</h3><button onClick={onClose}><X className="h-4 w-4 text-slate-400" /></button></div>
        {children}
      </div>
    </div>
  )
}

export function AptitudeManager({ rows, role, bdName }: { rows: AptRow[]; role: Role; bdName: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [tab, setTab] = useState('all')
  // `qInput` is what is typed and `q` is what the table is filtered by, a beat
  // behind it. The box stays instant; the filter runs once you pause.
  const [qInput, setQInput] = useState('')
  const q = useDebouncedValue(qInput)
  const [from, setFrom] = useState(''); const [to, setTo] = useState('')
  const [pay, setPay] = useState<AptRow | null>(null)
  const [res, setRes] = useState<AptRow | null>(null)
  const [dateEdit, setDateEdit] = useState<AptRow | null>(null)
  const [add, setAdd] = useState(false)
  const [busy, setBusy] = useState(false)
  const [inviteLink, setInviteLink] = useState<string | null>(null)

  const k = useMemo(() => ({
    total: rows.length,
    sent: rows.filter(isSent).length,
    filled: rows.filter(isFilled).length,
    paid: rows.filter(isPaid).length,
    pass: rows.filter((r) => r.result === 'Selected').length,
    fail: rows.filter((r) => r.result === 'Not Selected').length,
    pend: rows.filter(isPending).length,
    retest: rows.filter((r) => r.result === 'Re-Test').length,
  }), [rows])

  const filtered = useMemo(() => {
    const tf = TABS.find((t) => t.key === tab)!.fn
    return rows.filter((r) => {
      if (!tf(r)) return false
      if (q) { const s = q.toLowerCase(); if (!(`${r.name} ${r.phone ?? ''} ${r.college ?? ''}`.toLowerCase().includes(s))) return false }
      const d = tab === 'paid' ? (r.payment_date ?? r.apt_date) : r.apt_date
      if (from && (!d || d < from)) return false
      if (to && (!d || d > to)) return false
      return true
    })
  }, [rows, tab, q, from, to])

  const upd = async (id: string, fields: any) => { await supabase.from('aptitude').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', id); router.refresh() }

  async function confirmPay(r: AptRow, amt: number, mode: string, txn: string) {
    setBusy(true)
    const today = new Date().toISOString().slice(0, 10)
    await supabase.from('aptitude').update({
      payment_done: true, payment_amt: amt, payment_mode: mode, payment_txn: txn || null, payment_date: today,
      status: 'Payment Done', updated_at: new Date().toISOString(),
    }).eq('id', r.id)
    // auto-create revenue row (src=Aptitude). The fee is paid in full here,
    // so received_amount = amt and pending_amount = 0 — otherwise the Revenue
    // page (which sums received_amount) shows the row as ₹0 despite "Received".
    await supabase.from('revenue').upsert({
      rev_key: `rev_apt_${r.apt_key ?? r.id}`, date: today, payment_date: today, name: r.name, phone: r.phone, email: r.email, college: r.college,
      program: `Aptitude Test Fee — ${r.round}`, src: 'Aptitude', amt, total_amt: amt, received_amount: amt, pending_amount: 0, base: amt, gst: 0,
      mode, txn: txn || null, bd: r.bd, status: 'Received', verified: 'No', apt_key: r.apt_key,
      fingerprint: revenueFingerprint(today, r.name, amt, mode),
    }, { onConflict: 'rev_key' })
    setBusy(false); setPay(null); router.refresh()
  }

  async function undoPay(r: AptRow) {
    if (!confirm(`Remove payment for ${r.name}? This also removes the linked revenue entry.`)) return
    await supabase.from('aptitude').update({ payment_done: false, payment_verified_ai: false, payment_amt: 0, payment_mode: null, status: 'Form Filled' }).eq('id', r.id)
    // Without a key there is no linked revenue row to remove, and eq(null)
    // would match nothing anyway.
    if (r.apt_key) await supabase.from('revenue').delete().eq('apt_key', r.apt_key)
    router.refresh()
  }

  async function invite(r: AptRow) {
    const status = (STATUS_RANK[r.status] ?? 0) < 2 ? 'Form Sent' : r.status
    await upd(r.id, { invite_sent: true, status })
    const params = new URLSearchParams({
      name: r.name ?? '', phone: r.phone ?? '', bd: r.bd ?? '', mode: r.mode ?? '',
      round: r.round ?? '', date: r.apt_date ?? '', time: '', venue: r.venue ?? '', key: r.apt_key ?? '',
    })
    const link = `${window.location.origin}/aptitude-form?${params.toString()}`
    try { await navigator.clipboard.writeText(link) } catch { /* clipboard may be blocked */ }
    setInviteLink(link)
  }

  async function del(r: AptRow) {
    if (!confirm(`Delete ${r.name}'s aptitude record?`)) return
    await supabase.from('aptitude').update({ deleted_at: new Date().toISOString() }).eq('id', r.id); router.refresh()
  }

  const kpis = [
    { label: 'Total', value: k.total }, { label: 'Form Sent', value: k.sent }, { label: 'Form Filled', value: k.filled },
    { label: 'Payment Done', value: k.paid }, { label: 'Selected', value: k.pass }, { label: 'Not Selected', value: k.fail },
    { label: 'Pending', value: k.pend }, { label: 'Re-Test', value: k.retest },
  ]

  return (
    <div className="space-y-5">
      {inviteLink && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm">
          <span className="font-medium text-blue-700">Test link generated & copied:</span>
          <input readOnly value={inviteLink} onFocus={(e) => e.target.select()} className="min-w-[200px] flex-1 rounded-lg border border-blue-200 bg-white px-2 py-1 text-xs text-slate-600" />
          <button onClick={() => { navigator.clipboard?.writeText(inviteLink); }} className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white">Copy</button>
          <a href={inviteLink} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-blue-200 px-3 py-1 text-xs font-medium text-blue-700">Open</a>
          <button onClick={() => setInviteLink(null)} className="text-blue-400 hover:text-blue-600">✕</button>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-xl font-semibold text-slate-900">Aptitude Management</h1><p className="text-sm text-slate-500">{filtered.length} of {rows.length} records</p></div>
        <button onClick={() => setAdd(true)} className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"><Plus className="h-4 w-4" /> Schedule Test</button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {kpis.map((s) => (<div key={s.label} className="rounded-xl border border-slate-200 bg-white p-3"><div className="text-[11px] text-slate-500">{s.label}</div><div className="mt-0.5 text-lg font-semibold text-slate-900">{s.value}</div></div>))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-white p-1 text-xs">
          {TABS.map((t) => (<button key={t.key} onClick={() => setTab(t.key)} className={`rounded-md px-2.5 py-1.5 font-medium ${tab === t.key ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>{t.label}</button>))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <input value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Search name / phone / college…" className="rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-blue-300" />
        <span className="text-xs text-slate-400">{tab === 'paid' ? 'Payment date' : 'Test date'}:</span>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs" />
        {/* Keyed off what is typed, not the debounced term, so Clear appears
            with the first character rather than a beat later. */}
        {(from || to || qInput) && <button onClick={() => { setFrom(''); setTo(''); setQInput('') }} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600">Clear</button>}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500"><tr>
            <th className="px-3 py-3 font-medium">Student</th><th className="px-3 py-3 font-medium">CGPA</th><th className="px-3 py-3 font-medium">Mode</th>
            <th className="px-3 py-3 font-medium">Round</th><th className="px-3 py-3 font-medium">Date</th><th className="px-3 py-3 font-medium">Status</th>
            <th className="px-3 py-3 font-medium">Result</th><th className="px-3 py-3 font-medium">Actions</th>
          </tr></thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 align-top">
                <td className="px-3 py-2.5"><div className="font-medium text-slate-800">{r.name}</div><div className="text-xs text-slate-400">{r.phone ?? ''}{r.college ? ` · ${r.college}` : ''}</div></td>
                <td className="px-3 py-2.5 text-slate-500">{r.cgpa || '—'}</td>
                <td className="px-3 py-2.5"><span className={`rounded-full px-2 py-0.5 text-xs ${r.mode === 'Offline' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>{r.mode || 'Online'}</span></td>
                <td className="px-3 py-2.5 text-slate-500">{r.round}</td>
                <td className="px-3 py-2.5 text-slate-500">{r.apt_date ?? '—'}</td>
                <td className="px-3 py-2.5">
                  <select value={STATUSES.includes(r.status) ? r.status : 'Scheduled'} onChange={(e) => {
                    const next = e.target.value
                    // "Payment Done" must go through the real payment flow —
                    // it's the only path that records an amount and creates
                    // the matching revenue row. Picking it here just opens
                    // that same dialog instead of writing bare status text.
                    if (next === 'Payment Done' && !isPaid(r)) { setPay(r); return }
                    upd(r.id, { status: next })
                  }} className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs">{/* A row already at an outcome keeps showing it, rather than reading back as Scheduled. */}{(OUTCOME_STATUSES.includes(r.status) ? [...STATUS_OPTIONS, r.status] : STATUS_OPTIONS).map((s) => <option key={s}>{s}</option>)}</select>
                  <div className="mt-1 flex gap-1">{isPaid(r) && <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-600">💰 Paid</span>}{r.payment_verified_ai && <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] text-violet-600">🤖 AI</span>}</div>
                </td>
                <td className="px-3 py-2.5">{r.result ? <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.result === 'Selected' ? 'bg-emerald-50 text-emerald-600' : r.result === 'Not Selected' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}>{r.result}</span> : '—'}</td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {!isPaid(r)
                      ? <button onClick={() => setPay(r)} title="Pay" className="rounded-md bg-emerald-50 p-1.5 text-emerald-600 hover:bg-emerald-100"><IndianRupee className="h-3.5 w-3.5" /></button>
                      : <button onClick={() => undoPay(r)} title="Undo Pay" className="rounded-md bg-slate-100 p-1.5 text-slate-500 hover:bg-slate-200"><Undo2 className="h-3.5 w-3.5" /></button>}
                    <button onClick={() => setRes(r)} title="Result" className="rounded-md bg-blue-50 p-1.5 text-blue-600 hover:bg-blue-100"><ClipboardCheck className="h-3.5 w-3.5" /></button>
                    {!r.invite_sent && <button onClick={() => invite(r)} title="Send Invite" className="rounded-md bg-blue-50 p-1.5 text-blue-600 hover:bg-blue-100"><Send className="h-3.5 w-3.5" /></button>}
                    <button onClick={() => setDateEdit(r)} title="Edit Date" className="rounded-md bg-amber-50 p-1.5 text-amber-600 hover:bg-amber-100"><CalendarClock className="h-3.5 w-3.5" /></button>
                    <button onClick={() => del(r)} title="Delete" className="rounded-md bg-rose-50 p-1.5 text-rose-500 hover:bg-rose-100"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-400">No records in this view.</td></tr>}
          </tbody>
        </table>
      </div>

      {pay && <PayModal r={pay} busy={busy} onClose={() => setPay(null)} onSave={confirmPay} />}
      {res && <ResultModal r={res} onClose={() => setRes(null)} onSave={async (f) => { await upd(res.id, f); setRes(null) }} />}
      {dateEdit && <DateModal r={dateEdit} onClose={() => setDateEdit(null)} onSave={async (d) => { await upd(dateEdit.id, { apt_date: d }); setDateEdit(null) }} />}
      {add && <AddModal bdName={bdName} onClose={() => setAdd(false)} onSaved={() => { setAdd(false); router.refresh() }} />}
    </div>
  )
}

function PayModal({ r, busy, onClose, onSave }: { r: AptRow; busy: boolean; onClose: () => void; onSave: (r: AptRow, amt: number, mode: string, txn: string) => void }) {
  const [amt, setAmt] = useState('99'); const [mode, setMode] = useState('UPI'); const [txn, setTxn] = useState('')
  return (
    <Modal title={`Record Payment — ${r.name}`} onClose={onClose}>
      <div className="space-y-3">
        <div><label className="mb-1 block text-xs text-slate-500">Amount (₹)</label><input className={inp} type="number" value={amt} onChange={(e) => setAmt(e.target.value)} /></div>
        <div><label className="mb-1 block text-xs text-slate-500">Mode</label><select className={inp} value={mode} onChange={(e) => setMode(e.target.value)}>{MODES.map((m) => <option key={m}>{m}</option>)}</select></div>
        <div><label className="mb-1 block text-xs text-slate-500">TXN Reference</label><input className={inp} value={txn} onChange={(e) => setTxn(e.target.value)} /></div>
        <p className="text-xs text-slate-400">Saving also creates a Revenue entry (src = Aptitude, ₹{amt} Received).</p>
        <button disabled={busy} onClick={() => onSave(r, Number(amt || 0), mode, txn)} className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60">{busy ? 'Saving…' : 'Confirm Payment'}</button>
      </div>
    </Modal>
  )
}

function ResultModal({ r, onClose, onSave }: { r: AptRow; onClose: () => void; onSave: (f: any) => void }) {
  const [result, setResult] = useState(r.result || 'Selected'); const [score, setScore] = useState(r.score || ''); const [remarks, setRemarks] = useState(r.remarks || ''); const [next, setNext] = useState(r.next_action || '')
  return (
    <Modal title={`Result — ${r.name}`} onClose={onClose}>
      <div className="space-y-3">
        <div><label className="mb-1 block text-xs text-slate-500">Result</label><select className={inp} value={result} onChange={(e) => setResult(e.target.value)}>{RESULTS.map((x) => <option key={x}>{x}</option>)}</select></div>
        <div><label className="mb-1 block text-xs text-slate-500">Score (/100)</label><input className={inp} type="number" value={score} onChange={(e) => setScore(e.target.value)} /></div>
        <div><label className="mb-1 block text-xs text-slate-500">Remarks</label><input className={inp} value={remarks} onChange={(e) => setRemarks(e.target.value)} /></div>
        <div><label className="mb-1 block text-xs text-slate-500">Next Action</label><input className={inp} value={next} onChange={(e) => setNext(e.target.value)} /></div>
        <button onClick={() => onSave({ result, score: score || null, remarks: remarks || null, next_action: next || null, status: result === 'Selected' ? 'Selected' : result === 'Not Selected' ? 'Not Selected' : r.status })} className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white">Save Result</button>
      </div>
    </Modal>
  )
}

function DateModal({ r, onClose, onSave }: { r: AptRow; onClose: () => void; onSave: (d: string) => void }) {
  const [d, setD] = useState(r.apt_date || new Date().toISOString().slice(0, 10))
  return (
    <Modal title={`Edit Test Date — ${r.name}`} onClose={onClose}>
      <div className="space-y-3"><input className={inp} type="date" value={d} onChange={(e) => setD(e.target.value)} /><button onClick={() => onSave(d)} className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white">Save Date</button></div>
    </Modal>
  )
}

function AddModal({ bdName, onClose, onSaved }: { bdName: string; onClose: () => void; onSaved: () => void }) {
  const supabase = createClient()
  const [f, setF] = useState({ name: '', phone: '', email: '', college: '', cgpa: '', goal: '', mode: 'Online', round: 'Round 1', date: new Date().toISOString().slice(0, 10), venue: '' })
  const [err, setErr] = useState<string | null>(null)
  const set = (key: string, v: string) => setF((p) => ({ ...p, [key]: v }))
  async function save() {
    if (!f.name) return setErr('Name required')
    const { error } = await supabase.from('aptitude').insert({
      apt_key: `apt_${Date.now()}_m`, name: f.name, phone: f.phone || null, email: f.email || null, college: f.college || null,
      cgpa: f.cgpa || null, goal: f.goal || null, mode: f.mode, round: f.round, apt_date: f.date, venue: f.venue || null,
      bd: bdName, source: 'Manual', status: 'Scheduled',
    })
    if (error) return setErr(error.message)
    onSaved()
  }
  return (
    <Modal title="Schedule Aptitude Test" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <input className={inp} placeholder="Name *" value={f.name} onChange={(e) => set('name', e.target.value)} />
        <input className={inp} placeholder="Phone" value={f.phone} onChange={(e) => set('phone', e.target.value)} />
        <input className={inp} placeholder="Email" value={f.email} onChange={(e) => set('email', e.target.value)} />
        <input className={inp} placeholder="College" value={f.college} onChange={(e) => set('college', e.target.value)} />
        <input className={inp} placeholder="CGPA" value={f.cgpa} onChange={(e) => set('cgpa', e.target.value)} />
        <input className={inp} placeholder="Goal" value={f.goal} onChange={(e) => set('goal', e.target.value)} />
        <select className={inp} value={f.mode} onChange={(e) => set('mode', e.target.value)}><option>Online</option><option>Offline</option></select>
        <select className={inp} value={f.round} onChange={(e) => set('round', e.target.value)}>{ROUNDS.map((x) => <option key={x}>{x}</option>)}</select>
        <input className={inp} type="date" value={f.date} onChange={(e) => set('date', e.target.value)} />
        <input className={inp} placeholder="Venue (offline)" value={f.venue} onChange={(e) => set('venue', e.target.value)} />
      </div>
      {err && <p className="mt-2 text-sm text-rose-600">{err}</p>}
      <button onClick={save} className="mt-3 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white">Create</button>
    </Modal>
  )
}
