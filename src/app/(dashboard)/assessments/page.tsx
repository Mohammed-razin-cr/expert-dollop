import { createClient } from '@/lib/api/server'
import { AssessmentsBoard } from '@/components/assessments/AssessmentsBoard'
import { getViewer } from '@/lib/trainer'
import { loadAssessments } from '@/lib/assessments'

/**
 * Assessments — the papers set for a batch.
 *
 * A trainer sees papers for batches they run; staff see all. This screen
 * used to list student_assessments, an ad-hoc score log that was empty
 * everywhere and had no route into the rest of the product.
 */
export default async function AssessmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const sp = await searchParams
  const supabase = await createClient()
  const viewer = await getViewer(supabase)
  const data = await loadAssessments(supabase, viewer)

  // ?status= lets the dashboard card land on the work it counted.
  const allowed = ['unmarked', 'marked']
  const initialStatus = allowed.includes(sp.status ?? '') ? (sp.status as string) : 'all'

  return (
    <AssessmentsBoard
      rows={data.rows}
      stats={data.stats}
      batches={data.batches}
      initialStatus={initialStatus}
    />
  )
}
