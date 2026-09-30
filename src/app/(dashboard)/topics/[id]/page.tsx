import { notFound } from 'next/navigation'
import { createClient } from '@/lib/api/server'
import { TopicDetail } from '@/components/topics/TopicDetail'
import { getViewer } from '@/lib/trainer'
import { loadTopicDetail } from '@/lib/topics'

/**
 * One session in full.
 *
 * `?edit=1` opens straight into the edit form — the Edit action on the
 * list links here rather than duplicating the form in the table.
 */
export default async function TopicPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ edit?: string }>
}) {
  const { id } = await params
  const sp = await searchParams
  const supabase = await createClient()
  const viewer = await getViewer(supabase)

  const data = await loadTopicDetail(supabase, viewer, id)
  // null means it does not exist, or belongs to another trainer. 404 rather
  // than 403, so the URL never confirms the id exists.
  if (!data) notFound()

  return <TopicDetail data={data} startEditing={sp.edit === '1'} userId={viewer.id} />
}
