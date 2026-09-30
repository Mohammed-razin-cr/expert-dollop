'use client'
import { Bell, Calendar } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/api/client'
import { ROLE_LABELS, type Role } from '@/lib/rbac'
import { useRouter } from "next/navigation"
import { Avatar } from '@/components/shell/Avatar'

export function Topbar({
  name,
  role,
  roleLabel,
  avatarUrl,
}: {
  name: string
  role: Role
  /** The specific role's label (e.g. "Counsellor"); falls back to the base. */
  roleLabel?: string
  /** Signed in the layout — a private object cannot be signed for here. */
  avatarUrl?: string | null
}) {
  const today = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
  const supabase = createClient()
  const router = useRouter()
  const [notifications, setNotifications] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const notificationRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    loadNotifications()

    function handleClickOutside(event: MouseEvent) {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }

    function handleVisibilityChange() {
      if (!document.hidden) {
        loadNotifications()
      }
    }

    const interval = setInterval(() => {
      loadNotifications()
    }, 30000)

    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      clearInterval(interval)
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [])

  async function loadNotifications(): Promise<void>{
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    if (roleLabel === 'Digital Marketing' || role === 'admin' || role === 'super_admin') {
      const { data: stored = [] } = await supabase.from('notifications')
        .select('id,title,body,created_at')
        .eq('user_id', user.id)
        .eq('read', false)
        .order('created_at', { ascending: false })
        .limit(20)
      const persisted = (stored ?? []).map((item: any) => ({ key: item.id, label: item.title, detail: item.body ?? 'Open Digital Marketing', href: roleLabel === 'Digital Marketing' ? '/marketing' : '/admin/digital-marketing?view=approvals' }))
      if (roleLabel !== 'Digital Marketing') {
        setNotifications(persisted)
        return
      }
      const date = new Date().toISOString().slice(0, 10)
      const { data: due, error } = await supabase.from('tasks')
        .select('id, title, due_date')
        .eq('assigned_to', user.id)
        .eq('related_type', 'digital_marketing')
        .lte('due_date', date)
        .in('status', ['pending', 'in_progress'])
        .is('deleted_at', null)
      if (!error) setNotifications([...persisted, ...(due ?? []).map((task) => ({ ...task, key: `due-${task.id}`, label: task.title, detail: task.due_date === date ? 'Due today' : 'Overdue', href: '/marketing' }))])
      return
    }
    // Trainers get their own teaching notifications; every other role keeps
    // the follow-up logic below unchanged.
    if (role === 'trainer') {
      await loadTrainerNotifications(user.id)
      return
    }
    const startToday = new Date()
    startToday.setHours(0, 0, 0, 0)
    const startTomorrow = new Date(startToday)
    startTomorrow.setDate(startTomorrow.getDate() + 1)
    const { data: followups = [], error } = await supabase
      .from('leads')
      .select('id, name, mobile, next_followup_at')
      .eq('assigned_bd', user.id)
      .gte('next_followup_at', startToday.toISOString())
      .lt('next_followup_at', startTomorrow.toISOString())
      .order('next_followup_at', { ascending: true })
    if (error) {
      console.error(error)
      return
    }
    setNotifications(followups ?? [])

  }

  // Teaching notifications for a trainer, each derived from live data and
  // scoped to their own batches. Only types we can actually source are
  // built — there is no certificates table, so certificate approvals are
  // deliberately omitted rather than faked.
  async function loadTrainerNotifications(uid: string): Promise<void> {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .slice(0, 10)
    const todayISO = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      .toISOString()
      .slice(0, 10)
    // Start of today (local), as a UTC timestamp to compare against the
    // stored created_at — "assigned today" means since local midnight.
    const dayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).toISOString()

    const { data: batches, error: batchErr } = await supabase
      .from('batches')
      .select('id, created_at')
      .eq('trainer_id', uid)
      .is('deleted_at', null)
    if (batchErr) {
      console.error(batchErr)
      return
    }
    const batchIds = (batches ?? []).map((b: any) => b.id)
    // PostgREST's .in() needs a non-empty list; a sentinel uuid matches nothing.
    const scope = batchIds.length ? batchIds : ['00000000-0000-0000-0000-000000000000']

    const [
      { data: assignments = [] },
      { data: enr = [] },
      { data: att = [] },
      { data: cal = [] },
    ] = await Promise.all([
      supabase.from('assignments').select('id').in('batch_id', scope).is('deleted_at', null),
      supabase
        .from('enrollments')
        .select('student_id, created_at')
        .in('batch_id', scope)
        .is('deleted_at', null),
      supabase
        .from('attendance')
        .select('student_id, status, date')
        .in('batch_id', scope)
        .gte('date', monthStart),
      supabase
        .from('calendar_events')
        .select('id')
        .eq('trainer_id', uid)
        .eq('type', 'class')
        .gte('date', todayISO)
        .is('deleted_at', null),
    ])

    // Assignment Submitted — homework handed in but not yet graded. 'late'
    // still needs marking, so it counts.
    const assignmentIds = (assignments ?? []).map((a: any) => a.id)
    let submitted = 0
    if (assignmentIds.length) {
      const { count } = await supabase
        .from('assignment_submissions')
        .select('*', { count: 'exact', head: true })
        .in('assignment_id', assignmentIds)
        .in('status', ['pending', 'submitted', 'late'])
        .is('deleted_at', null)
      submitted = count ?? 0
    }

    // Low Attendance — students under 70% this month, matching the dashboard.
    const byStudent: Record<string, { present: number; marked: number }> = {}
    ;(att ?? []).forEach((a: any) => {
      if (a.status === 'not_marked') return
      const s = (byStudent[a.student_id] ??= { present: 0, marked: 0 })
      s.marked += 1
      if (a.status === 'present') s.present += 1
    })
    const lowAttendance = Object.values(byStudent).filter(
      (s) => s.marked > 0 && s.present / s.marked < 0.7,
    ).length

    const newStudents = (enr ?? []).filter(
      (e: any) => e.created_at && e.created_at >= dayStart,
    ).length
    const newBatches = (batches ?? []).filter(
      (b: any) => b.created_at && b.created_at >= dayStart,
    ).length
    const upcomingClasses = (cal ?? []).length

    const plural = (n: number) => (n > 1 ? 's' : '')
    const items = [
      submitted > 0 && {
        key: 'assignment',
        label: 'Assignment Submitted',
        detail: `${submitted} awaiting grading`,
        href: '/assignments?status=ungraded',
      },
      upcomingClasses > 0 && {
        key: 'class',
        label: 'Upcoming Class Reminder',
        detail: `${upcomingClasses} class${upcomingClasses > 1 ? 'es' : ''} scheduled`,
        href: '/calendar',
      },
      lowAttendance > 0 && {
        key: 'attendance',
        label: 'Low Attendance Alert',
        detail: `${lowAttendance} student${plural(lowAttendance)} below 70%`,
        href: '/students?mine=true',
      },
      newStudents > 0 && {
        key: 'students',
        label: 'New Student Assigned',
        detail: `${newStudents} assigned today`,
        href: '/students?mine=true',
      },
      newBatches > 0 && {
        key: 'batches',
        label: 'New Batch Assigned',
        detail: `${newBatches} assigned today`,
        href: '/courses?tab=batches&status=active',
      },
    ].filter(Boolean)

    setNotifications(items as any[])
  }
  return (
    <header className="flex h-16 items-center gap-4 border-b border-slate-200 bg-white px-6">
      <div className="ml-auto flex items-center gap-5">
        <div className="hidden items-center gap-2 text-sm text-slate-500 sm:flex">
          <Calendar className="h-4 w-4" />
          {today}
        </div>
        <div className="relative" ref={notificationRef}>
          <button onClick={() => setOpen(!open)} className="relative text-slate-500 hover:text-slate-700">
            <Bell className="h-5 w-5" />{notifications.length > 0 && (
              <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-rose-500 text-[10px] font-semibold text-white">{notifications.length}</span>
            )}
          </button>
          {open && (role === 'trainer' || roleLabel === 'Digital Marketing' || role === 'admin' || role === 'super_admin') ? (
            <div className="absolute right-0 mt-3 w-80 rounded-lg border bg-white shadow-lg z-50">
              <div className="border-b p-3">
                <p className="font-semibold text-slate-800">
                  {notifications.length > 0
                    ? `You have ${notifications.length} notification${notifications.length !== 1 ? 's' : ''}`
                    : 'Notifications'}
                </p>
              </div>
              {notifications.length === 0 ? (
                <div className="p-4 text-center">
                  <p className="text-sm font-medium text-green-600">You&apos;re all caught up</p>
                </div>
              ) : (
                <ul className="max-h-80 overflow-auto">
                  {notifications.map((n: any) => (
                    <li
                      key={n.key}
                      onClick={() => {
                        setOpen(false)
                        router.push(n.href)
                      }}
                      className="cursor-pointer border-b border-slate-100 p-3 last:border-0 hover:bg-blue-50"
                    >
                      <p className="text-sm font-medium text-slate-800">{n.label}</p>
                      <p className="text-xs text-slate-500">{n.detail}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : open && (
            <div className="absolute right-0 mt-3 w-80 rounded-lg border bg-white shadow-lg z-50">
              <div className="border-b p-3">
                <p className="font-semibold text-slate-800">
                  You have {notifications.length} follow-up{notifications.length !== 1 ? 's' : ''} today
                </p>
              </div>
              {notifications.length === 0 ? (
                <div className="p-4 text-center">
                  <p className="text-sm font-medium text-green-600">
                    No follow-ups scheduled for today
                  </p>
                </div>
              ) : (
                <div
                  onClick={() => {
                    setOpen(false)
                    router.push('/followups?filter=today')
                  }}
                  className="cursor-pointer p-4 text-center hover:bg-blue-50"
                >
                  <p className="text-sm font-medium text-blue-600">
                    Click here to view today's follow-ups
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2.5">
          <Avatar src={avatarUrl} name={name} size={36} />
          <div className="hidden leading-tight sm:block">
            <p className="text-sm font-medium text-slate-900">{name}</p>
            <p className="text-xs text-slate-400">{roleLabel ?? ROLE_LABELS[role]}</p>
          </div>
        </div>
      </div>
    </header>
  )
}
