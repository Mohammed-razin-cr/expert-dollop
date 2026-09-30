'use client'

import type { BatchOption, TopicStatus } from '@/lib/topics'

/**
 * The fields of a session, shared by "Add Topic" on the list and "Edit
 * Topic" on the detail screen — the two must stay identical, or a topic
 * would gain fields it could never be edited to change.
 *
 * Covered points are typed one per line and stored as an array; a textarea
 * is a better fit than a repeater for a handful of short bullets.
 */

export type TopicDraft = {
  date: string
  topic: string
  batchId: string
  status: TopicStatus
  description: string
  covered: string
  notes: string
}

export const emptyDraft = (): TopicDraft => ({
  date: new Date().toISOString().slice(0, 10),
  topic: '',
  batchId: '',
  status: 'completed',
  description: '',
  covered: '',
  notes: '',
})

/** Lines the trainer typed, minus the blanks a stray return leaves behind. */
export const coveredToArray = (covered: string) =>
  covered
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)

export const inp =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100'

const label = 'mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-400'

export function TopicFields({
  value,
  onChange,
  batches,
}: {
  value: TopicDraft
  onChange: (next: TopicDraft) => void
  batches: BatchOption[]
}) {
  const set = <K extends keyof TopicDraft>(k: K, v: TopicDraft[K]) =>
    onChange({ ...value, [k]: v })

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className={label}>Date</label>
          <input
            className={inp}
            type="date"
            value={value.date}
            onChange={(e) => set('date', e.target.value)}
          />
        </div>
        <div>
          <label className={label}>Topic *</label>
          <input
            className={inp}
            placeholder="Introduction to Machine Learning"
            value={value.topic}
            onChange={(e) => set('topic', e.target.value)}
          />
        </div>
        <div>
          <label className={label}>Batch</label>
          <select className={inp} value={value.batchId} onChange={(e) => set('batchId', e.target.value)}>
            <option value="">No batch</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Status</label>
          <select
            className={inp}
            value={value.status}
            onChange={(e) => set('status', e.target.value as TopicStatus)}
          >
            <option value="completed">Completed</option>
            <option value="upcoming">Upcoming</option>
          </select>
        </div>
      </div>

      <div>
        <label className={label}>Description</label>
        <input
          className={inp}
          placeholder="Overview of ML, types, applications and real-world use cases."
          value={value.description}
          onChange={(e) => set('description', e.target.value)}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div>
          <label className={label}>Topics Covered — one per line</label>
          <textarea
            className={`${inp} min-h-[92px]`}
            placeholder={'What is Machine Learning?\nTypes of Machine Learning\nML Workflow'}
            value={value.covered}
            onChange={(e) => set('covered', e.target.value)}
          />
        </div>
        <div>
          <label className={label}>Trainer Notes</label>
          <textarea
            className={`${inp} min-h-[92px]`}
            placeholder="How the session went, what to revisit next time."
            value={value.notes}
            onChange={(e) => set('notes', e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}
