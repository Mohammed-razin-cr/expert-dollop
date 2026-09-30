import { createClient } from '@/lib/api/server'
import { isStaff, type Role } from '@/lib/rbac'
import { REVENUE_SOURCES, canEditRevenue, receivedOf, pendingOf, num } from '@/lib/revenue'
import { resolveRange, resolvePeriod } from '@/lib/period'
import {
  AddRevenueForm,
  VerifyBadge,
  DeleteRevenueButton,
  RevenueStatusSelect,
} from '@/components/revenue/RevenueForms'
import { LiveSearchInput } from '@/components/shared/LiveSearchInput'
import { LiveSelect } from '@/components/shared/LiveSelect'
import { DateRangeFilter } from '@/components/shared/DateRangeFilter'
import { cached } from '@/lib/cache/cached'
const PAGE_SIZE = 50
const inr = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN')
const fmtD = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

export default async function RevenuePage({
  searchParams,
}: {
  searchParams: Promise<{src?: string;status?: string;q?: string;page?: string; period?: string; from?: string; to?: string; bd?: string; collected?: string;}>
}) {
  const sp = await searchParams
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)
  const from = (page - 1) * PAGE_SIZE

  // Free start/end dates on payment_date, the same control the Leads and
  // Invoicing pages use. Either side may be left open. An explicit range
  // wins over a dashboard period link. A collection with no payment date
  // belongs to no range, so it only shows with the filter cleared — the
  // same rule the dashboards apply.
  const dRe = /^\d{4}-\d{2}-\d{2}$/
  const dFrom = sp.from && dRe.test(sp.from) ? sp.from : ''
  const dTo = sp.to && dRe.test(sp.to) ? sp.to : ''

  // Opened with nothing asked for, this shows the current month — the 1st
  // to today, rolling forward on its own — the same default the Dashboard
  // and Invoicing pages use, rather than the whole ledger ever collected.
  // `period=overall` (the All time link below) or an explicit date range
  // both override it.
  const periodParam = sp.period ?? ''
  const period = dFrom || dTo ? resolveRange(dFrom, dTo) : resolvePeriod(periodParam || 'month')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: me } = await supabase.from('profiles').select('role, full_name').eq('id', user!.id).single()
  const role = ((me as any)?.role ?? 'student') as Role
  const myName = ((me as any)?.full_name ?? '').trim()
  const isBD = role === 'bd' || role === 'counsellor'
  // Removing a collection is admin's alone — see the note on the button.
  // canEditRevenue still decides who may correct one.
  const canDelete = isStaff(role)
  const canVerify = role === 'admin' || role === 'super_admin'

  // Every filter the tabs, the search box and the period selector apply.
  //
  // One definition, handed to both queries below. They were spelled out
  // twice and had drifted: the table narrowed by tab, status and search
  // while the stats query narrowed by none of them, so selecting Projects
  // emptied the table and left Total Received still reporting the whole
  // ledger.
  //
  // PostgREST splits an `or` filter on commas and treats % as a wildcard,
  // so both are stripped before the search term reaches the query — the
  // same guard the Follow-ups page uses.
  const term = (sp.q ?? '').trim().replace(/[,%]/g, ' ')
  // `%` and `_` would turn an exact-but-case-blind match into a wildcard one.
  const bd = (sp.bd ?? '').trim().replace(/[%_]/g, '')
  // "Money actually came in on this row", which is not the same as status
  // Received: three rows here are still Pending but carry a part payment.
  // Total Received counts those, so filtering by status would show ₹37,158
  // under a card reading ₹57,158. This is receivedOf's own test, expressed
  // as a query.
  const collected = sp.collected === '1'
  // No per-BD narrowing any more: every BD reads the whole ledger (the
  // revenue_bd_select policy says the same), while editing stays gated
  // per row by canEditRevenue below — see it, don't touch it.
  const applyFilters = (x: any) => {
    let r = x.is('deleted_at', null)
    if (sp.src) r = r.eq('src', sp.src)
    if (sp.status) r = r.eq('status', sp.status)
    // Optional, never automatic: the ledger still opens whole, and this only
    // narrows it when the filter or a dashboard card asks for one BD's rows.
    // `bd` is the denormalised display name, the column those cards total on.
    //
    // ilike, not eq: the dashboard totals this column case-insensitively, so
    // an exact match here would disagree with the card that linked in the
    // moment a name was typed with different capitalisation. No wildcards,
    // so it stays an exact-but-case-blind match rather than a search.
    if (bd) r = r.ilike('bd', bd)
    if (collected) r = r.or('received_amount.gt.0,status.eq.Received')
    if (term) r = r.or(`name.ilike.%${term}%,phone.ilike.%${term}%`)
    if (period.from) r = r.gte('payment_date', period.from)
    if (period.to) r = r.lte('payment_date', period.to)
    return r
  }

  const pageQ = applyFilters(
    supabase.from('revenue').select(
      `id,
      payment_date,
      due_date,
      name,
      phone,
      program,
      total_amt,
      received_amount,
      pending_amount,
      deductions,
      mode,
      src,
      bd,
      status,
      verified,
      inv_no`,
      { count: 'exact' },
    ),
  )
    // Latest created OR most recently touched (e.g. marked Payment Done,
    // status flipped) surfaces first. payment_date alone missed this: many
    // rows have it unset, and it doesn't move when a row is only updated.
    .order('updated_at', { ascending: false })
    .range(from, from + PAGE_SIZE - 1)

  // `deductions` is here because receivedOf/pendingOf read it — without
  // it the stat cards would silently compute against 0.
  const statsQ = applyFilters(
    supabase.from('revenue').select('amt, total_amt, received_amount, pending_amount, deductions, status'),
  )

  const [{ data: rows = [], count = 0 }, { data: all = [] }] = await Promise.all([pageQ, statsQ])

  // The cards summarise every row matching the current filters, not just the
  // fifty on this page — tying them to `rows` would make Total Received
  // change as you paged through one tab.
  const filtered = (all ?? []) as any[]
  const received = filtered.reduce((s: number, r: any) => s + receivedOf(r), 0)
  const pending = filtered.reduce((s: number, r: any) => s + pendingOf(r), 0)
  // Received plus still owed, which is what is actually on the books.
  //
  // This summed total_amt before — the gross agreed figure — so it also
  // carried anything written off as a deduction: a referral payout or a
  // waiver counted towards "collections" nobody will ever collect. Unfiltered
  // that put it 2,500 above the two cards beside it, and the three could not
  // be reconciled by eye.
  //
  // Adding the two figures rather than re-deriving from total_amt is
  // deliberate: they come from receivedOf and pendingOf, so this card cannot
  // drift from the pair it is meant to total.
  const gross = received + pending
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE))

  // The fourth card names what the tab narrowed to, so its figure can never
  // be read as some other category's.
  const COLLECTION_LABELS: Record<string, string> = {
    Aptitude: 'Aptitude Fees',
    Projects: 'Project Fees',
    Courses: 'Course Fees',
    Webinars: 'Webinar Fees',
    Direct: 'Direct Collections',
  }
  // Who appears in the BD filter. Taken from the ledger rather than the
  // staff list: a collection recorded under someone who has since left still
  // needs to be reachable, and a name with no rows would be a dead option.
  // revenue_bd_select lets every BD/staff caller read the whole ledger (see
  // "every BD reads the whole ledger" above), so this is identical for
  // everyone and safe to cache under one shared key.
  const bdRows = await cached('revenue-page:bd-names', 120, async () => {
    const { data } = await supabase
      .from('revenue')
      .select('bd')
      .is('deleted_at', null)
      .not('bd', 'is', null)
    return data ?? []
  })
  const bdNames = [...new Set(((bdRows ?? []) as any[]).map((r) => (r.bd ?? '').trim()).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b),
  )

  const grossLabel = sp.src
    ? COLLECTION_LABELS[sp.src] ?? `${sp.src} Collections`
    : sp.status === 'Pending'
      ? 'Pending Collections'
      : 'Total Collections'


  // Every link on this page carries the filters it is not itself changing: a
  // tab switch that dropped the period, or a Next that dropped the tab, would
  // land on a different dataset than the one being read. `page` resets unless
  // asked for, since page 4 of All is rarely page 4 of Aptitude.
  const link = (patch: Record<string, string | number | null | undefined> = {}) => {
    const merged: Record<string, unknown> = {
      src: sp.src, status: sp.status, q: sp.q, period: sp.period, bd,
      collected: collected ? '1' : undefined,
      from: dFrom, to: dTo, page: undefined, ...patch,
    }
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries(merged)) {
      if (v !== undefined && v !== null && v !== '') p.set(k, String(v))
    }
    const qs = p.toString()
    return qs ? `/revenue?${qs}` : '/revenue'
  }

  // What the date filter navigates from: the active tab, status and search
  // term, without the range itself or a period link.
  const baseP = new URLSearchParams()
  if (sp.src) baseP.set('src', sp.src)
  if (sp.status) baseP.set('status', sp.status)
  if (sp.q) baseP.set('q', sp.q)
  if (bd) baseP.set('bd', bd)
  if (collected) baseP.set('collected', '1')
  const rangeBaseHref = baseP.toString() ? `/revenue?${baseP.toString()}` : '/revenue'

  // What the two date boxes show. An explicit range echoes back as typed;
  // otherwise they show the default period actually in force, so opening
  // the page on This Month puts 01-09-2026 and 11-09-2026 in them rather
  // than leaving them blank beside a filtered table. Overall's bounds are
  // null — not a range to show anybody, so the boxes stay empty for it.
  const shownFrom = dFrom || period.from || ''
  const shownTo = dTo || period.to || ''

  // Each card opens the rows its own figure was added up from, and nothing
  // wider: a card that lands you on a different set than the one it counted
  // is worse than one that does not move at all. `active` is what the card is
  // currently showing, so the tile you are already looking at reads as
  // selected rather than as somewhere else to go.
  //
  // Entries and the gross card summarise the whole tab whatever the status,
  // so theirs is the same view with the status narrowing dropped.
  const stats = [
    {
      label: 'Total Received',
      value: inr(received),
      href: link({ collected: '1', status: null }),
      active: collected,
    },
    {
      label: 'Pending',
      value: inr(pending),
      href: link({ status: 'Pending', collected: null }),
      active: sp.status === 'Pending',
    },
    {
      label: 'Entries',
      value: (count ?? 0).toLocaleString('en-IN'),
      href: link({ status: null, collected: null }),
      active: !sp.status && !collected,
    },
    {
      label: grossLabel,
      value: inr(gross),
      href: link({ status: null, collected: null }),
      active: !sp.status && !collected,
    },
  ]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Revenue</h1>
          <p className="text-sm text-slate-500">
            {bd ? `${bd}'s collections` : 'All BD collections'}
            {isBD ? ' — yours are editable' : ''}
            {' · '}
            {dFrom || dTo ? (
              `${dFrom ? fmtD(dFrom) : '…'} – ${dTo ? fmtD(dTo) : 'today'}`
            ) : (
              <>
                <span className="font-medium text-slate-600">{period.label}</span>
                {' · '}
                {period.key === 'overall' ? (
                  <a href={rangeBaseHref} className="font-medium text-blue-600 hover:underline">This month</a>
                ) : (
                  <a href={`${rangeBaseHref}${rangeBaseHref.includes('?') ? '&' : '?'}period=overall`} className="font-medium text-blue-600 hover:underline">All time</a>
                )}
              </>
            )}
          </p>
        </div>
        <AddRevenueForm bdName={myName} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <a
            key={s.label}
            href={s.href}
            className={`rounded-xl border bg-white p-4 transition-all hover:border-blue-400 hover:shadow-sm ${
              s.active ? 'border-blue-400 ring-1 ring-blue-100' : 'border-slate-200'
            }`}
          >
            <div className="text-xs text-slate-500">{s.label}</div>
            <div className="mt-1 text-xl font-semibold text-slate-900">{s.value}</div>
          </a>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
          <a href={link({ src: null, status: null })} className={`rounded-md px-2.5 py-1.5 font-medium ${!sp.src && !sp.status ? 'bg-blue-600 text-white' : 'text-slate-600'}`}>All</a>
          {REVENUE_SOURCES.map((s) => (
            <a key={s} href={link({ src: s, status: null })} className={`rounded-md px-2.5 py-1.5 font-medium ${sp.src === s ? 'bg-blue-600 text-white' : 'text-slate-600'}`}>{s}</a>
          ))}
          <a href={link({ status: 'Pending', src: null })} className={`rounded-md px-2.5 py-1.5 font-medium ${sp.status === 'Pending' ? 'bg-blue-600 text-white' : 'text-slate-600'}`}>Pending</a>
        </div>
        {/* Narrows as you type. The hidden src/status/period fields that used
            to sit here are gone with the form: the term is now applied by
            rewriting `q` on the current URL, which carries the active tab and
            period through untouched rather than re-submitting them. */}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {/* The date filter navigates from everything except the range
              itself; period is deliberately left out — picking explicit
              dates replaces a dashboard period link rather than fighting
              it. */}
          <DateRangeFilter from={shownFrom} to={shownTo} baseHref={rangeBaseHref} />
          <LiveSelect
            name="bd"
            value={bd}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300"
          >
            <option value="">All BDs</option>
            {bdNames.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </LiveSelect>
          <LiveSearchInput value={sp.q ?? ''} placeholder="Search name / phone…" className="w-56 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300" />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
  <tr>
    <th className="px-4 py-3 font-medium">Payment Date</th>
    <th className="px-4 py-3 font-medium">Due Date</th>
    <th className="px-4 py-3 font-medium">Name</th>
    <th className="px-4 py-3 font-medium">Program</th>
    <th className="px-4 py-3 font-medium">Total Amount</th>
    <th className="px-4 py-3 font-medium">Received Amount</th>
    <th className="px-4 py-3 font-medium">Deductions</th>
    <th className="px-4 py-3 font-medium">Pending Amount</th>
    <th className="px-4 py-3 font-medium">Mode</th>

    {/* Shown to everyone now that BDs see each other's rows — it's how a
        BD tells which collections are theirs to edit. */}
    <th className="px-4 py-3 font-medium">
      BD
    </th>

    <th className="px-4 py-3 font-medium">Status</th>
    <th className="px-4 py-3 font-medium">Verified</th>
    <th className="px-4 py-3 font-medium text-center">
      Actions
    </th>
  </tr>
</thead>
          <tbody>
            {(rows ?? []).map((r: any) => {
              // A collection is the BD's own to change; admins may change
              // any. Worked out once here and handed to every control in the
              // row, so Edit and Status can't disagree about it.
              const mine = canEditRevenue(r, role, myName)
              return (
              <tr key={r.id} className="border-t border-slate-100">
  {/* Payment Date */}
  <td className="px-4 py-2.5 text-slate-500">
    {r.payment_date ?? r.date ?? "—"}
  </td>

  {/* Due Date - Temporary */}
  <td className="px-4 py-2.5 text-slate-500">
   {r.due_date ?? "—"}
  </td>

  {/* Name */}
  <td className="px-4 py-2.5 font-medium text-slate-800">
    {r.name}
  </td>

  {/* Program */}
  <td className="px-4 py-2.5 text-slate-600">
    {r.program ?? "—"}
  </td>

  {/* Total Amount */}
  <td className="px-4 py-2.5">
    {inr(r.total_amt ?? r.amt)}
  </td>

  {/* Received Amount */}
  <td className="px-4 py-2.5">
    {inr(receivedOf(r))}
  </td>

  {/* Deductions */}
  <td className="px-4 py-2.5">
    {num(r.deductions) > 0 ? inr(r.deductions) : "—"}
  </td>

  {/* Pending Amount */}
  <td className="px-4 py-2.5">
    {inr(pendingOf(r))}
  </td>

  {/* Mode */}
  <td className="px-4 py-2.5">
    {r.mode ?? "—"}
  </td>

  <td className="px-4 py-2.5">
    {r.bd ?? "—"}
  </td>

  {/* <td className="px-4 py-2.5">
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        r.status === "Received"
          ? "bg-emerald-50 text-emerald-600"
          : "bg-amber-50 text-amber-600"
      }`}
    >
      {r.status}
    </span>
  </td> */}
  <td className="px-4 py-2.5">
    <RevenueStatusSelect
      id={r.id}
      status={r.status}
      canEdit={mine}
    />
  </td>
    

  <td className="px-4 py-2.5">
    <VerifyBadge
      id={r.id}
      verified={r.verified}
      canVerify={canVerify}
    />
  </td>

  {/* Actions */}
  <td className="px-4 py-2.5">
    <div className="flex justify-center gap-2">
      {mine ? (
        <>
          <a
            href={`/revenue/edit/${r.id}`}
            className="rounded bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-200"
          >
            Edit
          </a>
          {/* Deleting is admin's alone. A BD still corrects their own
              collection, but removing one is not the same act as fixing it:
              the money it recorded disappears from every total on the
              Revenue page and both dashboards, and whoever is reconciling
              has nothing left to reconcile against. */}
          {canDelete && <DeleteRevenueButton id={r.id} canEdit />}
        </>
      ) : (
        <span className="text-xs text-slate-400">—</span>
      )}
    </div>
  </td>
</tr>
              )
            })}
            {!(rows ?? []).length && <tr>
              <td colSpan={13} className="px-4 py-6 text-center text-slate-400">
                No revenue records found.
              </td>
            </tr>}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-500">Page {page} of {totalPages}</span>
        <div className="flex gap-2">
          {page > 1 && <a href={link({ page: page - 1 })} className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-600">Previous</a>}
          {page < totalPages && <a href={link({ page: page + 1 })} className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-600">Next</a>}
        </div>
      </div>
    </div>
  )
}
