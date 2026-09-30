import { createClient } from '@/lib/api/server'
import { AssignmentsBoard } from '@/components/assignments/AssignmentsBoard'
import { getViewer } from '@/lib/trainer'
import { loadAssignments } from '@/lib/assignments'

/**
 * Assignments.
 *
 * A trainer sees homework for batches they run; staff see all. Scoping and
 * the submission arithmetic live in lib/assignments.
 */
export default async function AssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const sp = await searchParams
  const supabase = await createClient()
  const viewer = await getViewer(supabase)
  const data = await loadAssignments(supabase, viewer)

  // ?status= lets the dashboard card land on the work it counted, rather
  // than on the full list the reader then has to filter themselves.
  const allowed = ['open', 'closed', 'ungraded']
  const initialStatus = allowed.includes(sp.status ?? '') ? (sp.status as string) : 'all'

  return (
    <AssignmentsBoard
      rows={data.rows}
      stats={data.stats}
      batches={data.batches}
      topics={data.topics}
      userId={viewer.id}
      initialStatus={initialStatus}
    />
  )
}
