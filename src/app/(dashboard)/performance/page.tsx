import Link from 'next/link'
import { createClient } from '@/lib/api/server'
import { isStaff, ROLE_LABELS, type Role } from '@/lib/rbac'
import { LiveSelect } from '@/components/shared/LiveSelect'

const inr = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN')

// `href` is set only where a card can land on the same figures it reports;
// a derived ratio has no list behind it, so those stay plain.
type Kpi = { label: string; value: string | number; href?: string }

/**
 * Performance dashboard.
 *
 * Everyone sees their own numbers. Only super_admin/admin get the staff
 * picker and may view anyone else's — enforced on the server, not by
 * hiding the control, so a hand-typed ?u= cannot read another person's
 * collections.
 *
 * KPIs follow the *selected* person's role: lead and revenue figures for a
 * BD, teaching figures for a trainer, org-wide totals for an admin.
 */
export default async function PerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ u?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: me } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user!.id)
    .single()

  const myRole = ((me as any)?.role ?? 'student') as Role
  const canViewAll = isStaff(myRole)

  // The requested id is honoured only for staff; everyone else is pinned to
  // themselves regardless of what the URL says.
  const params = await searchParams
  const targetId = canViewAll && params.u ? params.u : user!.id

  const { data: target } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', targetId)
    .single()

  const targetName = (target as any)?.full_name ?? ((me as any)?.full_name ?? '')
  const targetRole = ((target as any)?.role ?? myRole) as Role
  const isSelf = targetId === user!.id

  // Staff picker: everyone who does real work in the system.
  const { data: staff = [] } = canViewAll
    ? await supabase
        .from('profiles')
        .select('id, full_name, role')
        .in('role', ['super_admin', 'admin', 'bd', 'counsellor', 'trainer'])
        .is('deleted_at', null)
        .order('role')
        .order('full_name')
    : { data: [] }

  let kpis: Kpi[] = []
  let byStatus: Record<string, number> = {}

  if (targetRole === 'trainer') {
    const { data: batches = [] } = await supabase
      .from('batches')
      .select('id, name, progress')
      .eq('trainer_id', targetId)
      .is('deleted_at', null)

    const batchIds = (batches ?? []).map((b: any) => b.id)

    const [enrolled, marked, topics, graded] = await Promise.all([
      batchIds.length
        ? supabase
            .from('enrollments')
            .select('*', { count: 'exact', head: true })
            .in('batch_id', batchIds)
            .is('deleted_at', null)
        : Promise.resolve({ count: 0 }),
      supabase
        .from('attendance')
        .select('*', { count: 'exact', head: true })
        .eq('marked_by', targetId)
        .is('deleted_at', null),
      supabase
        .from('topics')
        .select('*', { count: 'exact', head: true })
        .eq('trainer_id', targetId)
        .is('deleted_at', null),
      supabase
        .from('student_assessments')
        .select('*', { count: 'exact', head: true })
        .eq('created_by', targetId)
        .is('deleted_at', null),
    ])

    const avgProgress = (batches ?? []).length
      ? Math.round(
          (batches ?? []).reduce((s: number, b: any) => s + Number(b.progress || 0), 0) /
            (batches ?? []).length,
        )
      : 0

    // Every trainer screen scopes to whoever is signed in and takes no
    // trainer parameter, so these link only on your own page — from an admin
    // viewing a trainer they would show the admin's own work instead.
    //
    // Avg Batch Progress is an average, with no list behind it. Assessments
    // Graded counts student_assessments, the ad-hoc score log; /assessments is
    // built on the unrelated `assessments` table (see lib/assessments.ts), so
    // it would land on a different set of things than the card counted.
    kpis = [
      { label: 'Batches', value: (batches ?? []).length, href: isSelf ? '/batches' : undefined },
      { label: 'Students', value: (enrolled as any).count ?? 0, href: isSelf ? '/students' : undefined },
      { label: 'Avg Batch Progress', value: avgProgress + '%' },
      { label: 'Attendance Marked', value: (marked as any).count ?? 0, href: isSelf ? '/attendance' : undefined },
      { label: 'Topics Covered', value: (topics as any).count ?? 0, href: isSelf ? '/topics' : undefined },
      { label: 'Assessments Graded', value: (graded as any).count ?? 0 },
    ]
  } else {
    // BD figures for a BD (or the BD-equivalent counsellor); org-wide when
    // an admin views themselves.
    const pBd = targetRole === 'bd' || targetRole === 'counsellor' ? targetId : null

    const [{ data: stats }, { data: rev = [] }, fuRes] = await Promise.all([
      supabase.rpc('lead_stats', { p_bd: pBd }),
      pBd
        ? supabase.from('revenue').select('amt, status').eq('bd', targetName).is('deleted_at', null)
        : supabase.from('revenue').select('amt, status').is('deleted_at', null),
      pBd
        ? supabase.from('followups').select('*', { count: 'exact', head: true }).eq('bd_id', targetId)
        : supabase.from('followups').select('*', { count: 'exact', head: true }),
    ])

    byStatus = (stats as any)?.by_status ?? {}
    const total = (stats as any)?.total ?? 0
    const enrolled = byStatus['enrolled'] ?? 0
    const collected = (rev ?? [])
      .filter((r: any) => r.status === 'Received')
      .reduce((s: number, r: any) => s + Number(r.amt || 0), 0)
    const convRate = total ? Math.round((enrolled / total) * 100) : 0

    // The leads list takes an assigned_bd, so those two cards can point at
    // this person's leads whoever is looking. Revenue and Follow-ups have no
    // such parameter — they scope to whoever is signed in — so they are only
    // linked on your own page, where that scope is the same one the card
    // counted. Admin viewing themselves is org-wide on both sides, so it
    // lines up there too.
    const bdQ = pBd ? `&assigned_bd=${pBd}` : ''
    kpis = [
      { label: pBd ? 'Leads' : 'Total Leads', value: total.toLocaleString('en-IN'), href: `/leads?view=all${bdQ}` },
      { label: 'Converted', value: enrolled, href: `/leads?status=enrolled${bdQ}` },
      { label: 'Conversion Rate', value: convRate + '%' },
      { label: 'Follow-ups Logged', value: fuRes.count ?? 0, href: isSelf ? '/followups?filter=all' : undefined },
      { label: 'Collections', value: inr(collected), href: isSelf ? '/revenue?status=Received' : undefined },
      // Commission is a BD incentive; it means nothing on an org-wide view.
      ...(pBd ? [{ label: 'Est. Commission', value: inr(Math.round(collected * 0.05)) }] : []),
    ]
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            {isSelf ? 'My Performance' : `${targetName}'s Performance`}
          </h1>
          <p className="text-sm text-slate-500">
            {targetName} · {ROLE_LABELS[targetRole] ?? targetRole}
          </p>
        </div>

        {/* Applies on pick — the View button went with the form. */}
        {canViewAll && (
          <LiveSelect
            name="u"
            value={targetId}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {(staff ?? []).map((s: any) => (
              <option key={s.id} value={s.id}>
                {s.full_name} — {ROLE_LABELS[s.role as Role] ?? s.role}
              </option>
            ))}
          </LiveSelect>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k) => {
          const face = (
            <>
              <div className="text-xs text-slate-500">{k.label}</div>
              <div className="mt-1 text-xl font-semibold text-slate-900">{k.value}</div>
            </>
          )
          const box = 'rounded-xl border border-slate-200 bg-white p-4'
          return k.href ? (
            <Link key={k.label} href={k.href} className={`${box} transition hover:border-blue-300 hover:shadow-sm`}>
              {face}
            </Link>
          ) : (
            <div key={k.label} className={box}>{face}</div>
          )
        })}
      </div>

      {targetRole !== 'trainer' && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-800">
            Leads by Stage
          </div>
          <table className="w-full text-sm">
            <tbody>
              {Object.entries(byStatus).map(([k, v]) => (
                <tr key={k} className="border-t border-slate-100">
                  <td className="px-4 py-2.5 capitalize text-slate-600">{k.replace('_', ' ')}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-slate-800">
                    {(v as number).toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
