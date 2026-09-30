'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/api/client'

const inp = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300'

export function AddEventForm({ trainerId }: { trainerId: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [f, setF] = useState({ date: new Date().toISOString().slice(0, 10), title: '', time: '', end_time: '', type: 'Class', batch: '', notes: '' })
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }))

  async function save() {
    if (!f.title || !f.date) return setErr('Date and title required')
    const { error } = await supabase.from('calendar_events').insert({ date: f.date, title: f.title, time: f.time || null, end_time: f.end_time || null, type: f.type, batch: f.batch || null, notes: f.notes || null, trainer_id: trainerId })
    if (error) return setErr(error.message)
    setF({ date: new Date().toISOString().slice(0, 10), title: '', time: '', end_time: '', type: 'Class', batch: '', notes: '' }); setOpen(false); router.refresh()
  }

  if (!open) return <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"><Plus className="h-4 w-4" /> Add Event</button>
  return (
    <div className="w-full rounded-xl border border-slate-200 bg-white p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input className={inp} type="date" value={f.date} onChange={(e) => set('date', e.target.value)} />
        <input className={inp} placeholder="Title *" value={f.title} onChange={(e) => set('title', e.target.value)} />
        <select className={inp} value={f.type} onChange={(e) => set('type', e.target.value)}><option>Class</option><option>Holiday</option><option>Meeting</option><option>Test</option></select>
        <input className={inp} placeholder="Batch" value={f.batch} onChange={(e) => set('batch', e.target.value)} />
        <input className={inp} type="time" value={f.time} onChange={(e) => set('time', e.target.value)} />
        <input className={inp} type="time" value={f.end_time} onChange={(e) => set('end_time', e.target.value)} />
        <input className={inp} placeholder="Notes" value={f.notes} onChange={(e) => set('notes', e.target.value)} />
      </div>
      {err && <p className="mt-2 text-sm text-rose-600">{err}</p>}
      <div className="mt-3 flex gap-2"><button onClick={save} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white">Save</button><button onClick={() => { setOpen(false); setErr(null) }} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600">Cancel</button></div>
    </div>
  )
}
