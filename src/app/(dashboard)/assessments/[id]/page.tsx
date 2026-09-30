import { notFound } from 'next/navigation'
import { createClient } from '@/lib/api/server'
import { AssessmentDetail } from '@/components/assessments/AssessmentDetail'
import { getViewer } from '@/lib/trainer'
import { loadAssessmentDetail } from '@/lib/assessments'

/** One paper, with the whole class roster and their marks. */
export default async function AssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const viewer = await getViewer(supabase)

  const data = await loadAssessmentDetail(supabase, viewer, id)
  // null means it does not exist, or belongs to a batch this viewer does
  // not run. 404 rather than 403, so the URL never confirms the id exists.
  if (!data) notFound()

  return <AssessmentDetail data={data} />
}
