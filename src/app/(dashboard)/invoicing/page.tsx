import { createClient } from '@/lib/api/server'
import { resolveRange, resolvePeriod } from '@/lib/period'
import { CreateInvoiceForm, InvoiceStatusSelect, EditInvoiceButton } from '@/components/invoicing/InvoiceForms'
import { InvoicePrint } from '@/components/invoicing/InvoicePrint'
import { InvoiceExport } from '@/components/invoicing/InvoiceExport'
import { SoftDeleteButton } from '@/components/shared/SoftDeleteButton'
import { DateRangeFilter } from '@/components/shared/DateRangeFilter'
import { LiveSelect } from '@/components/shared/LiveSelect'
import { cached } from '@/lib/cache/cached'

const one = (x: any) => (Array.isArray(x) ? x[0] : x)
const inr = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN')
// Not collected yet. Overdue is unpaid money the same as pending is;
// cancelled is not owed at all, so it is deliberately not here.
const OUTSTANDING = ['pending', 'overdue']

const PAGE_SIZE = 50
const fmtD = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

export default async function InvoicingPage({
  searchParams,
}: {
    searchParams: Promise<{page?: string;from?: string;to?: string;status?: string;period?: string;bd?: string;project_id?: string;}>
    }) {
  const sp = await searchParams
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1)
  // From a project's "Generate Invoice" link — opens Create Invoice with
  // that project already picked.
  const initialProjectId = /^[0-9a-f-]{36}$/i.test(sp.project_id ?? '') ? sp.project_id! : ''
  const from = (page - 1) * PAGE_SIZE
  const status = sp.status ?? ''
  // Who raised the invoice. `created_by` is stamped by CreateInvoiceForm, so
  // this narrows anything raised through the app; invoices that predate the
  // column carry null and belong to nobody, which is why "Unassigned" is an
  // option rather than those rows quietly vanishing from every choice.
  const bd = /^[0-9a-f-]{36}$/i.test(sp.bd ?? '') || sp.bd === 'none' ? sp.bd! : ''
  // The raw query value, kept only to round-trip through qs() below — the
  // resolved period object (with its actual from/to bounds) is `period`.
  const periodParam = sp.period ?? ''

  // Free start/end dates, same control as the Leads page. Either side may
  // be left open. An explicit range wins over the period switcher below.
  const dRe = /^\d{4}-\d{2}-\d{2}$/
  const dFrom = sp.from && dRe.test(sp.from) ? sp.from : ''
  const dTo = sp.to && dRe.test(sp.to) ? sp.to : ''

  // Opened with nothing asked for, this shows the current month — the 1st
  // to today, rolling forward on its own as the date changes — rather than
  // every invoice ever raised. The "All time" control below (period=overall)
  // or an explicit date range both override it, the same way the dashboard's
  // period filter works.
  const period = dFrom || dTo ? resolveRange(dFrom, dTo) : resolvePeriod(periodParam || 'month')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  const isAdmin = ['admin', 'super_admin'].includes((me as any)?.role)

  // base filters shared by list + export + totals
  const applyRange = (q: any) => {
    let r = q.is('deleted_at', null)
    if (period.from) r = r.gte('issued_date', period.from)
    if (period.to) r = r.lte('issued_date', period.to)
    if (status === 'outstanding') r = r.in('status', OUTSTANDING)
    else if (status) r = r.eq('status', status)
    if (bd === 'none') r = r.is('created_by', null)
    else if (bd) r = r.eq('created_by', bd)
    return r
  }

  // students, projects and the BD roster are fixed picker/filter lookups —
  // untouched by this page's own period/status/bd filters — so they're
  // cached separately from the actual invoice data below. `students_read`
  // and `projects`' RLS are both flat "any authenticated user" reads,
  // identical for everyone; `profiles` is not (see the Leads page's BD
  // roster comment), so that one is cached per-user instead.
  const [students, projects, bds, invoiceResults] = await Promise.all([
    cached('invoicing-page:students', 120, async () => {
      const { data } = await supabase.from('students').select('id, full_name').order('full_name').limit(500)
      return data ?? []
    }),
    // Only projects with a committed vendor engagement make sense to bill:
    // new/in_discussion (nothing ordered yet) and declined (fell through)
    // are left out, project_ordered/in_progress/delivered all still get
    // generate-invoice.
    cached('invoicing-page:projects', 120, async () => {
      const { data } = await supabase.from('projects').select('id, name, project_name, college, department, mobile, amount_paid, referral_deduction, status').is('deleted_at', null).in('status', ['project_ordered', 'in_progress', 'delivered']).order('project_name').limit(500)
      return data ?? []
    }),
    // Counsellor is BD-equivalent, so it belongs in this list the way it does
    // in the Leads page's BD filter.
    cached(`invoicing-page:bd-roster:${user!.id}`, 180, async () => {
      const { data } = await supabase.from('profiles').select('id, full_name').in('role', ['bd', 'counsellor']).order('full_name')
      return data ?? []
    }),
    Promise.all([
      applyRange(supabase.from('invoices').select(`id,invoice_no,amount,status,issued_date,due_date,customer_name,student_id,project_id,created_by,students(full_name,mobile,email,primary_course,place_city,current_location,branch,degree,cgpa,year_of_passing,graduation_status,dob),projects(name,project_name,college,department,mobile,referral_deduction)`, { count: 'exact' }))
      // .select('id, invoice_no, amount, status, issued_date, due_date, customer_name, student_id, students(full_name)', { count: 'exact' }))
        .order('issued_date', { ascending: false }).range(from, from + PAGE_SIZE - 1),
      applyRange(supabase.from('invoices').select('amount, status')),
      applyRange(supabase.from('invoices').select('invoice_no, amount, status, issued_date, due_date, customer_name, students(full_name), projects(name, project_name)'))
        .order('issued_date', { ascending: false }).limit(5000),
    ]),
  ])
  const [{ data: invoices = [], count = 0 }, { data: sumRows = [] }, { data: exportRows = [] }] = invoiceResults

  const sum = (rows: any[]) => rows.reduce((s: number, i: any) => s + Number(i.amount ?? 0), 0)
  const paid = sum((sumRows ?? []).filter((i: any) => i.status === 'paid'))
  // Pending means not collected, which is pending and overdue both. Counting
  // only 'pending' would leave an overdue invoice out of the money still
  // owed while it is exactly that.
  const pending = sum((sumRows ?? []).filter((i: any) => OUTSTANDING.includes(i.status)))
  // Everything raised, whatever became of it — cancelled included, since it
  // was still billed.
  const billed = sum((sumRows ?? []) as any[])
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE))

  const billedTo = (i: any) => one(i.students)?.full_name ?? one(i.projects)?.project_name ?? one(i.projects)?.name ?? i.customer_name ?? null

  const exportData = (exportRows ?? []).map((i: any) => ({
    invoice_no: i.invoice_no,
    student: billedTo(i),
    amount: Number(i.amount || 0),
    status: i.status,
    issued_date: i.issued_date,
    due_date: i.due_date,
  }))
  const exportLabel = dFrom || dTo ? `${dFrom || 'start'}_to_${dTo || 'today'}` : period.label.replace(/\s+/g, '_')

  const qs = (patch: Record<string, string>) => {
    const p = new URLSearchParams()
    const st = patch.status ?? status
    const pr = patch.period ?? periodParam
    // Paging must not quietly widen the range back out to everything.
    if (dFrom) p.set('from', dFrom)
    if (dTo) p.set('to', dTo)
    if (st) p.set('status', st)
    if (pr) p.set('period', pr)
    if (bd) p.set('bd', bd)
    const pg = patch.page ?? '1'
    if (pg && pg !== '1') p.set('page', pg)
    const s = p.toString()
    return s ? `/invoicing?${s}` : '/invoicing'
  }

  // What the date filter navigates from: everything except the range itself.
  // period is deliberately left out — picking explicit dates replaces a
  // dashboard period link rather than fighting it.
  const baseP = new URLSearchParams()
  if (status) baseP.set('status', status)
  if (bd) baseP.set('bd', bd)
  const baseHref = baseP.toString() ? `/invoicing?${baseP.toString()}` : '/invoicing'

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Invoicing</h1>
          <p className="text-sm text-slate-500">
            {(count ?? 0).toLocaleString('en-IN')} invoices
            {dFrom || dTo ? (
              ` · ${dFrom ? fmtD(dFrom) : '…'} – ${dTo ? fmtD(dTo) : 'today'}`
            ) : (
              <>
                {' · '}
                <span className="font-medium text-slate-600">{period.label}</span>
                {' · '}
                {period.key === 'overall' ? (
                  <a href={baseHref} className="font-medium text-blue-600 hover:underline">This month</a>
                ) : (
                  <a href={`${baseHref}${baseHref.includes('?') ? '&' : '?'}period=overall`} className="font-medium text-blue-600 hover:underline">All time</a>
                )}
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Start/end date filter, the same control the Leads page uses —
              applies to table, totals, and export alike. Each side applies as
              picked; Clear inside the control drops the range (back to the
              This Month default, the same as the All time / This month
              toggle above). */}
          <DateRangeFilter from={dFrom || period.from || ''} to={dTo || period.to || ''} baseHref={baseHref} />
          <LiveSelect
            name="bd"
            value={bd}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300"
          >
            <option value="">All BDs</option>
            {((bds ?? []) as any[]).map((b) => (
              <option key={b.id} value={b.id}>{b.full_name}</option>
            ))}
            {/* Invoices raised before created_by was stamped belong to
                nobody. Without this they would be unreachable from any
                choice: every named BD returns none of them, and All BDs
                shows them mixed in with everything else. */}
            <option value="none">Unassigned</option>
          </LiveSelect>
          <InvoiceExport rows={exportData} label={exportLabel} />
          <CreateInvoiceForm students={(students ?? []) as any} projects={(projects ?? []) as any} initialProjectId={initialProjectId || undefined} />
        </div>
      </div>

      {/* Each card opens the invoices its own figure was added up from, the
          way the Revenue page's do, and keeps whatever BD and date range are
          already applied. The tile you are looking at reads as selected
          rather than as somewhere else to go. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total Invoices', value: (count ?? 0).toLocaleString('en-IN'), st: '', on: !status },
          { label: 'Collected', value: inr(paid), st: 'paid', on: status === 'paid' },
          { label: 'Pending', value: inr(pending), st: 'outstanding', on: status === 'outstanding' },
          { label: 'Total Billed', value: inr(billed), st: '', on: !status },
        ].map((c) => (
          <a
            key={c.label}
            href={qs({ status: c.st })}
            className={`rounded-xl border bg-white p-4 transition-all hover:border-blue-400 hover:shadow-sm ${
              c.on ? 'border-blue-400 ring-1 ring-blue-100' : 'border-slate-200'
            }`}
          >
            <div className="text-xs text-slate-500">{c.label}</div>
            <div className="mt-1 text-xl font-semibold text-slate-900">{c.value}</div>
          </a>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Invoice No</th>
              <th className="px-4 py-3 font-medium">Billed To</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Issued</th>
              <th className="px-4 py-3 font-medium">Due</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(invoices ?? []).map((i: any) => {
              // Everyone sees every invoice; changing one is for whoever
              // issued it, or an admin. Rows from before created_by was
              // stamped have no issuer and are admin-only to change — the
              // same rule the invoices RLS policies enforce, mirrored here
              // so the row doesn't offer controls the write would refuse.
              const mine = isAdmin || (!!i.created_by && i.created_by === user!.id)
              return (
              <tr key={i.id} className="border-t border-slate-100">
                <td className="px-4 py-2.5 font-medium text-slate-800">{i.invoice_no}</td>
                <td className="px-4 py-2.5 text-slate-600">
                  {billedTo(i) ?? '—'}
                  {i.project_id && <span className="ml-1.5 rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-medium text-purple-600">Project</span>}
                </td>
                <td className="px-4 py-2.5 text-slate-700">{inr(i.amount)}</td>
                <td className="px-4 py-2.5 text-slate-500">{i.issued_date ?? '—'}</td>
                <td className="px-4 py-2.5 text-slate-500">{i.due_date ?? '—'}</td>
                <td className="px-4 py-2.5"><InvoiceStatusSelect id={i.id} status={i.status} canEdit={mine} /></td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                   <InvoicePrint
                      invoice={{
                        invoice_no: i.invoice_no,
                        amount: i.amount,
                        student: billedTo(i),
                        kind: i.project_id ? 'project' : 'student',
                        personName: one(i.projects)?.name,
                        projectTitle: one(i.projects)?.project_name,
                        college: one(i.projects)?.college,
                        department: one(i.projects)?.department,
                        referralDeduction: one(i.projects)?.referral_deduction,

                        mobile: one(i.students)?.mobile ?? one(i.projects)?.mobile,
                        email: one(i.students)?.email,
                        course: one(i.students)?.primary_course,
                        place_city: one(i.students)?.place_city,
                        current_location: one(i.students)?.current_location,
                        branch: one(i.students)?.branch,
                        degree: one(i.students)?.degree,
                        cgpa: one(i.students)?.cgpa,
                        year_of_passing: one(i.students)?.year_of_passing,
                        graduation_status: one(i.students)?.graduation_status,
                        dob: one(i.students)?.dob,

                        status: i.status,
                        issued_date: i.issued_date,
                        due_date: i.due_date,
                      }}
                    />
                    {mine && <EditInvoiceButton
                      students={(students ?? []) as any}
                      projects={(projects ?? []) as any}
                      invoice={{ id: i.id, invoice_no: i.invoice_no, student_id: i.student_id ?? '', project_id: i.project_id ?? '', amount: i.amount, status: i.status, issued_date: i.issued_date, due_date: i.due_date }}
                    />}
                    {isAdmin && <SoftDeleteButton table="invoices" id={i.id} confirmText={`Delete invoice ${i.invoice_no}?`} />}
                  </div>
                </td>
              </tr>
              )
            })}
            {!(invoices ?? []).length && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">No invoices for this period.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-500">Page {page} of {totalPages}</span>
        <div className="flex gap-2">
          {page > 1 && <a href={qs({ page: String(page - 1) })} className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-600">Previous</a>}
          {page < totalPages && <a href={qs({ page: String(page + 1) })} className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-600">Next</a>}
        </div>
      </div>
    </div>
  )
}
