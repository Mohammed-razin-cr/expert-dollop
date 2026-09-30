'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'
import { createClient } from '@/lib/api/client'

const inp = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300'
type Opt = { id: string; name: string }
const TRACKS = ['', 'Internship', 'Training', 'Placement', 'Certification']
const STATUS = ['active', 'completed', 'on_hold', 'dropped']

export function AddStudentForm({ courses, trainers }: { courses: Opt[]; trainers: string[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [f, setF] = useState({ full_name: '', mobile: '', email: '', primary_course: '', track: '', program: '', batch_name: '', trainer_name: '', status: 'active' })
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }))

  async function save() {
    if (!f.full_name) return setErr('Name required')
    setBusy(true)
    const { error } = await supabase.from('students').insert({
      full_name: f.full_name, mobile: f.mobile || null, email: f.email || null,
      primary_course: f.primary_course || null, track: f.track || null, program: f.program || null,
      batch_name: f.batch_name || null, trainer_name: f.trainer_name || null, status: f.status,
    })
    setBusy(false)
    if (error) return setErr(error.message)
    setF({ full_name: '', mobile: '', email: '', primary_course: '', track: '', program: '', batch_name: '', trainer_name: '', status: 'active' })
    setOpen(false); router.refresh()
  }

  if (!open) return <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"><Plus className="h-4 w-4" /> Add Student</button>
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onClick={() => setOpen(false)}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold text-slate-900">Add Student</h2><button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input className={inp} placeholder="Full name *" value={f.full_name} onChange={(e) => set('full_name', e.target.value)} />
          <input className={inp} placeholder="Mobile" value={f.mobile} onChange={(e) => set('mobile', e.target.value)} />
          <input className={inp} placeholder="Email" value={f.email} onChange={(e) => set('email', e.target.value)} />
          <select className={inp} value={f.primary_course} onChange={(e) => set('primary_course', e.target.value)}><option value="">Course…</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <select className={inp} value={f.track} onChange={(e) => set('track', e.target.value)}>{TRACKS.map((t) => <option key={t} value={t}>{t || 'Track…'}</option>)}</select>
          <input className={inp} placeholder="Program" value={f.program} onChange={(e) => set('program', e.target.value)} />
          <input className={inp} placeholder="Batch" value={f.batch_name} onChange={(e) => set('batch_name', e.target.value)} />
          <select className={inp} value={f.trainer_name} onChange={(e) => set('trainer_name', e.target.value)}><option value="">Trainer…</option>{trainers.map((t) => <option key={t} value={t}>{t}</option>)}</select>
          <select className={inp} value={f.status} onChange={(e) => set('status', e.target.value)}>{STATUS.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select>
        </div>
        {err && <p className="mt-2 text-sm text-rose-600">{err}</p>}
        <div className="mt-4 flex justify-end gap-2"><button onClick={() => setOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600">Cancel</button><button onClick={save} disabled={busy} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{busy ? 'Saving…' : 'Save'}</button></div>
      </div>
    </div>
  )
}
