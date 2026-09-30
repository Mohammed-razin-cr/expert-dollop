'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, Copy, CheckCircle2, Clock, Trash2, Download } from 'lucide-react'
import { createClient } from '@/lib/api/client'
import { SearchSelect } from '@/components/shared/SearchSelect'
import { completionLetterBody } from './completionletter'
import { printDoc } from '@/lib/printDoc'

const inp = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300'

type Student = {
  id: string
  full_name: string
  intern_id?: string | null
  college?: string | null
  branch?: string | null
  degree?: string | null
  semester?: string | null
  program?: string | null
}
type Row = {
  id: string
  intern_name: string
  intern_id: string | null
  role: string | null
  status: string
  token: string
  accepted_at: string | null
  created_at: string
}

export function OnboardingManager({ students, rows, userId }: { students: Student[]; rows: Row[]; userId: string }) {
  const router = useRouter()
  const supabase = createClient()
  const studentOptions = useMemo(() => students.map((s) => ({ value: s.id, label: s.full_name })), [students])
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  // Separate from `err`, which is only rendered inside the create panel — and
  // that panel is closed when you are deleting a row from the table.
  const [delErr, setDelErr] = useState<string | null>(null)
  const [completionOpen, setCompletionOpen] = useState(false)

  const [completion, setCompletionData] = useState({internship_id: '',date: '',intern_name: '',department: '',college: '',degree: '',domain: '',
    start_date: '',
    end_date: '',
    project_name: '',
    authorized_person: '',
    designation: '',
  })

const updateCompletion = (key: string, value: string) =>
  setCompletionData((prev) => ({
    ...prev,
    [key]: value,
  }))
  const [copied, setCopied] = useState<string | null>(null)
  const [f, setF] = useState({ student_id: '', intern_name: '', intern_id: '', college: '', role: '', university_reg_no: '', branch: '', semester: '', start_date: '', end_date: '', duration: '', stipend: '', reporting_manager: '', acceptance_deadline: '' })
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }))

  function pickStudent(id: string) {
  const s = students.find((x) => x.id === id)
  if (!s) return
  setF((p) => ({
    ...p,
    student_id: id,
    intern_name: s.full_name ?? '',
    intern_id: s.intern_id ?? '',
    college: s.college ?? '',
    branch: s.branch ?? '',
    semester: s.semester ?? '',
    role: s.program ?? '',
  }))
}
  async function save() {
    if (!f.intern_name) return setErr('Intern name is required')
    setBusy(true); setErr(null)
    const token = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, '')
    
