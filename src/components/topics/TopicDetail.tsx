'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  Download,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  User,
  Users,
} from 'lucide-react'
import { createClient } from '@/lib/api/client'
import { MAX_MATERIAL_BYTES, MAX_MATERIAL_MB } from '@/lib/uploads'
import type { TopicDetailData } from '@/lib/topics'
import { STATUS_LABEL, STATUS_TONE } from './TopicsManager'
import { fmtDate, fmtStamp } from '@/lib/ui'
import { TopicFields, coveredToArray, type TopicDraft } from './TopicForm'

/**
 * One session, in full.
 *
 * Read-mostly: the trainer edits the session itself, shares a file against
 * it, or deletes it. Assignments are listed but not created here — they
 * belong to whichever screen owns assignments.
 */

const BUCKET = 'oms-files'
const safeName = (n: string) => n.replace(/[^\w.\-]/g, '_')

/** "1.2 MB" — file sizes as the upload reported them. */
function fmtSize(bytes: number | null) {
  if (bytes === null || bytes <= 0) return null
  const units = ['B', 'KB', 'MB', 'GB']
  let v = bytes
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i += 1
  }
  return `${i === 0 ? v : Number(v.toFixed(1))} ${units[i]}`
}

const card = 'rounded-xl border border-slate-200 bg-white p-5'
const heading = 'text-sm font-semibold text-slate-800'
const field =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-300'

