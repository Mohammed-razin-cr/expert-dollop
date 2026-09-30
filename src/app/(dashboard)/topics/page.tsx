import { createClient } from '@/lib/api/server'
import { TopicsManager } from '@/components/topics/TopicsManager'
import { getViewer } from '@/lib/trainer'
import { loadTopics } from '@/lib/topics'

/**
 * Daily topics.
 *
 * A trainer sees only the sessions they logged. Staff see every trainer's,
 * which is the point of the screen in the admin sidebar. Both scoping and
 * the KPI arithmetic live in lib/topics.
 */
export default async function TopicsPage() {
  const supabase = await createClient()
  const viewer = await getViewer(supabase)
  const data = await loadTopics(supabase, viewer)

  return (
    <TopicsManager
      topics={data.rows}
      stats={data.stats}
      batches={data.batches}
      trainerId={viewer.id}
    />
  )
}
