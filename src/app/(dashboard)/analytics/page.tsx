import { createClient } from '@/lib/api/server'
import { AnalyticsCharts } from '@/components/analytics/AnalyticsCharts'

const SRC_LABEL: Record<string, string> = { just_dial: 'Just Dial', website: 'Website', college: 'College', referral: 'Referral', social_media: 'Social', walk_in: 'Walk-in', skillfinity: 'Skillfinity' }

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const [{ data: stats }, { data: students = [] }, { data: rev = [] }, { data: profiles = [] }, { data: leadDates = [] }] = await Promise.all([
    supabase.rpc('lead_stats', { p_bd: null }),
    supabase.from('students').select('track').is('deleted_at', null).limit(5000),
    supabase.from('revenue').select('bd, amt, status').is('deleted_at', null),
    supabase.from('profiles').select('id, full_name'),
    supabase.from('leads').select('created_at').is('deleted_at', null).limit(5000),
  ])

  const bySource: Record<string, number> = (stats as any)?.by_source ?? {}
  const byBd: Record<string, number> = (stats as any)?.by_bd ?? {}
  const nameById: Record<string, string> = {}
  for (const p of profiles ?? []) nameById[(p as any).id] = (p as any).full_name

  const source = Object.entries(bySource).map(([k, v]) => ({ name: SRC_LABEL[k] ?? k, value: v as number }))

  const trackCounts: Record<string, number> = {}
  for (const s of students ?? []) { const t = (s as any).track || 'Unassigned'; trackCounts[t] = (trackCounts[t] ?? 0) + 1 }
  const track = Object.entries(trackCounts).map(([name, value]) => ({ name, value }))

  const revByBd: Record<string, number> = {}
  for (const r of rev ?? []) if ((r as any).status === 'Received') { const k = (r as any).bd || '—'; revByBd[k] = (revByBd[k] ?? 0) + Number((r as any).amt || 0) }
  const revBd = Object.entries(revByBd).map(([name, value]) => ({ name, value }))

  const leadBd = Object.entries(byBd).map(([id, v]) => ({ name: id === 'none' ? 'Unassigned' : (nameById[id] ?? id.slice(0, 6)), value: v as number }))

  const monthCounts: Record<string, number> = {}
  for (const l of leadDates ?? []) { const m = String((l as any).created_at ?? '').slice(0, 7); if (m) monthCounts[m] = (monthCounts[m] ?? 0) + 1 }
  const trend = Object.entries(monthCounts).sort().slice(-6).map(([month, value]) => ({ month, value }))

  return (
    <div className="space-y-5">
      <div><h1 className="text-xl font-semibold text-slate-900">Analytics</h1><p className="text-sm text-slate-500">Source · track · BD · trends</p></div>
      <AnalyticsCharts source={source} track={track} revBd={revBd} leadBd={leadBd} trend={trend} />
    </div>
  )
}
