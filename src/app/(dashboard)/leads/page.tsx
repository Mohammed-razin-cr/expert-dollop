import Link from 'next/link'
import { createClient } from '@/lib/api/server'
import { DateRangeFilter } from '@/components/shared/DateRangeFilter'
import { LeadRowActions, DeleteRequestsPanel } from '@/components/leads/LeadRowActions'
import { LiveSearchInput } from '@/components/shared/LiveSearchInput'
import { LiveSelect } from '@/components/shared/LiveSelect'
import { LeadRows } from '@/components/leads/LeadRows'
import { LeadsFilterMemory } from '@/components/leads/LeadsFilterMemory'
import type { Role } from '@/lib/rbac'
import { cached } from '@/lib/cache/cached'

const one = (x: any) => (Array.isArray(x) ? x[0] : x)
const PAGE_SIZE = 50

const VIEWS = [
  { key: 'all', label: 'All Leads' },
  { key: 'active', label: 'Active' },
  { key: 'hot', label: '🔥 Hot' },
  { key: 'warm', label: '🌡 Warm' },
  { key: 'cold', label: '❄ Cold' },
  { key: 'onboarded', label: 'Onboarded' },
  { key: 'lost', label: 'Inactive / Lost' },
]
const META: Record<string, string> = {
  new: 'bg-blue-50 text-blue-600', contacted: 'bg-amber-50 text-amber-600', interested: 'bg-emerald-50 text-emerald-600',
  demo_scheduled: 'bg-violet-50 text-violet-600', aptitude_shared: 'bg-cyan-50 text-cyan-600', passed: 'bg-green-50 text-green-600',
  enrolled: 'bg-blue-50 text-blue-600', no_response: 'bg-slate-100 text-slate-500', irrelevant: 'bg-slate-100 text-slate-400', not_interested: 'bg-rose-50 text-rose-500', lost: 'bg-slate-100 text-slate-500',
}
const tempCls = (t: string) => /hot/i.test(t) ? 'text-rose-500' : /warm/i.test(t) ? 'text-amber-500' : /cold/i.test(t) ? 'text-sky-500' : 'text-slate-400'

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{q?: string;page?: string;view?: string;from?: string;to?: string;status?: string;period?: string; assigned_bd?: string; course?: string; touched?: string; temp?: string; pending?: string;}>})
  {
  const sp = await searchParams
  const q = (sp.q ?? '').trim()
  // Opening /leads with no explicit view lands on All Leads — the dashboard
  // KPI cards that link here (the Total Leads card, Leads by Source panel)
  // don't set a view param either, so they inherit this default too. It
  // used to be "active", which silently hid enrolled/lost rows and made
  // the list undercount what those cards claimed.
  const view = VIEWS.some((v) => v.key === sp.view) ? sp.view! : 'all'
  // Clicking a number in the activity row (Contacted/Hot/Warm/Cold) drops
  // into this mode — it swaps the whole list from the normal created_at
  // view to the exact updated_at-windowed, touched-only set that row
  // counts, since the two were previously answering different questions
  // under the same date range with no way to see who the activity numbers
  // actually meant.
  const touched = sp.touched === '1'
  // Clicking Pending in the activity row: the list becomes the leads added
  // in that row's window that nobody has worked yet — see pendingList below.
  const pending = !touched && sp.pending === '1'
  const temp = sp.temp === 'hot' || sp.temp === 'warm' || sp.temp === 'cold' ? sp.temp : ''
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)
  const from = (page - 1) * PAGE_SIZE
  const dRe = /^\d{4}-\d{2}-\d{2}$/
  const dFrom = sp.from && dRe.test(sp.from) ? sp.from : ''
  const dTo = sp.to && dRe.test(sp.to) ? sp.to : ''
  const status = sp.status ?? ''
  const assignedBd = sp.assigned_bd ?? ''
  const period = sp.period ?? ''
  // Course-interest filter from the dashboard KPI cards: a course id, or a
  // keyword — "other" (any recorded course that isn't Skillfinity or
  // Internship, the admin dashboard's Other Courses card) or "noninternship"
  // (any recorded course that isn't the Internship, the BD dashboard's
  // Courses card). Anything else is ignored rather than passed to the query.
  const course = sp.course === 'other' || sp.course === 'noninternship' ? sp.course
    : sp.course && /^[0-9a-f-]{36}$/i.test(sp.course) ? sp.course : ''
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: me } = await supabase.from('profiles').select('role, full_name').eq('id', user!.id).single()
  const role = ((me as any)?.role ?? 'student') as Role
  const myName = (me as any)?.full_name ?? ''
  const isBD = role === 'bd' || role === 'counsellor'
  const isAdmin = role === 'admin' || role === 'super_admin'
  // Counsellor is BD-equivalent, so it appears in the BD filter and is
  // assignable as a lead owner alongside BDs. RLS on `profiles` means this
  // query's result depends on who's asking (a BD sees only their own row,
  // staff see the full roster) — cached per-user so caching can't change
  // what any given user actually sees, only how often it's re-fetched.
  const bds = await cached(`leads-page:bd-roster:${user!.id}`, 180, async () => {
    const { data } = await supabase.from('profiles').select('id, full_name').in('role', ['bd', 'counsellor']).order('full_name')
    return data ?? []
  })

  // The catalogue, for the course filter below and for the keyword
  // exclusions. It used to be fetched only when a keyword needed it; the
  // dropdown needs it every time, and it is a handful of rows. `courses`
  // RLS is a flat "any authenticated user" read, so unlike the roster above
  // this one is identical for everyone and safe to share across users.
  const allCourses = await cached('leads-page:course-catalog', 180, async () => {
    const { data } = await supabase
      .from('courses')
      .select('id, name')
      .is('deleted_at', null)
      .order('name')
    return data ?? []
  })

  // Matched by name, the same rule the dashboards use to build these links:
  // "other" excludes Skillfinity and Internship, "noninternship" excludes
  // only the Internship.
  let excludeIds: string[] = []
  if (course === 'other' || course === 'noninternship') {
    const re = course === 'other' ? /skillfinity|internship/i : /internship/i
    excludeIds = ((allCourses ?? []) as any[]).filter((c) => re.test(c.name)).map((c) => c.id)
  }

  // Shared by the list query and every KPI count below — everything except
  // the created_at date-range, which each caller applies on its own field
  // (the KPI-activity counts below need it on updated_at, not created_at).
  const baseFilters = (x: any) => {
    x = x.is('deleted_at', null)
    if (assignedBd) {
      x = x.eq('assigned_bd', assignedBd)
    }
    if (course === 'other' || course === 'noninternship') {
      x = x.not('course_interest', 'is', null)
      if (excludeIds.length) x = x.not('course_interest', 'in', `(${excludeIds.join(',')})`)
    } else if (course) {
      x = x.eq('course_interest', course)
    }
    return x
  }

  const base = () => {
    let x = baseFilters(supabase.from('leads').select(
    'id, name, mobile, status, temperature, delete_requested, course_interest, category, created_at, updated_at, enquiry_date, assigned_bd, remarks, next_followup_at, courses(name)',
    { count: 'exact' }
    ))
    // Deleting a lead is a soft delete — approving a request stamps
    // deleted_at rather than removing the row. This list never excluded
    // them, so an approved deletion still showed up here, to admins and
    // BDs alike, and looked like the delete had silently failed.

    // A picked range matches a lead with activity in the window either way —
    // created in it OR updated in it — so the list shows both newly-added
    // leads and ones worked during the range, not only those created then.
    // Wide sentinel bounds fill in the open side when only one end is set.
    if (dFrom || dTo) {
      const lo = dFrom || '1900-01-01'
      const hi = (dTo || '9999-12-31') + 'T23:59:59'
      x = x.or(`and(created_at.gte.${lo},created_at.lte.${hi}),and(updated_at.gte.${lo},updated_at.lte.${hi})`)
    }

    if (period === 'today') {
    const today = new Date().toISOString().slice(0, 10)

    x = x
      .gte('updated_at', today + 'T00:00:00')
      .lte('updated_at', today + 'T23:59:59')
  }
    return x
  }
  // Most recently touched lead first. updated_at is maintained by the
  // touch_updated_at trigger (02_functions.sql), so any edit — an inline
  // status change, a reassignment, a follow-up written back onto the lead
  // — lifts that row to the top, which is what this page is watched for.
  //
  // This replaces the enquiry_date ordering deliberately: that stopped an
  // import of old enquiries jumping the queue, but it also left a lead you
  // had just edited buried at its original enquiry date. The trade-off
  // returns on imports — freshly inserted rows carry a fresh updated_at,
  // so they sit on top until something else is edited.
  //
  // `id` breaks ties: a bulk write stamps one updated_at across the whole
  // batch, and without a tiebreak the order inside it is left to the
  // planner — so with LIMIT/OFFSET the same lead could appear on two pages
  // or on none.
  let query = base()
    .order('updated_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, from + PAGE_SIZE - 1)
  if (status) {
      query = query.eq('status', status)
    } else {
      if (view === 'all') {}
      else if (view === 'active') query = query.not('status', 'in', '(enrolled,lost)')
      else if (view === 'hot') query = query.ilike('temperature', '%hot%')
      else if (view === 'warm') query = query.ilike('temperature', '%warm%')
      else if (view === 'cold') query = query.ilike('temperature', '%cold%')
      else if (view === 'onboarded') query = query.eq('status', 'enrolled')
      else if (view === 'lost') query = query.eq('status', 'lost')
    }

    if (q) {
      const safe = q.replace(/[,%]/g, ' ')
      query = query.or(`name.ilike.%${safe}%,mobile.ilike.%${safe}%`)
    }
  const cnt = (build: (x: any) => any) => build(base()).then((r: any) => r.count ?? 0)

  // Top-row inventory counts deliberately ignore the date range: Total and the
  // Hot/Warm/Cold mix beside it always describe every lead (of the selected
  // BD/course), so the summary stays put while only the activity row below
  // reacts to today / the picked range. Uses baseFilters directly, skipping
  // base()'s created_at window.
  const cntAll = (build: (x: any) => any) =>
    build(baseFilters(supabase.from('leads').select('*', { count: 'exact', head: true }))).then((r: any) => r.count ?? 0)

  // Activity counts (contacted / hot / warm / cold) for the second KPI row,
  // keyed off updated_at rather than created_at — these answer "what moved
  // today", not "what was added today". They follow the date-range picker
  // when one is set, and fall back to today otherwise.
  const hasRange = !!(dFrom || dTo)
  // The UTC calendar date, matching how dFrom/dTo (bare "YYYY-MM-DD" from
  // the date picker) already get compared against created_at elsewhere on
  // this page. Deriving it by converting *local* midnight to UTC and
  // slicing the date — the previous approach — quietly rolls back to
  // yesterday on any server west of UTC (this one runs in IST), so every
  // "today" fallback below silently queried the wrong day and read 0.
  const todayStr = new Date().toISOString().slice(0, 10)
  const actFrom = (dFrom || todayStr) + 'T00:00:00'
  const actTo = dTo ? dTo + 'T23:59:59' : hasRange ? null : todayStr + 'T23:59:59'
  // A row's updated_at starts out equal to its created_at — an import's
  // insert never fires an UPDATE, so a lead that's sat untouched since a
  // bulk import still has updated_at === created_at, even though that
  // instant falls "today". Without excluding those, importing 374 leads
  // read as 374 BDs having contacted someone today. PostgREST can't compare
  // one column to another in a filter, so this counts client-side instead
  // of via head:true — fine at this scale (a day's worth of activity).
  const TOUCH_EPSILON_MS = 1000
  const cntAct = (build: (x: any) => any) => {
    let x = baseFilters(supabase.from('leads').select('created_at, updated_at'))
    x = x.gte('updated_at', actFrom)
    if (actTo) x = x.lte('updated_at', actTo)
    return build(x).then((r: any) =>
      ((r.data ?? []) as { created_at: string; updated_at: string }[]).filter(
        (row) => new Date(row.updated_at).getTime() - new Date(row.created_at).getTime() > TOUCH_EPSILON_MS
      ).length
    )
  }

  // "Added today" always means the calendar day, regardless of whatever
  // date range is picked above — it must not go through base(), or a
  // selected range that doesn't include today ANDs against itself and
  // silently reads 0 even when leads were in fact added today.
  const cntToday = (build: (x: any) => any) =>
    build(baseFilters(supabase.from('leads').select('*', { count: 'exact', head: true })).gte('created_at', todayStr))
      .then((r: any) => r.count ?? 0)

  // In touched mode the list itself becomes the drill-down for the activity
  // row: instead of the created_at window the rest of the page filters on,
  // it shows exactly the leads that row counts — updated inside the window
  // and genuinely touched since creation (updated_at meaningfully later than
  // created_at, so a raw import insert doesn't qualify). PostgREST can't
  // compare two columns, so both the touched filter and this list's own
  // count happen client-side — fine at a range's worth of activity.
  const touchedList = async () => {
    let x = baseFilters(supabase.from('leads').select(
      'id, name, mobile, status, temperature, delete_requested, course_interest, category, created_at, updated_at, enquiry_date, assigned_bd, remarks, next_followup_at, courses(name)'
    )).gte('updated_at', actFrom)
    if (actTo) x = x.lte('updated_at', actTo)
    if (temp) x = x.ilike('temperature', `%${temp}%`)
    if (q) {
      const safe = q.replace(/[,%]/g, ' ')
      x = x.or(`name.ilike.%${safe}%,mobile.ilike.%${safe}%`)
    }
    const { data } = await x.order('updated_at', { ascending: false }).order('id', { ascending: false })
    const rows = ((data ?? []) as any[]).filter(
      (r) => new Date(r.updated_at).getTime() - new Date(r.created_at).getTime() > TOUCH_EPSILON_MS
    )
    return { data: rows.slice(from, from + PAGE_SIZE), count: rows.length }
  }

  // Pending: leads their BD hasn't worked since getting them — no status
  // change, no edit, no follow-up. "Getting them" is the later of creation
  // and the last reassignment/take-over (lead_assignment_history, written by
  // the reassignment trigger in the same transaction as the lead's own
  // updated_at bump, so the two timestamps match). Anything the BD changes
  // afterwards moves updated_at past that point. Opening a lead writes
  // nothing, so it can't count.
  //
  // With no date picked this is every such lead — the backlog a BD has to
  // work through, which "today only" would hide. With a range picked it is
  // the backlog as of the range's end: leads that had arrived by then and
  // are still untouched. Only the latest change is stored, not the first,
  // so a lead waiting then but worked since can't be counted — past ranges
  // show what is still waiting from then, not the full backlog of the time.
  //
  // Client-side for the same reason as cntAct (PostgREST can't compare two
  // columns); the history table is small.
  const assignedAtP = supabase
    .from('lead_assignment_history')
    .select('lead_id, changed_at')
    .then((r: any) => {
      const last = new Map<string, number>()
      for (const h of (r.data ?? []) as { lead_id: string; changed_at: string }[]) {
        const t = new Date(h.changed_at).getTime()
        if (t > (last.get(h.lead_id) ?? 0)) last.set(h.lead_id, t)
      }
      return last
    })
  const pendHi = dTo ? new Date(dTo + 'T23:59:59Z').getTime() : Infinity
  type Stamp = { id: string; created_at: string; updated_at: string }
  // The pending leads under the current filters, oldest arrival first — the
  // ones waiting longest are the ones to start on.
  const pendingIds = async (narrow: (x: any) => any = (x) => x) => {
    const [assignedAt, { data }] = await Promise.all([
      assignedAtP,
      narrow(baseFilters(supabase.from('leads').select('id, created_at, updated_at'))),
    ])
    return ((data ?? []) as Stamp[])
      .map((r) => ({ id: r.id, arrived: Math.max(new Date(r.created_at).getTime(), assignedAt.get(r.id) ?? 0), updated: new Date(r.updated_at).getTime() }))
      .filter((r) => r.updated - r.arrived <= TOUCH_EPSILON_MS && r.arrived <= pendHi)
      .sort((a, b) => a.arrived - b.arrived || a.id.localeCompare(b.id))
      .map((r) => r.id)
  }
  const cntPending = () => pendingIds().then((ids) => ids.length)
  // The Pending drill-down. Search and stage still narrow it; only the page
  // being shown is fetched in full.
  const pendingList = async () => {
    const ids = await pendingIds((x) => {
      if (status) x = x.eq('status', status)
      if (q) {
        const safe = q.replace(/[,%]/g, ' ')
        x = x.or(`name.ilike.%${safe}%,mobile.ilike.%${safe}%`)
      }
      return x
    })
    const pageIds = ids.slice(from, from + PAGE_SIZE)
    if (!pageIds.length) return { data: [], count: ids.length }
    const { data } = await supabase
      .from('leads')
      .select('id, name, mobile, status, temperature, delete_requested, course_interest, category, created_at, updated_at, enquiry_date, assigned_bd, remarks, next_followup_at, courses(name)')
      .in('id', pageIds)
    const byId = new Map(((data ?? []) as any[]).map((r) => [r.id, r]))
    return { data: pageIds.map((id) => byId.get(id)).filter(Boolean), count: ids.length }
  }

  const [
    { data: leads = [], count = 0 }, totalC, hotC, warmC, coldC, todayC,
    contactedActC, hotActC, warmActC, coldActC, pendingActC,
  ] = await Promise.all([
    touched ? touchedList() : pending ? pendingList() : query,
    cntAll((x) => x),
    cntAll((x) => x.ilike('temperature', '%hot%')),
    cntAll((x) => x.ilike('temperature', '%warm%')),
    cntAll((x) => x.ilike('temperature', '%cold%')),
    cntToday((x) => x),
    // "Contacted" here means touched, not staged — every distinct lead a BD
    // updated in the window, whatever it ended up as. Not scoped to
    // status='contacted', which underreported: a lead updated today but
    // already past that stage (e.g. moved straight to interested) wouldn't
    // count even though the BD plainly worked it today.
    cntAct((x) => x),
    cntAct((x) => x.ilike('temperature', '%hot%')),
    cntAct((x) => x.ilike('temperature', '%warm%')),
    cntAct((x) => x.ilike('temperature', '%cold%')),
    cntPending(),
  ])
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE))
  // Every filter the list is currently showing, bar the page number — the
  // shared base for every link on this page, so no control has to remember
  // the full set on its own and quietly drop the ones it doesn't know about.
  const baseParams = () => {
    const p = new URLSearchParams(); p.set('view', view); if (q) p.set('q', q); if (dFrom) p.set('from', dFrom); if (dTo) p.set('to', dTo)
    // Carried so paging doesn't quietly widen a KPI-card click-through
    // back out to every lead.
    if (course) p.set('course', course); if (assignedBd) p.set('assigned_bd', assignedBd); if (status) p.set('status', status)
    // Carried so paging within the touched drill-down stays in it.
    if (touched) p.set('touched', '1'); if (temp) p.set('temp', temp)
    if (pending) p.set('pending', '1')
    return p
  }
  const mk = (extra: Record<string, string | number>) => {
    const p = baseParams()
    // An empty value in `extra` clears the param rather than writing a
    // blank one — that's how the top row and tabs step back OUT of touched
    // mode (touched:'' / temp:'').
    Object.entries(extra).forEach(([k, v]) => (v === '' ? p.delete(k) : p.set(k, String(v)))); return `/leads?${p.toString()}`
  }
  // This exact list — filters, tab, search, drill-down and page number — as a
  // bare query string. It rides into each lead on `back` so closing that lead
  // comes back here rather than to a reset /leads; reapplying filters after
  // every edit was the whole complaint.
  //
  // Deliberately not stashed and re-read when /leads is opened without it:
  // the dashboard's Total Leads card and the sidebar both link here bare and
  // have to keep meaning "all of them", or the card's number and the list
  // below it disagree again.
  const returnParams = baseParams()
  if (page > 1) returnParams.set('page', String(page))
  const returnQs = returnParams.toString()
  // Is anything actually narrowing this list? The tab counts — "selected tab"
  // is part of what has to survive the round trip — so only plain All Leads
  // with nothing else set reads as unfiltered.
  const hasFilters = !!(
    q || status || assignedBd || course || dFrom || dTo || touched || temp || pending ||
    page > 1 || view !== 'all'
  )
  // /leads opened with nothing on it at all: the sidebar's own link, or the
  // address bar. That is the only case the filter memory fills in — anything
  // carrying params is taken at its word.
  const isBare = Object.keys(sp).length === 0
  return (
    <div className="space-y-4">
      <LeadsFilterMemory qs={returnQs} isBare={isBare} hasFilters={hasFilters} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-xl font-semibold text-slate-900">Leads / CRM</h1><p className="text-sm text-slate-500">{(count ?? 0).toLocaleString('en-IN')} in this view</p></div>
        <div className="flex items-center gap-2">
  {/* Keyed on the values themselves: DateRangeFilter holds its own input
      state via useState(from), which only runs once — a soft navigation
      that changes dFrom/dTo (e.g. arriving from a dashboard KPI card with a
      preset range while a leads tab is already open) would otherwise leave
      the boxes showing whatever they had at first mount. */}
  {/* Built from mk() rather than a bare "/leads?view=…": the picker appends
      its own from/to to whatever base it is handed, so a hand-rolled base
      silently dropped the search term, stage, BD, course and the touched
      drill-down every time a date was changed. from/to are cleared out of
      the base because the picker supplies them. */}
  <DateRangeFilter
    key={`${dFrom}-${dTo}`}
    from={dFrom}
    to={dTo}
    baseHref={mk({ from: '', to: '' })}
  />

  {isAdmin && <DeleteRequestsPanel />}

  <Link
    href="/leads/new"
    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
  >
    + Add Lead
  </Link>
</div>
      </div>

      <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-white p-1 text-sm w-fit">
        {VIEWS.map((v) => (
          // Goes through mk() so switching tabs keeps the date range, course,
          // BD and search term already applied instead of dropping them —
          // it used to carry only assigned_bd, so picking a tab while a date
          // range was set would silently widen the list back to all dates.
          // touched:''/temp:'' step out of the activity drill-down back to
          // the normal created_at list.
          <Link
            key={v.key}
            href={mk({ view: v.key, status: '', touched: '', temp: '', pending: '' })}
            className={`rounded-md px-3 py-1.5 font-medium ${
              view === v.key && !touched && !pending
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {v.label}
          </Link>
          ))}
      </div>

      {/* Two rows, two questions. Top row is a fixed inventory snapshot —
          every lead (of the selected BD/course) and its temperature mix,
          deliberately NOT filtered by the date range, so Total and the
          breakdown stay put whatever window is picked. Second row is activity:
          leads actually worked (updated), today by default or in the selected
          range. That's the difference — what exists vs. what got worked. */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
        <span className="mr-1 text-xs font-medium uppercase tracking-wide text-slate-400">
          All leads
        </span>
        <Link href={mk({ view: 'all', status: '', touched: '', temp: '', pending: '' })} className="text-slate-500 hover:text-slate-700">Total <b className="text-slate-800">{totalC.toLocaleString('en-IN')}</b></Link>
        <Link href={mk({ view: 'hot', status: '', touched: '', temp: '', pending: '' })} className="text-slate-500 hover:text-slate-700">🔥 Hot <b className="text-rose-500">{hotC}</b></Link>
        <Link href={mk({ view: 'warm', status: '', touched: '', temp: '', pending: '' })} className="text-slate-500 hover:text-slate-700">🌡 Warm <b className="text-amber-500">{warmC}</b></Link>
        <Link href={mk({ view: 'cold', status: '', touched: '', temp: '', pending: '' })} className="text-slate-500 hover:text-slate-700">❄ Cold <b className="text-sky-500">{coldC}</b></Link>
        <Link href={mk({ from: todayStr, to: todayStr, touched: '', temp: '', pending: '' })} className="text-slate-500 hover:text-slate-700">Added today <b className="text-slate-800">{todayC}</b></Link>
      </div>

      {/* Every number here is a link into "touched" mode — the list swaps to
          exactly the leads this row counts (updated in the window, and
          genuinely worked, not just freshly imported), so a count like
          "16" is always one you can click through and see. */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
        <span className="mr-1 text-xs font-medium uppercase tracking-wide text-slate-400">
          {hasRange ? 'Updated in range' : 'Updated today'}
        </span>
        <Link href={mk({ touched: '1', temp: '', pending: '' })} className="text-slate-500 hover:text-slate-700">Updated <b className="text-amber-600">{contactedActC}</b></Link>
        <Link href={mk({ touched: '1', temp: 'hot', pending: '' })} className="text-slate-500 hover:text-slate-700">🔥 Hot <b className="text-rose-500">{hotActC}</b></Link>
        <Link href={mk({ touched: '1', temp: 'warm', pending: '' })} className="text-slate-500 hover:text-slate-700">🌡 Warm <b className="text-amber-500">{warmActC}</b></Link>
        <Link href={mk({ touched: '1', temp: 'cold', pending: '' })} className="text-slate-500 hover:text-slate-700">❄ Cold <b className="text-sky-500">{coldActC}</b></Link>
        <Link
          href={mk({ status: '', touched: '', temp: '', pending: '1' })}
          title={dTo
            ? 'Leads their BD had by the end of this range and still has not worked since getting them'
            : 'All leads their BD has not worked since getting them (any date)'}
          className={`hover:text-slate-700 ${pending ? 'font-medium text-slate-800' : 'text-slate-500'}`}
        >
          ⏳ Pending <b className="text-violet-600">{pendingActC.toLocaleString('en-IN')}</b>
        </Link>
      </div>

      {/* Every control here applies itself: the term as you type, a stage or a
          BD the moment it is picked. The hidden view/period fields and the
          Search button went with the form — each control now edits its own
          param on the current URL, so the tab, period and date range it is not
          itself changing come through untouched. The submit used to drop the
          date range, having no field for it. */}
      <div className="flex gap-2">
        <LiveSearchInput value={q} placeholder="Search by name or mobile…" className="w-full max-w-sm rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300" />
        <LiveSelect name="status" value={status} className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300">
          <option value="">All Stages</option>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="interested">Interested</option>
          <option value="demo_scheduled">Demo Scheduled</option>
          <option value="aptitude_shared">Aptitude Shared</option>
          <option value="passed">Passed</option>
          <option value="enrolled">Enrolled</option>
          <option value="no_response">No Response</option>
          <option value="irrelevant">Irrelevant</option>
          <option value="not_interested">Not Interested</option>
          <option value="lost">Lost</option>
        </LiveSelect>
        <LiveSelect
          name="assigned_bd"
          value={assignedBd}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300"
        >
          <option value="">All BDs</option>
          {(bds ?? []).map((bd: any) => (
            <option key={bd.id} value={bd.id}>
              {bd.full_name}
            </option>
          ))}
        </LiveSelect>
        <LiveSelect
          name="course"
          value={course}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300"
        >
          <option value="">All Courses</option>
          {((allCourses ?? []) as any[]).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          {/* The dashboard Courses cards link by keyword rather than by id.
              Without an option carrying that value the control would snap
              back to "All Courses" and misreport what the list below is
              actually showing. Only rendered when it is the live filter, so
              the dropdown stays a plain list of courses otherwise. */}
          {course === 'noninternship' && (
            <option value="noninternship">All except Internship</option>
          )}
          {course === 'other' && <option value="other">Other courses</option>}
        </LiveSelect>
        {/* assignedBd joins the test: picking a BD alone left no way back to
            all of them but re-picking "All BDs". */}
        {(q || status || assignedBd || course) && (<Link href={`/leads?view=${view}`} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600">Clear</Link>)}
      </div>

      {/* Made obvious that the list is no longer the normal created_at view
          but the activity drill-down, with a one-click way back out. */}
      {touched && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          <span>
            Showing <b>{temp ? `${temp} ` : ''}leads updated {hasRange ? 'in the selected range' : 'today'}</b> — changed after they were added, not just imported.
          </span>
          <Link href={mk({ view: 'all', status: '', touched: '', temp: '', pending: '' })} className="ml-auto rounded-md border border-amber-300 bg-white px-3 py-1 font-medium text-amber-800 hover:bg-amber-100">
            Back to all leads
          </Link>
        </div>
      )}

      {pending && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-4 py-2 text-sm text-violet-800">
          <span>
            Showing <b>pending leads{dTo ? ' as of the end of the selected range' : ''}</b> — not changed since their BD got them (added, reassigned or taken over), oldest first.
          </span>
          <Link href={mk({ view: 'all', status: '', touched: '', temp: '', pending: '' })} className="ml-auto rounded-md border border-violet-300 bg-white px-3 py-1 font-medium text-violet-800 hover:bg-violet-100">
            Back to all leads
          </Link>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500"><tr>
            <th className="px-4 py-3 font-medium">Last Updated</th>
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Mobile</th>
            <th className="px-4 py-3 font-medium">Course</th>
            <th className="px-4 py-3 font-medium">Temp</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Actions</th>
          </tr></thead>
          <tbody>
            <LeadRows
              rows={(leads ?? []).map((l: any) => ({
                id: l.id,
                name: l.name,
                mobile: l.mobile,
                course: one(l.courses)?.name ?? l.course_interest ?? null,
                category: l.category,
                temperature: l.temperature,
                status: l.status,
                updated_at: l.updated_at,
                created_at: l.created_at,
                delete_requested: !!l.delete_requested,
                assigned_bd: l.assigned_bd,
                remarks: l.remarks,
                next_followup_at: l.next_followup_at,
              }))}
              role={role}
              myName={myName}
              currentUserId={user!.id}
              returnQs={returnQs}
            />
            {!(leads ?? []).length && <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">No leads in this view.</td></tr>}
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
