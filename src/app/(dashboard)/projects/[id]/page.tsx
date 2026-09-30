import { notFound } from 'next/navigation'
import { createClient } from '@/lib/api/server'
import { ProjectDetail } from '@/components/projects/ProjectDetail'
import { BD_ROLES } from '@/lib/rbac'

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user!.id).single()

  const [
    { data: project },
    { data: bds = [] },
    { data: allProfiles = [] },
    { data: history = [] },
  ] = await Promise.all([
    supabase.from('projects').select('*').eq('id', id).is('deleted_at', null).single(),
    // Counsellor is BD-equivalent, so it's assignable as a project owner too.
    supabase.from('profiles').select('id, full_name').in('role', BD_ROLES).order('full_name'),
    supabase.from('profiles').select('id, full_name'),
    // Table + trigger from migration 44 — may not exist yet on every
    // environment, so a missing-table error is swallowed to an empty list
    // rather than failing the whole page.
    supabase
      .from('project_assignment_history')
      .select('id, from_owner, to_owner, changed_by, changed_at')
      .eq('project_id', id)
      .order('changed_at', { ascending: false })
      .then((r) => (r.error ? { data: [] } : r)),
  ])

  if (!project) notFound()

  return (
    <ProjectDetail
      project={project as any}
      bds={(bds ?? []) as any}
      allProfiles={(allProfiles ?? []) as any}
      history={(history ?? []) as any}
      currentUserId={user!.id}
      role={(me as any)?.role ?? 'student'}
    />
  )
}
