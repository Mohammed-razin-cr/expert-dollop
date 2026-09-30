'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/api/client'
import type { BatchStat } from '@/lib/courses'
import type { Update, Enum } from '@/lib/database.types'

/**
 * The batches table, shared by the Batches tab on /courses and the
 * dedicated /batches route so the two cannot drift apart.
 *
 * Status and progress are editable inline; everything else is read-only —
 * creating batches and assigning trainers stays with admins.
 */

export type BatchRow = {
  id: string
  name: string
  course: string | null
  trainer: string | null
  start_date: string | null
  end_date: string | null
  capacity: number | null
  progress: number | null
  status: string
}

const BATCH_ST = ['planned', 'active', 'completed', 'cancelled']

const fmt = (d: string | null) =>
  d
    ? new Date(d + 'T00:00:00').toLocaleDateString('en-CA') // YYYY-MM-DD, matches the design
    : null

const dates = (a: string | null, b: string | null) => {
  const s = fmt(a)
  const e = fmt(b)
  if (!s && !e) return '—'
  return `${s ?? '—'} — ${e ?? '—'}`
}

/** Green above 90, amber 75-90, rose below — a glanceable health signal. */
function attendanceTone(pct: number) {
  if (pct >= 90) return 'text-emerald-600'
  if (pct >= 75) return 'text-amber-600'
  return 'text-rose-600'
}

export function BatchesTable({
  batches,
  stats,
}: {
  batches: BatchRow[]
  stats: Record<string, BatchStat>
}) {
  const router = useRouter()
  const supabase = createClient()

  const upd = (id: string, fields: Update<'batches'>) =>
    supabase
      .from('batches')
      .update(fields)
      .eq('id', id)
      .then(() => router.refresh())

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-100 text-left text-xs text-slate-500">
          <tr>
            <th className="px-5 py-3.5 font-medium">Batch</th>
            <th className="px-5 py-3.5 font-medium">Course</th>
            <th className="px-5 py-3.5 font-medium">Trainer</th>
            <th className="px-5 py-3.5 font-medium">Dates</th>
            <th className="px-5 py-3.5 font-medium">Students</th>
            <th className="px-5 py-3.5 font-medium">Attendance</th>
            <th className="px-5 py-3.5 font-medium">Progress</th>
            <th className="px-5 py-3.5 font-medium">Status</th>
            <th className="px-5 py-3.5 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {batches.map((b) => {
            const s = stats[b.id] ?? { enrolled: 0, attendancePct: null }
            const progress = Math.max(0, Math.min(100, Number(b.progress ?? 0)))
            return (
              <tr key={b.id} className="border-t border-slate-100">
                <td className="px-5 py-4 font-semibold text-slate-900">{b.name}</td>
                <td className="px-5 py-4 text-slate-600">{b.course ?? '—'}</td>
                <td className="px-5 py-4 text-slate-600">{b.trainer ?? '—'}</td>
                <td className="px-5 py-4 whitespace-nowrap text-slate-500">
                  {dates(b.start_date, b.end_date)}
                </td>
                <td className="px-5 py-4 whitespace-nowrap text-slate-600">
                  {s.enrolled} / {b.capacity ?? '—'}
                </td>
                <td className="px-5 py-4 whitespace-nowrap">
                  {s.attendancePct === null ? (
                    <span className="text-slate-400">—</span>
                  ) : (
                    <span className={`font-medium ${attendanceTone(s.attendancePct)}`}>
                      {s.attendancePct}%
                    </span>
                  )}
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-blue-600" style={{ width: `${progress}%` }} />
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      defaultValue={progress}
                      onBlur={(e) => {
                        const v = Math.max(0, Math.min(100, Number(e.target.value)))
                        if (v !== progress) upd(b.id, { progress: v })
                      }}
                      aria-label={`Progress for ${b.name}`}
                      className="w-14 rounded-md border border-transparent px-1 py-0.5 text-xs text-slate-600 hover:border-slate-200 focus:border-blue-300 focus:outline-none"
                    />
                    <span className="text-xs text-slate-400">%</span>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <select
                    defaultValue={b.status}
                    onChange={(e) => upd(b.id, { status: e.target.value as Enum<'batch_status'> })}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"
                  >
                    {BATCH_ST.map((s2) => (
                      <option key={s2} value={s2}>{s2}</option>
                    ))}
                  </select>
                </td>
                <td className="px-5 py-4">
                  <Link
                    href={`/batches/${b.id}`}
                    className="inline-block whitespace-nowrap rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                  >
                    View Batch
                  </Link>
                </td>
              </tr>
            )
          })}
          {!batches.length && (
            <tr>
              <td colSpan={9} className="px-5 py-10 text-center text-slate-400">
                No batches assigned to you yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
