import { redirect } from 'next/navigation'
import { createClient } from '@/lib/api/server'
import { navFor } from '@/lib/nav'
import type { Role } from '@/lib/rbac'
import { Sidebar } from '@/components/shell/Sidebar'
import { Topbar } from '@/components/shell/Topbar'
import { ActivityTracker } from '@/components/productivity/ActivityTracker'
import { signedAvatarUrl } from '@/lib/avatars.server'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, role_key, avatar_url')
    .eq('id', user.id)
    .single()

  // `role` is the base access level and drives the sidebar; `role_key` is the
  // specific role, whose label is shown in the topbar. A custom role inherits
  // its base's navigation, so navFor(role) needs no per-role wiring.
  const role = (profile?.role ?? 'student') as Role
  const roleKey = (profile?.role_key as string | null) ?? role
  const { data: roleRow } = await supabase.from('roles').select('label').eq('key', roleKey).maybeSingle()
  const roleLabel = (roleRow as any)?.label as string | undefined
  const name = (profile?.full_name as string) ?? user.email ?? 'User'
  // Signed here rather than in the topbar: the picture is a private object,
  // and the topbar is a client component with no way to sign for one.
  const avatarUrl = signedAvatarUrl(profile?.avatar_url as string | null)

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <ActivityTracker userId={user.id} />
      <Sidebar items={navFor(role, roleKey)} role={role} roleLabel={roleLabel ?? (roleKey === 'digital_marketing' ? 'Digital Marketing' : undefined)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar name={name} role={role} roleLabel={roleLabel} avatarUrl={avatarUrl} />
        <main className={`flex-1 overflow-y-auto p-4 sm:p-6 ${roleKey === 'digital_marketing' ? 'pb-20 md:pb-6' : ''}`}>{children}</main>
      </div>
    </div>
  )
}
