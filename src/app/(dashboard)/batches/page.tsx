import Link from 'next/link'
import { createClient } from '@/lib/api/server'
import { CourseManager } from '@/components/courses/CourseManager'
import { BatchesTable } from '@/components/courses/BatchesTable'
import { getViewer } from '@/lib/trainer'
import { loadCoursesAndBatches, loadTrainerStats, loadBatchStats, loadBatchEnrolments } from '@/lib/courses'
import { Layers, Users, ClipboardCheck } from 'lucide-react'

/**
 * Batches — the trainer sidebar's own entry.
 *
 * Shows the same table as the Batches tab on /courses, via the shared
 * BatchesTable, so the two cannot drift apart.
 *
 * Staff reaching this URL get CourseManager opened on its batches tab —
 * their administration screen, unchanged.
 */
export default async function BatchesPage() {
  const supabase = await createClient()
  const viewer = await getViewer(supabase)
  const data = await loadCoursesAndBatches(supabase, viewer)

  if (viewer.role !== 'trainer') {
    // The batch form edits each batch's roll, so it opens with the students
    // already enrolled — and the table shows the count.
    const enrolledByBatch = await loadBatchEnrolments(
      supabase,
      data.batches.map((b: any) => b.id),
    )
    return (
      <CourseManager
        courses={data.courses as any}
        batches={data.batches as any}
        trainers={data.trainers as any}
        courseOpts={data.courseOpts}
        role={viewer.role}
        defaultTab="batches"
        enrolledByBatch={enrolledByBatch}
      />
    )
  }

  const [stats, batchStats] = await Promise.all([
    loadTrainerStats(supabase, viewer.id),
    loadBatchStats(supabase, data.batches.map((b: any) => b.id)),
  ])

  // Total Batches is what the table below already lists, so it stays plain;
  // the other two belong to screens of their own.
  const kpis: { label: string; value: number; Icon: typeof Layers; tone: string; href?: string }[] = [
    { label: 'Total Batches', value: stats.batches, Icon: Layers, tone: 'bg-blue-50 text-blue-600' },
    { label: 'Total Students', value: stats.students, Icon: Users, tone: 'bg-emerald-50 text-emerald-600', href: '/students' },
    { label: 'Pending Reviews', value: stats.pendingReviews, Icon: ClipboardCheck, tone: 'bg-orange-50 text-orange-600', href: '/assignments?status=ungraded' },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Batches</h1>
        <p className="text-sm text-slate-500">
          {data.batches.length} {data.batches.length === 1 ? 'batch' : 'batches'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {kpis.map((k) => {
          const face = (
            <>
              <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${k.tone}`}>
                <k.Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-semibold text-slate-900">{k.value}</p>
                <p className="truncate text-xs text-slate-500">{k.label}</p>
              </div>
            </>
          )
          const box = 'flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4'
          return k.href ? (
            <Link key={k.label} href={k.href} className={`${box} transition hover:border-blue-300 hover:shadow-sm`}>
              {face}
            </Link>
          ) : (
            <div key={k.label} className={box}>{face}</div>
          )
        })}
      </div>

      <BatchesTable batches={data.batches as any} stats={batchStats} />
    </div>
  )
}