export function TopicDetail({
  data,
  startEditing,
  userId,
}: {
  data: TopicDetailData
  startEditing: boolean
  userId: string
}) {
  const router = useRouter()
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const { topic: t } = data

  const [editing, setEditing] = useState(startEditing)
  const [draft, setDraft] = useState<TopicDraft>({
    date: t.date ?? new Date().toISOString().slice(0, 10),
    topic: t.topic,
    batchId: t.batchId ?? '',
    status: t.status,
    description: t.description ?? '',
    covered: t.covered.join('\n'),
    notes: t.notes ?? '',
  })
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const [givingAssignment, setGivingAssignment] = useState(false)
  const [assignment, setAssignment] = useState({ title: '', due: '', description: '' })
  const [assignBusy, setAssignBusy] = useState(false)

  async function saveEdit() {
    if (!draft.topic.trim()) return setErr('Topic required')
    setBusy(true)
    setErr(null)
    // Name written alongside the id — see the same note on the list screen.
    const name = data.batches.find((b) => b.id === draft.batchId)?.name ?? null
    const { error } = await supabase
      .from('topics')
      .update({
        date: draft.date,
        topic: draft.topic.trim(),
        description: draft.description.trim() || null,
        batch: name,
        batch_id: draft.batchId || null,
        status: draft.status,
        covered: coveredToArray(draft.covered),
        notes: draft.notes.trim() || null,
      })
      .eq('id', t.id)
    setBusy(false)
    if (error) return setErr(error.message)
    setEditing(false)
    router.refresh()
  }

  async function removeTopic() {
    if (!confirm(`Delete "${t.topic}"? The session and its notes will be removed.`)) return
    setBusy(true)
    const { error } = await supabase
      .from('topics')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', t.id)
    setBusy(false)
    if (error) return setErr(error.message)
    router.push('/topics')
    router.refresh()
  }

  async function addMaterial(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    // Same cap the materials board applies — this uploads to the same place.
    // Checked here as well so a large file is refused before it is sent.
    if (file.size > MAX_MATERIAL_BYTES) {
      if (fileRef.current) fileRef.current.value = ''
      return setErr(`File is too large (${fmtSize(file.size)}). Please upload a material under ${MAX_MATERIAL_MB} MB.`)
    }
    setUploading(true)
    setErr(null)
    const path = `materials/${Date.now()}_${safeName(file.name)}`
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file)
    if (upErr) {
      setUploading(false)
      return setErr(upErr.message)
    }
    const { error } = await supabase.from('materials').insert({
      title: file.name,
      type: file.name.split('.').pop()?.toLowerCase() ?? null,
      file_url: path,
      file_size: file.size,
      topic_id: t.id,
      batch_id: t.batchId,
      // Stamped, not left null: a session with no batch has no owns_batch()
      // to satisfy, and the uploader is the only thing RLS can match on.
      uploaded_by: userId,
    })
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
    if (error) return setErr(error.message)
    router.refresh()
  }

  /**
   * Homework set for this session. Filed against the topic's batch, which
   * is also what RLS checks — a session with no batch has no class to give
   * an assignment to, so the button is disabled rather than failing.
   */
  async function giveAssignment() {
    if (!assignment.title.trim()) return setErr('Assignment title required')
    if (!t.batchId) return setErr('This session has no batch, so there is nobody to assign to')
    setAssignBusy(true)
    setErr(null)
    const { error } = await supabase.from('assignments').insert({
      title: assignment.title.trim(),
      description: assignment.description.trim() || null,
      due_date: assignment.due || null,
      batch_id: t.batchId,
      topic_id: t.id,
      created_by: userId,
    })
    setAssignBusy(false)
    if (error) return setErr(error.message)
    setAssignment({ title: '', due: '', description: '' })
    setGivingAssignment(false)
    router.refresh()
  }

  async function removeAssignment(id: string, title: string) {
    if (!confirm(`Remove "${title}"? Any submissions against it stay in the database.`)) return
    const { error } = await supabase
      .from('assignments')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return setErr(error.message)
    router.refresh()
  }

  /** Storage is private, so a file is opened through a short-lived link. */
  async function download(path: string) {
    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(path, 120)
    if (signed?.signedUrl) window.open(signed.signedUrl, '_blank')
  }

  async function removeMaterial(id: string, path: string | null, title: string) {
    if (!confirm(`Remove ${title} from this session?`)) return
    if (path) await supabase.storage.from(BUCKET).remove([path])
    await supabase.from('materials').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    router.refresh()
  }

  return (
    <div className="space-y-5">
      <Link
        href="/topics"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Daily Topics
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold text-slate-900">{t.topic}</h1>
            <span
              className={`inline-block rounded-md border px-2 py-0.5 text-xs font-medium ${STATUS_TONE[t.status]}`}
            >
              {STATUS_LABEL[t.status]}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" /> {fmtDate(t.date)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-4 w-4" /> {t.batch ?? 'No batch'}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <User className="h-4 w-4" /> {t.trainer ?? '—'}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4" /> Posted on {fmtStamp(t.created_at)}
            </span>
          </div>
        </div>

        {!editing && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 px-3.5 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50"
            >
              <Pencil className="h-4 w-4" /> Edit Topic
            </button>
            <button
              onClick={removeTopic}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3.5 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" /> Delete Topic
            </button>
          </div>
        )}
      </div>

      {err && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{err}</p>
      )}

      {editing ? (
        <div className={card}>
          <h2 className={`mb-3 ${heading}`}>Edit Topic</h2>
          <TopicFields value={draft} onChange={setDraft} batches={data.batches} />
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
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Left */}
          <div className="space-y-4">
            <div className={card}>
              <h2 className={heading}>Topic Description</h2>
              <p className="mt-2 text-sm text-slate-600">
                {t.description ?? 'No description for this session.'}
              </p>

              <h3 className="mt-5 text-sm font-semibold text-slate-800">Topics Covered</h3>
              {t.covered.length ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                  {t.covered.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-slate-400">Nothing listed yet.</p>
              )}
            </div>

            <div className={card}>
              <div className="flex items-center justify-between gap-3">
                <h2 className={heading}>Materials Shared</h2>
                <input
                  ref={fileRef}
                  type="file"
                  id="topic-material"
                  className="hidden"
                  onChange={addMaterial}
                />
                <label
                  htmlFor="topic-material"
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50"
                >
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  {uploading ? 'Uploading…' : 'Add Material'}
                </label>
              </div>

              {data.materials.length ? (
                <ul className="mt-3 divide-y divide-slate-100">
                  {data.materials.map((m) => {
                    const size = fmtSize(m.file_size)
                    return (
                      <li key={m.id} className="flex items-center gap-3 py-2.5">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">
                          <FileText className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-800">{m.title}</p>
                          <p className="text-xs text-slate-400">
                            {(m.type ?? 'FILE').toUpperCase()}
                            {size ? ` • ${size}` : ''}
                          </p>
                        </div>
                        <div className="ml-auto flex gap-1.5">
                          {m.file_url && (
                            <button
                              onClick={() => download(m.file_url!)}
                              className="rounded-md bg-slate-100 p-1.5 text-slate-600 hover:bg-slate-200"
                              aria-label={`Download ${m.title}`}
                            >
                              <Download className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => removeMaterial(m.id, m.file_url, m.title)}
                            className="rounded-md bg-rose-50 p-1.5 text-rose-500 hover:bg-rose-100"
                            aria-label={`Remove ${m.title}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-slate-400">No material shared for this session.</p>
              )}
            </div>
          </div>

          {/* Right */}
          <div className="space-y-4">
            <div className={card}>
              <div className="flex items-center justify-between gap-3">
                <h2 className={heading}>Assignments Given</h2>
                {!givingAssignment && (
                  <button
                    onClick={() => setGivingAssignment(true)}
                    disabled={!t.batchId}
                    title={t.batchId ? undefined : 'Give this session a batch first'}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                  >
                    <Plus className="h-3.5 w-3.5" /> Give Assignment
                  </button>
                )}
              </div>

              {givingAssignment && (
                <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      className={field}
                      placeholder="Assignment title *"
                      value={assignment.title}
                      onChange={(e) => setAssignment((p) => ({ ...p, title: e.target.value }))}
                    />
                    <input
                      className={field}
                      type="date"
                      value={assignment.due}
                      onChange={(e) => setAssignment((p) => ({ ...p, due: e.target.value }))}
                      aria-label="Due date"
                    />
                  </div>
                  <input
                    className={field}
                    placeholder="Description"
                    value={assignment.description}
                    onChange={(e) => setAssignment((p) => ({ ...p, description: e.target.value }))}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={giveAssignment}
                      disabled={assignBusy}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {assignBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
                    </button>
                    <button
                      onClick={() => {
                        setGivingAssignment(false)
                        setErr(null)
                      }}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {data.assignments.length ? (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs text-slate-500">
                      <tr className="border-b border-slate-100">
                        <th className="py-2 pr-3 font-medium">Assignment</th>
                        <th className="py-2 pr-3 font-medium">Due Date</th>
                        <th className="py-2 pr-3 font-medium">Status</th>
                        <th className="py-2 pr-3 font-medium">Submissions</th>
                        <th className="py-2 font-medium sr-only">Remove</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.assignments.map((a) => (
                        <tr key={a.id} className="border-b border-slate-50 last:border-0">
                          <td className="py-2.5 pr-3 font-medium text-slate-800">{a.title}</td>
                          <td className="whitespace-nowrap py-2.5 pr-3 text-slate-600">{fmtDate(a.due_date)}</td>
                          <td className="py-2.5 pr-3">
                            <span
                              className={`inline-block rounded-md border px-2 py-0.5 text-xs font-medium ${
                                a.open
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                  : 'border-slate-200 bg-slate-50 text-slate-600'
                              }`}
                            >
                              {a.open ? 'Active' : 'Closed'}
                            </span>
                          </td>
                          <td className="whitespace-nowrap py-2.5 pr-3 text-slate-600">
                            {a.submitted} / {a.roster}
                          </td>
                          <td className="py-2.5 text-right">
                            <button
                              onClick={() => removeAssignment(a.id, a.title)}
                              className="rounded-md bg-rose-50 p-1.5 text-rose-500 hover:bg-rose-100"
                              aria-label={`Remove ${a.title}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                !givingAssignment && (
                  <p className="mt-3 text-sm text-slate-400">
                    {t.batchId
                      ? 'No assignments given for this session.'
                      : 'Give this session a batch to set an assignment.'}
                  </p>
                )
              )}
            </div>

            <div className={card}>
              <h2 className={heading}>Trainer Notes</h2>
              <p className="mt-2 whitespace-pre-line text-sm text-slate-600">
                {t.notes ?? 'No notes for this session.'}
              </p>
            </div>

            <div className={card}>
              <h2 className={heading}>Other Details</h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-slate-500">Created On</p>
                  <p className="mt-0.5 text-sm text-slate-700">{fmtStamp(t.created_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Last Updated On</p>
                  <p className="mt-0.5 text-sm text-slate-700">{fmtStamp(t.updated_at)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
