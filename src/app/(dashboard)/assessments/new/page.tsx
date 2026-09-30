import { createClient } from '@/lib/api/server'
import { AssessmentForm } from '@/components/assessments/AssessmentForm'
import { getViewer } from '@/lib/trainer'
import { loadBatchOptions } from '@/lib/assessments'

/** Add Assessment — its own page, as the form is too large for a panel. */
export default async function NewAssessmentPage() {
  const supabase = await createClient()
  const viewer = await getViewer(supabase)
  const batches = await loadBatchOptions(supabase, viewer)

  return <AssessmentForm batches={batches} userId={viewer.id} />
}
