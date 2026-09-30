import { notFound } from 'next/navigation'
import { createClient } from '@/lib/api/server'
import { AssignmentDetail } from '@/components/assignments/AssignmentDetail'
import { getViewer } from '@/lib/trainer'
import { loadAssignmentDetail } from '@/lib/assignments'

/** One assignment, with the whole class roster and their marks. */
export default async function AssignmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const viewer = await getViewer(supabase)

  const data = await loadAssignmentDetail(supabase, viewer, id)
  // null means it does not exist, or belongs to a batch this viewer does
  // not run. 404 rather than 403, so the URL never confirms the id exists.
  if (!data) notFound()

  return <AssignmentDetail data={data} />
}
