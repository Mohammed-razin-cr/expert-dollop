'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CalendarDays, Check, Clock, Loader2, Trash2, Users } from 'lucide-react'
import { createClient } from '@/lib/api/client'
import { fmtDate, fmtStamp } from '@/lib/ui'
import type { AssessmentDetailData, ResultRow } from '@/lib/assessments'

/**
 * One paper: what it is, and how each student did on it.
 *
 * The table is driven by the batch roster, so a student with no score
 * still has a line — that gap is the work outstanding. Entering a score
 * creates the row.
 */

const card = 'rounded-xl border border-slate-200 bg-white p-5'
const heading = 'text-sm font-semibold text-slate-800'

export function AssessmentDetail({ data }: { data: AssessmentDetailData }) {
  const router = useRouter()
  const supabase = createClient()

  const { assessment: a } = data

  const [scores, setScores] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [done, setDone] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const marked = data.results.filter((r) => r.score !== null)
  const avgMarks = marked.length
    ? Math.round((marked.reduce((s, r) => s + (r.score as number), 0) / marked.length) * 10) / 10
    : null
  const avgPct = avgMarks !== null && a.totalMarks ? Math.round((avgMarks / a.totalMarks) * 100) : null
  const passes = a.passingMarks === null ? null : marked.filter((r) => r.passed).length

  async function mark(r: ResultRow) {
    const raw = (scores[r.studentId] ?? '').trim()
    if (!raw) return setErr('Enter a score first')
    const score = Number(raw)
    if (Number.isNaN(score) || score < 0) return setErr('Score must be a positive number')
    if (a.totalMarks !== null && score > a.totalMarks) {
      return setErr(`Score cannot be above ${a.totalMarks}`)
    }
    setSaving(r.studentId)
    setErr(null)
    // The row may not exist — upsert on the pair the unique constraint
    // covers, so a first mark and a correction both land.
    const { error } = await supabase.from('assessment_results').upsert(
      { assessment_id: a.id, student_id: r.studentId, score, status: 'graded' },
      { onConflict: 'assessment_id,student_id' },
    )
    setSaving(null)
    if (error) return setErr(error.message)
    setDone((p) => ({ ...p, [r.studentId]: true }))
    router.refresh()
  }

  async function remove() {
    if (!confirm(`Delete "${a.title}"? Recorded marks stay in the database.`)) return
    setBusy(true)
    const { error } = await supabase
      .from('assessments')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', a.id)
    setBusy(false)
    if (error) return setErr(error.message)
    router.push('/assessments')
    router.refresh()
  }

  return (
    <div className="space-y-5">
      <Link
        href="/assessments"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Assessments
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold text-slate-900">{a.title}</h1>
            {a.type && (
              <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium capitalize text-slate-600">
                {a.type}
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-4 w-4" /> {a.batch ?? 'No batch'}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" /> {fmtDate(a.date)}
            </span>
            {a.durationMinutes !== null && (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4" /> {a.durationMinutes} min
              </span>
            )}
          </div>
        </div>

        <button
          onClick={remove}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3.5 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" /> Delete
        </button>
      </div>

      {err && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{err}</p>
      )}

      <div className={card}>
        <h2 className={heading}>Paper</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Topic" value={a.topic ?? '—'} />
          <Stat label="Total Marks" value={a.totalMarks ?? '—'} />
          <Stat label="Passing Marks" value={a.passingMarks ?? '—'} />
          <Stat
            label="Attempted"
            value={`${marked.length} / ${data.results.length}`}
          />
        </div>
        {a.description && (
          <p className="mt-4 whitespace-pre-line border-t border-slate-100 pt-4 text-sm text-slate-600">
            {a.description}
          </p>
        )}
      </div>

      <div className={card}>
        <h2 className={heading}>Class Performance</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <Stat label="Average" value={avgPct === null ? '—' : `${avgPct}%`} />
          <Stat label="Average marks" value={avgMarks === null ? '—' : `${avgMarks}`} />
          <Stat
            label="Passed"
            value={passes === null ? '—' : `${passes} / ${marked.length}`}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className={heading}>Results</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Student</th>
              <th className="px-4 py-3 font-medium">Result</th>
              <th className="px-4 py-3 font-medium">
                Score{a.totalMarks !== null ? ` / ${a.totalMarks}` : ''}
              </th>
            </tr>
          </thead>
          <tbody>
            {data.results.map((r) => (
              <tr key={r.studentId} className="border-t border-slate-100">
                <td className="px-4 py-2.5 font-medium text-slate-800">{r.student}</td>
                <td className="px-4 py-2.5">
                  {r.score === null ? (
                    <span className="inline-block rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-500">
                      Not marked
                    </span>
                  ) : r.passed === null ? (
                    <span className="text-slate-400">—</span>
                  ) : (
                    <span
                      className={`inline-block rounded-md border px-2 py-0.5 text-xs font-medium ${
                        r.passed
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-rose-200 bg-rose-50 text-rose-700'
                      }`}
                    >
                      {r.passed ? 'Pass' : 'Fail'}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  {done[r.studentId] ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                      <Check className="h-3.5 w-3.5" /> Saved
                    </span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-sm text-slate-700 outline-none focus:border-blue-300"
                        type="number"
                        min={0}
                        max={a.totalMarks ?? undefined}
                        placeholder={r.score !== null ? String(r.score) : '—'}
                        value={scores[r.studentId] ?? ''}
                        onChange={(e) => setScores((p) => ({ ...p, [r.studentId]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') mark(r)
                        }}
                      />
                      <button
                        onClick={() => mark(r)}
                        disabled={saving === r.studentId || !(scores[r.studentId] ?? '').trim()}
                        className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-40"
                      >
                        {saving === r.studentId && <Loader2 className="h-3 w-3 animate-spin" />} Save
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {!data.results.length && (
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center text-sm text-slate-400">
                  Nobody is enrolled in this batch yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className={card}>
        <h2 className={heading}>Other Details</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Stat label="Created On" value={fmtStamp(a.created_at)} />
          <Stat label="Last Updated On" value={fmtStamp(a.updated_at)} />
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-slate-800">{value}</p>
    </div>
  )
}
