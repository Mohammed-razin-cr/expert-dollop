import {Users, PhoneCall, CalendarClock, UserPlus, BookOpen, Briefcase, FolderKanban, Wallet, IndianRupee, Receipt, Clock, Banknote,} from 'lucide-react'
import { createClient } from '@/lib/api/server'
import { CategoryDonut } from '@/components/charts/CategoryDonut'
import { KpiCard } from '@/components/dashboards/KpiCard'
import Link from 'next/link'
import { cached } from '@/lib/cache/cached'
import { receivedOf, pendingOf } from '@/lib/revenue'

const inr = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN')
const one = (x: any) => (Array.isArray(x) ? x[0] : x)
const today = () => new Date().toISOString().slice(0, 10)

// `action` renders blue like a link, so without an href it reads as a
// control and does nothing when clicked. Pass href to make it real; the
// span is kept for any panel that genuinely has nowhere to go.
function Panel({ title, action, href, children, className = '' }: { title: string; action?: string; href?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-5 ${className}`}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {action && (href
          ? <Link href={href} className="text-xs font-medium text-blue-600 hover:underline">{action}</Link>
          : <span className="text-xs font-medium text-blue-600">{action}</span>)}
      </div>
      {children}
    </section>
  )
}

const STATUS_META: Record<string, { label: string; color: string; badge: string }> = {
  new: { label: 'New', color: '#3b82f6', badge: 'bg-blue-50 text-blue-600' },
  contacted: { label: 'Contacted', color: '#f59e0b', badge: 'bg-amber-50 text-amber-600' },
  interested: { label: 'Interested', color: '#10b981', badge: 'bg-emerald-50 text-emerald-600' },
  demo_scheduled: { label: 'Demo Scheduled', color: '#8b5cf6', badge: 'bg-violet-50 text-violet-600' },
  aptitude_shared: { label: 'Aptitude Shared', color: '#06b6d4', badge: 'bg-cyan-50 text-cyan-600' },
  passed: { label: 'Passed', color: '#22c55e', badge: 'bg-green-50 text-green-600' },
  enrolled: { label: 'Enrolled', color: '#6366f1', badge: 'bg-blue-50 text-blue-600' },
  lost: { label: 'Lost', color: '#94a3b8', badge: 'bg-slate-100 text-slate-500' },
}
const FUNNEL = ['new', 'contacted', 'interested', 'demo_scheduled', 'aptitude_shared', 'passed', 'enrolled']

export async function BDDashboard({
      userId,
      bdName,
      from,
      to,
      period = 'overall',
      periodName = 'Total',
    }: {
      userId: string
      /** This BD's display name, which is what `revenue.bd` carries. */
      bdName: string
      from?: string | null
      to?: string | null
      period?: string
      /** What the period-scoped cards call themselves — "September" on a
       *  month, "Total" on Overall. See periodName in lib/period. */
      periodName?: string
    }){
  const supabase = await createClient()
  const ranged = !!(from && to)

  // All read-only queries for this panel, memoized per (user, range, period)
  // in Redis for 30s — long enough to absorb repeat loads/tab switches, short
  // enough that a status change or new lead shows up on the next refresh.
  // v6: the revenue rows carry `pending_amount`, which pendingOf prefers
  // over recomputing; without it every row would fall through to the
  // computed branch and a stale v5 entry would answer differently.
  // v5: projects are counted for this BD rather than the company, and the
  // revenue rows carry `deductions` so the pending figure can be worked out
  // — both change what a cached entry means, not just what it holds.
  // v4: the revenue rows now carry `bd` so the dashboard can total this
  // BD's own collections; a stale v3 entry has the column missing, which
  // would read as nobody's revenue rather than as an error.
  // v3: the card set changed — follow-up count back in, the course split
  // collapsed to Courses/Internships — so the payload shape changed and a
  // v2 entry from before the deploy must not be reused.
  const cacheKey = `bd-dashboard:v6:${userId}:${from ?? 'none'}:${to ?? 'none'}:${period}`

  const {
    byStatus, total, leads, followups, invSum, invList, tasks, revenueToday, revenueAll,
    projectsCount, courseLeads, internshipLeads, internshipId, fuLeadCount,
  } = await cached(cacheKey, 30, async () => {
      // ---- leads by status (range-aware) ----
      let byStatus: Record<string, number> = {}
      let total = 0
      if (ranged) {
        // Ranged on created_at, not updated_at. Every other count on this
        // screen ranges on created_at, and so does the Leads page these cards
        // link to — so counting by updated_at meant Total Leads, Demo
        // Scheduled and Total Enrollments each reported one set and opened a
        // different one: a lead raised last year but touched inside the
        // window counted here and was missing there.
        const { data: rl = [] } = await supabase.from('leads').select('status, created_at').eq('assigned_bd', userId).is('deleted_at', null).gte('created_at', from!).lte('created_at', to! + 'T23:59:59')
        for (const l of rl ?? []) { const st = (l as any).status; byStatus[st] = (byStatus[st] ?? 0) + 1 }
        total = (rl ?? []).length
      }
      else {
        const { data: stats } = await supabase.rpc('lead_stats', { p_bd: userId });
        byStatus = (stats as any)?.by_status ?? {};
        total = (stats as any)?.total ?? 0;
      }

      // ---- other panels ----

      let leadsQ = supabase.from('leads').select('id, name, mobile, status, created_at, updated_at, courses(name)').eq('assigned_bd', userId).order('created_at', { ascending: false }).limit(8)
      if (ranged) leadsQ = leadsQ.gte('created_at', from!).lte('created_at', to! + 'T23:59:59')
      // Deleting an invoice stamps deleted_at rather than dropping the row,
      // so it has to be filtered out here as it is on the admin dashboard —
      // otherwise the two screens disagree the moment an invoice is deleted.
      let invSumQ = supabase.from('invoices').select('amount, status, issued_date').is('deleted_at', null)
      if (ranged) invSumQ = invSumQ.gte('issued_date', from!).lte('issued_date', to!)
      let invListQ = supabase.from('invoices').select('invoice_no, amount, status, issued_date').is('deleted_at', null).order('issued_date', { ascending: false }).limit(5)
      if (ranged) invListQ = invListQ.gte('issued_date', from!).lte('issued_date', to!)
      let followupsQ = supabase
        .from("followups")
        .select("id, scheduled_at, status, leads(name, mobile)")
        .eq("bd_id", userId)

      if (ranged) {
        followupsQ = followupsQ
          .gte("scheduled_at", from!)
          .lte("scheduled_at", to! + "T23:59:59")
      }
      followupsQ = followupsQ.order("scheduled_at", { ascending: false })

      // Which course is the Internship, matched by name so a re-seeded
      // courses table keeps working. Everything else with a course recorded
      // is a "Courses" lead; Internship is broken out on its own card.
      const { data: courseRows = [] } = await supabase.from('courses').select('id, name')
      const internshipIds = (courseRows ?? []).filter((c: any) => /internship/i.test(c.name)).map((c: any) => c.id)

      // My leads counted by the course they enquired about. Courses = any
      // recorded course that isn't the Internship; Internship = that course.
      // A lead with no course recorded belongs to neither card.
      const interestCount = (which: 'courses' | 'internship') => {
        if (which === 'internship' && !internshipIds.length) return Promise.resolve(0)
        let q = supabase
          .from('leads')
          .select('id', { count: 'exact', head: true })
          .eq('assigned_bd', userId)
          .is('deleted_at', null)
        if (which === 'internship') q = q.in('course_interest', internshipIds)
        else {
          q = q.not('course_interest', 'is', null)
          if (internshipIds.length) q = q.not('course_interest', 'in', `(${internshipIds.join(',')})`)
        }
        if (ranged) q = q.gte('created_at', from!).lte('created_at', to! + 'T23:59:59')
        return q.then((r: any) => r.count ?? 0)
      }

      // Leads of mine that have been followed up — the same rule the
      // Follow-ups page's All tab uses, so the card and the page agree.
      // Counting followups rows instead answers a different question ("how
      // many calls did I make") and read far higher than the page it links to.
      let fuLeadsQ = supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_bd', userId)
        .is('deleted_at', null)
        .gt('fu_count', 0)
      if (ranged) fuLeadsQ = fuLeadsQ.gte('created_at', from!).lte('created_at', to! + 'T23:59:59')

      // This BD's own projects. `owner_id` is who the row belongs to — the
      // same column the `projects_owner` policy grants edit rights by — so
      // the card counts what this login owns rather than the company book.
      let projectsQ = supabase.from('projects').select('id', { count: 'exact', head: true }).eq('owner_id', userId).is('deleted_at', null)
      if (ranged) projectsQ = projectsQ.gte('created_at', from!).lte('created_at', to! + 'T23:59:59')

      const [
          { data: leads = [] },
          { data: followups = [] },
          { data: invSum = [] },
          { data: invList = [] },
          { data: tasks = [] },
          { count: projectsCount = 0 },
          { count: fuLeadCount = 0 },
          courseLeads,
          internshipLeads,
        ] = await Promise.all([
            leadsQ,
            followupsQ,
            invSumQ,
            invListQ,
            supabase
              .from("tasks")
              .select("id, title, status")
              .eq("assigned_to", userId)
              .eq("status", "pending")
              .limit(8),

            projectsQ,
            fuLeadsQ,
            interestCount('courses'),
            interestCount('internship'),
          ]);
          const { data: revenueToday = [] } = await supabase
          .from("revenue")
          .select("received_amount, payment_date")
          .is("deleted_at", null)
          .eq("payment_date", today())

          // Revenue actually collected, from the `revenue` table. A different
          // figure from the invoices total: invoices are what was billed, revenue
          // is what came in. Since 31_finance_visibility.sql every BD reads the
          // whole ledger, so this card totals all collections — the same figure
          // the Revenue page and the admin dashboard report.
          let revenueAllQ = supabase
            .from("revenue")
            .select("received_amount, total_amt, amt, status, payment_date, bd, deductions, pending_amount")
            .is("deleted_at", null)
          if (ranged) revenueAllQ = revenueAllQ.gte("payment_date", from!).lte("payment_date", to!)
          const { data: revenueAll = [] } = await revenueAllQ

      return {
        byStatus, total, leads, followups, invSum, invList, tasks, revenueToday, revenueAll,
        projectsCount, fuLeadCount, courseLeads, internshipLeads,
        internshipId: internshipIds[0] ?? null,
      }
  })

  const L = leads ?? []
  const todaysLeads = L.filter(
  (lead: any) => (lead.created_at ?? '').slice(0, 10) === today()
  )

  const todaysByStatus: Record<string, number> = {}

  todaysLeads.forEach((lead: any) => {
    const st = lead.status
    todaysByStatus[st] = (todaysByStatus[st] ?? 0) + 1
  })

  const followupsToday = (followups ?? []).filter((f: any) => (f.scheduled_at ?? '').slice(0, 10) === today()).length
  // receivedOf and pendingOf come from lib/revenue, which is what the Revenue
  // page and the edit form already use. This screen had its own copy of the
  // "Received" rule, and the copy had drifted: it ignored deductions, and the
  // pending figure below was not applying the rule at all — a row marked
  // Received with received_amount left blank was counted as money in AND as
  // money still owed, the same rupees twice. Sharing one implementation is
  // what stops the dashboard and the Revenue page disagreeing.
  const sumBy = (rows: any[], f: (r: any) => number) =>
    rows.reduce((s: number, r: any) => s + f(r), 0)

  // This BD's own rows. `revenue.bd` is the denormalised display name,
  // matched the way canEditRevenue matches it on the Revenue page — trimmed
  // and case-insensitive — so these cards and the rows a BD may edit there
  // are the same set. A profile with no name owns nothing rather than
  // owning every row whose `bd` is blank.
  const myName = (bdName ?? '').trim().toLowerCase()
  const myRows = myName
    ? (revenueAll ?? []).filter((r: any) => (r.bd ?? '').trim().toLowerCase() === myName)
    : []

  const myRevenue = sumBy(myRows, receivedOf)

  // Invoiced and collected are kept apart rather than added.
  //
  // They were summed, on the grounds that "no revenue row carries an invoice
  // number, so the ledgers are disjoint". That field is null on every row in
  // the table — it records nothing, so it guaranteed nothing. Matching on
  // person and amount instead turns up the same payment in both places: a
  // 7,000 project fee sits as a paid invoice AND as a collection, and it was
  // being counted twice.
  //
  // Deduplicating properly needs `revenue.inv_no` populated, which is a data
  // job. Until then two figures that are each true beat one that is neither:
  // invoices are what was billed and settled, the ledger is what arrived,
  // and the overlap between them is visible rather than buried in a total.
  //
  // Both are worked out the way the admin dashboard works them out, so the
  // two screens report the same organisation figures on the same day.
  const paidInvoices = (invSum ?? [])
    .filter((i: any) => i.status === 'paid')
    .reduce((s: number, i: any) => s + Number(i.amount ?? 0), 0)
  const collected = sumBy(revenueAll ?? [], receivedOf)

  // Still owed on this BD's rows, by the same reckoning the Revenue page's
  // Pending column shows.
  const myPending = sumBy(myRows, pendingOf)

  // Invoices are company-wide on these two cards: every row's `created_by`
  // is null in the data as it stands, so counting only this BD's would read
  // zero for everybody. InvoiceForms does stamp it on new invoices, so
  // narrowing them later is a `.eq('created_by', userId)` on invSumQ.
  // Cancelled invoices are not outstanding, so only pending and overdue
  // count towards the pending card.
  const invoiceCount = (invSum ?? []).length
  const invoicesPending = (invSum ?? []).filter(
    (i: any) => i.status === 'pending' || i.status === 'overdue',
  ).length
  const todayInvoices = (invSum ?? []).filter(
    (i: any) => (i.issued_date ?? '').slice(0, 10) === today()
  )

  const todayPending = todayInvoices
    .filter((i: any) => i.status === 'pending')
    .reduce((s: number, i: any) => s + Number(i.amount), 0)

  const todayRevenueAmount = (revenueToday ?? []).reduce(
  (s: number, r: any) => s + Number(r.received_amount ?? 0),
  0
  )
  const donut = Object.keys(byStatus).map((s) => ({
    name: STATUS_META[s]?.label ?? s,
    value: byStatus[s],
    color: STATUS_META[s]?.color ?? '#94a3b8'
  }))
  const enrolled = byStatus['enrolled'] ?? 0
  const todaysDonut = Object.keys(STATUS_META).map((s) => ({
  name: STATUS_META[s].label,
  value: todaysByStatus[s] ?? 0,
  color: STATUS_META[s].color,
  }))
  // The selected range, carried to every click-through as from/to — the
  // params the Leads and Revenue pages read — so a card opens the same
  // window it counted. Empty when the dashboard is on Overall.
  const rangeAmp = from && to ? `&from=${from}&to=${to}` : ''
  const rangeQ = from && to ? `?from=${from}&to=${to}` : ''
  // A card has to open the set it counted, or the figure and the page under
  // it disagree. This carries the dashboard's date range onto a link that
  // already has filters of its own.
  const withRange = (path: string) =>
    from && to ? `${path}${path.includes('?') ? '&' : '?'}from=${from}&to=${to}` : path
  // `revenue.bd` is a display name, so it has to survive the query string.
  const meQ = encodeURIComponent(bdName ?? '')
  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-slate-800">Dashboard Summary</h2>
      {/* Every tile is the same size: the grid stretches each one in a row
          to match the tallest, and KpiCard centres its own contents, so a
          card whose label wraps no longer stands taller than its neighbours.

          Four across. All of them in one row is what made these cramped — a
          tile needs roughly 179px to hold the widest label on one line and
          the widest figure beside its icon, which eight of do not fit until
          about 1800px. */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {/* My leads, every stage. The click-through opens the All Leads view
            filtered to me, so the page shows the set the card counted. */}
        <KpiCard
          icon={Users} label={`${periodName} Leads`} tint="bg-blue-50 text-blue-600"
          value={total}
          href={`/leads?view=all&assigned_bd=${userId}${rangeAmp}`}
        />

        {/* Leads of mine followed up, not calls made — one lead rung six
            times is one lead here. Links to the tab that lists exactly this
            set. */}
        <KpiCard
          icon={PhoneCall} label="Follow-ups" tint="bg-teal-50 text-teal-600"
          value={fuLeadCount ?? 0}
          href={withRange('/followups?filter=all')}
        />

        {/* My leads at the demo-scheduled stage. */}
        <KpiCard
          icon={CalendarClock} label="Demo Scheduled" tint="bg-violet-50 text-violet-600"
          value={byStatus['demo_scheduled'] ?? 0}
          href={`/leads?status=demo_scheduled&assigned_bd=${userId}${rangeAmp}`}
        />

        {/* My leads that reached enrolled — what Admissions used to count. */}
        <KpiCard
          icon={UserPlus} label={`${periodName} Enrollments`} tint="bg-indigo-50 text-indigo-600"
          value={enrolled}
          href={`/leads?status=enrolled&assigned_bd=${userId}${rangeAmp}`}
        />

        {/* My leads with a course recorded that isn't the Internship. */}
        <KpiCard
          icon={BookOpen} label="Courses" tint="bg-cyan-50 text-cyan-600"
          value={courseLeads ?? 0}
          href={`/leads?view=all&course=noninternship&assigned_bd=${userId}${rangeAmp}`}
        />

        {/* My leads whose interest is the Internship course. */}
        <KpiCard
          icon={Briefcase} label="Internships" tint="bg-rose-50 text-rose-600"
          value={internshipLeads ?? 0}
          href={internshipId ? `/leads?view=all&course=${internshipId}&assigned_bd=${userId}${rangeAmp}` : '/leads?view=all'}
        />

        {/* Projects I own. `?bd=` is the Projects page's owner filter, so it
            opens the same rows this counted. */}
        <KpiCard
          icon={FolderKanban} label="Projects" tint="bg-amber-50 text-amber-600"
          value={projectsCount ?? 0}
          href={withRange(`/projects?bd=${userId}`)}
        />

        {/* Still owed on my collections: agreed, less received, less
            written off. */}
        <KpiCard
          icon={Wallet} label="Pending Payments" tint="bg-orange-50 text-orange-600"
          value={inr(myPending)}
          href={withRange(`/revenue?status=Pending&bd=${meQ}`)}
        />

        {/* Invoices raised. Company-wide — see the note where these are
            counted. */}
        <KpiCard
          icon={Receipt} label={`${periodName} Invoices`} tint="bg-sky-50 text-sky-600"
          value={invoiceCount}
          href={withRange('/invoicing')}
        />

        {/* Of those, the ones still unpaid — cancelled invoices are not
            outstanding, so they do not count here. */}
        <KpiCard
          icon={Clock} label="Invoices Pending" tint="bg-yellow-50 text-yellow-700"
          value={invoicesPending}
          href={withRange('/invoicing?status=outstanding')}
        />

        {/* Mine and everybody's on one card: the same measure twice, so two
            tiles would have said the same word and left the reader to work
            out which was which. */}
        <KpiCard
          icon={IndianRupee} label="Revenue Collected" tint="bg-emerald-50 text-emerald-600"
          value={
            <span className="whitespace-nowrap">
              {inr(myRevenue)}
              <span className="ml-1 text-xs font-normal text-slate-400">of {inr(collected)}</span>
            </span>
          }
          href={withRange(`/revenue?status=Received&bd=${meQ}`)}
        />

        {/* Billed and settled — a different ledger from the one above, not a
            share of it. */}
        <KpiCard
          icon={Banknote} label={`${periodName} Invoiced`} tint="bg-green-50 text-green-700"
          value={inr(paidInvoices)}
          href={withRange('/invoicing?status=paid')}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* My Sales Funnel removed */}
        <Panel title="Lead Status"><CategoryDonut data={donut} centerLabel="Leads" /></Panel>

        <Panel title="Today's Follow-ups" action="View All" href="/followups?filter=today">
          <ul className="space-y-2.5 text-sm">
            {(followups ?? []).filter((f: any) => (f.scheduled_at ?? '').slice(0, 10) === today()).slice(0, 6).map((f: any) => (
              <li key={f.id} className="flex items-center justify-between gap-2">
                <div className="min-w-0"><p className="truncate font-medium text-slate-800">{one(f.leads)?.name ?? '—'}</p><p className="text-xs text-slate-400">{one(f.leads)?.mobile ?? ''}</p></div>
                <span className="text-xs text-blue-600">{(f.scheduled_at ?? '').slice(11, 16)}</span>
              </li>
            ))}
            {!(followups ?? []).some((f: any) => (f.scheduled_at ?? '').slice(0, 10) === today()) && <li className="text-slate-400">No follow-ups today.</li>}
          </ul>
        </Panel>

        <Panel title="Today's Leads">
        <CategoryDonut
          data={todaysDonut}
          centerLabel="Today"
        />
      </Panel>
      </div>
    </div>
  )
}
