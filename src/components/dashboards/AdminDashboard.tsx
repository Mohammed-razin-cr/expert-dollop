import Link from 'next/link'
import {
  Users, GraduationCap, IndianRupee, Briefcase, FolderKanban, BookOpen, Sparkles, Receipt, Banknote,
} from 'lucide-react'
import { createClient } from '@/lib/api/server'
import { CategoryDonut } from '@/components/charts/CategoryDonut'
import { TrendLine } from '@/components/charts/TrendLine'
import { RevenuePie } from '@/components/charts/RevenuePie'
import { KpiCard } from '@/components/dashboards/KpiCard'
import { FeeReminderDialog, type PendingInvoice } from '@/components/dashboards/FeeReminderDialog'
import { receivedOf } from '@/lib/revenue'
import { fmtDate } from '@/lib/ui'
import { dayEnd, trendBuckets, periodName, type Period } from '@/lib/period'
import { AdminMarketingSummary } from '@/components/marketing/AdminMarketingSummary'

const inr = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN')
const one = (x: any) => (Array.isArray(x) ? x[0] : x)

/**
 * Every panel below reads the same period, and reads it in the database
 * rather than after the fact: the bounds go out as PostgREST gte/lte
 * filters, so a week view fetches a week's rows. The one exception is the
 * user directory at the bottom, which is a staff list rather than a
 * measurement and has no period to be in.
 *
 * Period views apply exactly the predicates the Overall view applies, plus
 * the date range — so switching to This Month narrows the same population
 * rather than quietly counting a different one.
 */

/** Row count in a window. Ranged on created_at, which is not-null everywhere
 *  here, so narrowing never silently drops rows Overall would have counted. */
async function countRows(
  s: any, table: string,
  f: string | null, t: string | null,
  mod?: (q: any) => any,
) {
  let q = s.from(table).select('*', { count: 'exact', head: true })
  if (mod) q = mod(q)
  if (f && t) q = q.gte('created_at', f).lte('created_at', dayEnd(t))
  const { count } = await q
  return count ?? 0
}

// Collections with no BD recorded. Named once so the bar and the test that
// decides it cannot be clicked through can never disagree.
const UNATTRIBUTED = 'Unattributed'

const sumPaid = (rows: any[]) =>
  (rows ?? []).filter((i: any) => i.status === 'paid').reduce((s: number, i: any) => s + Number(i.amount), 0)

const sumPending = (rows: any[]) =>
  (rows ?? []).filter((i: any) => i.status === 'pending').reduce((s: number, i: any) => s + Number(i.amount), 0)

// receivedOf is lib/revenue's, the one the Revenue page and the edit form
// read. This file kept its own copy of the rule and the copy had drifted: it
// counted a written-off amount as collected, never subtracting deductions.
// Two implementations of one rule is how screens end up disagreeing, so
// there is now only the one.
const sumCollected = (rows: any[]) =>
  (rows ?? []).reduce((s: number, r: any) => s + receivedOf(r), 0)

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

const SRC_META: Record<string, { label: string; color: string }> = {
  just_dial: { label: 'Just Dial', color: '#ec4899' },
  website: { label: 'Website', color: '#3b82f6' },
  social_media: { label: 'Social Media', color: '#8b5cf6' },
  college: { label: 'College', color: '#10b981' },
  referral: { label: 'Referral', color: '#f59e0b' },
  walk_in: { label: 'Walk-in', color: '#94a3b8' },
  skillfinity: { label: 'Skillfinity', color: '#14b8a6' },
}

