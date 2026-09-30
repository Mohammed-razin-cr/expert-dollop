'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import { useRouter } from 'next/navigation'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleX,
  Clock,
  FileBadge,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/api/client'
import { SearchSelect } from '@/components/shared/SearchSelect'
import { printDoc } from '@/lib/printDoc'
import { fmtStamp, pageWindow } from '@/lib/ui'
import { certificateHTML } from '@/lib/certificateDoc'
import { ELIGIBILITY, makeCertificateId, type CertRow, type CertStats, type CertificatesData, type Option } from '@/lib/certificates'

/**
 * Certificate requests — review and approve.
 *
 * Completion and score are read live rather than stored on the request, so
 * the eligibility shown is always current. A request can still be approved
 * when the student is not eligible: the rule is guidance for the trainer,
 * not a lock, and the warning says so.
 */

const PAGE_SIZE = 6
const NOTES_MAX = 300

const sel =
  'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-300'

const STATUS_TONE: Record<string, string> = {
  Pending: 'border-amber-200 bg-amber-50 text-amber-700',
  Approved: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  Sent: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  Rejected: 'border-rose-200 bg-rose-50 text-rose-700',
}

/** Stable pastel per student, so the same person keeps the same colour. */
const TONES = [
  'bg-purple-100 text-purple-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-sky-100 text-sky-700',
  'bg-rose-100 text-rose-700',
  'bg-indigo-100 text-indigo-700',
]
function toneFor(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return TONES[h % TONES.length]
}
const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase() || '?'

/** The width the certificate template is designed at. */
const CERT_WIDTH = 900

/**
 * Shrinks the certificate to fit whatever column it is dropped into.
 *
 * The template uses fixed pixel sizes so the printed copy is consistent,
 * which means the preview has to be scaled rather than reflowed — reflowing
 * would give a preview that does not match what prints.
 */
function useFitToWidth(dep: unknown) {
  const outer = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ scale: 1, height: 0 })

  useEffect(() => {
    const o = outer.current
    const i = inner.current
    if (!o || !i) return
    const measure = () => {
      const scale = Math.min(1, o.clientWidth / CERT_WIDTH)
      setBox({ scale, height: i.offsetHeight * scale })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(o)
    ro.observe(i)
    return () => ro.disconnect()
  }, [dep])

  return { outer, inner, ...box }
}

