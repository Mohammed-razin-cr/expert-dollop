import Link from 'next/link'
import { createClient } from '@/lib/api/server'
import { type Role, isBD } from '@/lib/rbac'
import { resolveRange, resolvePeriod, periodName } from '@/lib/period'
import { TrainerDashboard } from '@/components/dashboards/TrainerDashboard'
import { BDDashboard } from '@/components/dashboards/BDDashboard'
import { AdminDashboard } from '@/components/dashboards/AdminDashboard'
import { DateRangeFilter } from '@/components/shared/DateRangeFilter'
import { MarketingModule } from '@/components/marketing/MarketingModule'
import { marketingData } from '@/lib/marketing'

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  )
}

async function count(supabase: Awaited<ReturnType<typeof createClient>>, table: string) {
  const { count } = await supabase.from(table).select('*', { count: 'exact', head: true })
  return count ?? 0
}
export default async function LeadsPage({searchParams,}: {searchParams: Promise<{from?: string;to?: string;period?: string;}>}){
  const sp = await searchParams
  // One resolver for the whole dashboard, so the filter, the panels and the
  // growth comparisons can never disagree about where the range starts.
  //
  // Opened with nothing asked for, it shows the current month — the 1st to
  // today — rather than all time. All time answers "how has the business
  // ever done", which is not the question anyone opens a dashboard on a
  // Tuesday to ask; it also drowns this month's movement in years of
  // history, and left every growth badge blank, since Overall has no
  // previous stretch to compare against.
  //
  // A picked range still wins, and `?period=overall` (or today/week) is the
  // way back to the old view — the control beside the date filter links to
  // it, so it stays reachable rather than becoming a URL only we know.
  const period = sp.from || sp.to ? resolveRange(sp.from, sp.to) : resolvePeriod(sp.period ?? 'month')
  const { from, to } = period

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, role_key')
    .eq('id', user!.id)
    .single()

  const role = (profile?.role ?? 'student') as Role
  const firstName = ((profile?.full_name as string) ?? '').split(' ')[0]

  if (profile?.role_key === 'digital_marketing') {
    const data = await marketingData()
    return <MarketingModule {...data} mode="dashboard" />
  }

  const titles: Record<Role, string> = {
    super_admin: 'Admin Dashboard',
    admin: 'Admin Dashboard',
    bd: 'BD Dashboard',
    counsellor: 'Counsellor Dashboard',
    trainer: 'Trainer Dashboard',
    student: 'My Dashboard',
  }

  const Header = (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">{titles[role]}</h1>
      <p className="text-sm text-slate-500">Welcome back, {firstName || 'there'}.</p>
    </div>
  )

  // What the two date boxes show. They read from the query string when one
  // was given, and otherwise from the period actually in force — so opening
  // the dashboard on the current month puts 01-09-2026 and 09-09-2026 in
  // them rather than leaving them blank beside a filtered page. An
  // open-ended range keeps its empty side: period.from is filled with
  // 1970-01-01 for querying, which is not a date to show anybody.
  const shown =
    sp.from || sp.to
      ? { from: sp.from ?? '', to: sp.to ?? '' }
      : { from: period.from ?? '', to: period.to ?? '' }

  // Says which stretch is on screen and offers the other one. Without this
  // a BD would see this month's numbers with nothing telling them so — the
  // admin dashboard prints the period, the BD one never did — and Overall
  // would have no way back now that it is no longer the default.
  const Controls = (
    <div className="flex flex-wrap items-center gap-3">
      <p className="text-xs text-slate-500">
        Showing <span className="font-medium text-slate-700">{period.label}</span>
        <span className="mx-1.5 text-slate-300">·</span>
        {period.key === 'overall' ? (
          <Link href="/dashboard" className="font-medium text-blue-600 hover:underline">
            This month
          </Link>
        ) : (
          <Link href="/dashboard?period=overall" className="font-medium text-blue-600 hover:underline">
            All time
          </Link>
        )}
      </p>
      <DateRangeFilter from={shown.from} to={shown.to} baseHref="/dashboard" />
    </div>
  )

  // ---- Trainer: full dashboard ----
  if (role === 'trainer') {
    return (
      <div className="space-y-5">
        {Header}
        <TrainerDashboard userId={user!.id} />
      </div>
    )
  }

  // ---- BD: full dashboard ----
  // if (role === 'bd') {
  //   return (
  //     <div className="space-y-5">
  //       {Header}
  //       <BDDashboard userId={user!.id} from={null} to={null} />
  //     </div>
  //   )
  // }
  // Counsellor shares the BD dashboard — same access, same view.
  if (isBD(role)) {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {Header}
          {Controls}
        </div>

        <BDDashboard
        userId={user!.id}
        from={from}
        to={to}
        period={period.key}
        periodName={periodName(period)}
        bdName={((profile?.full_name as string) ?? '').trim()}
      />
      </div>
    )
  }
  // ---- Admin / Super Admin: full dashboard ----
  if (role === 'super_admin' || role === 'admin') {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {Header}
          {Controls}
        </div>
        <AdminDashboard period={period} />
      </div>
    )
  }
  // ---- Student (only remaining role): simple view ----
  const [myCourses, myInvoices] = await Promise.all([
    count(supabase, 'enrollments'),
    count(supabase, 'invoices'),
  ])

  return (
    <div className="space-y-6">
      {Header}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="My Courses" value={myCourses} />
        <StatCard label="My Invoices" value={myInvoices} />
      </div>
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <p className="text-sm font-medium text-slate-700">Student portal</p>
        <p className="mt-1 text-sm text-slate-500">Your courses, attendance, and fees view comes in a later sprint.</p>
      </div>
    </div>
  )
}
