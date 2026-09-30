'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/api/client'
import { ASSESSMENT_TYPES, type BatchOption } from '@/lib/assessments'
import type { Enum } from '@/lib/database.types'

/**
 * Add Assessment — setting a paper up before it is sat.
 *
 * Its own page rather than a panel on the list: eight fields is more than
 * a row of inputs can carry, and a trainer arriving here has already
 * decided to create one.
 */

const DESCRIPTION_MAX = 500

const label = 'mb-1.5 block text-sm font-medium text-slate-700'
const req = <span className="text-rose-500">*</span>
const field =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100'

export function AssessmentForm({ batches, userId }: { batches: BatchOption[]; userId: string }) {
  const router = useRouter()
  const supabase = createClient()

  const [f, setF] = useState({
    title: '',
    batchId: '',
    topic: '',
    date: '',
    totalMarks: '',
    passingMarks: '',
    duration: '',
    type: '' as Enum<'assessment_type'> | '',
    description: '',
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const set = <K extends keyof typeof f>(k: K, v: string) => setF((p) => ({ ...p, [k]: v }))

  async function save() {
    const total = Number(f.totalMarks)
    const passing = Number(f.passingMarks)

    if (!f.title.trim()) return setErr('Assessment name is required')
    if (!f.batchId) return setErr('Pick the batch this paper is for')
    if (!f.topic.trim()) return setErr('Topic is required')
    if (!f.date) return setErr('Date is required')
    if (!f.totalMarks || Number.isNaN(total) || total <= 0) return setErr('Total marks must be a positive number')
    if (!f.passingMarks || Number.isNaN(passing) || passing < 0) return setErr('Passing marks must be a number')
    if (!f.type) return setErr('Assessment type is required')
    // The database enforces this too; catching it here gives a plain message
    // instead of a constraint violation.
    if (passing > total) return setErr('Passing marks cannot be above total marks')

    setBusy(true)
    setErr(null)
    const { data, error } = await supabase
      .from('assessments')
      .insert({
        title: f.title.trim(),
        batch_id: f.batchId,
        topic: f.topic.trim(),
        scheduled_at: f.date,
        total_marks: total,
        passing_marks: passing,
        duration_minutes: f.duration ? Number(f.duration) : null,
        type: f.type || null,
        description: f.description.trim() || null,
        created_by: userId,
      })
      .select('id')
      .maybeSingle()

    setBusy(false)
    if (error) return setErr(error.message)
    router.push(data?.id ? `/assessments/${(data as any).id}` : '/assessments')
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

      <div>
        <h1 className="text-xl font-semibold text-slate-900">Add Assessment</h1>
        <p className="text-sm text-slate-500">Create a new assessment for your batch.</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className={label}>Assessment Name {req}</label>
            <input
              className={field}
              placeholder="Enter assessment name"
              value={f.title}
              onChange={(e) => set('title', e.target.value)}
            />
          </div>
          <div>
            <label className={label}>Batch {req}</label>
            <select className={field} value={f.batchId} onChange={(e) => set('batchId', e.target.value)}>
              <option value="">Select batch</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Topic {req}</label>
            <input
              className={field}
              placeholder="Enter topic"
              value={f.topic}
              onChange={(e) => set('topic', e.target.value)}
            />
          </div>
          <div>
            <label className={label}>Date {req}</label>
            <input
              className={field}
              type="date"
              value={f.date}
              onChange={(e) => set('date', e.target.value)}
            />
          </div>

          <div>
            <label className={label}>Total Marks {req}</label>
            <input
              className={field}
              type="number"
              min={1}
              placeholder="Enter total marks"
              value={f.totalMarks}
              onChange={(e) => set('totalMarks', e.target.value)}
            />
          </div>
          <div>
            <label className={label}>Passing Marks {req}</label>
            <input
              className={field}
              type="number"
              min={0}
              placeholder="Enter passing marks"
              value={f.passingMarks}
              onChange={(e) => set('passingMarks', e.target.value)}
            />
          </div>
          <div>
            <label className={label}>Duration (Minutes)</label>
            <input
              className={field}
              type="number"
              min={1}
              placeholder="Enter duration (optional)"
              value={f.duration}
              onChange={(e) => set('duration', e.target.value)}
            />
          </div>
          <div>
            <label className={label}>Assessment Type {req}</label>
            <select className={field} value={f.type} onChange={(e) => set('type', e.target.value)}>
              <option value="">Select type</option>
              {ASSESSMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4">
          <label className={label}>Description (Optional)</label>
          <textarea
            className={`${field} min-h-[110px]`}
            placeholder="Enter assessment description or instructions..."
            maxLength={DESCRIPTION_MAX}
            value={f.description}
            onChange={(e) => set('description', e.target.value)}
          />
          <p className="mt-1 text-right text-xs text-slate-400">
            {f.description.length} / {DESCRIPTION_MAX}
          </p>
        </div>

        {err && (
          <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
            {err}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Link
            href="/assessments"
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            onClick={save}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Create Assessment
          </button>
        </div>
      </div>
    </div>
  )
}
