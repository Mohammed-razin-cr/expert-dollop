import { createClient } from '@/lib/api/server'
import { ProfileClient } from '@/components/profile/ProfileClient'
import { signedAvatarUrl } from '@/lib/avatars.server'

export default async function ProfilePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: p } = await supabase
  .from('profiles')
  .select(`
    full_name,
    email,
    role,
    role_key,
    department,
    employee_id,
    phone,
    place,
    bio,
    avatar_url
  `)
  .eq('id', user!.id)
  .single()

  const avatarKey = ((p as any)?.avatar_url as string | null) ?? null

  return (
  <ProfileClient
    id={user!.id}
    avatarKey={avatarKey}
    avatarUrl={signedAvatarUrl(avatarKey)}
    profile={{
      full_name: (p as any)?.full_name ?? '',
      email: (p as any)?.email ?? user!.email ?? '',
      role: (p as any)?.role_key === 'digital_marketing' ? 'Digital Marketing' : (p as any)?.role ?? '',
      department: (p as any)?.department ?? '',
      employee_id: (p as any)?.employee_id ?? '',
      phone: (p as any)?.phone ?? '',
      place: (p as any)?.place ?? '',
      bio: (p as any)?.bio ?? '',
    }}
  />
)
}
