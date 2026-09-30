'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ClipboardList,
  Loader2,
  Pencil,
  Trash2,
  Users,
} from 'lucide-react'
import { createClient } from '@/lib/api/client'
import { fmtDate, fmtStamp } from '@/lib/ui'
import type { AssignmentDetailData, SubmissionRow } from '@/lib/assignments'

/**
 * One assignment: who has handed in, and what they scored.
 *
 * The table is driven by the batch roster rather than by submission rows,
 * so a student who handed in nothing still has a line — that absence is
 * the thing a trainer needs to see. Entering a score for them creates the
 * row, which is how marking offline work is handled.
 */

const card = 'rounded-xl border border-slate-200 bg-white p-5'
const heading = 'text-sm font-semibold text-slate-800'
const field =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-300'

const STATUS: Record<string, { label: string; tone: string }> = {
  not_submitted: { label: 'Not submitted', tone: 'border-slate-200 bg-slate-50 text-slate-500' },
  pending: { label: 'Pending', tone: 'border-slate-200 bg-slate-50 text-slate-600' },
  submitted: { label: 'Submitted', tone: 'border-blue-200 bg-blue-50 text-blue-700' },
  late: { label: 'Late', tone: 'border-amber-200 bg-amber-50 text-amber-700' },
  graded: { label: 'Graded', tone: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
}

export function AssignmentDetail({ data }: { data: AssignmentDetailData }) {
  const router = useRouter()
  const supabase = createClient()

  const { assignment: a } = data

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({
    title: a.title,
    description: a.description ?? '',
    due: a.due_date ?? '',
    batchId: a.batchId ?? '',
    topicId: a.topicId ?? '',
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const [scores, setScores] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [done, setDone] = useState<Record<string, boolean>>({})

  const topicChoices = data.topics.filter((t) => t.batchId === draft.batchId)

  const submitted = data.submissions.filter((s) => s.status !== 'not_submitted').length
  const graded = data.submissions.filter((s) => s.status === 'graded').length

  async function saveEdit() {
    if (!draft.title.trim()) return setErr('Title required')
    if (!draft.batchId) return setErr('An assignment needs a batch')
    setBusy(true)
    setErr(null)
    const { error } = await supabase
      .from('assignments')
      .update({
        title: draft.title.trim(),
        description: draft.description.trim() || null,
        due_date: draft.due || null,
        batch_id: draft.batchId,
        topic_id: draft.topicId || null,
      })
      .eq('id', a.id)
    setBusy(false)
    if (error) return setErr(error.message)
    setEditing(false)
    router.refresh()
  }

  async function remove() {
    if (!confirm(`Delete "${a.title}"? Submissions against it stay in the database.`)) return
    setBusy(true)
    const { error } = await supabase
      .from('assignments')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', a.id)
    setBusy(false)
    if (error) return setErr(error.message)
    router.push('/assignments')
    router.refresh()
  }

  async function grade(s: SubmissionRow) {
    const raw = (scores[s.studentId] ?? '').trim()
    if (!raw) return setErr('Enter a score first')
    const score = Number(raw)
    if (Number.isNaN(score) || score < 0 || score > 100) {
      return setErr('Score must be between 0 and 100')
    }
    setSaving(s.studentId)
    setErr(null)
    // The row may not exist — marking work handed in on paper creates it.
    // Upsert on the pair the unique constraint covers.
    const { error } = await supabase.from('assignment_submissions').upsert(
      {
        assignment_id: a.id,
        student_id: s.studentId,
        score,
        status: 'graded',
      },
      { onConflict: 'assignment_id,student_id' },
    )
    setSaving(null)
    if (error) return setErr(error.message)
    setDone((p) => ({ ...p, [s.studentId]: true }))
    router.refresh()
  }

  return (
    <div className="space-y-5">
      <Link
        href="/assignments"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Assignments
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold text-slate-900">{a.title}</h1>
            <span
              className={`inline-block rounded-md border px-2 py-0.5 text-xs font-medium ${
                a.open
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 bg-slate-50 text-slate-600'
              }`}
            >
              {a.open ? 'Open' : 'Closed'}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-4 w-4" /> {a.batch ?? 'No batch'}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" /> Due {fmtDate(a.due_date)}
            </span>
            {a.topic && (
              <span className="inline-flex items-center gap-1.5">
                <ClipboardList className="h-4 w-4" /> {a.topic}
              </span>
            )}
          </div>
        </div>

        {!editing && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 px-3.5 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50"
            >
              <Pencil className="h-4 w-4" /> Edit
            </button>
            <button
              onClick={remove}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3.5 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          </div>
        )}
      </div>

      {err && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{err}</p>
      )}

      {editing ? (
        <div className={card}>
          <h2 className={`mb-3 ${heading}`}>Edit Assignment</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <input
              className={field}
              placeholder="Title *"
              value={draft.title}
              onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))}
            />
            <select
              className={field}
              value={draft.batchId}
              onChange={(e) => setDraft((p) => ({ ...p, batchId: e.target.value, topicId: '' }))}
            >
              <option value="">Batch *…</option>
              {data.batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <select
              className={field}
              value={draft.topicId}
              onChange={(e) => setDraft((p) => ({ ...p, topicId: e.target.value }))}
              disabled={!draft.batchId}
            >
              <option value="">Session (optional)…</option>
              {topicChoices.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.topic}
                </option>
              ))}
            </select>
            <input
              className={field}
              type="date"
              value={draft.due}
              onChange={(e) => setDraft((p) => ({ ...p, due: e.target.value }))}
              aria-label="Due date"
            />
          </div>
          <input
            className={`${field} mt-3`}
            placeholder="Description"
            value={draft.description}
            onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
          />
          <div className="mt-3 flex gap-2">
            <button
              onClick={saveEdit}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save Changes
            </button>
            <button
              onClick={() => {
                setEditing(false)
                setErr(null)
              }}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className={card}>
            <h2 className={heading}>Description</h2>
            <p className="mt-2 whitespace-pre-line text-sm text-slate-600">
              {a.description ?? 'No description.'}
            </p>
            <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-3">
              <Stat label="Class size" value={data.submissions.length} />
              <Stat label="Handed in" value={`${submitted} / ${data.submissions.length}`} />
              <Stat label="Graded" value={`${graded} / ${submitted}`} />
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-4 py-3">
              <h2 className={heading}>Submissions</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Student</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Submitted</th>
                  <th className="px-4 py-3 font-medium">Score /100</th>
                </tr>
              </thead>
              <tbody>
                {data.submissions.map((s) => {
                  const st = STATUS[s.status] ?? STATUS.pending
                  return (
                    <tr key={s.studentId} className="border-t border-slate-100">
                      <td className="px-4 py-2.5 font-medium text-slate-800">{s.student}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-block rounded-md border px-2 py-0.5 text-xs font-medium ${st.tone}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">{s.submitted_at ?? '—'}</td>
                      <td className="px-4 py-2.5">
                        {done[s.studentId] ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                            <Check className="h-3.5 w-3.5" /> Saved
                          </span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <input
                              className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-sm text-slate-700 outline-none focus:border-blue-300"
                              type="number"
                              min={0}
                              max={100}
                              placeholder={s.score !== null ? String(s.score) : '—'}
                              value={scores[s.studentId] ?? ''}
                              onChange={(e) =>
                                setScores((p) => ({ ...p, [s.studentId]: e.target.value }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') grade(s)
                              }}
                            />
                            <button
                              onClick={() => grade(s)}
                              disabled={saving === s.studentId || !(scores[s.studentId] ?? '').trim()}
                              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-40"
                            >
                              {saving === s.studentId && <Loader2 className="h-3 w-3 animate-spin" />} Save
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {!data.submissions.length && (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-sm text-slate-400">
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
              <div>
                <p className="text-xs text-slate-500">Created On</p>
                <p className="mt-0.5 text-sm text-slate-700">{fmtStamp(a.created_at)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Last Updated On</p>
                <p className="mt-0.5 text-sm text-slate-700">{fmtStamp(a.updated_at)}</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  )
}
