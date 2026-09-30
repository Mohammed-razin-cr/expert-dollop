'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Eye } from 'lucide-react'
import { createClient } from '@/lib/api/client'
import { SearchSelect } from '@/components/shared/SearchSelect'
import { printDoc } from '@/lib/printDoc'
import { certificateHTML } from '@/lib/certificateDoc'

const inp = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100'
const cls: Record<string, string> = { Pending: 'bg-amber-50 text-amber-600', Approved: 'bg-blue-50 text-blue-600', Sent: 'bg-emerald-50 text-emerald-600', Rejected: 'bg-rose-50 text-rose-600' }
type Student = { id: string; full_name: string }
type Row = { id: string; type: string | null; request_date: string | null; status: string; sent_date: string | null; certificate_id?: string | null; student: string | null }

export function CertManager({ rows, students }: { rows: Row[]; students: Student[] }) {
  const router = useRouter()
  const supabase = createClient()
  const studentOptions = useMemo(() => students.map((s) => ({ value: s.id, label: s.full_name })), [students])
  const [open, setOpen] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [f, setF] = useState({ student_id: '', type: 'Completion' })

  async function save() {
    if (!f.student_id) return setErr('Student required')
    const { error } = await supabase.from('cert_requests').insert({ student_id: f.student_id, type: f.type, status: 'Pending' })
    if (error) return setErr(error.message)
    setF({ student_id: '', type: 'Completion' }); setOpen(false); router.refresh()
  }
  const setStatus = (id: string, status: string) => supabase.from('cert_requests').update({ status, sent_date: status === 'Sent' ? new Date().toISOString().slice(0, 10) : null }).eq('id', id).then(() => router.refresh())
  function viewCertificate(r: Row) {
    printDoc(
      `Certificate — ${r.student ?? ''}`,
      certificateHTML({
        student: r.student ?? '—',
        course: r.type,
        batch: null,
        completedOn: r.sent_date ?? r.request_date ?? new Date().toISOString().slice(0, 10),
        certificateId: r.certificate_id ?? null,
      }),
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-semibold text-slate-900">Certificate Requests</h1><p className="text-sm text-slate-500">{rows.length} requests</p></div>
        {!open && <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"><Plus className="h-4 w-4" /> New Request</button>}
      </div>
      {open && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <SearchSelect className={inp} options={studentOptions} value={f.student_id} onChange={(v) => setF({ ...f, student_id: v })} placeholder="Student *…" />
            <select className={inp} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}><option>Completion</option><option>Internship</option><option>Merit</option></select>
          </div>
          {err && <p className="mt-2 text-sm text-rose-600">{err}</p>}
          <div className="mt-3 flex gap-2"><button onClick={save} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white">Save</button><button onClick={() => { setOpen(false); setErr(null) }} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600">Cancel</button></div>
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="px-4 py-3 font-medium">Student</th><th className="px-4 py-3 font-medium">Type</th><th className="px-4 py-3 font-medium">Requested</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Sent</th><th className="px-4 py-3 font-medium">Actions</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-4 py-2.5 font-medium text-slate-800">{r.student ?? '—'}</td>
                <td className="px-4 py-2.5 text-slate-600">{r.type ?? '—'}</td>
                <td className="px-4 py-2.5 text-slate-500">{r.request_date ?? '—'}</td>
                <td className="px-4 py-2.5"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls[r.status] ?? ''}`}>{r.status}</span></td>
                <td className="px-4 py-2.5 text-slate-500">{r.sent_date ?? '—'}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1.5 text-xs">
                    {r.status === 'Pending' && <><button onClick={() => setStatus(r.id, 'Approved')} className="rounded-md bg-blue-50 px-2 py-1 font-medium text-blue-600">Approve</button><button onClick={() => setStatus(r.id, 'Rejected')} className="rounded-md bg-rose-50 px-2 py-1 font-medium text-rose-600">Reject</button></>}
                    {r.status === 'Approved' && <button onClick={() => setStatus(r.id, 'Sent')} className="rounded-md bg-emerald-50 px-2 py-1 font-medium text-emerald-600">Send Certificate</button>}
                    {(r.status === 'Approved' || r.status === 'Sent') && <button onClick={() => viewCertificate(r)} title="View Certificate" className="rounded-md bg-slate-100 p-1.5 text-slate-600 hover:bg-slate-200"><Eye className="h-3.5 w-3.5" /></button>}
                    {r.status === 'Rejected' && <span className="text-slate-400">—</span>}
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">No requests yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
