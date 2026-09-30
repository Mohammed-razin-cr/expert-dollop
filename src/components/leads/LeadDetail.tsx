'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Phone, UserPlus, Save, Trash2, Check } from 'lucide-react'
import { createClient } from '@/lib/api/client'
import type { Enum } from '@/lib/database.types'
import { PathwaySection } from './PathwaySection'

type Course = { id: string; name: string }
type BD = { id: string; full_name: string }
type HistoryRow = { id: string; from_bd: string | null; to_bd: string | null; changed_by: string | null; changed_at: string }
type Followup = { id: string; type: string | null; outcome: string | null; notes: string | null; scheduled_at: string | null; created_at: string }
type Lead = {
  id: string
  assigned_bd: string | null
  name: string
  mobile: string | null
  email: string | null
  college: string | null
  status: Enum<'lead_status'>
  temperature: string | null
  source_detail: string | null
  source: Enum<'lead_source'>
  category: string | null
  enquiry_date: string | null
  course_interest: string | null
  plan: string | null

  place_city: string | null
  branch: string | null
  degree: string | null
  cgpa: number | null
  year_of_passing: number | null
  dob: string | null
  current_location: string | null
  graduation_status: string | null

  pathway: string | null
  fu_count: number | null
  remarks: string | null
  next_followup_at: string | null
  updated_by: string | null
  updated_by_name: string | null
  updated_at: string | null
  /** Read-only — shown on the audit panel, never part of the save payload. */
  created_at: string | null

  pathway_details?: Record<string, any> | null
}

const STAGES: Enum<'lead_status'>[] = ['new', 'contacted', 'interested', 'demo_scheduled', 'aptitude_shared', 'passed', 'enrolled', 'no_response', 'irrelevant', 'not_interested', 'lost']
const TEMPS = ['cold', 'warm', 'hot']
const FU_TYPES = ['Call', 'WhatsApp', 'Email', 'Meeting', 'Visit']
// The same six values Add New Lead offers, so both screens write the same
// vocabulary into leads.source.
const SOURCES: Enum<'lead_source'>[] = ['just_dial', 'website', 'college', 'referral', 'social_media', 'walk_in', 'skillfinity']

const OUTCOMES = ['Interested', 'Not Interested', 'No Response', 'Call Back', 'Follow-up', 'Converted']

const field = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100'
const lbl = 'mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-400'
// An UPDATE the row-level security policy filters out matches nothing and
// comes back without an error, so "no rows changed" is the only signal that
// the write was refused rather than applied.
const BLOCKED = 'Nothing was saved — the database refused this change. You may no longer have access to this lead; reopen it and try again.'

