import { createClient } from '@/lib/api/server'
import { MaterialsBoard } from '@/components/materials/MaterialsBoard'
import { getViewer, trainerBatchIds, orNothing } from '@/lib/trainer'
import { loadMaterials } from '@/lib/materials'

/**
 * Study materials.
 *
 * A trainer sees files they uploaded plus anything shared with a batch
 * they run. The course picker is narrowed the same way, so material cannot
 * be filed against a course they do not teach.
 */
export default async function MaterialsPage() {
  const supabase = await createClient()
  const viewer = await getViewer(supabase)
  const data = await loadMaterials(supabase, viewer)

  // Courses to offer on upload: the ones this trainer's batches belong to.
  let coursesQ = supabase.from('courses').select('id, name').is('deleted_at', null).order('name')
  if (viewer.scoped) {
    const myBatches = await trainerBatchIds(supabase, viewer.id)
    const { data: rows = [] } = myBatches.length
      ? await supabase.from('batches').select('course_id').in('id', orNothing(myBatches))
      : { data: [] }
    const courseIds = [...new Set((rows ?? []).map((b: any) => b.course_id).filter(Boolean))]
    coursesQ = coursesQ.in('id', orNothing(courseIds as string[]))
  }
  const { data: courses = [] } = await coursesQ

  return (
    <MaterialsBoard
      rows={data.rows}
      stats={data.stats}
      courses={(courses ?? []).map((c: any) => ({ id: c.id, name: c.name }))}
      batchOptions={data.batchOptions}
      userId={viewer.id}
    />
  )
}