export function CertificatesBoard({
  rows,
  stats,
  batches,
  courses,
  students,
  userId,
  nextSeq,
  canManage = false,
}: CertificatesData & { userId: string; nextSeq: number; canManage?: boolean }) {
  const router = useRouter()
  const supabase = createClient()

  // `qInput` is what is typed and `q` is what the table is filtered by, a beat
  // behind it. The box stays instant; the filter runs once you pause.
  const [qInput, setQInput] = useState('')
  const q = useDebouncedValue(qInput)
  const [batch, setBatch] = useState('all')
  const [course, setCourse] = useState('all')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const [adding, setAdding] = useState(false)
  const [newStudent, setNewStudent] = useState('')
  // Same text the options carried before, flattened to a string: the batch
  // and progress are how you tell two same-named students apart.
  const studentOptions = useMemo(
    () => students.map((s) => ({
      value: s.id,
      label: `${s.name} — ${s.batch ?? ''} (${s.completion}% complete${s.score === null ? '' : `, ${s.score}%`})`,
    })),
    [students],
  )

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return rows.filter((r) => {
      if (needle && !`${r.student} ${r.email ?? ''}`.toLowerCase().includes(needle)) return false
      if (batch !== 'all' && r.batchId !== batch) return false
      if (course !== 'all' && r.course !== courses.find((c) => c.id === course)?.name) return false
      if (status !== 'all' && r.status !== status) return false
      return true
    })
  }, [rows, q, batch, course, status, courses])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, pageCount)
  const from = (current - 1) * PAGE_SIZE
  const slice = filtered.slice(from, from + PAGE_SIZE)

  const selected = rows.find((r) => r.id === selectedId) ?? null
  const fit = useFitToWidth(selectedId)

  function select(r: CertRow) {
    setSelectedId(r.id)
    setNotes(r.notes ?? '')
    setErr(null)
  }

  function preview(r: CertRow) {
    return certificateHTML({
      student: r.student,
      course: r.course,
      batch: r.batch,
      completedOn: r.requestedOn,
      certificateId: r.certificateId ?? 'Pending approval',
    })
  }

  async function decide(r: CertRow, next: 'Approved' | 'Rejected') {
    setBusy(r.id)
    setErr(null)
    const certificateId =
      next === 'Approved' ? (r.certificateId ?? makeCertificateId(r.batch, nextSeq)) : null

    const { error } = await supabase
      .from('cert_requests')
      .update({
        status: next,
        notes: notes.trim() || null,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        ...(next === 'Approved' ? { certificate_id: certificateId } : {}),
      })
      .eq('id', r.id)

    setBusy(null)
    if (error) return setErr(error.message)

    if (next === 'Approved') {
      printDoc(
        `Certificate — ${r.student}`,
        certificateHTML({
          student: r.student,
          course: r.course,
          batch: r.batch,
          completedOn: new Date().toISOString().slice(0, 10),
          certificateId,
        }),
      )
    }
    setSelectedId(null)
    setNotes('')
    router.refresh()
  }

  function viewCertificate(r: CertRow) {
    printDoc(
      `Certificate — ${r.student}`,
      certificateHTML({
        student: r.student,
        course: r.course,
        batch: r.batch,
        completedOn: r.reviewedAt ? r.reviewedAt.slice(0, 10) : r.requestedOn,
        certificateId: r.certificateId,
      }),
    )
  }

  async function raise() {
    if (!newStudent) return setErr('Pick a student')
    const s = students.find((x) => x.id === newStudent)
    setBusy('new')
    setErr(null)
    const { error } = await supabase.from('cert_requests').insert({
      student_id: newStudent,
      batch_id: s?.batchId ?? null,
      type: 'Course Completion',
      status: 'Pending',
      created_by: userId,
    })
    setBusy(null)
    if (error) return setErr(error.message)
    setNewStudent('')
    setAdding(false)
    router.refresh()
  }

  async function remove(id: string) {
    if (!confirm('Delete this certificate request?')) return
    setBusy(id)
    await supabase.from('cert_requests').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    setBusy(null)
    if (selectedId === id) { setSelectedId(null); setNotes('') }
    router.refresh()
  }

  const kpis = [
    { label: 'Total Requests', value: stats.total, Icon: FileBadge, tone: 'bg-blue-50 text-blue-600' },
    { label: 'Pending Requests', value: stats.pending, Icon: Clock, tone: 'bg-amber-50 text-amber-600' },
    { label: 'Approved Certificates', value: stats.approved, Icon: CircleCheck, tone: 'bg-emerald-50 text-emerald-600' },
    { label: 'Rejected Requests', value: stats.rejected, Icon: CircleX, tone: 'bg-rose-50 text-rose-600' },
  ]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Certificates</h1>
          <p className="text-sm text-slate-500">Review and approve certificate requests for your students.</p>
        </div>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" /> New Request
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={qInput}
            onChange={(e) => {
              setQInput(e.target.value)
              setPage(1)
            }}
            placeholder="Search by student name..."
            className="w-64 rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-blue-300"
          />
        </div>
        <select value={batch} onChange={(e) => setBatch(e.target.value)} className={sel}>
          <option value="all">All Batches</option>
          {batches.map((b: Option) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <select value={course} onChange={(e) => setCourse(e.target.value)} className={sel}>
          <option value="all">All Courses</option>
          {courses.map((c: Option) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={sel}>
          <option value="all">All Status</option>
          <option value="Pending">Pending</option>
          <option value="Approved">Approved</option>
          <option value="Rejected">Rejected</option>
        </select>
        <button
          onClick={() => {
            setQInput('')
            setBatch('all')
            setCourse('all')
            setStatus('all')
            setPage(1)
          }}
          className="rounded-lg border border-blue-200 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50"
        >
          Reset
        </button>
      </div>

      {err && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{err}</p>
      )}

      {adding && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">New Request</h2>
          {students.length ? (
            <div className="flex flex-wrap items-center gap-3">
              <SearchSelect
                className={sel}
                wrapperClassName="w-full sm:w-96"
                options={studentOptions}
                value={newStudent}
                onChange={setNewStudent}
                placeholder="Select student…"
              />
              <button
                onClick={raise}
                disabled={busy === 'new'}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {busy === 'new' && <Loader2 className="h-4 w-4 animate-spin" />} Raise Request
              </button>
              <button
                onClick={() => {
                  setAdding(false)
                  setErr(null)
                }}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          ) : (
            <p className="text-sm text-slate-400">
              Every student already has a request. Rejected ones can be raised again.
            </p>
          )}
        </div>
      )}

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${k.tone}`}>
              <k.Icon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs text-slate-500">{k.label}</p>
              <p className="text-2xl font-semibold text-slate-900">{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Requests */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Student</th>
                <th className="px-4 py-3 font-medium">Batch</th>
                <th className="px-4 py-3 font-medium">Course</th>
                <th className="px-4 py-3 font-medium">Completion %</th>
                <th className="px-4 py-3 font-medium">Assessment Score</th>
                <th className="px-4 py-3 font-medium">Eligibility</th>
                <th className="px-4 py-3 font-medium">Requested On</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {slice.map((r) => (
                <tr
                  key={r.id}
                  className={`border-t border-slate-100 ${selectedId === r.id ? 'bg-blue-50/40' : ''}`}
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold ${toneFor(r.studentId)}`}>
                        {initials(r.student)}
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800">{r.student}</p>
                        <p className="truncate text-xs text-slate-400">{r.email ?? '—'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{r.batch ?? '—'}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{r.course ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <p className="text-slate-700">{r.completion}%</p>
                    <span className="mt-1 block h-1.5 w-24 rounded-full bg-slate-100">
                      <span
                        className={`block h-1.5 rounded-full ${r.completion >= ELIGIBILITY.minCompletion ? 'bg-emerald-500' : 'bg-amber-500'}`}
                        style={{ width: `${Math.min(100, r.completion)}%` }}
                      />
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">{r.score === null ? '—' : `${r.score}%`}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-block rounded-md border px-2 py-0.5 text-xs font-medium ${
                        r.eligible
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-rose-200 bg-rose-50 text-rose-700'
                      }`}
                    >
                      {r.eligible ? 'Eligible' : 'Not Eligible'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">{fmtStamp(r.requestedOn)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block rounded-md border px-2 py-0.5 text-xs font-medium ${STATUS_TONE[r.status]}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      {r.status === 'Pending' && (
                        <button
                          onClick={() => select(r)}
                          className="rounded-md border border-blue-200 px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
                        >
                          Review
                        </button>
                      )}
                      {(r.status === 'Approved' || r.status === 'Sent') && (
                        <button
                          onClick={() => viewCertificate(r)}
                          className="rounded-md border border-blue-200 px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
                        >
                          View Certificate
                        </button>
                      )}
                      {canManage && r.status !== 'Pending' && (
                        <button
                          onClick={() => select(r)}
                          title="Edit"
                          className="rounded-md bg-blue-50 p-1.5 text-blue-600 hover:bg-blue-100"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canManage && (
                        <button
                          disabled={busy === r.id}
                          onClick={() => remove(r.id)}
                          title="Delete"
                          className="rounded-md bg-rose-50 p-1.5 text-rose-500 hover:bg-rose-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {!canManage && r.status === 'Rejected' && <span className="text-slate-400">—</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!filtered.length && (
          <div className="py-14 text-center">
            <p className="text-sm font-medium text-slate-700">
              {rows.length ? 'No requests match these filters.' : 'No certificate requests yet.'}
            </p>
            <p className="mt-1 text-sm text-slate-400">Raise one with New Request.</p>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
            <p className="text-xs text-slate-500">
              Showing {from + 1} to {Math.min(from + PAGE_SIZE, filtered.length)} of {filtered.length} requests
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(current - 1)}
                disabled={current === 1}
                className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {pageWindow(current, pageCount).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`h-8 min-w-8 rounded-lg px-2 text-xs font-medium ${
                    p === current ? 'bg-blue-600 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage(current + 1)}
                disabled={current === pageCount}
                className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Review panel */}
      {selected && (
        <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr_1fr]">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-800">Certificate Preview</h2>
            <div ref={fit.outer} className="overflow-hidden rounded-lg" style={{ height: fit.height || undefined }}>
              <div
                ref={fit.inner}
                style={{
                  width: CERT_WIDTH,
                  transform: `scale(${fit.scale})`,
                  transformOrigin: 'top left',
                }}
                dangerouslySetInnerHTML={{ __html: preview(selected) }}
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-800">Certificate Details</h2>
            <dl className="space-y-3 text-sm">
              <Detail label="Student" value={selected.student} />
              <Detail label="Batch" value={selected.batch ?? '—'} />
              <Detail label="Course" value={selected.course ?? '—'} />
              <Detail label="Completion" value={`${selected.completion}%`} />
              <Detail label="Assessment Score" value={selected.score === null ? '—' : `${selected.score}%`} />
              <Detail label="Certificate ID" value={selected.certificateId ?? 'Issued on approval'} />
              <div className="flex gap-4">
                <dt className="w-36 shrink-0 text-slate-500">Eligibility</dt>
                <dd>
                  <span
                    className={`inline-block rounded-md border px-2 py-0.5 text-xs font-medium ${
                      selected.eligible
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-rose-200 bg-rose-50 text-rose-700'
                    }`}
                  >
                    {selected.eligible ? 'Eligible' : 'Not Eligible'}
                  </span>
                </dd>
              </div>
            </dl>
            {!selected.eligible && (
              <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Below {ELIGIBILITY.minCompletion}% completion or {ELIGIBILITY.minScore}% average. You can still
                approve — the rule is a guide, not a lock.
              </p>
            )}
          </div>

          <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-800">Notes (Optional)</h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, NOTES_MAX))}
              placeholder="Add notes about this request..."
              className="min-h-[160px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-300"
            />
            <p className="mt-1 text-right text-xs text-slate-400">
              {notes.length} / {NOTES_MAX}
            </p>

            <div className="mt-auto flex flex-wrap justify-end gap-2 pt-4">
              <button
                onClick={() => {
                  setSelectedId(null)
                  setNotes('')
                }}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => decide(selected, 'Rejected')}
                disabled={busy === selected.id}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
              >
                <X className="h-4 w-4" /> Reject
              </button>
              <button
                onClick={() => decide(selected, 'Approved')}
                disabled={busy === selected.id}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {busy === selected.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Approve &amp; Generate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4">
      <dt className="w-36 shrink-0 text-slate-500">{label}</dt>
      <dd className="text-slate-800">{value}</dd>
    </div>
  )
}
