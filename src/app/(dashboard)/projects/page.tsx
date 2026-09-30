import Link from 'next/link'
import { createClient } from '@/lib/api/server'
import { ProjectDeleteRequestsPanel } from '@/components/projects/ProjectRowActions'
import { ProjectRows, type ProjectRow } from '@/components/projects/ProjectRows'
import { DateRangeFilter } from '@/components/shared/DateRangeFilter'
import { LiveSearchInput } from '@/components/shared/LiveSearchInput'
import { LiveSelect } from '@/components/shared/LiveSelect'
import { type Role, BD_ROLES } from '@/lib/rbac'

// The chip colours moved to ProjectRows, which now renders the status.
const STATUSES = ['new', 'in_discussion', 'project_ordered', 'in_progress', 'delivered', 'declined']
// Mirrors the RESPONSES vocabulary in ProjectDetail/AddProjectForm/ProjectRows.
const RESPONSES = ['Interested', 'Not Interested', 'No Response', 'Will Call Back', 'Irrelevant']
const PAGE_SIZE = 50

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; bd?: string; response?: string; from?: string; to?: string; temp?: string; page?: string }>
}) {
  const sp = await searchParams
  const q = (sp.q ?? '').trim()
  const status = sp.status ?? ''
  const bd = sp.bd ?? ''
  const response = sp.response ?? ''
  const temp = ['hot', 'warm', 'cold'].includes(sp.temp ?? '') ? sp.temp! : ''
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)
  const rangeFrom = (page - 1) * PAGE_SIZE
  // No date means all time, same as the Leads page — the dashboard's own
  // "default to This Month" behaviour doesn't apply here.
  const dRe = /^\d{4}-\d{2}-\d{2}$/
  const dFrom = sp.from && dRe.test(sp.from) ? sp.from : ''
  const dTo = sp.to && dRe.test(sp.to) ? sp.to : ''
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: me } = await supabase.from('profiles').select('role, full_name').eq('id', user!.id).single()
  const role = ((me as any)?.role ?? 'student') as Role
  const myName = (me as any)?.full_name ?? ''
  const isAdmin = role === 'admin' || role === 'super_admin'

  const { data: bds = [] } = await supabase.from('profiles').select('id, full_name').in('role', BD_ROLES).order('full_name')

  let query = supabase
    .from('projects')
    .select('id, entry_date, name, mobile, college, department, project_name, vendor_name, status, temperature, response, remarks, notes, created_at, updated_at, delete_requested, owner_id, owner:owner_id(full_name)', { count: 'exact' })
    .is('deleted_at', null)
    // Most recently touched project first, matching what the Updated column
    // shows — any edit (status, response, remarks, …) lifts that row back to
    // the top. `id` breaks ties: a bulk write (an import, one of the data
    // cleanups) stamps one updated_at across the whole batch, and without a
    // tiebreak the order inside it is left to the planner — so with
    // range()-based paging the same project could appear on two pages or on
    // none.
    .order('updated_at', { ascending: false })
    .order('id', { ascending: false })
    .range(rangeFrom, rangeFrom + PAGE_SIZE - 1)

  if (status) query = query.eq('status', status)
  if (bd) query = query.eq('owner_id', bd)
  if (response) query = query.eq('response', response)
  if (temp) query = query.ilike('temperature', `%${temp}%`)
  // The date filter is on updated_at, not created_at: picking a range
  // answers "what was touched in this window" (an edit, a status change, a
  // fresh entry — updated_at starts out equal to created_at on insert, so a
  // brand-new project is "touched" too), not "what was first entered in
  // this window". "Added today" below is the one place that specifically
  // means creation date.
  if (dFrom) query = query.gte('updated_at', dFrom)
  if (dTo) query = query.lte('updated_at', dTo + 'T23:59:59')
  if (q) {
    const safe = q.replace(/[,%]/g, ' ')
    query = query.or(`name.ilike.%${safe}%,mobile.ilike.%${safe}%,project_name.ilike.%${safe}%`)
  }

  // Shared by every KPI count below — bd and the date range, but not status,
  // temperature or search, so the cards report the same totals regardless of
  // which slice of the table the list itself is currently showing.
  const baseFilters = (x: any) => {
    x = x.is('deleted_at', null)
    if (bd) x = x.eq('owner_id', bd)
    return x
  }
  // Same bd + date-range scope as base(), but selecting real columns instead
  // of a head:true count — for KPIs that need to filter client-side.
  const baseData = (cols: string) => {
    let x = baseFilters(supabase.from('projects').select(cols))
    if (dFrom) x = x.gte('updated_at', dFrom)
    if (dTo) x = x.lte('updated_at', dTo + 'T23:59:59')
    return x
  }
  const base = () => {
    let x = baseFilters(supabase.from('projects').select('*', { count: 'exact', head: true }))
    if (dFrom) x = x.gte('updated_at', dFrom)
    if (dTo) x = x.lte('updated_at', dTo + 'T23:59:59')
    return x
  }
  const cnt = (build: (x: any) => any) => build(base()).then((r: any) => r.count ?? 0)

  // "Added today" always means the calendar day, regardless of whatever date
  // range is picked above — it must not go through base(), or a selected
  // range that doesn't include today silently reads 0.
  const todayStr = new Date().toISOString().slice(0, 10)
  const cntToday = () =>
    baseFilters(supabase.from('projects').select('*', { count: 'exact', head: true }))
      .gte('created_at', todayStr)
      .then((r: any) => r.count ?? 0)

  // "Updated" — scoped to the same view as Total (bd + date range), so it
  // can never read higher than Total: it answers "of the projects shown,
  // how many did someone touch", not "anywhere in the table". The window it
  // checks updated_at against follows the picked date range when one is
  // set, and falls back to today otherwise — same as the Leads page's
  // activity row. A row's updated_at starts out equal to its created_at, so
  // a freshly-imported project counts as "added" but not as "updated";
  // only rows an edit actually moved forward count here.
  const hasRange = !!(dFrom || dTo)
  const actFrom = (dFrom || todayStr) + 'T00:00:00'
  const actTo = dTo ? dTo + 'T23:59:59' : hasRange ? null : todayStr + 'T23:59:59'
  const actLabel = hasRange ? 'In selected range' : 'Today'
  const TOUCH_EPSILON_MS = 1000
  const cntUpdatedToday = (tempFilter?: string) => {
    let x = baseData(tempFilter ? 'created_at, updated_at, temperature' : 'created_at, updated_at')
    if (tempFilter) x = x.ilike('temperature', `%${tempFilter}%`)
    x = x.gte('updated_at', actFrom)
    if (actTo) x = x.lte('updated_at', actTo)
    return x
      .then((r: any) =>
        ((r.data ?? []) as { created_at: string; updated_at: string }[]).filter(
          (row) => new Date(row.updated_at).getTime() - new Date(row.created_at).getTime() > TOUCH_EPSILON_MS,
        ).length,
      )
  }

  const [{ data: rows = [], count = 0 }, totalC, hotC, warmC, coldC, todayC, updatedTodayC, hotActC, warmActC, coldActC] = await Promise.all([
    query,
    cnt((x) => x),
    cnt((x) => x.ilike('temperature', '%hot%')),
    cnt((x) => x.ilike('temperature', '%warm%')),
    cnt((x) => x.ilike('temperature', '%cold%')),
    cntToday(),
    cntUpdatedToday(),
    cntUpdatedToday('hot'),
    cntUpdatedToday('warm'),
    cntUpdatedToday('cold'),
  ])
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE))
  const one = (x: any) => (Array.isArray(x) ? x[0] : x)
  // Carries every current filter forward onto a KPI-card link, overridden by
  // whatever the card itself sets (e.g. a temperature card clears status).
  const mk = (extra: Record<string, string | number>) => {
    const p = new URLSearchParams()
    if (q) p.set('q', q)
    if (status) p.set('status', status)
    if (bd) p.set('bd', bd)
    if (response) p.set('response', response)
    if (temp) p.set('temp', temp)
    if (dFrom) p.set('from', dFrom)
    if (dTo) p.set('to', dTo)
    // Every card and filter link below goes through this, so switching any
    // of them lands back on page 1 instead of keeping an out-of-range page
    // from the previous filter.
    Object.entries(extra).forEach(([k, v]) => (v || v === 0 ? p.set(k, String(v)) : p.delete(k)))
    return `/projects?${p.toString()}`
  }
  // DateRangeFilter replaces from/to wholesale on top of this, so the other
  // filters it should preserve have to be baked into the base href itself.
  const dateBaseHref = (() => {
    const p = new URLSearchParams()
    if (status) p.set('status', status)
    if (bd) p.set('bd', bd)
    if (response) p.set('response', response)
    if (temp) p.set('temp', temp)
    const qs = p.toString()
    return qs ? `/projects?${qs}` : '/projects'
  })()

  // The rows are handed to a client component so a status chip can open the
  // reason under its row, which means flattening the owner join first.
  const items: ProjectRow[] = (rows ?? []).map((r: any) => ({
    id: r.id,
    date: r.updated_at || r.entry_date || r.created_at || null,
    name: r.name,
    mobile: r.mobile ?? null,
    college: r.college ?? null,
    department: r.department ?? null,
    project_name: r.project_name ?? null,
    vendor_name: r.vendor_name ?? null,
    owner_id: r.owner_id ?? null,
    owner_name: one(r.owner)?.full_name ?? null,
    status: r.status ?? '',
    temperature: r.temperature ?? null,
    delete_requested: !!r.delete_requested,
    response: r.response ?? null,
    remarks: r.remarks ?? null,
    notes: r.notes ?? null,
  }))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Projects</h1>
          <p className="text-sm text-slate-500">{(count ?? 0).toLocaleString('en-IN')} in this view</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Keyed on the values themselves: DateRangeFilter holds its own
              input state via useState(from), which only runs once — a soft
              navigation that changes dFrom/dTo (a KPI card, a filter) would
              otherwise leave the boxes showing whatever they had at first
              mount instead of the range actually in effect. */}
          <DateRangeFilter key={`${dFrom}-${dTo}`} from={dFrom} to={dTo} baseHref={dateBaseHref} />
          {isAdmin && <ProjectDeleteRequestsPanel />}
          <Link href="/projects/new" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            + Add Project
          </Link>
        </div>
      </div>

      {/* Each number is a shortcut for the matching temperature, applied on top
          of whatever filters (date range, BD, search) are already active —
          clicking Hot while a BD is selected shows that BD's hot projects,
          not every hot project. */}
      <div className="flex flex-wrap gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
        <Link href={mk({ temp: '' })} className="text-slate-500 hover:text-slate-700">Total <b className="text-slate-800">{totalC.toLocaleString('en-IN')}</b></Link>
        <Link href={mk({ temp: 'hot' })} className="text-slate-500 hover:text-slate-700">🔥 Hot <b className="text-rose-500">{hotC}</b></Link>
        <Link href={mk({ temp: 'warm' })} className="text-slate-500 hover:text-slate-700">🌡 Warm <b className="text-amber-500">{warmC}</b></Link>
        <Link href={mk({ temp: 'cold' })} className="text-slate-500 hover:text-slate-700">❄ Cold <b className="text-sky-500">{coldC}</b></Link>
        <Link href={mk({ from: todayStr, to: todayStr })} className="text-slate-500 hover:text-slate-700">Added today <b className="text-slate-800">{todayC}</b></Link>
      </div>

      {/* Second row answers "of the projects in the view above, how many did
          someone actually touch today" — same population as Total (bd +
          date range), just intersected with updated_at instead of
          created_at, so it can never outrun Total the way an unscoped
          all-rows-ever count would. */}
      <div className="flex flex-wrap gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
        <span className="mr-1 text-xs font-medium uppercase tracking-wide text-slate-400">{actLabel}</span>
        <Link href={mk({ temp: '' })} className="text-slate-500 hover:text-slate-700">Updated <b className="text-amber-600">{updatedTodayC}</b></Link>
        <Link href={mk({ temp: 'hot' })} className="text-slate-500 hover:text-slate-700">🔥 Hot <b className="text-rose-500">{hotActC}</b></Link>
        <Link href={mk({ temp: 'warm' })} className="text-slate-500 hover:text-slate-700">🌡 Warm <b className="text-amber-500">{warmActC}</b></Link>
        <Link href={mk({ temp: 'cold' })} className="text-slate-500 hover:text-slate-700">❄ Cold <b className="text-sky-500">{coldActC}</b></Link>
      </div>

      {/* Every control here applies itself: the term as you type, a status or a
          BD the moment it is picked. The Search button went with the form —
          each control now edits its own param on the current URL. */}
      <div className="flex gap-2">
        <LiveSearchInput
          value={q}
          placeholder="Search by name, mobile or project…"
          className="w-full max-w-sm rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300"
        />
        <LiveSelect name="status" value={status} className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300">
          <option value="">All Statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s.replaceAll('_', ' ')}</option>
          ))}
        </LiveSelect>
        <LiveSelect name="bd" value={bd} className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300">
          <option value="">All BDs</option>
          {(bds ?? []).map((b: any) => (
            <option key={b.id} value={b.id}>{b.full_name}</option>
          ))}
        </LiveSelect>
        <LiveSelect name="response" value={response} className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300">
          <option value="">All Responses</option>
          {RESPONSES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </LiveSelect>
        {(q || status || bd || response || temp) && <Link href="/projects" className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600">Clear</Link>}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Updated</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Mobile</th>
              <th className="px-4 py-3 font-medium">College</th>
              <th className="px-4 py-3 font-medium">Department</th>
              <th className="px-4 py-3 font-medium">Project</th>
              <th className="px-4 py-3 font-medium">Vendor</th>
              <th className="px-4 py-3 font-medium">BD</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Temp</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            <ProjectRows rows={items} role={role} myName={myName} currentUserId={user!.id} />
            {!items.length && (
              <tr><td colSpan={11} className="px-4 py-6 text-center text-slate-400">No projects yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-500">Page {page} of {totalPages}</span>
        <div className="flex gap-2">
          {page > 1 && <Link href={mk({ page: page - 1 })} className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-600">Previous</Link>}
          {page < totalPages && <Link href={mk({ page: page + 1 })} className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-600">Next</Link>}
        </div>
      </div>
    </div>
  )
}
