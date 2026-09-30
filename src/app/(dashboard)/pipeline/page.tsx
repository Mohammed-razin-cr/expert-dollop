import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/api/server'
import type { Role } from '@/lib/rbac'

const STAGES = [
  { key: 'new', label: 'New Lead', color: 'bg-slate-400' },
  { key: 'contacted', label: 'Contacted', color: 'bg-blue-500' },
  { key: 'interested', label: 'Interested', color: 'bg-amber-500' },
  { key: 'demo_scheduled', label: 'Demo Scheduled', color: 'bg-violet-500' },
  { key: 'aptitude_shared', label: 'Aptitude', color: 'bg-purple-500' },
  { key: 'passed', label: 'Passed', color: 'bg-cyan-500' },
  { key: 'enrolled', label: 'Enrolled', color: 'bg-emerald-500' },
  { key: 'lost', label: 'Lost', color: 'bg-rose-400' },
]

export default async function PipelinePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: me } = await supabase.from('profiles').select('role, full_name').eq('id', user!.id).single()
  const role = ((me as any)?.role ?? 'student') as Role
  // Pipeline is an admin view. A BD works their funnel from Leads and
  // Follow-ups, so the page is not part of the BD module.
  if (role === 'bd' || role === 'counsellor') redirect('/dashboard')

  const { data: stats } = await supabase.rpc('lead_stats', { p_bd: null })
  const byStatus: Record<string, number> = (stats as any)?.by_status ?? {}
  const total = (stats as any)?.total ?? 0
  const max = Math.max(1, ...STAGES.map((s) => byStatus[s.key] ?? 0))

  const hotQ = supabase.from('leads').select('id, name, mobile, source, status, temperature, fu_count, updated_at')
    .is('deleted_at', null).ilike('temperature', '%hot%').order('updated_at', { ascending: false }).limit(8)
  const { data: hot = [] } = await hotQ

  return (
    <div className="space-y-5">
      <div><h1 className="text-xl font-semibold text-slate-900">Recruitment Pipeline</h1><p className="text-sm text-slate-500">{total.toLocaleString('en-IN')} leads across the funnel</p></div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="space-y-3">
          {STAGES.map((s) => {
            const c = byStatus[s.key] ?? 0
            const pct = total ? Math.round((c / total) * 100) : 0
            return (
              <div key={s.key} className="flex items-center gap-3">
                <div className="w-32 shrink-0 text-sm text-slate-600">{s.label}</div>
                <div className="h-6 flex-1 overflow-hidden rounded-md bg-slate-100">
                  <div className={`h-full ${s.color}`} style={{ width: `${Math.round(((c) / max) * 100)}%` }} />
                </div>
                <div className="w-24 shrink-0 text-right text-sm"><span className="font-semibold text-slate-800">{c.toLocaleString('en-IN')}</span> <span className="text-xs text-slate-400">{pct}%</span></div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-800">🔥 Hot Leads</div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500"><tr>
            <th className="px-4 py-3 font-medium">Name</th><th className="px-4 py-3 font-medium">Phone</th><th className="px-4 py-3 font-medium">Source</th><th className="px-4 py-3 font-medium">Stage</th><th className="px-4 py-3 font-medium">FU#</th><th className="px-4 py-3 font-medium"></th>
          </tr></thead>
          <tbody>
            {(hot ?? []).map((l: any) => (
              <tr key={l.id} className="border-t border-slate-100">
                <td className="px-4 py-2.5 font-medium text-slate-800">{l.name}</td>
                <td className="px-4 py-2.5 text-slate-600">{l.mobile ?? '—'}</td>
                <td className="px-4 py-2.5 text-slate-600">{l.source ?? '—'}</td>
                <td className="px-4 py-2.5 text-slate-500">{(l.status ?? '').replace('_', ' ')}</td>
                <td className="px-4 py-2.5 text-slate-600">{l.fu_count ?? 0}</td>
                <td className="px-4 py-2.5"><Link href={`/leads/${l.id}`} className="text-xs font-medium text-blue-600 hover:underline">View →</Link></td>
              </tr>
            ))}
            {!(hot ?? []).length && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">No hot leads right now.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
