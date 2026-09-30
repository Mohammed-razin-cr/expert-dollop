import { createClient } from '@/lib/api/server'
import { ReportsClient } from '@/components/reports/ReportsClient'
import { TrainerReports } from '@/components/reports/TrainerReports'
import { trainerBatchIds } from '@/lib/trainer'
import { redirect } from 'next/navigation'
import { isBD, isStaff, type Role } from '@/lib/rbac'

const one = (x: any) => (Array.isArray(x) ? x[0] : x)

/**
 * Reports.
 *
 * Trainers get their own board — attendance, assessment, performance,
 * batch progress and material usage, with a history of what they have
 * generated. Every other role falls through to the original export screen
 * below, unchanged, so the BD and admin CSV exports are untouched.
 */
export default async function ReportsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  const role = ((me as any)?.role ?? 'student') as Role

  if (role === 'trainer') {
    const myBatchIds = await trainerBatchIds(supabase, user!.id)

    const [{ data: rows = [] }, { data: batches = [] }] = await Promise.all([
      supabase
        .from('reports')
        .select('id, name, type, batch_id, date_from, date_to, created_at, batches(name), profiles(full_name)')
        .eq('generated_by', user!.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(500),
      supabase
        .from('batches')
        .select('id, name')
        .eq('trainer_id', user!.id)
        .is('deleted_at', null)
        .order('name'),
    ])

    return (
      <TrainerReports
        rows={(rows ?? []).map((r: any) => ({
          id: r.id,
          name: r.name,
          type: r.type,
          batch: one(r.batches)?.name ?? null,
          batchId: r.batch_id,
          from: r.date_from,
          to: r.date_to,
          generatedBy: one(r.profiles)?.full_name ?? null,
          createdAt: r.created_at,
        }))}
        batches={(batches ?? []).map((b: any) => ({ id: b.id, name: b.name }))}
        myBatchIds={myBatchIds}
        userId={user!.id}
      />
    )
  }

  // ---------------------------------------------------------------------
  // Export screen — BD / admin / super_admin.
  //
  // Everything on it leaves the building as CSV: leads, revenue, aptitude,
  // follow-ups, projects, and a full JSON backup. Trainers have their own
  // board above, and anyone else is sent away rather than left to find the
  // URL — a student is not offered Reports in their sidebar, but nothing
  // stopped them typing it, and the tables behind these buttons are
  // readable by any authenticated session.
  if (!isStaff(role) && !isBD(role)) redirect('/dashboard')

  // canSeeBD was `role !== 'trainer'`. Everyone still here is staff or BD,
  // which is exactly what the old expression evaluated to for these roles.
  // ---------------------------------------------------------------------
  return <ReportsClient canSeeBD />
}
