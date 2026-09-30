'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save } from 'lucide-react'
import { createClient } from '@/lib/api/client'

const inp = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300'
const PATHWAYS = ['Recruitment', 'Internship', 'Course', 'Project', 'Aptitude'] as const
type Field = { k: string; l: string; type?: 'text' | 'number' | 'date' | 'select' | 'course'; opts?: string[]; full?: boolean }

const FORMS: Record<string, Field[]> = {
  Recruitment: [
    { k: 'company', l: 'Target Company' }, { k: 'role', l: 'Role / Position' },
    { k: 'expected_ctc', l: 'Expected CTC (₹)', type: 'number' }, { k: 'location', l: 'Location' },
    { k: 'stage', l: 'Stage', type: 'select', opts: ['Sourced', 'Screening', 'Interview', 'Offer', 'Joined'] },
    { k: 'notes', l: 'Notes', full: true },
  ],
  Internship: [
    { k: 'company', l: 'Company / Organisation' }, { k: 'domain', l: 'Domain' },
    { k: 'duration_weeks', l: 'Duration (weeks)', type: 'number' }, { k: 'stipend', l: 'Stipend (₹)', type: 'number' },
    { k: 'start_date', l: 'Start Date', type: 'date' }, { k: 'mode', l: 'Mode', type: 'select', opts: ['Remote', 'Onsite', 'Hybrid'] },
    { k: 'notes', l: 'Notes', full: true },
  ],
  Course: [
    { k: 'course_id', l: 'Course', type: 'course' }, { k: 'batch', l: 'Batch' },
    { k: 'fee', l: 'Fee (₹)', type: 'number' }, { k: 'start_date', l: 'Start Date', type: 'date' },
    { k: 'mode', l: 'Mode', type: 'select', opts: ['Online', 'Offline', 'Hybrid'] },
    { k: 'notes', l: 'Notes', full: true },
  ],
  Project: [
    { k: 'title', l: 'Project Title' }, { k: 'tech_stack', l: 'Tech Stack' },
    { k: 'duration_weeks', l: 'Duration (weeks)', type: 'number' }, { k: 'mentor', l: 'Mentor' },
    { k: 'deliverable', l: 'Deliverable' },
    { k: 'vendor', l: 'Vendor' }, { k: 'vendor_cost', l: 'Vendor Cost (₹)', type: 'number' },
    { k: 'company_cost', l: 'Company Cost (₹)', type: 'number' },
    { k: 'status', l: 'Status', type: 'select', opts: ['Not Started', 'In Progress', 'Completed', 'On Hold', 'Student Declined'] },
    { k: 'assigned_developer', l: 'Assigned To (Developer)' },
    { k: 'notes', l: 'Notes', full: true },
  ],
  Aptitude: [
    { k: 'round', l: 'Round', type: 'select', opts: ['Round 1', 'Round 2', 'Round 3'] },
    { k: 'mode', l: 'Mode', type: 'select', opts: ['Online', 'Offline'] },
    { k: 'test_date', l: 'Test Date', type: 'date' }, { k: 'venue', l: 'Venue' },
    { k: 'target_score', l: 'Target Score', type: 'number' }, { k: 'notes', l: 'Notes', full: true },
  ],
}

type Opt = { id: string; name: string }
export function PathwaySection({leadId,pathway,details,courses,canEdit,}: {leadId: string; pathway: string | null; details: Record<string, any>; courses: Opt[];canEdit: boolean}){
  const router = useRouter()
  const supabase = createClient()
  const [active, setActive] = useState<string | null>(pathway && PATHWAYS.includes(pathway as any) ? pathway : null)
  const [data, setData] = useState<Record<string, any>>(details ?? {})
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  const cur = active ? (data[active] ?? {}) : {}
  const setField = (k: string, v: any) => { setData((p) => ({ ...p, [active!]: { ...(p[active!] ?? {}), [k]: v } })); setSaved(false) }

  async function save() {
    setBusy(true)
    const { error } = await supabase
  .from('leads')
  .update({
    pathway: active,
    pathway_details: data,
  })
  .eq('id', leadId)

setBusy(false)

if (error) {
  alert(error.message)
  return
}

setSaved(true)
router.refresh()
    setBusy(false); setSaved(true); router.refresh()
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Student Pathway</h2>
        {active && <button onClick={save} disabled={busy|| !canEdit} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"><Save className="h-3.5 w-3.5" /> {busy ? 'Saving…' : 'Save Pathway'}{saved && ' ✓'}</button>}
      </div>

      <div className="flex flex-wrap gap-2">
        {PATHWAYS.map((p) => {
          const filled = data[p] && Object.values(data[p]).some((v) => v !== '' && v != null)
          return (
            <button key={p} disabled={!canEdit} onClick={() => {
                  if (!canEdit) return
                  setActive(active === p ? null : p)
                  setSaved(false)
                }}
              className={`relative rounded-lg border px-4 py-2 text-sm font-medium ${active === p ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              {p}{filled && <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 align-middle" />}
            </button>
          )
        })}
      </div>

      {active && (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {FORMS[active].map((fld) => (
            <div key={fld.k} className={fld.full ? 'sm:col-span-2' : ''}>
              <label className="mb-1 block text-xs text-slate-500">{fld.l}</label>
              {fld.type === 'select' ? (
                <select className={inp} value={cur[fld.k] ?? ''} onChange={(e) => setField(fld.k, e.target.value)} disabled={!canEdit}>
                  <option value="">—</option>{fld.opts!.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : fld.type === 'course' ? (
                <select className={inp} value={cur[fld.k] ?? ''} onChange={(e) => setField(fld.k, e.target.value)} disabled={!canEdit}>
                  <option value="">Select course…</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              ) : fld.full ? (
                <textarea className={inp} rows={2} value={cur[fld.k] ?? ''} onChange={(e) => setField(fld.k, e.target.value)} disabled={!canEdit}/>
              ) : (
                <input className={inp} type={fld.type ?? 'text'} value={cur[fld.k] ?? ''} onChange={(e) => setField(fld.k, e.target.value)} disabled={!canEdit} />
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
