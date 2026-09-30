import Link from 'next/link'
import { createClient } from '@/lib/api/server'
import { DateRangeFilter } from '@/components/shared/DateRangeFilter'
import { LiveSearchInput } from '@/components/shared/LiveSearchInput'
import type { Role } from '@/lib/rbac'

const PAGE_SIZE = 50
const pad = (n: number) => String(n).padStart(2, '0')
const META: Record<string, string> = {
  new: 'bg-blue-50 text-blue-600', contacted: 'bg-amber-50 text-amber-600',
  interested: 'bg-emerald-50 text-emerald-600', demo_scheduled: 'bg-violet-50 text-violet-600',
  aptitude_shared: 'bg-cyan-50 text-cyan-600', passed: 'bg-green-50 text-green-600',
  enrolled: 'bg-blue-50 text-blue-600', no_response: 'bg-slate-100 text-slate-500',
  irrelevant: 'bg-slate-100 text-slate-400', not_interested: 'bg-rose-50 text-rose-500', lost: 'bg-slate-100 text-slate-500',
}
// TAT bands: ✅ 0–2d, ⚠️ 2–5d, 🔴 >5d
function tatBadge(days: number) {
  if (days <= 2) return { cls: 'bg-emerald-50 text-emerald-600', icon: '✅' }
  if (days <= 5) return { cls: 'bg-amber-50 text-amber-600', icon: '⚠️' }
  return { cls: 'bg-rose-50 text-rose-600', icon: '🔴' }
}

