import { createClient } from '@/lib/api/server'
import { TasksManager } from '@/components/tasks/TasksManager'
import { getViewer, trainerBatchIds } from '@/lib/trainer'

const one = (x: any) => (Array.isArray(x) ? x[0] : x)

/**
 * My Tasks.
 *
 * Shows tasks assigned to the signed-in user or raised by them — the
 * "my" in the title is the filter, for every role.
 *
 * Everything the board needs is fetched here in one pass; filtering,
 * sorting and paging happen client-side in TasksManager, which keeps the
 * KPI counts honest (they always describe the full set, not the page).
 */
export default async function TasksPage() {
  const supabase = await createClient()
  const viewer = await getViewer(supabase)

  const [{ data: tasks = [] }, { data: users = [] }] = await Promise.all([
    supabase
      .from('tasks')
      .select(
        'id, title, description, due_date, status, priority, assigned_to, created_by, batch_id, batches(name)',
      )
      .or(`assigned_to.eq.${viewer.id},created_by.eq.${viewer.id}`)
      .is('deleted_at', null)
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(500),
    supabase.from('profiles').select('id, full_name').is('deleted_at', null).order('full_name'),
  ])

  // "Related To" offers the trainer's own batches; staff get all of them.
  const myBatchIds = viewer.scoped ? await trainerBatchIds(supabase, viewer.id) : null
  let batchesQ = supabase.from('batches').select('id, name').is('deleted_at', null).order('name')
  if (myBatchIds) batchesQ = batchesQ.eq('trainer_id', viewer.id)
  const { data: batches = [] } = await batchesQ

  const nameById: Record<string, string> = {}
  for (const u of users ?? []) nameById[(u as any).id] = (u as any).full_name

  const out = (tasks ?? []).map((t: any) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    due_date: t.due_date,
    status: t.status,
    priority: t.priority ?? 'medium',
    batch_id: t.batch_id,
    batch: one(t.batches)?.name ?? null,
    assigned_to: t.assigned_to,
    assignee: nameById[t.assigned_to] ?? null,
    created_by: t.created_by,
  }))

  return (
    <TasksManager
      tasks={out as any}
      users={(users ?? []) as any}
      batches={(batches ?? []) as any}
      userId={viewer.id}
      role={viewer.role}
    />
  )
}
