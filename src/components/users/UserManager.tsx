'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Loader2, KeyRound, X, ShieldPlus } from 'lucide-react'
import { createClient } from '@/lib/api/client'
import type { Update } from '@/lib/database.types'
import { type Role, type RoleBase, type RoleCatalogEntry, ROLE_BASES } from '@/lib/rbac'

type User = { id: string; full_name: string; email: string; role: Role; role_key: string | null; department: string | null; status: string | null }
const inp = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100'

export function UserManager({ users, roles, currentUserId }: { users: User[]; roles: RoleCatalogEntry[]; currentUserId: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  // Default a new user to a non-privileged role.
  const defaultRoleKey = roles.find((r) => r.key === 'trainer')?.key ?? roles[0]?.key ?? 'student'
  const [f, setF] = useState({ full_name: '', email: '', password: '', role_key: defaultRoleKey, department: '' })
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }))
  const baseOf = (key: string): RoleBase => roles.find((r) => r.key === key)?.base ?? 'student'

  async function addUser() {
    setBusy(true); setErr(null)
    const res = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) })
    const j = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) return setErr(j.error || 'Failed to create user')
    setF({ full_name: '', email: '', password: '', role_key: defaultRoleKey, department: '' })
    setOpen(false); router.refresh()
  }

  // Assigning a role writes both: role_key is the specific role, role is the
  // base access level it inherits — every RLS policy and screen reads the base.
  async function assignRole(id: string, roleKey: string) {
    await supabase.from('profiles').update({ role_key: roleKey, role: baseOf(roleKey) as any }).eq('id', id)
    router.refresh()
  }

  async function patch(id: string, fields: Update<'profiles'>) {
    await supabase.from('profiles').update(fields).eq('id', id)
    router.refresh()
  }

  // ---- Roles management ----
  const [rOpen, setROpen] = useState(false)
  const [rBusy, setRBusy] = useState(false)
  const [rErr, setRErr] = useState<string | null>(null)
  const [rf, setRf] = useState<{ label: string; base: RoleBase }>({ label: '', base: 'bd' })
  const usageCount = (key: string) => users.filter((u) => (u.role_key ?? u.role) === key).length

  async function addRole() {
    setRBusy(true); setRErr(null)
    const key = rf.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
    const { error } = await supabase.rpc('admin_create_role', { p_key: key, p_label: rf.label.trim(), p_base: rf.base })
    setRBusy(false)
    if (error) return setRErr(error.message)
    setRf({ label: '', base: 'bd' }); setROpen(false); router.refresh()
  }

  async function removeRole(key: string) {
    if (!confirm(`Delete the "${key}" role?`)) return
    const { error } = await supabase.rpc('admin_delete_role', { p_key: key })
    if (error) return alert(error.message)
    router.refresh()
  }

  async function remove(id: string) {
    if (!confirm('Delete this user permanently?')) return
    const res = await fetch(`/api/users?id=${id}`, { method: 'DELETE' })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return alert(j.error || 'Delete failed')
    router.refresh()
  }

  // ---- Admin password reset ----
  const [pwUser, setPwUser] = useState<User | null>(null)
  const [pw, setPw] = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [pwBusy, setPwBusy] = useState(false)
  const [pwErr, setPwErr] = useState<string | null>(null)
  const [pwDone, setPwDone] = useState(false)

  function openReset(u: User) {
    setPwUser(u); setPw(''); setPwConfirm(''); setPwErr(null); setPwDone(false)
  }

  async function resetPassword() {
    if (!pwUser) return
    setPwErr(null)
    if (pw.length < 8) return setPwErr('Password must be at least 8 characters')
    if (pw !== pwConfirm) return setPwErr('Passwords do not match')

    setPwBusy(true)
    const res = await fetch('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: pwUser.id, password: pw }),
    })
    const j = await res.json().catch(() => ({}))
    setPwBusy(false)
    if (!res.ok) return setPwErr(j.error || 'Could not set password')
    setPwDone(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Users & Roles</h1>
          <p className="text-sm text-slate-500">{users.length} users · {roles.length} roles</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setROpen((v) => !v); setRErr(null) }} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <ShieldPlus className="h-4 w-4" /> Manage Roles
          </button>
          {!open && (
            <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
              <Plus className="h-4 w-4" /> Add User
            </button>
          )}
        </div>
      </div>

      {/* Roles catalogue: add a role that inherits a base access level, or
          remove a custom one. Built-ins and roles in use are protected by
          the RPCs, which surface a message rather than deleting. */}
      {rOpen && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Roles</h2>
          <div className="mb-4 overflow-x-auto rounded-lg border border-slate-100">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Role</th>
                  <th className="px-3 py-2 font-medium">Acts as</th>
                  <th className="px-3 py-2 font-medium">Users</th>
                  <th className="px-3 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {roles.map((r) => (
                  <tr key={r.key} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-800">{r.label}</td>
                    <td className="px-3 py-2 text-slate-600">{ROLE_BASES.find((b) => b.value === r.base)?.label ?? r.base}</td>
                    <td className="px-3 py-2 text-slate-500">{usageCount(r.key)}</td>
                    <td className="px-3 py-2 text-right">
                      {r.is_builtin
                        ? <span className="text-xs text-slate-400">built-in</span>
                        : <button onClick={() => removeRole(r.key)} className="text-rose-500 hover:text-rose-700" title="Delete role"><Trash2 className="h-4 w-4" /></button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-[11px] uppercase text-slate-400">New role name</label>
              <input className={inp} placeholder="e.g. Telecaller" value={rf.label} onChange={(e) => setRf((p) => ({ ...p, label: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] uppercase text-slate-400">Inherits access of</label>
              <select className={inp} value={rf.base} onChange={(e) => setRf((p) => ({ ...p, base: e.target.value as RoleBase }))}>
                {ROLE_BASES.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <button onClick={addRole} disabled={rBusy || !rf.label.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
                {rBusy && <Loader2 className="h-4 w-4 animate-spin" />} Add Role
              </button>
            </div>
          </div>
          {rErr && <p className="mt-2 text-sm text-rose-600">{rErr}</p>}
          <p className="mt-2 text-xs text-slate-400">A new role gets the exact access of the level it inherits. Assign it to a user in the table below.</p>
        </div>
      )}

      {open && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <input className={inp} placeholder="Full name *" value={f.full_name} onChange={(e) => set('full_name', e.target.value)} />
            <input className={inp} placeholder="Email *" value={f.email} onChange={(e) => set('email', e.target.value)} />
            <input className={inp} type="text" placeholder="Temp password *" value={f.password} onChange={(e) => set('password', e.target.value)} />
            <select className={inp} value={f.role_key} onChange={(e) => set('role_key', e.target.value)}>
              {roles.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
            <input className={inp} placeholder="Department" value={f.department} onChange={(e) => set('department', e.target.value)} />
          </div>
          {err && <p className="mt-2 text-sm text-rose-600">{err}</p>}
          <div className="mt-3 flex gap-2">
            <button onClick={addUser} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Create User
            </button>
            <button onClick={() => { setOpen(false); setErr(null) }} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600">Cancel</button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Department</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-slate-100">
                <td className="px-4 py-2.5 font-medium text-slate-800">{u.full_name}</td>
                <td className="px-4 py-2.5 text-slate-600">{u.email}</td>
                <td className="px-4 py-2.5">
                  <select defaultValue={u.role_key ?? u.role} onChange={(e) => assignRole(u.id, e.target.value)}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-blue-300">
                    {roles.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                  </select>
                </td>
                <td className="px-4 py-2.5">
                  <input defaultValue={u.department ?? ''} onBlur={(e) => patch(u.id, { department: e.target.value })}
                    className="w-32 rounded-md border border-slate-200 px-2 py-1 text-xs outline-none focus:border-blue-300" />
                </td>
                <td className="px-4 py-2.5">
                  <select defaultValue={u.status ?? 'active'} onChange={(e) => patch(u.id, { status: e.target.value })}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-blue-300">
                    <option value="active">active</option>
                    <option value="inactive">inactive</option>
                    <option value="suspended">suspended</option>
                  </select>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <button onClick={() => openReset(u)} title="Reset password" className="text-slate-500 hover:text-blue-600"><KeyRound className="h-4 w-4" /></button>
                    {u.id !== currentUserId && (
                      <button onClick={() => remove(u.id)} title="Delete user" className="text-rose-500 hover:text-rose-700"><Trash2 className="h-4 w-4" /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pwUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPwUser(null)}>
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-semibold text-slate-900">
                <KeyRound className="h-4 w-4 text-blue-600" /> Reset password
              </h3>
              <button onClick={() => setPwUser(null)} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
            </div>

            {pwDone ? (
              <div className="space-y-4">
                <p className="text-sm text-slate-600">
                  Password updated for <span className="font-medium text-slate-900">{pwUser.full_name}</span>.
                  Share the new password with them — they use it at the next login.
                </p>
                <button onClick={() => setPwUser(null)} className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Done</button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-500">
                  Set a new password for <span className="font-medium text-slate-700">{pwUser.full_name}</span> ({pwUser.email}).
                </p>
                <input className={inp} type="text" placeholder="New password (min 8 characters)" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
                <input className={inp} type="text" placeholder="Confirm new password" value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)} />
                {pwErr && <p className="text-sm text-rose-600">{pwErr}</p>}
                <div className="flex gap-2 pt-1">
                  <button onClick={resetPassword} disabled={pwBusy} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
                    {pwBusy && <Loader2 className="h-4 w-4 animate-spin" />} Set Password
                  </button>
                  <button onClick={() => setPwUser(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600">Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
