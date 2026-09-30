export type Role = 'super_admin' | 'admin' | 'bd' | 'counsellor' | 'trainer' | 'student'

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  bd: 'BD Executive',
  counsellor: 'Counsellor',
  trainer: 'Trainer',
  student: 'Student',
}

export const isStaff = (role?: Role | null) =>
  role === 'super_admin' || role === 'admin'

// Counsellor is a BD-equivalent role: the same access, dashboards and
// data scoping. Every place that used to gate on the literal 'bd' asks
// this instead, so the two roles can never quietly drift apart. The
// database mirrors it with public.is_bd() (32_counsellor_role.sql).
export const BD_ROLES: Role[] = ['bd', 'counsellor']

export const isMarketing = (roleKey?: string | null) => roleKey === 'digital_marketing'

export const isBD = (role?: Role | null): boolean =>
  role === 'bd' || role === 'counsellor'

// ---- Dynamic roles (33_dynamic_roles.sql) -------------------------------
// A role in the `roles` catalogue inherits one of these built-in access
// levels. profiles.role stores the base; profiles.role_key stores which
// specific role was assigned. So a custom role behaves exactly as its base
// everywhere, and only its label and key are its own.
export type RoleBase = 'super_admin' | 'admin' | 'bd' | 'trainer' | 'student'

export type RoleCatalogEntry = {
  key: string
  label: string
  base: RoleBase
  is_builtin: boolean
  sort: number
}

export const ROLE_BASES: { value: RoleBase; label: string }[] = [
  { value: 'admin', label: 'Admin — full access' },
  { value: 'bd', label: 'BD — leads, revenue, own edits' },
  { value: 'trainer', label: 'Trainer — batches, students, attendance' },
  { value: 'student', label: 'Student — own courses and invoices' },
  { value: 'super_admin', label: 'Super Admin — full access' },
]

// The label to show for a user, preferring their specific role over the
// base. Falls back to the base label, then the raw key.
export const roleLabelOf = (
  roleKey: string | null | undefined,
  role: Role | null | undefined,
  catalogue?: Pick<RoleCatalogEntry, 'key' | 'label'>[],
): string => {
  const key = roleKey ?? role ?? ''
  const hit = catalogue?.find((r) => r.key === key)
  if (hit) return hit.label
  return ROLE_LABELS[key as Role] ?? key
}

/** Where each role lands after login. All currently share /dashboard,
 *  which renders the role-specific view. */
export const homePathFor = (_role: Role) => '/dashboard'
