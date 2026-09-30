'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil } from 'lucide-react'
import { createClient } from '@/lib/api/client'
import { SearchSelect } from '@/components/shared/SearchSelect'
import type { Enum } from '@/lib/database.types'


type Student = { id: string; full_name: string }
type Project = { id: string; name: string; project_name: string | null; college: string | null; department: string | null; mobile: string | null; amount_paid: number | null; referral_deduction: number | null }
type InvoiceValues = {
  id?: string
  invoice_no?: string
  student_id?: string | null
  project_id?: string | null
  amount?: number | string
  status?: Enum<'invoice_status'>
  issued_date?: string | null
  due_date?: string | null
}

const STATUSES = ['pending', 'paid', 'overdue', 'cancelled']
const today = () => new Date().toISOString().slice(0, 10)
// Invoice numbers are not built from a pattern written here — they continue
// whatever series the table already holds, so the same build serves any
// database. The newest invoice says which series is in use (the text in
// front of its trailing digits), the highest number in that series says
// where the count is, and the next one is that + 1 at the same width.
//
// A -1/-2/-3 suffix marks a later instalment against an invoice — ET20250097
// for ₹5,000, then ET20250097-2 for ₹20,000. It is stripped before the
// number is read, so an instalment never uses up a number; auto-numbering
// never produces one either, since those are typed by hand.

/** 'ET20250097-2' -> prefix 'ET', digits '20250097'. Null if it ends in no digit. */
function splitNo(no: string) {
  const base = no.replace(/-[0-9]+$/, '')
  let i = base.length
  while (i > 0 && base[i - 1] >= '0' && base[i - 1] <= '9') i--
  const digits = base.slice(i)
  return digits ? { prefix: base.slice(0, i), digits } : null
}

type NextNo = { series: string; n: number; width: number }

/** Keeps the width it read, so a series written 0099 carries on 0100. */
const render = (x: NextNo) => x.series + String(x.n).padStart(x.width, '0')

// Null when there is nothing to continue from: the first invoice in an empty
// table has to be typed, not invented. Text ordering cannot find the highest
// number — 'ET20250099' sorts above 'ET202500104' — so it is compared as a
// number. Soft-deleted invoices still hold their number (invoice_no is unique
// across the whole table), so they count here too.
async function nextNo(supabase: ReturnType<typeof createClient>): Promise<NextNo | null> {
  const { data } = await supabase
    .from('invoices')
    .select('invoice_no, created_at')
    .order('created_at', { ascending: false })
    .limit(500)
  const parts = (data ?? []).flatMap((r) => {
    const p = splitNo(r.invoice_no ?? '')
    return p ? [p] : []
  })
  const series = parts[0]?.prefix
  if (series === undefined) return null
  let best: NextNo | null = null
  for (const p of parts) {
    if (p.prefix !== series) continue
    const n = Number(p.digits)
    if (!best || n > best.n) best = { series, n, width: p.digits.length }
  }
  return best ? { ...best, n: best.n + 1 } : null
}

const inp = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100'

// ---------------------------------------------------------------------
// Shared form used for BOTH create and edit.
// ---------------------------------------------------------------------
function InvoiceFields({
  students, projects, initial, mode, onDone, onCancel,
}: {
  students: Student[]
  projects: Project[]
  initial: InvoiceValues
  mode: 'create' | 'edit'
  onDone: () => void
  onCancel: () => void
}) {
  const router = useRouter()
  const supabase = createClient()
  const studentOptions = useMemo(() => students.map((s) => ({ value: s.id, label: s.full_name })), [students])
  const projectOptions = useMemo(() => projects.map((p) => ({ value: p.id, label: p.project_name || p.name })), [projects])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  // Which entity this invoice bills. A saved invoice already carries one or
  // the other in project_id, so edit picks it up from there instead of
  // always defaulting back to Student.
  const [target, setTarget] = useState<'student' | 'project'>(initial.project_id ? 'project' : 'student')
  const [f, setF] = useState({
      invoice_no: initial.invoice_no ?? '',
      student_id: initial.student_id ?? '',
      project_id: initial.project_id ?? '',
      amount: initial.amount != null ? String(initial.amount) : '',
      status: initial.status ?? 'pending',
      issued_date: initial.issued_date ?? today(),
      due_date: initial.due_date ?? '',mobile: '',email: '',course: '',place_city: '',current_location: '',branch: '',degree: '',cgpa: '',year_of_passing: '',graduation_status: '',dob: '',
      college: '',department: '',contact_name: '',referral_deduction: '',
  })
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }))

  // The number this invoice takes if the field is left blank, shown as the
  // placeholder so whoever types their own can see what comes next.
  const [autoNo, setAutoNo] = useState('')
  useEffect(() => {
    if (mode !== 'create') return
    let alive = true
    nextNo(supabase).then((x) => { if (alive) setAutoNo(x ? render(x) : '') })
    return () => { alive = false }
  }, [mode])
