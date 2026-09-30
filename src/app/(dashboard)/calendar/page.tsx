import Link from 'next/link'
import { ChevronLeft, ChevronRight, CalendarDays, GraduationCap, PhoneCall, Brain, CalendarClock } from 'lucide-react'
import { createClient } from '@/lib/api/server'
import { AddEventForm } from '@/components/calendar/AddEventForm'
import { TrainerCalendar } from '@/components/calendar/TrainerCalendar'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const typeCls: Record<string, string> = { Class: 'bg-blue-50 text-blue-600 border-blue-200', Holiday: 'bg-rose-50 text-rose-600 border-rose-200', Meeting: 'bg-amber-50 text-amber-600 border-amber-200', Test: 'bg-violet-50 text-violet-600 border-violet-200' }
const one = (x: any) => (Array.isArray(x) ? x[0] : x)
const pad = (n: number) => String(n).padStart(2, '0')

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ m?: string; d?: string }> }) {
  const sp = await searchParams
  const now = new Date()
  const [yStr, mStr] = (sp.m ?? `${now.getFullYear()}-${pad(now.getMonth() + 1)}`).split('-')
  let year = parseInt(yStr, 10) || now.getFullYear()
  let month = (parseInt(mStr, 10) || now.getMonth() + 1) - 1
  if (month < 0) { month = 11; year-- } else if (month > 11) { month = 0; year++ }

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const leadBlanks = new Date(year, month, 1).getDay()
  const startISO = `${year}-${pad(month + 1)}-01`
  const endISO = `${year}-${pad(month + 1)}-${pad(daysInMonth)}`
  const todayISO = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const monthKey = `${year}-${pad(month + 1)}`
  // selected day: ?d if within this month, else today if in month, else the 1st
  let selected = sp.d && /^\d{4}-\d{2}-\d{2}$/.test(sp.d) && sp.d.startsWith(monthKey) ? sp.d
    : todayISO.startsWith(monthKey) ? todayISO : startISO

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: me } = await supabase.from('profiles').select('role, full_name').eq('id', user!.id).single()
  const role = (me as any)?.role ?? 'student'

  // Trainers get their own month — classes, assessments, assignments and
  // tasks instead of follow-ups and aptitude tests. Every other role falls
  // through to the original screen below, unchanged.
  if (role === 'trainer') {
    return <TrainerCalendar userId={user!.id} month={sp.m} day={sp.d} />
  }

  const myName = (me as any)?.full_name ?? ''
  const isBD = role === 'bd' || role === 'counsellor'
  const canEdit = ['trainer', 'admin', 'super_admin'].includes(role)

  let fuQ = supabase.from('followups').select('scheduled_at, outcome, leads(name)').gte('scheduled_at', startISO).lte('scheduled_at', endISO + 'T23:59:59')
  if (isBD) fuQ = fuQ.eq('bd_id', user!.id)
  let aptQ = supabase.from('aptitude').select('apt_date, name, round, mode, bd').gte('apt_date', startISO).lte('apt_date', endISO).is('deleted_at', null)
  if (isBD && myName) aptQ = aptQ.ilike('bd', `%${myName}%`)

  const [{ data: fus = [] }, { data: apts = [] }, { data: topics = [] }, { data: events = [] }] = await Promise.all([
    fuQ,
    aptQ,
    supabase.from('topics').select('date, topic, batch').gte('date', startISO).lte('date', endISO).is('deleted_at', null),
    supabase.from('calendar_events').select('id, date, title, type, time, batch').gte('date', startISO).lte('date', endISO).is('deleted_at', null).order('time'),
  ])

  // group by date
  const evMap: Record<string, any[]> = {}, fuMap: Record<string, any[]> = {}, aptMap: Record<string, any[]> = {}, topMap: Record<string, any[]> = {}
  for (const e of events ?? []) (evMap[(e as any).date] ??= []).push(e)
  for (const f of fus ?? []) { const d = (f as any).scheduled_at?.slice(0, 10); if (d) (fuMap[d] ??= []).push(f) }
  for (const a of apts ?? []) { const d = (a as any).apt_date; if (d) (aptMap[d] ??= []).push(a) }
  for (const t of topics ?? []) { const d = (t as any).date; if (d) (topMap[d] ??= []).push(t) }

  const cells: (number | null)[] = [...Array(leadBlanks).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  const prevM = `${month === 0 ? year - 1 : year}-${pad(month === 0 ? 12 : month)}`
  const nextM = `${month === 11 ? year + 1 : year}-${pad(month === 11 ? 1 : month + 2)}`
  const selPretty = new Date(selected).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const dot = (cls: string) => <span className={`h-1.5 w-1.5 rounded-full ${cls}`} />
  const Section = ({ icon: Icon, title, color, children, empty }: any) => (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-500"><Icon className={`h-3.5 w-3.5 ${color}`} /> {title}</div>
      {children ?? <p className="text-xs text-slate-300">{empty}</p>}
    </div>
  )

  const selEv = evMap[selected] ?? [], selFu = fuMap[selected] ?? [], selApt = aptMap[selected] ?? [], selTop = topMap[selected] ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Calendar</h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">{dot('bg-blue-500')} Events</span>
            <span className="flex items-center gap-1">{dot('bg-indigo-500')} Classes</span>
            <span className="flex items-center gap-1">{dot('bg-emerald-500')} Follow-ups</span>
            <span className="flex items-center gap-1">{dot('bg-violet-500')} Aptitude</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/calendar?m=${prevM}`} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"><ChevronLeft className="h-4 w-4" /></Link>
          <span className="min-w-[150px] text-center text-sm font-semibold text-slate-800">{MONTHS[month]} {year}</span>
          <Link href={`/calendar?m=${nextM}`} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"><ChevronRight className="h-4 w-4" /></Link>
          <Link href="/calendar" className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">Today</Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Month grid */}
        <div className="lg:col-span-2 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50 text-center text-xs font-medium text-slate-500">
            {DOW.map((d) => <div key={d} className="py-2">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              if (day === null) return <div key={i} className="min-h-[84px] border-b border-r border-slate-100 bg-slate-50/40" />
              const iso = `${monthKey}-${pad(day)}`
              const isToday = iso === todayISO
              const isSel = iso === selected
              const dots = [
                (evMap[iso]?.length ? 'bg-blue-500' : ''), (topMap[iso]?.length ? 'bg-indigo-500' : ''),
                (fuMap[iso]?.length ? 'bg-emerald-500' : ''), (aptMap[iso]?.length ? 'bg-violet-500' : ''),
              ].filter(Boolean)
              return (
                <Link key={i} href={`/calendar?m=${monthKey}&d=${iso}`}
                  className={`min-h-[84px] border-b border-r border-slate-100 p-2 transition hover:bg-blue-50/40 ${isSel ? 'ring-2 ring-inset ring-blue-500 bg-blue-50/60' : isToday ? 'bg-amber-50/40' : ''}`}>
                  <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${isToday ? 'bg-blue-600 text-white' : isSel ? 'text-blue-700' : 'text-slate-600'}`}>{day}</div>
                  <div className="mt-1.5 flex flex-wrap gap-1">{dots.map((c, k) => <span key={k} className={`h-1.5 w-1.5 rounded-full ${c}`} />)}</div>
                </Link>
              )
            })}
          </div>
        </div>

        {/* Selected-day agenda */}
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <CalendarClock className="h-5 w-5 text-blue-600" />
            <div><div className="text-sm font-semibold text-slate-900">{selPretty}</div><div className="text-xs text-slate-400">{selEv.length + selFu.length + selApt.length + selTop.length} item(s)</div></div>
          </div>

          <Section icon={CalendarDays} title="Events" color="text-blue-500" empty="No events"
            children={selEv.length ? <div className="space-y-1">{selEv.map((e: any, k: number) => <div key={k} className={`rounded-lg border px-2 py-1.5 text-xs ${typeCls[e.type] ?? 'bg-slate-50 text-slate-600 border-slate-200'}`}><b>{e.time ? e.time + ' · ' : ''}{e.title}</b>{e.batch ? <span className="opacity-70"> · {e.batch}</span> : ''}</div>)}</div> : null} />

          <Section icon={GraduationCap} title="Classes" color="text-indigo-500" empty="No classes"
            children={selTop.length ? <div className="space-y-1">{selTop.map((t: any, k: number) => <div key={k} className="rounded-lg bg-indigo-50 px-2 py-1.5 text-xs text-indigo-700">{t.topic}{t.batch ? <span className="opacity-70"> · {t.batch}</span> : ''}</div>)}</div> : null} />

          <Section icon={PhoneCall} title="Follow-ups" color="text-emerald-500" empty="No follow-ups"
            children={selFu.length ? <div className="space-y-1">{selFu.map((f: any, k: number) => <div key={k} className="flex justify-between rounded-lg bg-emerald-50 px-2 py-1.5 text-xs text-emerald-700"><span>{one(f.leads)?.name ?? 'Lead'}</span><span className="opacity-70">{f.outcome ?? ''}</span></div>)}</div> : null} />

          <Section icon={Brain} title="Aptitude Tests" color="text-violet-500" empty="No aptitude tests"
            children={selApt.length ? <div className="space-y-1">{selApt.map((a: any, k: number) => <div key={k} className="flex justify-between rounded-lg bg-violet-50 px-2 py-1.5 text-xs text-violet-700"><span>{a.name ?? 'Candidate'}</span><span className="opacity-70">{a.round ?? ''}{a.mode ? ` · ${a.mode}` : ''}</span></div>)}</div> : null} />

          {canEdit && <div className="border-t border-slate-100 pt-3"><AddEventForm trainerId={user!.id} /></div>}
        </div>
      </div>
    </div>
  )
}
