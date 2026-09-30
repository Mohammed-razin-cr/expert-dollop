import type { Role } from '@/lib/rbac'

/**
 * Helpers for scoping trainer screens to the signed-in trainer.
 *
 * The trainer sidebar is labelled "My Courses", "Daily Topics", "My Tasks"
 * — but several of those pages fetched the whole organisation's rows. These
 * helpers resolve "mine" consistently:
 *
 *   trainer -> batches they run -> students enrolled in those batches
 *
 * Staff (super_admin/admin) are never scoped: those same screens are in
 * the admin sidebar and are meant to show everything.
 */

/**
 * PostgREST renders an empty `.in()` list as `in.()`, which is a syntax
 * error. Passing this sentinel instead yields "matches nothing", which is
 * the correct answer for a trainer with no batches — and, importantly, is
 * not the same as "no filter", which would leak every row.
 */
export const MATCH_NOTHING = ['00000000-0000-0000-0000-000000000000']

/** Substitute the sentinel when a filter list came back empty. */
export const orNothing = (ids: string[]) => (ids.length ? ids : MATCH_NOTHING)

/**
 * Only the surface each helper actually uses. Splitting these means the
 * id-lookup helpers can be called from anywhere holding a query client,
 * without also demanding an auth client they never touch.
 */
export type DbClient = { from: (table: string) => any }
export type AuthClient = DbClient & {
  auth: { getUser: () => Promise<{ data: { user: { id: string } | null } }> }
}

export type Viewer = {
  id: string
  role: Role
  /** true for super_admin / admin — sees everything, never scoped */
  isStaff: boolean
  /** true when the viewer's own rows are the only ones they should see */
  scoped: boolean
}

/** Resolve the signed-in user and whether their view should be narrowed. */
export async function getViewer(supabase: AuthClient): Promise<Viewer> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: me } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single()

  const role = ((me as any)?.role ?? 'student') as Role
  const isStaff = role === 'super_admin' || role === 'admin'

  return { id: user!.id, role, isStaff, scoped: !isStaff }
}

/** Ids of the batches this trainer runs. */
export async function trainerBatchIds(supabase: DbClient, trainerId: string): Promise<string[]> {
  const { data = [] } = await supabase
    .from('batches')
    .select('id')
    .eq('trainer_id', trainerId)
    .is('deleted_at', null)

  return (data ?? []).map((b: any) => b.id)
}

/**
 * Ids of the students enrolled in this trainer's batches.
 * Returns [] when the trainer has no batches — callers should pass the
 * result through orNothing() before using it in `.in()`.
 */
export async function trainerStudentIds(supabase: DbClient, trainerId: string): Promise<string[]> {
  const batchIds = await trainerBatchIds(supabase, trainerId)
  if (!batchIds.length) return []

  const { data = [] } = await supabase
    .from('enrollments')
    .select('student_id')
    .in('batch_id', batchIds)
    .is('deleted_at', null)

  return [...new Set((data ?? []).map((e: any) => e.student_id))] as string[]
}
