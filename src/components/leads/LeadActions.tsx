'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, Check } from 'lucide-react'
import { createClient } from '@/lib/api/client'
import type { Enum } from '@/lib/database.types'

const STATUSES: Enum<'lead_status'>[] = ['new', 'contacted', 'interested', 'demo_scheduled', 'aptitude_shared', 'passed', 'enrolled', 'no_response', 'irrelevant', 'not_interested', 'lost']

// An UPDATE the row-level security policy filters out matches nothing and
// comes back without an error, so "no rows changed" is the only signal that
// the write was refused rather than applied. A BD may only write leads
// assigned to them, so this fires on someone else's lead.
const BLOCKED = 'Not saved — this lead is assigned to someone else.'

export function LeadActions({
  lead,
}: {
  lead: { id: string; status: string; name: string; mobile: string | null; email: string | null; course_interest: string | null }
}) {
  const router = useRouter()
  const supabase = createClient()
  const [status, setStatus] = useState(lead.status)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [converted, setConverted] = useState(lead.status === 'enrolled')

  async function changeStatus(next: Enum<'lead_status'>) {
    setBusy(true)
    setErr(null)
    // The dropdown used to move before the write was attempted, so a refused
    // change looked applied until the refresh silently put it back. Move it
    // only once the database confirms the row actually changed.
    const { data, error } = await supabase
      .from('leads')
      .update({ status: next })
      .eq('id', lead.id)
      .select('id')
    setBusy(false)
    if (error) { setErr(error.message); return }
    if (!data?.length) { setErr(BLOCKED); return }
    setStatus(next)
    router.refresh()
  }

  async function convert() {
    if (busy || converted) return
    setBusy(true)
    setErr(null)
    const { error } = await supabase.from('students').insert({
      full_name: lead.name,
      mobile: lead.mobile,
      email: lead.email,
      primary_course: lead.course_interest,
      source_lead: lead.id,
    })
    if (error) { setBusy(false); setErr(error.message); return }

    // Any BD may create the student, but only the lead's owner may mark it
    // enrolled. Left unchecked, converting someone else's lead created the
    // student and quietly left the lead unconverted.
    const { data, error: leadErr } = await supabase
      .from('leads')
      .update({ status: 'enrolled' })
      .eq('id', lead.id)
      .select('id')
    setBusy(false)
    if (leadErr || !data?.length) {
      setErr('Student created, but this lead could not be marked enrolled — it is assigned to someone else.')
      router.refresh()
      return
    }
    setConverted(true)
    setStatus('enrolled')
    router.refresh()
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <select
          value={status}
          onChange={(e) => changeStatus(e.target.value as Enum<'lead_status'>)}
          disabled={busy}
          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-blue-300"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>
        {converted ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-600">
            <Check className="h-3.5 w-3.5" /> Student
          </span>
        ) : (
          <button
            onClick={convert}
            disabled={busy}
            title="Convert to student"
            className="inline-flex items-center gap-1 rounded-md border border-blue-200 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50"
          >
            <UserPlus className="h-3.5 w-3.5" /> Convert
          </button>
        )}
      </div>
      {err && <p className="text-[11px] leading-tight text-rose-600">{err}</p>}
    </div>
  )
}