const { error } = await supabase.from('onboarding').insert({
      student_id: f.student_id || null, 
      intern_name: f.intern_name,
      intern_id: f.intern_id || null,
      college: f.college || null,
      role: f.role || null, start_date: f.start_date || null, end_date: f.end_date || null,
      university_reg_no: f.university_reg_no || null, branch: f.branch || null, semester: f.semester || null,
      duration: f.duration || null, stipend: f.stipend || null, reporting_manager: f.reporting_manager || null,
      acceptance_deadline: f.acceptance_deadline || null, token, status: 'pending', created_by: userId,
    })
    setBusy(false)
    if (error) return setErr(error.message)
    setF({ student_id: '', intern_name: '', intern_id: '', college: '', role: '', university_reg_no: '', branch: '', semester: '', start_date: '', end_date: '', duration: '', stipend: '', reporting_manager: '', acceptance_deadline: '' })
    setOpen(false); router.refresh()
  }

  function copyLink(token: string) {
    const link = `${window.location.origin}/onboard/${token}`
    navigator.clipboard?.writeText(link)
    setCopied(token); setTimeout(() => setCopied(null), 2000)
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Delete onboarding record for ${name}? The acceptance link will stop working.`)) return
    setDelErr(null)

    // `.select()` so a refusal is visible. A delete here is a soft delete —
    // an update that stamps deleted_at — and RLS refuses an update by
    // matching no rows rather than raising an error. The result was never
    // read, so a blocked delete and a successful one looked identical: the
    // button appeared dead. Zero rows back now says so out loud.
    const { data, error } = await supabase
      .from('onboarding')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .select('id')

    if (error) return setDelErr(error.message)
    if (!data?.length) {
      return setDelErr(
        `Could not delete ${name}. The database refused it — onboarding records can only be removed by an admin.`,
      )
    }
    router.refresh()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-semibold text-slate-900">Onboarding</h1><p className="text-sm text-slate-500">{rows.length} interns · offer letter + NDA</p></div>
       {!open && (
<div className="flex gap-2">

<button
onClick={() => setCompletionOpen(true)}
className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
>
<Download className="h-4 w-4" />
Generate Completion Letter
</button>


<button 
onClick={() => setOpen(true)}
className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
>
<Plus className="h-4 w-4" />
Onboard Intern
</button>

</div>
)}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold text-slate-900">Onboard Intern</h2><button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button></div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <SearchSelect className={inp} options={studentOptions} value={f.student_id} onChange={pickStudent} placeholder="Existing student (optional)…" />

<input className={inp} placeholder="Intern name *" value={f.intern_name} onChange={(e) => set('intern_name', e.target.value)} />

<input className={inp} placeholder="Intern ID" value={f.intern_id} onChange={(e) => set('intern_id', e.target.value)} />

<input className={inp} placeholder="College" value={f.college} onChange={(e) => set('college', e.target.value)} />
              <input className={inp} placeholder="Role / Domain (e.g. AI & ML)" value={f.role} onChange={(e) => set('role', e.target.value)} />
              <input className={inp} placeholder="University Reg. No." value={f.university_reg_no} onChange={(e) => set('university_reg_no', e.target.value)} />
              <input className={inp} placeholder="Branch" value={f.branch} onChange={(e) => set('branch', e.target.value)} />
              <input className={inp} placeholder="Semester" value={f.semester} onChange={(e) => set('semester', e.target.value)} />
              <input className={inp} placeholder="Duration (e.g. 3 months)" value={f.duration} onChange={(e) => set('duration', e.target.value)} />
              <div><label className="mb-1 block text-xs text-slate-500">Start date</label><input className={inp} type="date" value={f.start_date} onChange={(e) => set('start_date', e.target.value)} /></div>
              <div><label className="mb-1 block text-xs text-slate-500">End date</label><input className={inp} type="date" value={f.end_date} onChange={(e) => set('end_date', e.target.value)} /></div>
              <input className={inp} placeholder="Stipend" value={f.stipend} onChange={(e) => set('stipend', e.target.value)} />
              <input className={inp} placeholder="Reporting manager / mentor" value={f.reporting_manager} onChange={(e) => set('reporting_manager', e.target.value)} />
              <div><label className="mb-1 block text-xs text-slate-500">Acceptance deadline</label><input className={inp} type="date" value={f.acceptance_deadline} onChange={(e) => set('acceptance_deadline', e.target.value)} /></div>
            </div>
            {err && <p className="mt-2 text-sm text-rose-600">{err}</p>}
            <div className="mt-4 flex justify-end gap-2"><button onClick={() => setOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600">Cancel</button><button onClick={save} disabled={busy} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{busy ? 'Creating…' : 'Create & Generate Link'}</button></div>
          </div>
        </div>
      )}

    {completionOpen && (
  <div
    className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4"
    onClick={() => setCompletionOpen(false)}
  >

    <div
      className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl"
      onClick={(e) => e.stopPropagation()}
    >

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">
          Generate Completion Letter
        </h2>

        <button
          onClick={() => setCompletionOpen(false)}
          className="text-slate-400 hover:text-slate-600"
        >
          <X className="h-5 w-5"/>
        </button>
      </div>


      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

        <input
          className={inp}
          placeholder="Internship ID"
          value={completion.internship_id}
          onChange={(e)=>updateCompletion('internship_id',e.target.value)}
        />


        <div>
          <label className="mb-1 block text-xs text-slate-500">
            Date
          </label>

          <input
            type="date"
            className={inp}
            value={completion.date}
            onChange={(e)=>updateCompletion('date',e.target.value)}
          />

        </div>


        <input
          className={inp}
          placeholder="Intern Name"
          value={completion.intern_name}
          onChange={(e)=>updateCompletion('intern_name',e.target.value)}
        />


        <input
          className={inp}
          placeholder="Department"
          value={completion.department}
          onChange={(e)=>updateCompletion('department',e.target.value)}
        />


        <input
          className={inp}
          placeholder="College Name"
          value={completion.college}
          onChange={(e)=>updateCompletion('college',e.target.value)}
        />


        <input
          className={inp}
          placeholder="Degree / Course"
          value={completion.degree}
          onChange={(e)=>updateCompletion('degree',e.target.value)}
        />


        <input
          className={inp}
          placeholder="Internship Domain"
          value={completion.domain}
          onChange={(e)=>updateCompletion('domain',e.target.value)}
        />


        <div>
          <label className="mb-1 block text-xs text-slate-500">
            Start Date
          </label>

          <input
            type="date"
            className={inp}
            value={completion.start_date}
            onChange={(e)=>updateCompletion('start_date',e.target.value)}
          />

        </div>


        <div>
          <label className="mb-1 block text-xs text-slate-500">
            End Date
          </label>

          <input
            type="date"
            className={inp}
            value={completion.end_date}
            onChange={(e)=>updateCompletion('end_date',e.target.value)}
          />

        </div>


        <input
          className={inp}
          placeholder="Project Name"
          value={completion.project_name}
          onChange={(e)=>updateCompletion('project_name',e.target.value)}
        />


        <input
          className={inp}
          placeholder="Authorized Person"
          value={completion.authorized_person}
          onChange={(e)=>updateCompletion('authorized_person',e.target.value)}
        />


        <input
          className={inp}
          placeholder="Designation"
          value={completion.designation}
          onChange={(e)=>updateCompletion('designation',e.target.value)}
        />


      </div>


      <div className="mt-5 flex justify-end gap-2">


        <button
          onClick={()=>setCompletionOpen(false)}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600"
        >
          Cancel
        </button>


        <button
          onClick={()=>{
            const html = completionLetterBody(completion)

            printDoc(
              'Internship Completion Letter',
              html
            )
          }}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"
        >
          Generate PDF
        </button>


      </div>


    </div>

  </div>
)}

      {delErr && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <span>{delErr}</span>
          <button onClick={() => setDelErr(null)} className="shrink-0 font-medium text-rose-500 hover:text-rose-700">Dismiss</button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500"><tr>
            <th className="px-4 py-3 font-medium">Intern ID</th>
<th className="px-4 py-3 font-medium">Intern</th>
<th className="px-4 py-3 font-medium">Role</th>
<th className="px-4 py-3 font-medium">Status</th>
<th className="px-4 py-3 font-medium">Acceptance Link</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
  <td className="px-4 py-2.5 font-medium text-slate-800">{r.intern_id ?? '—'}</td>
  <td className="px-4 py-2.5 font-medium text-slate-800">{r.intern_name}</td>
  <td className="px-4 py-2.5 text-slate-600">{r.role ?? '—'}</td>
                <td className="px-4 py-2.5">
                  {r.status === 'accepted'
                    ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> Accepted {r.accepted_at ? `· ${new Date(r.accepted_at).toLocaleDateString('en-IN')}` : ''}</span>
                    : <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600"><Clock className="h-3.5 w-3.5" /> Pending</span>}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <button onClick={() => copyLink(r.token)} className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100"><Copy className="h-3.5 w-3.5" /> {copied === r.token ? 'Copied!' : 'Copy link'}</button>
                    <a href={`/onboard/${r.token}`} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-slate-500 hover:underline">Open</a>
                    <button onClick={() => remove(r.id, r.intern_name)} title="Delete" className="rounded-md bg-rose-50 p-1.5 text-rose-500 hover:bg-rose-100"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">No interns onboarded yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
