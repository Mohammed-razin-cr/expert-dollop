'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Save, Undo2, Trash2, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/api/client'

const inp = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300'
type Opt = { id: string; name: string }
const TRACKS = ['', 'Internship', 'Training', 'Placement', 'Certification']
const STATUS = ['active', 'completed', 'on_hold', 'dropped']
// An UPDATE the row-level security policy filters out matches nothing and
// comes back without an error, so "no rows changed" is the only signal that
// the write was refused rather than applied. A BD has insert but no update
// on students, so every edit here is refused for them.
const BLOCKED = 'Nothing was saved — the database refused this change. Editing a student is restricted to admins; ask an admin to make it.'

type Student = {
  id: string; full_name: string; mobile: string | null; email: string | null; status: string
  primary_course: string | null; track: string | null; program: string | null
  batch_name: string | null; trainer_name: string | null; source_lead: string | null; joined_at: string | null
}
type Apt = { id: string; round: string | null; status: string | null; apt_date: string | null }

export function StudentDetail({ student, courses, trainers, aptitude }: { student: Student; courses: Opt[]; trainers: string[]; aptitude: Apt[] }) {
  const router = useRouter()
  const supabase = createClient()
  const [f, setF] = useState(student)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const set = (k: keyof Student, v: string) => { setF((p) => ({ ...p, [k]: v })); setSaved(false); setErr(null) }

  async function save() {
    setBusy(true)
    setErr(null)
    // .select() so a write the database silently refused is caught, rather
    // than reporting "Saved" over an edit that never landed.
    const { data, error } = await supabase.from('students').update({
      mobile: f.mobile || null, email: f.email || null, status: f.status,
      primary_course: f.primary_course || null, track: f.track || null, program: f.program || null,
      batch_name: f.batch_name || null, trainer_name: f.trainer_name || null,
    }).eq('id', f.id).select('id')
    setBusy(false)
    if (error) { setErr(error.message); return }
    if (!data?.length) { setErr(BLOCKED); return }
    setSaved(true); router.refresh()
  }
  async function remove(revert: boolean) {
    if (!confirm(revert ? 'Revert to lead? Student removed, original lead restored.' : 'Remove this student?')) return
    setBusy(true)
    setErr(null)

    // Remove the student first. The reverse order restored the lead before
    // knowing the student could be removed at all, so a refused delete left
    // the same person live as a student *and* back in the lead pipeline.
    const { data, error } = await supabase
      .from('students')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', f.id)
      .select('id')

    if (error) { setBusy(false); setErr(error.message); return }
    if (!data?.length) {
      setBusy(false)
      setErr('Nothing was removed — the database refused this change. Removing a student is restricted to admins; ask an admin to do it.')
      return
    }

    if (revert && f.source_lead) {
      const { data: led, error: leadErr } = await supabase
        .from('leads')
        .update({ status: 'contacted' })
        .eq('id', f.source_lead)
        .select('id')
      // The student is already gone, so this half failing is worth saying
      // out loud rather than silently landing back on the list.
      if (leadErr || !led?.length) {
        setBusy(false)
        setErr('Student removed, but the original lead could not be restored — you may not own that lead. Reopen it from Leads and set it back to Contacted.')
        return
      }
    }

    setBusy(false)
    router.push('/students'); router.refresh()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Link href="/students" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"><ArrowLeft className="h-4 w-4" /> Students</Link>
        <div className="flex gap-2">
          {f.source_lead && <button onClick={() => remove(true)} disabled={busy} className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-600 hover:bg-amber-100"><Undo2 className="h-4 w-4" /> Revert to Lead</button>}
          <button onClick={() => remove(false)} disabled={busy} className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-100"><Trash2 className="h-4 w-4" /> Remove</button>
        </div>
      </div>

      <div>
        <h1 className="text-xl font-semibold text-slate-900">{f.full_name}</h1>
        <p className="text-sm text-slate-500">Joined {f.joined_at ?? '—'}{f.source_lead && <> · <Link href={`/leads/${f.source_lead}`} className="text-blue-600 hover:underline">view source lead</Link></>}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-sm font-semibold text-slate-800">Profile</div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-xs text-slate-500">Mobile</label><input className={inp} value={f.mobile ?? ''} onChange={(e) => set('mobile', e.target.value)} /></div>
            <div><label className="mb-1 block text-xs text-slate-500">Email</label><input className={inp} value={f.email ?? ''} onChange={(e) => set('email', e.target.value)} /></div>
            <div><label className="mb-1 block text-xs text-slate-500">Course</label><select className={inp} value={f.primary_course ?? ''} onChange={(e) => set('primary_course', e.target.value)}><option value="">—</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div><label className="mb-1 block text-xs text-slate-500">Track</label><select className={inp} value={f.track ?? ''} onChange={(e) => set('track', e.target.value)}>{TRACKS.map((t) => <option key={t} value={t}>{t || '—'}</option>)}</select></div>
            <div><label className="mb-1 block text-xs text-slate-500">Program</label><input className={inp} value={f.program ?? ''} onChange={(e) => set('program', e.target.value)} /></div>
            <div><label className="mb-1 block text-xs text-slate-500">Batch</label><input className={inp} value={f.batch_name ?? ''} onChange={(e) => set('batch_name', e.target.value)} /></div>
            <div><label className="mb-1 block text-xs text-slate-500">Trainer</label><select className={inp} value={f.trainer_name ?? ''} onChange={(e) => set('trainer_name', e.target.value)}><option value="">—</option>{trainers.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
            <div><label className="mb-1 block text-xs text-slate-500">Status</label><select className={inp} value={f.status} onChange={(e) => set('status', e.target.value)}>{STATUS.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}</select></div>
          </div>
          <div className="flex items-center gap-3 pt-1"><button onClick={save} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"><Save className="h-4 w-4" /> {busy ? 'Saving…' : 'Save'}</button>{saved && <span className="text-sm text-emerald-600">Saved ✓</span>}</div>
          {err && <p className="text-sm text-rose-600">{err}</p>}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-2 text-sm font-semibold text-slate-800">Aptitude History ({aptitude.length})</div>
          {aptitude.length === 0 ? <p className="text-sm text-slate-400">No aptitude records linked by mobile.</p> : (
            <div className="divide-y divide-slate-100">
              {aptitude.map((a) => (<div key={a.id} className="flex items-center justify-between py-2 text-sm"><span className="text-slate-600">{a.round ?? 'Round'} · {a.apt_date ?? '—'}</span><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{a.status ?? '—'}</span></div>))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
