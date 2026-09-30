'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { BookOpen, Layers, Users, ClipboardCheck, FileText } from 'lucide-react'
import { createClient } from '@/lib/api/client'
import { BatchesTable, type BatchRow } from '@/components/courses/BatchesTable'
import type { TrainerStats, BatchStat } from '@/lib/courses'
import type { Update } from '@/lib/database.types'

/**
 * Courses board for trainers.
 *
 * Deliberately a separate component from CourseManager: that one is the
 * admin's course-administration screen (create courses, create batches,
 * assign trainers) and is shared with super_admin. Keeping this apart
 * means nothing here can change what other roles see.
 *
 * Read-mostly by design — a trainer can move a course or batch status and
 * update batch progress, but cannot create or delete either.
 */

type Course = {
  id: string
  name: string
  code: string | null
  domain: string | null
  duration_weeks: number | null
  status: string
  batch_count: number
}
const COURSE_ST = ['active', 'inactive']

/** One KPI card — same shape on both tabs, only the set differs. */
/**
 * A card is given an action only where there is somewhere to go: the card for
 * the tab you are already looking at stays plain rather than pretending.
 */
function Kpi({
  label,
  value,
  Icon,
  tone,
  onClick,
  href,
}: {
  label: string
  value: number
  Icon: typeof BookOpen
  tone: string
  onClick?: () => void
  href?: string
}) {
  const face = (
    <>
      <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${tone}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-semibold text-slate-900">{value}</p>
        <p className="truncate text-xs text-slate-500">{label}</p>
      </div>
    </>
  )
  const box = 'flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4'
  const live = `${box} w-full text-left transition hover:border-blue-300 hover:shadow-sm`
  if (onClick) return <button type="button" onClick={onClick} className={live}>{face}</button>
  if (href) return <Link href={href} className={live}>{face}</Link>
  return <div className={box}>{face}</div>
}

export function TrainerCourseBoard({
  courses,
  batches,
  stats,
  batchStats,
}: {
  courses: Course[]
  batches: BatchRow[]
  stats: TrainerStats
  batchStats: Record<string, BatchStat>
}) {
  const router = useRouter()
  const supabase = createClient()
  const searchParams = useSearchParams()
  // ?tab=batches opens straight on Batches — how "Back to Batches" from a
  // batch detail page returns you to the tab you came from, now that there
  // is no Batches entry in the sidebar.
  const [tab, setTab] = useState<'courses' | 'batches'>(
    searchParams.get('tab') === 'batches' ? 'batches' : 'courses',
  )

  const upd = (table: 'courses', id: string, fields: Update<'courses'>) =>
    supabase
      .from(table)
      .update(fields)
      .eq('id', id)
      .then(() => router.refresh())

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          {tab === 'batches' ? 'Courses & Batches' : 'Courses'}
        </h1>
        <p className="text-sm text-slate-500">
          {tab === 'batches'
            ? `${courses.length} ${courses.length === 1 ? 'course' : 'courses'} · ${batches.length} ${batches.length === 1 ? 'batch' : 'batches'}`
            : `${courses.length} ${courses.length === 1 ? 'course' : 'courses'}`}
        </p>
      </div>

      <div className="flex w-fit gap-1 rounded-lg border border-slate-200 bg-white p-1 text-sm">
        <button
          onClick={() => setTab('courses')}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium ${
            tab === 'courses' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <BookOpen className="h-4 w-4" /> Courses
        </button>
        <button
          onClick={() => setTab('batches')}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium ${
            tab === 'batches' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Layers className="h-4 w-4" /> Batches
        </button>
      </div>

      {/* Students and Pending Reviews live on the Students page and on the
          Batches tab below; repeating them here said nothing new. */}
      {tab === 'courses' && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Kpi label="Total Courses" value={stats.courses} Icon={BookOpen} tone="bg-blue-50 text-blue-600" />
          <Kpi label="Total Batches" value={stats.batches} Icon={Layers} tone="bg-emerald-50 text-emerald-600" onClick={() => setTab('batches')} />
          <Kpi label="Materials Shared" value={stats.materials} Icon={FileText} tone="bg-rose-50 text-rose-600" href="/materials" />
        </div>
      )}

      {tab === 'batches' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Kpi label="Total Batches" value={stats.batches} Icon={Layers} tone="bg-blue-50 text-blue-600" />
          <Kpi label="Total Students" value={stats.students} Icon={Users} tone="bg-emerald-50 text-emerald-600" href="/students" />
          <Kpi label="Pending Reviews" value={stats.pendingReviews} Icon={ClipboardCheck} tone="bg-orange-50 text-orange-600" href="/assignments?status=ungraded" />
        </div>
      )}

      {tab === 'courses' && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 text-left text-xs text-slate-500">
              <tr>
                <th className="px-5 py-3.5 font-medium">Course</th>
                <th className="px-5 py-3.5 text-right font-medium">Weeks</th>
                <th className="px-5 py-3.5 text-right font-medium">Batches</th>
                <th className="px-5 py-3.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((c) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-900">{c.name}</p>
                    {c.domain && <p className="text-xs text-slate-400">{c.domain}</p>}
                  </td>
                  <td className="px-5 py-4 text-right text-slate-600">{c.duration_weeks ?? '—'}</td>
                  <td className="px-5 py-4 text-right text-slate-600">{c.batch_count}</td>
                  <td className="px-5 py-4">
                    <select
                      defaultValue={c.status}
                      onChange={(e) => upd('courses', c.id, { status: e.target.value })}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"
                    >
                      {COURSE_ST.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
              {!courses.length && (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-slate-400">
                    No courses yet — courses appear here once you are assigned a batch.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'batches' && <BatchesTable batches={batches} stats={batchStats} />}
    </div>
  )
}
