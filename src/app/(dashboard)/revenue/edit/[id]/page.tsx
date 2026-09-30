import { notFound } from 'next/navigation'
import { createClient } from '@/lib/api/server'
import type { Role } from '@/lib/rbac'
import { canEditRevenue } from '@/lib/revenue'
import { EditRevenueForm, type RevenueRow } from '@/components/revenue/EditRevenueForm'

export default async function EditRevenuePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: me } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user!.id)
    .single()
  const role = ((me as any)?.role ?? 'student') as Role
  const myName = ((me as any)?.full_name ?? '').trim()

  const { data: row } = await supabase
    .from('revenue')
    .select(
      `id,
      payment_date,
      due_date,
      date,
      name,
      phone,
      program,
      amt,
      total_amt,
      received_amount,
      pending_amount,
      deductions,
      mode,
      src,
      status,
      bd`
    )
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  // Row-level security already hides other BDs' collections, so a missing
  // row here is either a deleted one or one this user was never allowed to
  // read — both are a 404 as far as they're concerned.
  if (!row) notFound()

  // Checked again rather than relying on the link being hidden: the edit
  // page is reachable by typing its URL, and an admin reading someone
  // else's row legitimately gets through here where a BD does not.
  if (!canEditRevenue(row as any, role, myName)) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Edit Revenue</h1>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <p className="text-slate-600">
            This collection was entered by {(row as any).bd || 'another BD'} and can
            only be edited by them or an admin.
          </p>
          <a href="/revenue" className="mt-4 inline-block rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600">
            Back to Revenue
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Edit Revenue</h1>
        <p className="text-slate-500">
          {(row as any).name}
          {(row as any).bd ? ` · entered by ${(row as any).bd}` : ''}
        </p>
      </div>

      <EditRevenueForm row={row as unknown as RevenueRow} />
    </div>
  )
}
