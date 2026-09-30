'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Users, CircleAlert } from 'lucide-react'
import { useDebouncedValue } from '@/lib/useDebouncedValue'

/**
 * Trainer Assignment — which trainer runs which batch.
 *
 * This screen used to assign a trainer to one student at a time, writing a
 * row per student into `trainer_assignments`. Teaching is organised by
 * batch, so that meant re-stating the same trainer for everybody in a
 * cohort, and nothing downstream read those rows: every screen that shows
 * "the trainer" reads `batches.trainer_id`, and the trainer's own sidebar
 * is scoped by it. Assigning that column is therefore the whole job — the
 * batch appears for the trainer the moment it is set.
 *
 * Writes go through /api/batches, which is where a BD is allowed to write
 * batches (see that route for why).
 */

type Trainer = { id: string; full_name: string }
type Row = {
  id: string
  name: string
  course: string | null
  trainer_id: string | null
  start_date: string | null
  end_date: string | null
  capacity: number | null
  status: string
  enrolled: number
}

const dates = (a: string | null, b: string | null) =>
  !a && !b ? '—' : `${a ?? '—'}${b ? ` → ${b}` : ''}`

const statusTone: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700',
  planned: 'bg-blue-50 text-blue-700',
  completed: 'bg-slate-100 text-slate-600',
  cancelled: 'bg-rose-50 text-rose-700',
}

export function TrainerAssignManager({
  rows,
  trainers,
  canManage,
}: {
  rows: Row[]
  trainers: Trainer[]
  canManage?: boolean
}) {
  const router = useRouter()
  // `qInput` is what is typed and `q` is what the table is filtered by, a
  // beat behind it. The box stays instant; the filter runs once you pause.
  const [qInput, setQInput] = useState('')
  const q = useDebouncedValue(qInput)
  const [onlyUnassigned, setOnlyUnassigned] = useState(false)
  // Per row, so one batch saving never freezes the others.
  const [busyId, setBusyId] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const trainerName = useMemo(() => {
    const m: Record<string, string> = {}
    for (const t of trainers) m[t.id] = t.full_name
    return m
  }, [trainers])

  const unassigned = rows.filter((r) => !r.trainer_id).length

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return rows.filter((r) => {
      if (onlyUnassigned && r.trainer_id) return false
      if (!needle) return true
      const hay = `${r.name} ${r.course ?? ''} ${r.trainer_id ? trainerName[r.trainer_id] ?? '' : ''}`
      return hay.toLowerCase().includes(needle)
    })
  }, [rows, q, onlyUnassigned, trainerName])

  async function assign(batchId: string, trainerId: string) {
    setBusyId(batchId)
    setErr(null)
    try {
      const res = await fetch('/api/batches', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: batchId, trainer_id: trainerId || null }),
      })
      const out = await res.json().catch(() => null)
      if (!res.ok) {
        setErr((out as any)?.error ?? `Could not save the trainer (${res.status}).`)
        return
      }
      router.refresh()
    } catch {
      setErr('Could not reach the server. Check your connection and try again.')
    } finally {
      setBusyId(null)
    }
  }

  const th = 'px-4 py-3 font-medium'
  const td = 'px-4 py-2.5'

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Trainer Assignment</h1>
        <p className="text-sm text-slate-500">
          {rows.length} {rows.length === 1 ? 'batch' : 'batches'}
          {unassigned > 0 && (
            <>
              <span className="mx-1.5 text-slate-300">•</span>
              <span className="text-amber-700">{unassigned} without a trainer</span>
            </>
          )}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Search batch, course or trainer…"
            aria-label="Search batches"
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <button
          onClick={() => setOnlyUnassigned((v) => !v)}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium ${
            onlyUnassigned
              ? 'border-amber-300 bg-amber-50 text-amber-800'
              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
          }`}
        >
          <CircleAlert className="h-4 w-4" />
          Unassigned only
        </button>
      </div>

      {err && <p className="text-sm text-rose-600">{err}</p>}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className={th}>Batch</th>
              <th className={th}>Course</th>
              <th className={th}>Dates</th>
              <th className={th}>Students</th>
              <th className={th}>Trainer</th>
              <th className={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className={`${td} font-medium text-slate-800`}>{r.name}</td>
                <td className={`${td} text-slate-600`}>{r.course ?? '—'}</td>
                <td className={`${td} whitespace-nowrap text-slate-500`}>
                  {dates(r.start_date, r.end_date)}
                </td>
                <td className={`${td} whitespace-nowrap text-slate-600`}>
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-slate-400" />
                    {r.enrolled} / {r.capacity ?? '—'}
                  </span>
                </td>
                <td className={td}>
                  {canManage ? (
                    <div className="flex items-center gap-2">
                      <select
                        value={r.trainer_id ?? ''}
                        disabled={busyId === r.id}
                        onChange={(e) => assign(r.id, e.target.value)}
                        aria-label={`Trainer for ${r.name}`}
                        className={`min-w-44 rounded-lg border bg-white px-2 py-1.5 text-sm disabled:opacity-60 ${
                          r.trainer_id ? 'border-slate-200 text-slate-700' : 'border-amber-300 text-amber-800'
                        }`}
                      >
                        <option value="">
                          {trainers.length ? 'Unassigned — pick a trainer…' : 'No trainers on record'}
                        </option>
                        {trainers.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.full_name}
                          </option>
                        ))}
                      </select>
                      {busyId === r.id && <span className="text-xs text-slate-400">Saving…</span>}
                    </div>
                  ) : r.trainer_id ? (
                    <span className="text-slate-700">{trainerName[r.trainer_id] ?? '—'}</span>
                  ) : (
                    <span className="text-amber-700">Unassigned</span>
                  )}
                </td>
                <td className={td}>
                  <span
                    className={`rounded-md px-2 py-1 text-xs font-medium capitalize ${
                      statusTone[r.status] ?? 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
            {!shown.length && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  {rows.length
                    ? 'No batch matches these filters.'
                    : 'No batches yet — create one on the Batches screen first.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