export function LeadDetail({lead,followups,courses,bds,allProfiles,history,currentUserId,role,backHref,}: {
  lead: Lead
  followups: Followup[]
  courses: Course[]
  bds: BD[]
  allProfiles: BD[]
  history: HistoryRow[]
  currentUserId: string
  role: string
  /** Where Close / X / Delete return to — the filtered list, or plain /leads. */
  backHref: string
}){
  const router = useRouter()
  // Back to the filtered list this lead was opened from. The server resolved
  // it from the `back` param and handed it down rather than this component
  // reading useSearchParams(): /leads/[id] already reads its params on the
  // server, and keeping it there avoids dragging in a Suspense boundary to
  // read one string.
  const goBackToLeads = () => router.push(backHref)
  const supabase = createClient()
  const [f, setF] = useState(lead)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [converted, setConverted] = useState(lead.status === 'enrolled')
  const [fu, setFu] = useState({type: 'Call',outcome: '',notes: '',date: '',nextDate: '',})
  const isAdmin = role === 'admin' || role === 'super_admin'
  // Reads f (not the lead prop) so taking over flips this the instant it
  // succeeds, without waiting on a router.refresh() round-trip.
  const canEdit = isAdmin || f.assigned_bd === currentUserId
  const canTakeOver = (role === 'bd' || role === 'counsellor') && !canEdit
  const canDelete = isAdmin
  const nameOf = (id: string | null) => (id ? allProfiles.find((p) => p.id === id)?.full_name ?? 'Unknown' : 'Unassigned')
  const set = (k: keyof Lead, v: any) => { setF((p) => ({ ...p, [k]: v })); setSaved(false) }
  async function takeOver() {
    if (!canTakeOver || busy) return
    if (!confirm(`Take over this lead from ${nameOf(f.assigned_bd)}? It will be reassigned to you.`)) return
    setBusy(true)
    setErr(null)
    // .select() so a write the database silently refused is caught: an
    // UPDATE that RLS filters out matches no rows and returns no error, so
    // without this a blocked takeover looked like it had worked and every
    // edit after it was quietly discarded.
    const { data, error } = await supabase.from('leads').update({ assigned_bd: currentUserId }).eq('id', lead.id).select('id')
    setBusy(false)
    if (error) { setErr(error.message); return }
    if (!data?.length) { setErr(BLOCKED); return }
    setF((p) => ({ ...p, assigned_bd: currentUserId }))
    router.refresh()
  }
  async function save() {
    if (!canEdit) return

    setBusy(true)
    setErr(null)
    setSaved(false)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user!.id)
      .single()

    const { data, error } = await supabase
      .from('leads')
      .update({
        name: f.name,
        mobile: f.mobile,
        email: f.email,
        college: f.college,
        ...(isAdmin && { assigned_bd: f.assigned_bd }),

        // Saving any edit on a lead still sitting at "new" counts as first
        // contact, same as logging a follow-up already does below — unless
        // the BD picked a different stage in this same save, in which case
        // that explicit choice wins.
        status: f.status === 'new' ? 'contacted' : f.status,
        temperature: f.temperature,
        source: f.source,
        category: f.category,
        enquiry_date: f.enquiry_date
          ? new Date(f.enquiry_date).toISOString()
          : null,

        course_interest: f.course_interest || null,
        plan: f.plan,

        place_city: f.place_city,
        branch: f.branch,
        degree: f.degree,
        cgpa: f.cgpa,
        year_of_passing: f.year_of_passing,
        dob: f.dob,
        current_location: f.current_location,
        graduation_status: f.graduation_status,
        remarks: f.remarks,
        next_followup_at: f.next_followup_at
        ? new Date(f.next_followup_at).toISOString()
        : null,
        updated_by: user?.id,
        updated_by_name: profile?.full_name,
      })
      .eq('id', lead.id)
      .select('id')

    setBusy(false)

    if (error) {
      setErr(error.message)
      return
    }
    if (!data?.length) {
      setErr(BLOCKED)
      return
    }
    if (f.status === 'aptitude_shared') {
      const { data: existing } = await supabase
        .from('aptitude')
        .select('id')
        .eq('lead_ref', lead.id)
        .maybeSingle()
      if (!existing) {
        await supabase.from('aptitude').insert({
          apt_key: `apt_${Date.now()}`,
          lead_ref: lead.id,
          name: f.name,
          phone: f.mobile,
          email: f.email,
          college: f.college,
          // leads.cgpa is numeric; aptitude.cgpa is text.
          cgpa: f.cgpa == null ? null : String(f.cgpa),
          bd: profile?.full_name ?? null,
          status: 'Scheduled',
          round: 'Round 1',
          mode: 'Online',
          apt_date: new Date().toISOString().slice(0, 10),
        })
      }
    }
    setSaved(true)
    router.refresh()
  }
    
  async function logFollowup() { if (!canEdit) return;
    if (!fu.date || !fu.nextDate) {
      alert('Please select both dates')
      return
    }
    setBusy(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('followups').insert({
      lead_id: lead.id, bd_id: user?.id ?? null, type: fu.type, outcome: fu.outcome || null,
      notes: fu.notes || null, scheduled_at: fu.date ? new Date(fu.date).toISOString() : new Date().toISOString(),
      status: 'done',
    })
    const tempMap: Record<string, string> = {
      'Interested': 'hot', 'Very Interested': 'hot',
      'Callback Requested': 'warm', 'Follow-up': 'warm',
      'Not Interested': 'cold', 'Not Reachable': 'cold',
    }
    const autoTemp = tempMap[fu.outcome]
    const updateResult = await supabase
      .from('leads')
      .update({
        next_followup_at: fu.nextDate
        ? new Date(fu.nextDate).toISOString()
        : null,
        fu_count: (f.fu_count ?? 0) + 1,
        status: f.status === 'new' ? 'contacted' : f.status,
        ...(autoTemp ? { temperature: autoTemp } : {}),
      })
      .eq('id', lead.id)
      .select()
    if (updateResult.data?.[0]) {
      setF((prev) => ({
        ...prev,
        next_followup_at: fu.nextDate
          ? new Date(fu.nextDate).toISOString()
          : null,
      }))
    }
    if (autoTemp) set('temperature', autoTemp)

    setBusy(false); setFu({
      type: 'Call',
      outcome: '',
      notes: '',
      date: '',
      nextDate: '',
    }); router.refresh()
  }

async function convert() { if (!canEdit) return;
  if (converted) return
  setBusy(true)

  const { error } = await supabase.from('students').insert({
    full_name: f.name,
    mobile: f.mobile,
    email: f.email,
    primary_course: f.course_interest || null,
    source_lead: lead.id,

    place_city: f.place_city,
    current_location: f.current_location,
    branch: f.branch,
    degree: f.degree,
    cgpa: f.cgpa,
    year_of_passing: f.year_of_passing,
    graduation_status: f.graduation_status,
    dob: f.dob,
  })
  if (!error) {
    await supabase.from('leads').update({ status: 'enrolled' }).eq('id', lead.id)
    setConverted(true)
    set('status', 'enrolled')
  }
  setBusy(false)
  router.refresh()
}
async function del() { if (!canDelete) return;
    if (!confirm('Delete this lead permanently?')) return
    setBusy(true)
    await supabase.from('leads').delete().eq('id', lead.id)
    goBackToLeads()
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {/* header */}
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-lg font-semibold text-slate-900">Lead Detail</h1>
        <div className="flex items-center gap-2">
          <button onClick={save} disabled={busy || !canEdit}className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
            {saved ? <><Check className="h-4 w-4" /> Saved</> : <><Save className="h-4 w-4" /> Save</>}
          </button>
          {!converted && (
            <button onClick={convert} disabled={busy || !canEdit} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              <UserPlus className="h-4 w-4" /> Convert
            </button>
          )}
          <button onClick={goBackToLeads} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"><X className="h-4 w-4" /></button>
        </div>
      </div>

      {/* banner */}
      <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-blue-600 to-violet-600 px-6 py-5 text-white">
        <div>
          <p className="text-xl font-semibold">{f.name}</p>
          <p className="text-sm text-blue-100">{f.mobile ?? '—'}</p>
        </div>
        <div className="text-right text-sm text-blue-100">
          <p className="capitalize">{f.temperature ?? '—'}</p>
          <p>{f.fu_count ?? 0} follow-ups</p>
        </div>
      </div>

      {canTakeOver && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
          <p className="text-amber-800">
            This lead is assigned to <strong>{nameOf(f.assigned_bd)}</strong>. Take it over to edit it.
          </p>
          <button onClick={takeOver} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50">
            <UserPlus className="h-4 w-4" /> Take Over Lead
          </button>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
        {/* When the lead came in. The list used to carry this in its Date
            column; that column now shows when the lead was last touched, which
            is what it is ordered by. */}
        <p>
          <strong>Lead Created On:</strong>{" "}
          {f.created_at
            ? new Date(f.created_at).toLocaleString("en-IN")
            : "—"}
        </p>

        <p className="mt-1">
          <strong>Last Updated By:</strong>{" "}
          {f.updated_by_name ?? "Not updated yet"}
        </p>

        <p className="mt-1">
          <strong>Last Updated On:</strong>{" "}
          {f.updated_at
            ? new Date(f.updated_at).toLocaleString("en-IN")
            : "—"}
        </p>

        {history.length > 0 && (
          <div className="mt-3 border-t border-slate-200 pt-3">
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
              Assignment History
              <span className="ml-1 font-normal normal-case tracking-normal text-slate-400">· newest first</span>
            </p>
            <ul className="space-y-1">
              {history.map((h, i) => {
                // The query orders changed_at desc, so the first row is the
                // change that produced today's owner. Unlabelled, four
                // "X → Y" rows read as a top-down story and the oldest row
                // gets mistaken for the latest. Only badge it when it really
                // does agree with assigned_bd — if the two ever disagree,
                // saying nothing beats asserting something false.
                const isCurrent = i === 0 && h.to_bd === f.assigned_bd
                return (
                  <li key={h.id} className={isCurrent ? 'text-slate-800' : 'text-slate-500'}>
                    {isCurrent && (
                      <span className="mr-1.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                        Current
                      </span>
                    )}
                    <strong>{nameOf(h.from_bd)}</strong> → <strong>{nameOf(h.to_bd)}</strong>
                    {' · by '}{nameOf(h.changed_by)}
                    {' · '}{new Date(h.changed_at).toLocaleString('en-IN')}
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>

      {/* basic + contact */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Basic Info</h2>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl}>Stage</label>
              <select className={field} value={f.status} onChange={(e) => set('status', e.target.value)} disabled={!canEdit}>
                {STAGES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select></div>
            <div><label className={lbl}>Temp</label>
              <select className={field} value={f.temperature ?? ''} onChange={(e) => set('temperature', e.target.value)}disabled={!canEdit}>
                <option value="">—</option>{TEMPS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select></div>
            {/* Binds to `source`, the lead_source enum every report reads —
                not `source_detail`, which the schema documents as the raw
                sheet value before mapSource(). That field held things like
                "collage" and "collage ", was empty on most rows, and
                nothing maps an edit to it back onto source, so typing there
                changed nothing that mattered. */}
            <div><label className={lbl}>Source</label>
              <select className={field} value={f.source ?? ''} onChange={(e) => set('source', e.target.value as Enum<'lead_source'>)} disabled={!canEdit}>
                {SOURCES.map((x) => <option key={x} value={x}>{x.replace('_', ' ')}</option>)}
              </select></div>
            <div><label className={lbl}>Course</label>
              <select className={field} value={f.course_interest ?? ''} onChange={(e) => set('course_interest', e.target.value)} disabled={!canEdit}>
                <option value="">—</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select></div>
            <div><label className={lbl}>Enquiry Date</label>
              <input type="date" className={field} value={(f.enquiry_date ?? '').slice(0, 10)} onChange={(e) => set('enquiry_date', e.target.value)} disabled={!canEdit} />
            </div>
            {/* Admin only. Reassigning is an admin action, so for everyone
                else this was a disabled box restating what they already
                know. A BD who opens a lead they do not own still learns
                whose it is from the take-over banner. */}
            {isAdmin && (
              <div><label className={lbl}>Assigned BD</label>
                <select className={field} value={f.assigned_bd ?? ''} onChange={(e) => set('assigned_bd', e.target.value || null)}>
                  <option value="">Unassigned</option>
                  {bds.map((b) => <option key={b.id} value={b.id}>{b.full_name}</option>)}
                </select>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Contact Info</h2>
          <div className="space-y-3">
            <div><label className={lbl}>Name</label><input className={field} value={f.name} onChange={(e) => set('name', e.target.value)} disabled={!canEdit} /></div>
            <div><label className={lbl}>Phone</label><input className={field} value={f.mobile ?? ''} onChange={(e) => set('mobile', e.target.value)} disabled={!canEdit} /></div>
            <div><label className={lbl}>Email</label><input className={field} value={f.email ?? ''} onChange={(e) => set('email', e.target.value)} disabled={!canEdit} /></div>
            <div><label className={lbl}>College</label><input className={field} value={f.college ?? ''} onChange={(e) => set('college', e.target.value)} disabled={!canEdit}/></div>
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Remarks</h2>
        <textarea className={`${field} min-h-[80px]`} value={f.remarks ?? ''} onChange={(e) => set('remarks', e.target.value)} disabled={!canEdit} placeholder="Notes about this lead…" />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
  <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
    Education Details
  </h2>

  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">

    <div>
      <label className={lbl}>Place / City</label>
      <input
        className={field}
        value={f.place_city ?? ''}
        onChange={(e) => set('place_city', e.target.value)} disabled={!canEdit}
      />
    </div>

    <div>
      <label className={lbl}>Current Location</label>
      <input
        className={field}
        value={f.current_location ?? ''}
        onChange={(e) => set('current_location', e.target.value)} disabled={!canEdit}
      />
    </div>

    <div>
      <label className={lbl}>Branch</label>
      <input
        className={field}
        value={f.branch ?? ''}
        onChange={(e) => set('branch', e.target.value)} disabled={!canEdit}
      />
    </div>

    <div>
      <label className={lbl}>Degree</label>
      <input
        className={field}
        value={f.degree ?? ''}
        onChange={(e) => set('degree', e.target.value)} disabled={!canEdit}
      />
    </div>

    <div>
      <label className={lbl}>CGPA</label>
      <input
        type="number"
        className={field}
        value={f.cgpa ?? ''}
        onChange={(e) =>
          set('cgpa', e.target.value ? Number(e.target.value) : null)
        } disabled={!canEdit}
              />
    </div>

    <div>
      <label className={lbl}>Year of Passing</label>
      <input
        type="number"
        className={field}
        value={f.year_of_passing ?? ''}
        onChange={(e) =>
          set(
            'year_of_passing',
            e.target.value ? Number(e.target.value) : null
          )
        } disabled={!canEdit}
      />
    </div>

    <div>
      <label className={lbl}>Date of Birth</label>
      <input
        type="date"
        className={field}
        value={f.dob ?? ''}
        onChange={(e) => set('dob', e.target.value)} disabled={!canEdit}
      />
    </div>

    <div>
      <label className={lbl}>Graduation Status</label>
      <select
        className={field}
        value={f.graduation_status ?? ''}
        onChange={(e) => set('graduation_status', e.target.value)} disabled={!canEdit}
      >
        <option value="">Select</option>
        <option>Pursuing</option>
        <option>Graduated</option>
        <option>Awaiting Results</option>
        <option>Dropped</option>
      </select>
    </div>

  </div>
</section>

      {/* pathway */}
      <PathwaySection leadId={lead.id} pathway={f.pathway} details={(lead.pathway_details ?? {}) as Record<string, any>} courses={courses} canEdit={canEdit}/>

      {/* follow-up history */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500"><Phone className="h-3.5 w-3.5" /> Follow-up History ({followups.length})</h2>
        {followups.length === 0 ? (
          <p className="text-sm text-slate-400">No follow-ups yet.</p>
        ) : (
          <ul className="space-y-2">
            {followups.map((h) => (
              <li key={h.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-700">{h.type ?? 'Call'}{h.outcome ? ` · ${h.outcome}` : ''}</span>
                  <span className="text-xs text-slate-400">{(h.scheduled_at ?? h.created_at ?? '').slice(0, 10)}</span>
                </div>
                {h.notes && <p className="mt-0.5 text-slate-500">{h.notes}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* log new follow-up */}
      <section className="rounded-xl border border-amber-200 bg-amber-50/50 p-5">
        <h2 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700"><Phone className="h-3.5 w-3.5" /> Log New Follow-up</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <select
            className={field}
            value={fu.type}
            onChange={(e) => setFu({ ...fu, type: e.target.value })}
            disabled={!canEdit}
          >
            {FU_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select className={field} value={fu.outcome} onChange={(e) => setFu({ ...fu, outcome: e.target.value })} disabled={!canEdit}><option value="">Outcome…</option>{OUTCOMES.map((o) => (<option key={o}>{o}</option>))}</select>        
        </div>
        <textarea className={`${field} mt-3`} rows={2} placeholder="What was discussed? Next action…" value={fu.notes} onChange={(e) => setFu({ ...fu, notes: e.target.value })} disabled={!canEdit}/>
        <div className="mt-3 grid grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Follow-up Done On
            </label>
            <input
              type="date"
              className={field}
              value={fu.date}
              onChange={(e) => setFu({ ...fu, date: e.target.value })}
              disabled={!canEdit}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Next Follow-up Date
            </label>
            <input
              type="date"
              value={fu.nextDate}
              onChange={(e) => setFu({ ...fu, nextDate: e.target.value })}
              className={field}
              disabled={!canEdit}
            />
          </div>

          <button
            onClick={logFollowup}
            disabled={busy || !canEdit}
            className="h-10 rounded-lg bg-amber-500 px-4 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
          >
            Log ✓
          </button>
        </div>
      </section>

      {/* footer */}
      {err && <p className="text-sm text-rose-600">Save failed: {err}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={save} disabled={busy || !canEdit} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {saved ? <><Check className="h-4 w-4" /> Saved</> : <><Save className="h-4 w-4" /> Save Changes</>}
        </button>
        <button onClick={goBackToLeads} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600">Close</button>
        {canDelete && (<button onClick={del} disabled={busy} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"><Trash2 className="h-4 w-4" /> Delete Lead</button>)}
      </div>
    </div>
  )
}