export async function AdminDashboard({ period }: { period: Period }) {
  const supabase = await createClient()
  const { from, to, prevFrom, prevTo, prevLabel } = period
  const per = periodName(period)
  const ranged = !!(from && to)
  const compare = !!(prevFrom && prevTo)

  // ---- query builders, each aware of the window it is being asked for ----
  const invoicesIn = (f: string | null, t: string | null, cols: string) => {
    // Deleting an invoice stamps deleted_at rather than dropping the row.
    // Without this filter a deleted invoice kept counting towards revenue
    // and pending fees — every other query in the app excludes them, and
    // the revenue ledger below already did.
    let q = supabase.from('invoices').select(cols).is('deleted_at', null)
    if (f && t) q = q.gte('issued_date', f).lte('issued_date', t)
    return q
  }
  // Collections recorded in the `revenue` table — aptitude fees, direct
  // payments. A separate ledger from invoices (no revenue row carries an
  // invoice number), so the two add up without double counting.
  // Ranged on payment_date, which is nullable: a collection with no payment
  // date belongs to no period and so only shows under Overall.
  const revenueIn = (f: string | null, t: string | null) => {
    let q = supabase.from('revenue')
      // `deductions` is here because receivedOf reads it — without it a
      // written-off amount reads as money collected.
      .select('received_amount, total_amt, amt, status, payment_date, deductions, bd')
      .is('deleted_at', null)
    if (f && t) q = q.gte('payment_date', f).lte('payment_date', t)
    return q
  }

  // Lead aggregates. Overall goes through the lead_stats RPC, which rolls
  // the whole table up in one round trip; a period pulls only the two
  // columns it groups by, for the rows inside the window.
  const leadAggregate = async () => {
    if (!ranged) {
      const stats = await supabase.rpc('lead_stats', { p_bd: null })
      const S = (stats as any)?.data ?? stats
      return {
        total: (S?.total ?? 0) as number,
        bySource: (S?.by_source ?? {}) as Record<string, number>,
        byBd: (S?.by_bd ?? {}) as Record<string, number>,
      }
    }
    const { data: rows = [] } = await supabase
      .from('leads').select('source, assigned_bd')
      .is('deleted_at', null)
      .gte('created_at', from!).lte('created_at', dayEnd(to!))
    const bySource: Record<string, number> = {}
    const byBd: Record<string, number> = {}
    for (const r of (rows ?? []) as any[]) {
      bySource[r.source] = (bySource[r.source] ?? 0) + 1
      const bd = r.assigned_bd ?? 'none'
      byBd[bd] = (byBd[bd] ?? 0) + 1
    }
    return { total: (rows ?? []).length, bySource, byBd }
  }

  // Enrolments ranged on enrolled_at — the date the course was actually
  // taken up, which is what "revenue earned this month" turns on.
  let enrolmentsQ = supabase.from('enrollments').select('batch_id, student_id, enrolled_at, batches(course_id)').is('deleted_at', null)
  if (ranged) enrolmentsQ = enrolmentsQ.gte('enrolled_at', from!).lte('enrolled_at', to!)

  // Courses come first because the interest cards below split leads by which
  // course they asked about. Skillfinity and Internship are matched by name
  // rather than a hard-coded id, so a re-seeded courses table keeps working.
  const { data: courses = [] } = await supabase.from('courses').select('id, name, fee')
  const skillfinityIds = (courses ?? []).filter((c: any) => /skillfinity/i.test(c.name)).map((c: any) => c.id)
  const internshipIds = (courses ?? []).filter((c: any) => /internship/i.test(c.name)).map((c: any) => c.id)
  const offerIds = [...skillfinityIds, ...internshipIds]

  // Leads counted by the course they came in asking about. "other" is any
  // recorded course that isn't Skillfinity or Internship — a lead with no
  // course recorded belongs to none of these three cards.
  const interestCount = (f: string | null, t: string | null, which: 'skillfinity' | 'internship' | 'other') => {
    const ids = which === 'skillfinity' ? skillfinityIds : which === 'internship' ? internshipIds : null
    if (ids && !ids.length) return Promise.resolve(0)
    return countRows(supabase, 'leads', f, t, (q: any) => {
      q = q.is('deleted_at', null)
      if (ids) return q.in('course_interest', ids)
      q = q.not('course_interest', 'is', null)
      return offerIds.length ? q.not('course_interest', 'in', `(${offerIds.join(',')})`) : q
    })
  }

  // Leads that reached "enrolled", ranged on created_at like every other
  // lead count here.
  //
  // This card used to count rows in `enrollments` by enrolled_at and link to
  // /students, which takes no date filter at all — so in July it read 0 and
  // opened a list of 34 students. Counting the leads instead means the card
  // and the page it opens are the same rows, which is the whole point of it
  // being a link. The enrolment rows are still read below, for Top Courses
  // by Revenue, which genuinely wants enrolments per course.
  const enrolledLeadCount = (f: string | null, t: string | null) =>
    countRows(supabase, 'leads', f, t, (q: any) => q.eq('status', 'enrolled').is('deleted_at', null))

  const INVOICE_COLS =
    'invoice_no, amount, status, issued_date, due_date, customer_name, customer_phone, students(full_name, mobile)'

  const [
    leadAgg, enrolledLeads, totalProjects, otherCourseLeads, skillfinityLeads, internshipLeads,
    { data: invoices = [] },
    { data: enrollments = [] }, { data: revenueRows = [] },
  ] = await Promise.all([
    leadAggregate(),
    enrolledLeadCount(from, to),
    // Soft-deleted projects stay in the table, same as leads and students.
    countRows(supabase, 'projects', from, to, (q: any) => q.is('deleted_at', null)),
    interestCount(from, to, 'other'),
    interestCount(from, to, 'skillfinity'),
    interestCount(from, to, 'internship'),
    invoicesIn(from, to, INVOICE_COLS),
    enrolmentsQ,
    revenueIn(from, to),
  ])

  const totalLeads = leadAgg.total
  const srcCountObj = leadAgg.bySource
  const bdCountObj = leadAgg.byBd

  // ---- finance ----
  const revenue = sumPaid(invoices as any[])
  const pendingFees = sumPending(invoices as any[])
  // Everything invoiced in the window regardless of status — what the
  // Invoices Generated tile reports alongside the plain count.
  const billed = ((invoices as any[]) ?? []).reduce((s: number, i: any) => s + Number(i.amount || 0), 0)
  const collected = sumCollected(revenueRows as any[])
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
  // `revenue` is the paid-invoice total; `collected` is the ledger's.

  // ---- the previous equivalent stretch, for the growth badges ----
  // Overall has nothing before it, so none of this runs there.
  const [
    prevLeads, prevEnrolledLeads, prevProjects,
    prevOther, prevSkillfinity, prevInternship,
    prevInvoices, prevRevenueRows,
  ] = compare
    ? await Promise.all([
        countRows(supabase, 'leads', prevFrom, prevTo, (q: any) => q.is('deleted_at', null)),
        enrolledLeadCount(prevFrom, prevTo),
        countRows(supabase, 'projects', prevFrom, prevTo, (q: any) => q.is('deleted_at', null)),
        interestCount(prevFrom, prevTo, 'other'),
        interestCount(prevFrom, prevTo, 'skillfinity'),
        interestCount(prevFrom, prevTo, 'internship'),
        invoicesIn(prevFrom, prevTo, 'amount, status').then((r: any) => r.data ?? []),
        revenueIn(prevFrom, prevTo).then((r: any) => r.data ?? []),
      ])
    : [0, 0, 0, 0, 0, 0, [] as any[], [] as any[]]

  const prevInvoiced = sumPaid(prevInvoices as any[])
  const prevCollected = sumCollected(prevRevenueRows as any[])
  const prevPending = sumPending(prevInvoices as any[])

  const delta = (current: number, previous: number, invert = false) =>
    compare ? { current, previous, note: prevLabel, invert } : undefined

  // ---- leads by source ----
  const sourceDonut = Object.keys(srcCountObj).map((s) => ({ name: SRC_META[s]?.label ?? s, value: srcCountObj[s], color: SRC_META[s]?.color ?? '#94a3b8' }))

  // ---- BD performance (leads per assigned BD, inside the period) ----
  const bdName: Record<string, string> = {}
  const bdIds = Object.keys(bdCountObj).filter((k) => k !== 'none')
  const { data: bdProfiles = [] } = bdIds.length ? await supabase.from('profiles').select('id, full_name').in('id', bdIds) : { data: [] }
  ;(bdProfiles ?? []).forEach((p: any) => (bdName[p.id] = p.full_name))
  const bdBars = bdIds.map((id) => ({ name: bdName[id] ?? '—', n: bdCountObj[id] })).sort((a, b) => b.n - a.n).slice(0, 5)
  const bdMax = Math.max(1, ...bdBars.map((b) => b.n))

  // ---- revenue trend (paid invoices, bucketed to suit the period) ----
  const trend = trendBuckets(
    (invoices as any[]).filter((i: any) => i.status === 'paid').map((i: any) => ({ date: i.issued_date, amount: Number(i.amount) })),
    period,
  )
  const trendTotal = trend.reduce((s, p) => s + p.value, 0)

  // ---- CTA destinations, carrying the period through ----
  // /leads filters on explicit from/to; /revenue and /invoicing read `period`.
  // Every CTA carries the selected range as from/to — the same params the
  // Leads, Revenue and Invoicing pages read — so a click lands on the same
  // window the dashboard is showing rather than the whole table.
  // Explicitly view=all rather than a bare /leads: these cards claim a total
  // and must land on the whole list. A bare /leads is where the filter memory
  // puts back whatever was last being worked, which would leave the card's
  // number and the list under it disagreeing again.
  const leadsQs = '?view=all' + (ranged ? `&from=${from}&to=${to}` : '')
  const rangeQs = ranged ? `from=${from}&to=${to}` : ''
  const withPq = (base: string, extra = '') => {
    const qs = [extra, rangeQs].filter(Boolean).join('&')
    return qs ? `${base}?${qs}` : base
  }
  // The interest cards count every stage, so their click-through opens the
  // All Leads view — the default Active view hides enrolled/lost rows and
  // would show fewer leads than the card claims.
  const courseLeadsHref = (c: string) =>
    '/leads?' + ['view=all', `course=${c}`, ranged ? `from=${from}&to=${to}` : ''].filter(Boolean).join('&')
  // view=all because the default Active view hides enrolled rows outright —
  // the card would claim a number the page then refused to show.
  const enrolledLeadsHref =
    '/leads?' + ['view=all', 'status=enrolled', ranged ? `from=${from}&to=${to}` : ''].filter(Boolean).join('&')

  // ---- collections per BD, for the period ----
  // `revenue.bd` is the denormalised display name — the same column a BD's
  // own dashboard totals their figure on, so the two agree. Paid invoices
  // are deliberately left out: an invoice records no BD, and splitting one
  // between people would be inventing the attribution.
  //
  // A collection recorded under no name is still money in, so it is shown
  // rather than dropped — as "Unattributed", which is also a prompt to go
  // and fix the row.
  const revPerBd: Record<string, number> = {}
  for (const r of (revenueRows ?? []) as any[]) {
    const who = (r.bd ?? '').trim()
    const amount = receivedOf(r)
    if (!amount) continue
    revPerBd[who || UNATTRIBUTED] = (revPerBd[who || UNATTRIBUTED] ?? 0) + amount
  }
  const revBars = Object.entries(revPerBd)
    .map(([name, amount]) => ({
      name,
      amount,
      // Each bar opens that BD's collections for the same period. The
      // unattributed one has no name to filter by, so it carries no href
      // and the chart leaves it inert.
      href: name === UNATTRIBUTED ? undefined : withPq('/revenue', `bd=${encodeURIComponent(name)}`),
    }))
    .sort((a, b) => b.amount - a.amount)

  // ---- top courses by revenue ----
  const enrPerCourse: Record<string, number> = {}
  ;(enrollments ?? []).forEach((e: any) => { const c = one(e.batches)?.course_id; if (c) enrPerCourse[c] = (enrPerCourse[c] ?? 0) + 1 })
  const topCourses = (courses ?? [])
    .map((c: any) => ({ name: c.name, students: enrPerCourse[c.id] ?? 0, revenue: (enrPerCourse[c.id] ?? 0) * Number(c.fee || 0) }))
    .sort((a: any, b: any) => b.revenue - a.revenue).slice(0, 5)

  // ---- what the pending-fee reminders are drafted from ----
  const pendingInvoices: PendingInvoice[] = (invoices as any[])
    .filter((i: any) => i.status === 'pending')
    .map((i: any) => ({
      invoice_no: i.invoice_no ?? null,
      name: one(i.students)?.full_name ?? i.customer_name ?? null,
      phone: one(i.students)?.mobile ?? i.customer_phone ?? null,
      amount: Number(i.amount || 0),
      due_date: i.due_date ?? null,
    }))
    .sort((a, b) => b.amount - a.amount)

  return (
    <div className="space-y-5">
      {ranged && (
        <p className="text-xs text-slate-500">
          Showing <span className="font-medium text-slate-700">{period.label}</span>
          {' · '}
          {from === to ? fmtDate(from) : `${fmtDate(from)} – ${fmtDate(to)}`}
        </p>
      )}

      {/* KPIs. The grid stretches every tile in a row to match the tallest, so
          they stay the same size as each other while that size still follows
          whatever the selected period actually renders — a growth badge on
          Today, nothing on Overall. The card centres its own contents so the
          ones with less to say don't leave the figure stranded at the top. */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {/* One destination per card — the screen that figure lives on — with
            the card itself as the link, the way the BD dashboard's are. */}
        <KpiCard
          icon={Users} label={`${per} Leads`} tint="bg-blue-50 text-blue-600"
          value={totalLeads.toLocaleString('en-IN')}
          delta={delta(totalLeads, prevLeads)}
          href={`/leads${leadsQs}`}
        />
        <KpiCard
          icon={GraduationCap} label={`${per} Enrollments`} tint="bg-violet-50 text-violet-600"
          value={enrolledLeads.toLocaleString('en-IN')}
          delta={delta(enrolledLeads, prevEnrolledLeads)}
          href={enrolledLeadsHref}
        />
        <KpiCard
          icon={IndianRupee} label={`${per} Invoiced`} tint="bg-emerald-50 text-emerald-600"
          value={inr(revenue)}
          delta={delta(revenue, prevInvoiced)}
          href={withPq('/invoicing', 'status=paid')}
        />
        <KpiCard
          icon={Banknote} label={`${per} Collected`} tint="bg-green-50 text-green-700"
          value={inr(collected)}
          delta={delta(collected, prevCollected)}
          href={withPq('/revenue')}
        />
        {/* Leads split by the course they enquired about. Courses is every
            recorded course that isn't Skillfinity or Internship (those have
            their own cards); a lead with no course recorded sits in none. */}
        <KpiCard
          icon={BookOpen} label="Courses" tint="bg-cyan-50 text-cyan-600"
          value={otherCourseLeads.toLocaleString('en-IN')}
          delta={delta(otherCourseLeads, prevOther)}
          href={courseLeadsHref('other')}
        />
        <KpiCard
          icon={Briefcase} label="Internships" tint="bg-indigo-50 text-indigo-600"
          value={internshipLeads.toLocaleString('en-IN')}
          delta={delta(internshipLeads, prevInternship)}
          href={internshipIds.length ? courseLeadsHref(internshipIds[0]) : undefined}
        />
        <KpiCard
          icon={FolderKanban} label={`${per} Projects`} tint="bg-amber-50 text-amber-600"
          value={totalProjects.toLocaleString('en-IN')}
          delta={delta(totalProjects, prevProjects)}
          href={withPq('/projects')}
        />
        <KpiCard
          icon={Receipt} label="Pending Payments" tint="bg-rose-50 text-rose-600"
          value={inr(pendingFees)}
          // Pending payments climbing is not growth, so the badge colours invert.
          delta={delta(pendingFees, prevPending, true)}
          href={withPq('/invoicing', 'status=pending')}
          // Tested here as well as inside the dialog: `extra` is a JSX element
          // and so always truthy, which would leave the card wearing an empty
          // divider row once the button itself rendered nothing.
          extra={pendingInvoices.length ? <FeeReminderDialog invoices={pendingInvoices} /> : undefined}
        />
        <KpiCard
          icon={Sparkles} label="Skillfinity" tint="bg-fuchsia-50 text-fuchsia-600"
          value={skillfinityLeads.toLocaleString('en-IN')}
          delta={delta(skillfinityLeads, prevSkillfinity)}
          href={skillfinityIds.length ? courseLeadsHref(skillfinityIds[0]) : undefined}
        />
      </div>

      {/* row 2 — four panels, two across. The trend is a line chart and
          needs width to read as a line rather than a zigzag; four in a row
          would leave each about 300px on a 1366 screen. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Revenue Trend" action="Revenue" href={withPq('/revenue')}>
          {trendTotal > 0
            ? <TrendLine data={trend} />
            : <p className="py-10 text-center text-sm text-slate-400">No revenue recorded in this period.</p>}
        </Panel>
        <Panel title="Revenue by BD" action="Revenue" href={withPq('/revenue')}>
          {revBars.length ? (
            <RevenuePie data={revBars} />
          ) : (
            <p className="py-10 text-center text-sm text-slate-400">No revenue recorded in this period.</p>
          )}
        </Panel>
        <Panel title="Leads by Source" action="All leads" href={`/leads${leadsQs}`}>
          <CategoryDonut data={sourceDonut} centerLabel="Leads" />
        </Panel>
        <Panel title="BD Performance" action="Analytics" href="/analytics">
          {bdBars.map((b) => (
            <div key={b.name} className="mb-3">
              <div className="mb-1 flex justify-between text-xs"><span className="text-slate-600">{b.name}</span><span className="font-medium text-slate-800">{b.n.toLocaleString('en-IN')}</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-500" style={{ width: `${(b.n / bdMax) * 100}%` }} /></div>
            </div>
          ))}
          {!bdBars.length && <p className="text-sm text-slate-400">No leads assigned in this period.</p>}
        </Panel>
      </div>

      <AdminMarketingSummary />

      {/* row 3: finance + top courses */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Finance Overview" action="Invoicing" href={withPq('/invoicing')} className="lg:col-span-2">
          {/* Each tile is a link to the screen its figure lives on, styled to
              say so on hover the way the KPI cards do. */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Link href={withPq('/invoicing', 'status=paid')} className="rounded-lg bg-emerald-50 p-3 transition-all hover:shadow-md hover:ring-1 hover:ring-emerald-300">
              <p className="text-xs text-slate-500">Invoices Paid</p>
              <p className="text-base font-semibold text-emerald-700">{inr(revenue)}</p>
            </Link>
            {/* Everything billed in the period, paid or not — the ₹ side of
                the invoice count two tiles over. */}
            <Link href={withPq('/invoicing')} className="rounded-lg bg-blue-50 p-3 transition-all hover:shadow-md hover:ring-1 hover:ring-blue-300">
              <p className="text-xs text-slate-500">Invoices Generated</p>
              <p className="text-base font-semibold text-blue-700">{inr(billed)}</p>
            </Link>
            {/* Send Reminder lives on the Pending Payments KPI card above, so
                this tile is just the clickable figure. */}
            <Link href={withPq('/invoicing', 'status=pending')} className="rounded-lg bg-rose-50 p-3 transition-all hover:shadow-md hover:ring-1 hover:ring-rose-300">
              <p className="text-xs text-slate-500">Pending Invoices</p>
              <p className="text-base font-semibold text-rose-700">{inr(pendingFees)}</p>
            </Link>
            <Link href={withPq('/invoicing')} className="rounded-lg bg-violet-50 p-3 transition-all hover:shadow-md hover:ring-1 hover:ring-violet-300">
              <p className="text-xs text-slate-500">Total Invoices Generated</p>
              <p className="text-base font-semibold text-violet-700">{(invoices ?? []).length}</p>
            </Link>
          </div>
        </Panel>
        <Panel title="Top Courses by Revenue" action="Courses" href="/courses">
          <ul className="space-y-2 text-sm">
            {topCourses.map((c: any) => (
              <li key={c.name} className="flex items-center justify-between">
                <span className="text-slate-700">{c.name}</span>
                <span className="text-xs text-slate-400">{c.students} students</span>
                <span className="font-medium text-slate-800">{inr(c.revenue)}</span>
              </li>
            ))}
            {!topCourses.length && <li className="text-slate-400">No enrolments in this period.</li>}
          </ul>
        </Panel>
      </div>

    </div>
  )
}
