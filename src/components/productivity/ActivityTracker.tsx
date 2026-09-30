'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/api/client'

const HEARTBEAT_MS = 120_000      // 2 min
const ONLINE_MAX = 15 * 60_000    // active if last activity < 15 min
const AWAY_MIN = 30 * 60_000      // away if > 30 min → idle modal

export function ActivityTracker({ userId }: { userId: string }) {
  const router = useRouter()
  const supabase = createClient()
  const lastActivity = useRef(Date.now())
  const active = useRef(0)
  const idle = useRef(0)
  const [warn, setWarn] = useState(false)
  const [count, setCount] = useState(60)

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    let alive = true

    const bump = () => { lastActivity.current = Date.now(); if (warn) { setWarn(false); setCount(60) } }
    const evs = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'click', 'scroll']
    evs.forEach((e) => window.addEventListener(e, bump, { passive: true }))

    ;(async () => {
      // start/load today's session
      await supabase.from('user_activity').upsert({ user_id: userId, day: today }, { onConflict: 'user_id,day', ignoreDuplicates: true })
      const { data } = await supabase.from('user_activity').select('active_ms, idle_ms').eq('user_id', userId).eq('day', today).maybeSingle()
      if (data) { active.current = Number((data as any).active_ms) || 0; idle.current = Number((data as any).idle_ms) || 0 }
    })()

    const heartbeat = setInterval(async () => {
      if (!alive) return
      const idleFor = Date.now() - lastActivity.current
      const status = idleFor < ONLINE_MAX ? 'online' : idleFor < AWAY_MIN ? 'idle' : 'away'
      if (status === 'online') active.current += HEARTBEAT_MS
      else idle.current += HEARTBEAT_MS
      await supabase.from('user_activity').update({ last_seen: new Date().toISOString(), active_ms: active.current, idle_ms: idle.current, status }).eq('user_id', userId).eq('day', today)
    }, HEARTBEAT_MS)

    const idleCheck = setInterval(() => {
      if (Date.now() - lastActivity.current > AWAY_MIN) setWarn(true)
    }, 20_000)

    return () => { alive = false; clearInterval(heartbeat); clearInterval(idleCheck); evs.forEach((e) => window.removeEventListener(e, bump)) }
  }, [supabase, userId, warn])

  useEffect(() => {
    if (!warn) return
    setCount(60)
    const t = setInterval(() => setCount((c) => {
      if (c <= 1) { clearInterval(t); supabase.auth.signOut().then(() => router.push('/login')) }
      return c - 1
    }), 1000)
    return () => clearInterval(t)
  }, [warn, supabase, router])

  if (!warn) return null
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
        <h3 className="text-lg font-semibold text-slate-900">Are you still there?</h3>
        <p className="mt-2 text-sm text-slate-500">You've been idle for a while. You'll be logged out in</p>
        <div className="my-4 text-4xl font-bold text-blue-600">{count}s</div>
        <div className="flex gap-2">
          <button onClick={() => { lastActivity.current = Date.now(); setWarn(false) }} className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white">Continue Working</button>
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600">Logout</button>
        </div>
      </div>
    </div>
  )
}