export default async function FollowupsPage({ searchParams }: { searchParams: Promise<{ filter?: string; page?: string; from?: string; to?: string; q?: string }> }) {
  const sp = await searchParams
  const filter = ['overdue', 'today', 'upcoming', 'all'].includes(sp.filter ?? '') ? sp.filter! : 'overdue'
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)
  const from = (page - 1) * PAGE_SIZE
  const dRe = /^\d{4}-\d{2}-\d{2}$/
  const dFrom = sp.from && dRe.test(sp.from) ? sp.from : ''
  const dTo = sp.to && dRe.test(sp.to) ? sp.to : ''
  // PostgREST splits an `or` filter on commas, and treats % as a wildcard,
  // so both are stripped before the term reaches the query.
  const term = (sp.q ?? '').trim()
  const safeTerm = term.replace(/[,%]/g, ' ')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  const role = (profile?.role ?? 'student') as Role
  // Counsellor is BD-equivalent — scoped to their own follow-ups too.
  const isBD = role === 'bd' || role === 'counsellor'

  const today = new Date()
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
  const startTomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString()

  const isAll = filter === 'all'

  const cols = 'id, name, mobile, status, next_followup_at, created_at, fu_count'
  let rows: any[] = []
  let count = 0

  if (isAll) {
    // "All" means every lead that has actually been followed up. It used to
    // mean "has a next_followup_at", which is a diary of what is still to
    // do — a field the sheet import never sets, because the sheet records
    // calls made rather than calls planned. So a BD could import hundreds
    // of calls and this page would stay empty.
    //
    // fu_count is kept in step with the followups table by a trigger, so
    // this needs no join.
    let q = supabase
      .from('leads')
      .select(cols, { count: 'exact' })
      .is('deleted_at', null)
      .gt('fu_count', 0)
      .order('updated_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)
    if (isBD) q = q.eq('assigned_bd', user!.id)
    if (term) q = q.or(`name.ilike.%${safeTerm}%,mobile.ilike.%${safeTerm}%`)
    if (dFrom) q = q.gte('created_at', dFrom)
    if (dTo) q = q.lte('created_at', dTo + 'T23:59:59')
    const res = await q
    rows = res.data ?? []
    count = res.count ?? 0
  } else {
    let q = supabase
      .from('leads')
      .select(cols, { count: 'exact' })
      // Soft-deleted leads were never excluded here, so a lead deleted
      // weeks ago kept showing on this page and nowhere else in the app.
      .is('deleted_at', null)
      .not('next_followup_at', 'is', null)
      .order('next_followup_at', { ascending: filter !== 'overdue' })
      .range(from, from + PAGE_SIZE - 1)
    if (isBD) q = q.eq('assigned_bd', user!.id)
    if (filter === 'overdue') q = q.lt('next_followup_at', startToday)
    else if (filter === 'today') q = q.gte('next_followup_at', startToday).lt('next_followup_at', startTomorrow)
    else if (filter === 'upcoming') q = q.gte('next_followup_at', startTomorrow)
    if (term) q = q.or(`name.ilike.%${safeTerm}%,mobile.ilike.%${safeTerm}%`)
    if (dFrom) q = q.gte('next_followup_at', dFrom)
    if (dTo) q = q.lte('next_followup_at', dTo + 'T23:59:59')
    const res = await q
    rows = res.data ?? []
    count = res.count ?? 0
  }

  // Most recent call for the leads on this page — one extra query for the
  // 50 rows on screen rather than a join, so the table can show what was
  // actually said last rather than only how many times they were rung.
  const lastCall = new Map<string, { at: string; outcome: string }>()
  if (rows.length) {
    const { data: fus = [] } = await supabase
      .from('followups')
      .select('lead_id, scheduled_at, outcome')
      .in('lead_id', rows.map((l: any) => l.id))
      .is('deleted_at', null)
      .order('scheduled_at', { ascending: false })
    for (const f of (fus ?? []) as any[]) {
      if (!lastCall.has(f.lead_id)) lastCall.set(f.lead_id, { at: f.scheduled_at, outcome: f.outcome })
    }
  }

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE))

  const tabs = [
    { key: 'overdue', label: 'Overdue' }, { key: 'today', label: 'Today' },
    { key: 'upcoming', label: 'Upcoming' }, { key: 'all', label: 'All' },
  ]
  const qs = `${term ? `&q=${encodeURIComponent(term)}` : ''}`
  const baseHref = `/followups?filter=${filter}${qs}`
  const link = (p: number) => `${baseHref}${dFrom ? `&from=${dFrom}` : ''}${dTo ? `&to=${dTo}` : ''}&page=${p}`
  const now = Date.now()

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Follow-ups</h1>
          <p className="text-sm text-slate-500">
            {isAll
              ? `${(count ?? 0).toLocaleString('en-IN')} lead${count === 1 ? '' : 's'} followed up`
              : `${(count ?? 0).toLocaleString('en-IN')} ${filter} follow-up${count === 1 ? '' : 's'}`}
            {dFrom || dTo ? ` · ${dFrom || '…'} to ${dTo || '…'}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Narrows as you type. The hidden filter/from/to fields that used to
              sit here are gone with the form: the term is now applied by
              rewriting `q` on the current URL, which carries the active tab and
              date range through untouched rather than re-submitting them. */}
          <div className="flex items-center gap-1">
            <LiveSearchInput
              value={term}
              placeholder="Search name / mobile…"
              className="w-56 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300"
            />
            {term && (
              <Link
                href={`/followups?filter=${filter}${dFrom ? `&from=${dFrom}` : ''}${dTo ? `&to=${dTo}` : ''}`}
                className="rounded-lg px-2 py-2 text-sm text-slate-500 hover:text-slate-700"
              >
                Clear
              </Link>
            )}
          </div>
          <DateRangeFilter from={dFrom} to={dTo} baseHref={baseHref} />
        </div>
      </div>

      <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1 text-sm w-fit">
        {tabs.map((t) => (
          <Link key={t.key} href={`/followups?filter=${t.key}${qs}${dFrom ? `&from=${dFrom}` : ''}${dTo ? `&to=${dTo}` : ''}`}
            className={`rounded-md px-3 py-1.5 font-medium ${filter === t.key ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
            {t.label}
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Mobile</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Start Date</th>
              <th className="px-4 py-3 font-medium">Follow-up date</th>
              <th className="px-4 py-3 font-medium">Last call</th>
              <th className="px-4 py-3 font-medium">TAT (days open)</th>
              <th className="px-4 py-3 font-medium">Touches</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((l: any) => {
              const days = l.created_at ? Math.max(0, Math.floor((now - new Date(l.created_at).getTime()) / 86400000)) : 0
              const t = tatBadge(days)
              return (
                <tr key={l.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 font-medium"><Link href={`/leads/${l.id}`} className="text-blue-600 hover:underline">{l.name}</Link></td>
                  <td className="px-4 py-2.5 text-slate-600">{l.mobile ?? '—'}</td>
                  <td className="px-4 py-2.5"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${META[l.status] ?? ''}`}>{(l.status ?? '').replaceAll('_', ' ')}</span></td>
                  <td className="px-4 py-2.5 text-slate-600">{l.created_at ? new Date(l.created_at).toLocaleDateString('en-IN', {day: '2-digit',month: 'short',year: 'numeric',}): '—'}</td>
                  <td className="px-4 py-2.5 text-slate-600">{l.next_followup_at? new Date(l.next_followup_at).toLocaleDateString('en-IN', {day: '2-digit',month: 'short',year: 'numeric',}): '—'}</td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {lastCall.get(l.id)
                      ? <span title={lastCall.get(l.id)!.outcome ?? ''}>
                          {new Date(lastCall.get(l.id)!.at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                          <span className="ml-1 text-slate-400">{(lastCall.get(l.id)!.outcome ?? '').slice(0, 22)}</span>
                        </span>
                      : '—'}
                  </td>
                  <td className="px-4 py-2.5"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${t.cls}`}>{t.icon} {days}d</span></td>
                  <td className="px-4 py-2.5 text-slate-500">{l.fu_count ?? 0}</td>
                  <td className="px-4 py-2.5"><Link href={`/leads/${l.id}`} className="text-xs font-medium text-blue-600 hover:underline">Open →</Link></td>
                </tr>
              )
            })}
            {!(rows ?? []).length && (
              <tr><td colSpan={9} className="px-4 py-6 text-center text-slate-400">{isAll ? 'No leads have been followed up' : `No ${filter} follow-ups`}{dFrom || dTo ? ' in range' : ''}.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-500">Page {page} of {totalPages}</span>
        <div className="flex gap-2">
          {page > 1 && <Link href={link(page - 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-600">Previous</Link>}
          {page < totalPages && <Link href={link(page + 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-600">Next</Link>}
        </div>
      </div>
    </div>
  )
}
