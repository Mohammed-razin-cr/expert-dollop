'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/api/client'
import { SearchSelect } from '@/components/shared/SearchSelect'
import type { Enum } from '@/lib/database.types'

const inp = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100'
const ST = [{ v: 'in_process', l: 'In Process' }, { v: 'offered', l: 'Offered' }, { v: 'placed', l: 'Joined' }, { v: 'declined', l: 'Declined' }]
const cls: Record<string, string> = { in_process: 'bg-slate-100 text-slate-500', offered: 'bg-amber-50 text-amber-600', placed: 'bg-emerald-50 text-emerald-600', declined: 'bg-rose-50 text-rose-600' }
type Student = { id: string; full_name: string }
type Row = { id: string; company: string | null; role: string | null; ctc: number | null; offer_date: string | null; join_date: string | null; status: string; student: string | null }

export function PlacementsManager({ rows, students }: { rows: Row[]; students: Student[] }) {
  const router = useRouter()
  const supabase = createClient()
  const studentOptions = useMemo(() => students.map((s) => ({ value: s.id, label: s.full_name })), [students])
  const [open, setOpen] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [f, setF] = useState({ student_id: '', company: '', role: '', ctc: '', offer_date: '', join_date: '', status: 'offered' as Enum<'placement_status'> })
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }))

  async function save() {
    if (!f.student_id || !f.company) return setErr('Student and company required')
    const { error } = await supabase.from('placements').insert({ student_id: f.student_id, company: f.company, role: f.role || null, ctc: f.ctc ? Number(f.ctc) : null, offer_date: f.offer_date || null, join_date: f.join_date || null, status: f.status })
    if (error) return setErr(error.message)
    setF({ student_id: '', company: '', role: '', ctc: '', offer_date: '', join_date: '', status: 'offered' as Enum<'placement_status'> }); setOpen(false); router.refresh()
  }
  const upd = (id: string, status: Enum<'placement_status'>) => supabase.from('placements').update({ status }).eq('id', id).then(() => router.refresh())

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-semibold text-slate-900">Placements</h1><p className="text-sm text-slate-500">{rows.length} placements</p></div>
        {!open && <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"><Plus className="h-4 w-4" /> Add Placement</button>}
      </div>
      {open && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SearchSelect className={inp} options={studentOptions} value={f.student_id} onChange={(v) => set('student_id', v)} placeholder="Student *…" />
            <input className={inp} placeholder="Company *" value={f.company} onChange={(e) => set('company', e.target.value)} />
            <input className={inp} placeholder="Role" value={f.role} onChange={(e) => set('role', e.target.value)} />
            <input className={inp} type="number" placeholder="CTC (₹)" value={f.ctc} onChange={(e) => set('ctc', e.target.value)} />
            <div><label className="mb-1 block text-[11px] uppercase text-slate-400">Offer date</label><input className={inp} type="date" value={f.offer_date} onChange={(e) => set('offer_date', e.target.value)} /></div>
            <div><label className="mb-1 block text-[11px] uppercase text-slate-400">Join date</label><input className={inp} type="date" value={f.join_date} onChange={(e) => set('join_date', e.target.value)} /></div>
            <select className={inp} value={f.status} onChange={(e) => set('status', e.target.value)}>{ST.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}</select>
          </div>
          {err && <p className="mt-2 text-sm text-rose-600">{err}</p>}
          <div className="mt-3 flex gap-2"><button onClick={save} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white">Save</button><button onClick={() => { setOpen(false); setErr(null) }} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600">Cancel</button></div>
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="px-4 py-3 font-medium">Student</th><th className="px-4 py-3 font-medium">Company</th><th className="px-4 py-3 font-medium">Role</th><th className="px-4 py-3 font-medium">CTC</th><th className="px-4 py-3 font-medium">Dates</th><th className="px-4 py-3 font-medium">Status</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-4 py-2.5 font-medium text-slate-800">{r.student ?? '—'}</td>
                <td className="px-4 py-2.5 text-slate-700">{r.company ?? '—'}</td>
                <td className="px-4 py-2.5 text-slate-600">{r.role ?? '—'}</td>
                <td className="px-4 py-2.5 text-slate-600">{r.ctc ? '₹' + Number(r.ctc).toLocaleString('en-IN') : '—'}</td>
                <td className="px-4 py-2.5 text-slate-500">{(r.offer_date ?? '—')}{r.join_date ? ` → ${r.join_date}` : ''}</td>
                <td className="px-4 py-2.5"><select defaultValue={r.status} onChange={(e) => upd(r.id, e.target.value as Enum<'placement_status'>)} className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls[r.status] ?? ''}`}>{ST.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}</select></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">No placements yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
