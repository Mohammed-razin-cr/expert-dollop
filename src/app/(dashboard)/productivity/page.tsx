import { redirect } from 'next/navigation'
import { createClient } from '@/lib/api/server'
import type { Role } from '@/lib/rbac'

const one = (x: any) => (Array.isArray(x) ? x[0] : x)
const hm = (ms: number) => { const m = Math.round((ms || 0) / 60000); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m` }
const pct = (a: number, i: number) => { const t = (a || 0) + (i || 0); return t ? Math.round((a / t) * 100) : 0 }
const dot: Record<string, string> = { online: 'bg-emerald-500', idle: 'bg-amber-500', away: 'bg-slate-300' }

export default async function ProductivityPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  const role = ((me as any)?.role ?? 'student') as Role
  // Productivity is not part of the BD module. Activity is still recorded
  // by ActivityTracker in the dashboard layout — this only removes the BD's
  // view of it, so admins keep seeing BD sessions on their own page.
  if (role === 'bd' || role === 'counsellor') redirect('/dashboard')
  const isAdmin = role === 'admin' || role === 'super_admin'
  const today = new Date().toISOString().slice(0, 10)

  let liveQ = supabase.from('user_activity').select('user_id, status, login_at, last_seen, active_ms, idle_ms, profiles(full_name, role)').eq('day', today)
  let histQ = supabase.from('user_activity').select('day, status, login_at, last_seen, active_ms, idle_ms, profiles(full_name, role)').order('day', { ascending: false }).limit(100)
  if (!isAdmin) { liveQ = liveQ.eq('user_id', user!.id); histQ = histQ.eq('user_id', user!.id) }
  const [{ data: live = [] }, { data: hist = [] }] = await Promise.all([liveQ, histQ])

  return (
    <div className="space-y-5">
      <div><h1 className="text-xl font-semibold text-slate-900">Productivity Monitor</h1><p className="text-sm text-slate-500">{isAdmin ? 'All users' : 'Your sessions'} · active vs idle</p></div>

      {isAdmin && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-800">Live Today</div>
          <table className="w-full text-sm"><thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="px-4 py-3 font-medium">User</th><th className="px-4 py-3 font-medium">Role</th><th className="px-4 py-3 font-medium">Login</th><th className="px-4 py-3 font-medium">Active</th><th className="px-4 py-3 font-medium">Productivity</th></tr></thead>
            <tbody>{(live ?? []).map((r: any, i: number) => (
              <tr key={i} className="border-t border-slate-100">
                <td className="px-4 py-2.5"><span className="inline-flex items-center gap-2 font-medium text-slate-800"><span className={`h-2 w-2 rounded-full ${dot[r.status] ?? 'bg-slate-300'}`} />{one(r.profiles)?.full_name ?? '—'}</span></td>
                <td className="px-4 py-2.5 text-slate-500">{one(r.profiles)?.role ?? '—'}</td>
                <td className="px-4 py-2.5 text-slate-500">{String(r.login_at).slice(11, 16)}</td>
                <td className="px-4 py-2.5 text-slate-600">{hm(r.active_ms)}</td>
                <td className="px-4 py-2.5 font-medium text-slate-800">{pct(r.active_ms, r.idle_ms)}%</td>
              </tr>
            ))}
            {!(live ?? []).length && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">No sessions today yet.</td></tr>}</tbody></table>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-800">Session History</div>
        <table className="w-full text-sm"><thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="px-4 py-3 font-medium">User</th><th className="px-4 py-3 font-medium">Date</th><th className="px-4 py-3 font-medium">Login</th><th className="px-4 py-3 font-medium">Last Seen</th><th className="px-4 py-3 font-medium">Active</th><th className="px-4 py-3 font-medium">Idle</th><th className="px-4 py-3 font-medium">Productivity</th></tr></thead>
          <tbody>{(hist ?? []).map((r: any, i: number) => (
            <tr key={i} className="border-t border-slate-100">
              <td className="px-4 py-2.5 font-medium text-slate-800">{one(r.profiles)?.full_name ?? '—'}</td>
              <td className="px-4 py-2.5 text-slate-500">{r.day}</td>
              <td className="px-4 py-2.5 text-slate-500">{String(r.login_at).slice(11, 16)}</td>
              <td className="px-4 py-2.5 text-slate-500">{String(r.last_seen).slice(11, 16)}</td>
              <td className="px-4 py-2.5 text-slate-600">{hm(r.active_ms)}</td>
              <td className="px-4 py-2.5 text-slate-500">{hm(r.idle_ms)}</td>
              <td className="px-4 py-2.5 font-medium text-slate-800">{pct(r.active_ms, r.idle_ms)}%</td>
            </tr>
          ))}
          {!(hist ?? []).length && <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">No sessions recorded yet.</td></tr>}</tbody></table>
      </div>
    </div>
  )
}
