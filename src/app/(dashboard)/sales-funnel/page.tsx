import { redirect } from 'next/navigation'
import { createClient } from '@/lib/api/server'
import type { Role } from '@/lib/rbac'

const inr = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN')

export default async function SalesFunnelPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  const role = ((me as any)?.role ?? 'student') as Role
  if (role !== 'admin' && role !== 'super_admin') redirect('/dashboard')

  const { data: stats } = await supabase.rpc('lead_stats', { p_bd: null })
  const byStatus: Record<string, number> = (stats as any)?.by_status ?? {}
  const byBd: Record<string, number> = (stats as any)?.by_bd ?? {}
  const total = (stats as any)?.total ?? 0

  const [calledRes, hotRes, aptRes, revRes, profilesRes, revRows] = await Promise.all([
    supabase.from('leads').select('*', { count: 'exact', head: true }).is('deleted_at', null).gt('fu_count', 0),
    supabase.from('leads').select('*', { count: 'exact', head: true }).is('deleted_at', null).ilike('temperature', '%hot%'),
    supabase.from('aptitude').select('*', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('revenue').select('*', { count: 'exact', head: true }).is('deleted_at', null).eq('status', 'Received'),
    supabase.from('profiles').select('id, full_name'),
    supabase.from('revenue').select('bd, amt, status').is('deleted_at', null),
  ])

  const called = calledRes.count ?? 0
  const connected = total - (byStatus['new'] ?? 0)
  const hot = hotRes.count ?? 0
  const aptitude = aptRes.count ?? 0
  const enrolled = byStatus['enrolled'] ?? 0
  const revenueCount = revRes.count ?? 0
  const lost = byStatus['lost'] ?? 0

  const funnel = [
    { label: 'Total Leads', value: total },
    { label: 'Called', value: called },
    { label: 'Connected', value: connected },
    { label: 'Hot', value: hot },
    { label: 'Aptitude', value: aptitude },
    { label: 'Enrolled', value: enrolled },
    { label: 'Revenue', value: revenueCount },
  ]
  const fmax = Math.max(1, ...funnel.map((f) => f.value))

  // BD comparison: leads (from by_bd uuid->count) + revenue by name
  const nameById: Record<string, string> = {}
  for (const p of profilesRes.data ?? []) nameById[(p as any).id] = (p as any).full_name
  const revByBd: Record<string, number> = {}
  for (const r of revRows.data ?? []) { if ((r as any).status === 'Received') { const k = (r as any).bd || '—'; revByBd[k] = (revByBd[k] ?? 0) + Number((r as any).amt || 0) } }
  const bdRows = Object.entries(byBd).map(([id, leads]) => {
    const name = id === 'none' ? 'Unassigned' : (nameById[id] ?? id.slice(0, 8))
    return { name, leads, revenue: revByBd[name] ?? 0 }
  }).sort((a, b) => b.revenue - a.revenue)
  const topBd = bdRows[0]
  const lowBd = bdRows.length > 1 ? bdRows[bdRows.length - 1] : null

  return (
    <div className="space-y-5">
      <div><h1 className="text-xl font-semibold text-slate-900">Sales Funnel</h1><p className="text-sm text-slate-500">Lead → revenue conversion</p></div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="space-y-2">
          {funnel.map((f, i) => {
            const pct = total ? Math.round((f.value / total) * 100) : 0
            return (
              <div key={f.label} className="flex items-center gap-3">
                <div className="w-28 shrink-0 text-sm text-slate-600">{f.label}</div>
                <div className="h-7 flex-1 overflow-hidden rounded-md bg-slate-100">
                  <div className="flex h-full items-center justify-end rounded-md bg-gradient-to-r from-blue-500 to-blue-400 pr-2 text-xs font-medium text-white" style={{ width: `${Math.max(6, Math.round((f.value / fmax) * 100))}%` }}>{f.value.toLocaleString('en-IN')}</div>
                </div>
                <div className="w-12 shrink-0 text-right text-xs text-slate-400">{pct}%</div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="text-xs text-slate-500">Top BD (revenue)</div><div className="mt-1 text-lg font-semibold text-slate-900">{topBd?.name ?? '—'}</div><div className="text-sm text-emerald-600">{inr(topBd?.revenue ?? 0)}</div></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="text-xs text-slate-500">Needs Attention</div><div className="mt-1 text-lg font-semibold text-slate-900">{lowBd?.name ?? '—'}</div><div className="text-sm text-amber-600">{lowBd ? inr(lowBd.revenue) : '—'}</div></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="text-xs text-slate-500">Leads Lost</div><div className="mt-1 text-lg font-semibold text-slate-900">{lost.toLocaleString('en-IN')}</div><div className="text-sm text-slate-400">{total ? Math.round((lost / total) * 100) : 0}% of total</div></div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-800">BD Comparison</div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="px-4 py-3 font-medium">BD</th><th className="px-4 py-3 font-medium">Leads</th><th className="px-4 py-3 font-medium">Revenue Collected</th></tr></thead>
          <tbody>
            {bdRows.map((b) => (
              <tr key={b.name} className="border-t border-slate-100">
                <td className="px-4 py-2.5 font-medium text-slate-800">{b.name}</td>
                <td className="px-4 py-2.5 text-slate-600">{b.leads.toLocaleString('en-IN')}</td>
                <td className="px-4 py-2.5 text-slate-700">{inr(b.revenue)}</td>
              </tr>
            ))}
            {!bdRows.length && <tr><td colSpan={3} className="px-4 py-6 text-center text-slate-400">No data.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