useEffect(() => {
  async function loadStudent() {
    if (!f.student_id) return

    const { data, error } = await supabase
      .from('students')
      .select(`
        mobile,
        email,
        primary_course,
        place_city,
        current_location,
        branch,
        degree,
        cgpa,
        year_of_passing,
        graduation_status,
        dob
      `)
      .eq('id', f.student_id)
      .single()

    if (error || !data) return

    setF((prev) => ({
      ...prev,
      mobile: data.mobile ?? '',
      email: data.email ?? '',
      course: data.primary_course ?? '',
      place_city: data.place_city ?? '',
      current_location: data.current_location ?? '',
      branch: data.branch ?? '',
      degree: data.degree ?? '',
      cgpa: data.cgpa?.toString() ?? '',
      year_of_passing: data.year_of_passing?.toString() ?? '',
      graduation_status: data.graduation_status ?? '',
      dob: data.dob ?? '',
    }))
  }

  loadStudent()
}, [f.student_id])
// Project fields come from the list already handed to the form (no extra
// round trip needed the way the student lookup makes one) — amount is
// pre-filled from what has actually been paid on the project so far,
// since that is what gets billed, and stays editable after.
useEffect(() => {
  if (target !== 'project' || !f.project_id) return
  const p = projects.find((x) => x.id === f.project_id)
  if (!p) return
  setF((prev) => ({
    ...prev,
    amount: p.amount_paid != null ? String(p.amount_paid) : prev.amount,
    mobile: p.mobile ?? '',
    college: p.college ?? '',
    department: p.department ?? '',
    contact_name: p.name ?? '',
    referral_deduction: p.referral_deduction != null ? String(p.referral_deduction) : '',
  }))
}, [f.project_id, target])
  async function save() {
    if (!f.amount) return setErr('Amount is required')
    setSaving(true); setErr(null)

    const typedNo = f.invoice_no.trim()
    const baseRow = {
      student_id: target === 'student' ? (f.student_id || null) : null,
      project_id: target === 'project' ? (f.project_id || null) : null,
      amount: Number(f.amount),
      status: f.status,
      issued_date: f.issued_date || today(),
      due_date: f.due_date || null,
    }

    if (mode === 'edit') {
      // invoice_no is editable; if blank keep existing number
      const invoice_no = typedNo || initial.invoice_no || ''
      if (!invoice_no) { setSaving(false); return setErr('Invoice number is required') }
      const { error } = await supabase.from('invoices')
        .update({ invoice_no, ...baseRow })
        .eq('id', initial.id!)
      setSaving(false)
      if (error) {
        const dup = error.code === '23505' || /duplicate|invoice_no/i.test(error.message)
        return setErr(dup ? `Invoice number "${invoice_no}" already exists — use a different one.` : error.message)
      }
      onDone(); router.refresh()
      return
    }

    // create — optional invoice_no with auto-fallback + retry on collision
    // created_by makes the invoice the issuer's own: the BD RLS policies
    // only let a BD change invoices carrying their id, and the insert
    // policy refuses a row that doesn't. Admins are unrestricted either way.
    const { data: { user } } = await supabase.auth.getUser()
    const next = typedNo ? null : await nextNo(supabase)
    if (!typedNo && !next) {
      setSaving(false)
      return setErr('No earlier invoice to continue from — type the first number.')
    }
    let attempt = 0
    while (true) {
      const invoice_no = typedNo || render(next!)
      const { error } = await supabase.from('invoices').insert({ invoice_no, created_by: user?.id ?? null, ...baseRow })
      if (!error) break
      const dup = error.code === '23505' || /duplicate|invoice_no/i.test(error.message)
      // someone else claimed the serial between the lookup and the insert
      if (dup && !typedNo && attempt < 5) { attempt++; next!.n++; continue }
      setSaving(false)
      if (dup && typedNo) return setErr(`Invoice number "${typedNo}" already exists — use a different one.`)
      return setErr(error.message)
    }
    setSaving(false)
    onDone(); router.refresh()
  }

  return (
    <div className="w-full rounded-xl border border-slate-200 bg-white p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="mb-1 block text-[11px] uppercase text-slate-400">Invoice No {mode === 'create' && '(optional)'}</label>
          <input className={inp} placeholder={mode === 'create' ? (autoNo ? `${autoNo} — auto-filled if left blank` : 'Auto-generated if left blank') : ''} value={f.invoice_no} onChange={(e) => set('invoice_no', e.target.value)} />
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <label className="mb-1 block text-[11px] uppercase text-slate-400">Bill To</label>
          <div className="flex gap-1.5">
            {(['student', 'project'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTarget(t)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium capitalize ${
                  target === t ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        {target === 'student' ? (
          <div>
            <label className="mb-1 block text-[11px] uppercase text-slate-400">Student</label>
            <SearchSelect className={inp} options={studentOptions} value={f.student_id ?? ''} onChange={(v) => set('student_id', v)} placeholder="Student (optional)…" emptyLabel="No student" />
          </div>
        ) : (
          <div>
            <label className="mb-1 block text-[11px] uppercase text-slate-400">Project</label>
            <SearchSelect className={inp} options={projectOptions} value={f.project_id ?? ''} onChange={(v) => set('project_id', v)} placeholder="Project…" emptyLabel="No project" />
          </div>
        )}
        <div>
          <label className="mb-1 block text-[11px] uppercase text-slate-400">Amount (₹) *</label>
          <input className={inp} type="number" placeholder="Amount (₹) *" value={f.amount} onChange={(e) => set('amount', e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-[11px] uppercase text-slate-400">Status</label>
          <select className={inp} value={f.status} onChange={(e) => set('status', e.target.value)}>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div><label className="mb-1 block text-[11px] uppercase text-slate-400">Issued</label><input className={inp} type="date" value={f.issued_date ?? ''} onChange={(e) => set('issued_date', e.target.value)} /></div>
        <div><label className="mb-1 block text-[11px] uppercase text-slate-400">Due</label><input className={inp} type="date" value={f.due_date ?? ''} onChange={(e) => set('due_date', e.target.value)} /></div>
         {/* Details (UI only) — which block shows follows Bill To above */}

        {target === 'student' ? (
          <>
            <div><label className="mb-1 block text-[11px] uppercase text-slate-400">  Mobile</label><input className={inp} value={f.mobile} readOnly placeholder="Will auto-fill" /></div>
            <div><label className="mb-1 block text-[11px] uppercase text-slate-400">Email</label><input className={inp} value={f.email} readOnly placeholder="Will auto-fill" /></div>
            <div><label className="mb-1 block text-[11px] uppercase text-slate-400">Course</label><input className={inp} value={f.course} readOnly placeholder="Will auto-fill" /></div>
            <div> <label className="mb-1 block text-[11px] uppercase text-slate-400">Place / City</label><input className={inp} value={f.place_city} readOnly placeholder="Will auto-fill" /></div>
            <div><label className="mb-1 block text-[11px] uppercase text-slate-400">Current Location</label><input className={inp} value={f.current_location} readOnly placeholder="Will auto-fill" /></div>
            <div><label className="mb-1 block text-[11px] uppercase text-slate-400">Branch</label><input className={inp} value={f.branch} readOnly placeholder="Will auto-fill" /></div>
            <div><label className="mb-1 block text-[11px] uppercase text-slate-400">Degree</label><input className={inp} value={f.degree} readOnly placeholder="Will auto-fill" /></div>
            <div><label className="mb-1 block text-[11px] uppercase text-slate-400">CGPA</label><input className={inp} value={f.cgpa} readOnly placeholder="Will auto-fill" /></div>
            <div><label className="mb-1 block text-[11px] uppercase text-slate-400">Year of Passing</label><input className={inp} value={f.year_of_passing} readOnly placeholder="Will auto-fill" /></div>
            <div><label className="mb-1 block text-[11px] uppercase text-slate-400">Graduation Status</label><input className={inp} value={f.graduation_status} readOnly placeholder="Will auto-fill" /></div>
            <div><label className="mb-1 block text-[11px] uppercase text-slate-400">DOB</label><input className={inp} value={f.dob} readOnly placeholder="Will auto-fill" /></div>
          </>
        ) : (
          <>
            <div><label className="mb-1 block text-[11px] uppercase text-slate-400">Name</label><input className={inp} value={f.contact_name} readOnly placeholder="Will auto-fill" /></div>
            <div><label className="mb-1 block text-[11px] uppercase text-slate-400">Mobile</label><input className={inp} value={f.mobile} readOnly placeholder="Will auto-fill" /></div>
            <div><label className="mb-1 block text-[11px] uppercase text-slate-400">College</label><input className={inp} value={f.college} readOnly placeholder="Will auto-fill" /></div>
            <div><label className="mb-1 block text-[11px] uppercase text-slate-400">Department</label><input className={inp} value={f.department} readOnly placeholder="Will auto-fill" /></div>
            <div><label className="mb-1 block text-[11px] uppercase text-slate-400">Referral Deduction (₹)</label><input className={inp} value={f.referral_deduction} readOnly placeholder="Will auto-fill" /></div>
          </>
        )}
      </div>
      {err && <p className="mt-2 text-sm text-rose-600">{err}</p>}
      <div className="mt-3 flex gap-2">
        <button onClick={save} disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">{saving ? 'Saving…' : mode === 'edit' ? 'Save Changes' : 'Save Invoice'}</button>
        <button onClick={onCancel} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600">Cancel</button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------
// Create (header button that expands the form)
// ---------------------------------------------------------------------
export function CreateInvoiceForm({ students, projects, initialProjectId }: { students: Student[]; projects: Project[]; initialProjectId?: string }) {
  // A "Generate Invoice" link from a project's row opens straight into this
  // form with that project already picked, instead of landing on a blank
  // list the BD has to search again.
  const [open, setOpen] = useState(!!initialProjectId)
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
        <Plus className="h-4 w-4" /> Create Invoice
      </button>
    )
  }
  return <InvoiceFields students={students} projects={projects} initial={initialProjectId ? { project_id: initialProjectId } : {}} mode="create" onDone={() => setOpen(false)} onCancel={() => setOpen(false)} />
}

// ---------------------------------------------------------------------
// Edit (per-row button that expands the form pre-filled)
// ---------------------------------------------------------------------
export function EditInvoiceButton({ students, projects, invoice }: { students: Student[]; projects: Project[]; invoice: InvoiceValues }) {
  const [open, setOpen] = useState(false)
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} title="Edit invoice" className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100">
        <Pencil className="h-3.5 w-3.5" /> Edit
      </button>
    )
  }
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4">
      <div className="mt-16 w-full max-w-2xl">
        <div className="mb-2 text-sm font-medium text-white">Edit invoice {invoice.invoice_no}</div>
        <InvoiceFields students={students} projects={projects} initial={invoice} mode="edit" onDone={() => setOpen(false)} onCancel={() => setOpen(false)} />
      </div>
    </div>
  )
}

// `canEdit` mirrors what the database would allow: another BD's invoice is
// readable but not theirs to move, so the select renders read-only rather
// than offering a change RLS would refuse. Defaults to true for callers
// that gate it elsewhere.
export function InvoiceStatusSelect({ id, status, canEdit = true }: { id: string; status: Enum<'invoice_status'>; canEdit?: boolean }) {
  const router = useRouter()
  const supabase = createClient()
  const [v, setV] = useState(status)
  const [busy, setBusy] = useState(false)
  async function change(next: Enum<'invoice_status'>) {
    setV(next); setBusy(true)
    await supabase.from('invoices').update({ status: next }).eq('id', id)
    setBusy(false); router.refresh()
  }
  const cls: Record<string, string> = {
    paid: 'text-emerald-600', pending: 'text-amber-600', overdue: 'text-rose-600', cancelled: 'text-slate-400',
  }
  if (!canEdit) {
    return (
      <span className={`inline-block rounded-md border border-slate-100 bg-slate-50 px-2 py-1 text-xs font-medium ${cls[v] ?? 'text-slate-500'}`}>
        {v}
      </span>
    )
  }
  return (
    <select value={v} disabled={busy} onChange={(e) => change(e.target.value as Enum<'invoice_status'>)}
      className={`rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium outline-none focus:border-blue-300 ${cls[v] ?? ''}`}>
      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
    </select>
  )
}
