import { notFound } from 'next/navigation'
import { createClient } from '@/lib/api/server'
import { MaterialDetail } from '@/components/materials/MaterialDetail'
import { getViewer } from '@/lib/trainer'
import { loadMaterialDetail } from '@/lib/materials'

/** One material, with its preview, reach and engagement. */
export default async function MaterialPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const viewer = await getViewer(supabase)

  const data = await loadMaterialDetail(supabase, viewer, id)
  // null means it does not exist, or is neither their upload nor shared
  // with a batch they run. 404 rather than 403.
  if (!data) notFound()

  return <MaterialDetail data={data} />
}
