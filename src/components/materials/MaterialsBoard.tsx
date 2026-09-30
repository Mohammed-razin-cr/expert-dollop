'use client'

import { useMemo, useRef, useState } from 'react'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FolderOpen,
  Loader2,
  Search,
  Trash2,
  Upload,
} from 'lucide-react'
import { createClient } from '@/lib/api/client'
import { fmtStamp, pageWindow } from '@/lib/ui'
import type { MaterialRow, MaterialsStats, Option } from '@/lib/materials'
import { MAX_MATERIAL_BYTES, MAX_MATERIAL_MB } from '@/lib/uploads'
import { FileIcon, KIND_STYLE, fmtSize, TypeBadge } from './fileKind'

/**
 * Materials — the board.
 *
 * Upload files a batch needs, and see what has actually been opened.
 * Sharing with more than one batch is done here at upload time; the first
 * batch chosen is stored on the material itself, the rest in
 * material_batches.
 */

const PAGE_SIZE = 10
const BUCKET = 'oms-files'
const safeName = (n: string) => n.replace(/[^\w.\-]/g, '_')

const sel =
  'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-300'
const field =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-300'

export function MaterialsBoard({
  rows,
  stats,
  courses,
  batchOptions,
  userId,
}: {
  rows: MaterialRow[]
  stats: MaterialsStats
  courses: Option[]
  batchOptions: Option[]
  userId: string
}) {
  const router = useRouter()
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [courseId, setCourseId] = useState('')
  const [batchIds, setBatchIds] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // `qInput` is what is typed and `q` is what the table is filtered by, a beat
  // behind it. The box stays instant; the filter runs once you pause.
  const [qInput, setQInput] = useState('')
  const q = useDebouncedValue(qInput)
  const [course, setCourse] = useState('all')
  const [batch, setBatch] = useState('all')
  const [type, setType] = useState('all')
  const [page, setPage] = useState(1)

  const toggleBatch = (id: string) =>
    setBatchIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_MATERIAL_BYTES) {
      // Cleared so choosing the same file again still fires onChange — without
      // this, a second attempt on the same file looks like nothing happened.
      if (fileRef.current) fileRef.current.value = ''
      return setErr(`File is too large (${fmtSize(file.size)}). Please upload a material under ${MAX_MATERIAL_MB} MB.`)
    }
    setBusy(true)
    setErr(null)

    const path = `materials/${Date.now()}_${safeName(file.name)}`
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file)
    if (upErr) {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
      return setErr(upErr.message)
    }

    // The first batch chosen is the primary one on the row itself; every
    // other screen reads materials.batch_id, so it must not be left null.
    const [primary, ...rest] = batchIds
    const { data, error } = await supabase
      .from('materials')
      .insert({
        title: title.trim() || file.name,
        description: description.trim() || null,
        type: file.name.split('.').pop()?.toLowerCase() ?? null,
        file_url: path,
        file_size: file.size,
        course_id: courseId || null,
        batch_id: primary ?? null,
        uploaded_by: userId,
      })
      .select('id')
      .maybeSingle()

    if (error) {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
      return setErr(error.message)
    }

    const id = (data as any)?.id
    if (id && batchIds.length) {
      const { error: shareErr } = await supabase
        .from('material_batches')
        .upsert(batchIds.map((b) => ({ material_id: id, batch_id: b })))
      if (shareErr) {
        setBusy(false)
        return setErr(`Uploaded, but sharing failed: ${shareErr.message}`)
      }
    }

    setBusy(false)
    setTitle('')
    setDescription('')
    setCourseId('')
    setBatchIds([])
    setOpen(false)
    if (fileRef.current) fileRef.current.value = ''
    router.refresh()
  }

  /** Storage is private, so a file is opened through a short-lived link. */
  async function openFile(m: MaterialRow, kind: 'view' | 'download') {
    if (!m.fileUrl) return
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(m.fileUrl, 120)
    if (!data?.signedUrl) return
    await supabase.rpc('record_material_view', { p_material: m.id, p_kind: kind })
    window.open(data.signedUrl, '_blank')
    router.refresh()
  }

  async function remove(m: MaterialRow) {
    if (!confirm(`Delete ${m.title}?`)) return
    if (m.fileUrl) await supabase.storage.from(BUCKET).remove([m.fileUrl])
    const { error } = await supabase
      .from('materials')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', m.id)
    if (error) return setErr(error.message)
    router.refresh()
  }

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return rows.filter((r) => {
      if (needle) {
        const hay = `${r.title} ${r.course ?? ''} ${r.batches.join(' ')}`.toLowerCase()
        if (!hay.includes(needle)) return false
      }
      if (course !== 'all' && r.courseId !== course) return false
      if (batch !== 'all' && !r.batchIds.includes(batch)) return false
      if (type !== 'all' && r.kind !== type) return false
      return true
    })
  }, [rows, q, course, batch, type])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, pageCount)
  const from = (current - 1) * PAGE_SIZE
  const slice = filtered.slice(from, from + PAGE_SIZE)

  const kinds = useMemo(() => [...new Set(rows.map((r) => r.kind))].sort(), [rows])

  // Clears the filters back to the whole library the count refers to.
  const kpis = [
    {
      label: 'Total Materials',
      value: stats.total,
      Icon: FolderOpen,
      tone: 'bg-blue-50 text-blue-600',
      onClick: () => { setQInput(''); setCourse('all'); setBatch('all'); setType('all'); setPage(1) },
    },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Materials</h1>
        <p className="text-sm text-slate-500">Manage and share study materials with your students.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <button key={k.label} type="button" onClick={k.onClick}
            className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-blue-300 hover:shadow-sm">
            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${k.tone}`}>
              <k.Icon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs text-slate-500">{k.label}</p>
              <p className="text-2xl font-semibold text-slate-900">{k.value}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Filters + upload */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={qInput}
            onChange={(e) => {
              setQInput(e.target.value)
              setPage(1)
            }}
            placeholder="Search materials..."
            className="w-56 rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-blue-300"
          />
        </div>

        <select value={course} onChange={(e) => setCourse(e.target.value)} className={sel}>
          <option value="all">All Courses</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select value={batch} onChange={(e) => setBatch(e.target.value)} className={sel}>
          <option value="all">All Batches</option>
          {batchOptions.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>

        <select value={type} onChange={(e) => setType(e.target.value)} className={sel}>
          <option value="all">All Types</option>
          {kinds.map((k) => (
            <option key={k} value={k}>
              {KIND_STYLE[k].label}
            </option>
          ))}
        </select>

        <button
          onClick={() => setOpen((v) => !v)}
          className="ml-auto inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Upload className="h-4 w-4" /> Upload Material
        </button>
      </div>

      {open && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Upload Material</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              className={field}
              placeholder="Title (defaults to the file name)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <select className={field} value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              <option value="">No course</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <input
            className={`${field} mt-3`}
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <div className="mt-3">
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
              Share with batches
            </p>
            {batchOptions.length ? (
              <div className="flex flex-wrap gap-2">
                {batchOptions.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => toggleBatch(b.id)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                      batchIds.includes(b.id)
                        ? 'border-blue-500 bg-blue-500 text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">You have no batches to share with.</p>
            )}
          </div>

          {err && <p className="mt-3 text-sm text-rose-600">{err}</p>}

          <div className="mt-4 flex items-center gap-2">
            <input ref={fileRef} type="file" id="material-upload" className="hidden" onChange={upload} />
            <label
              htmlFor="material-upload"
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {busy ? 'Uploading…' : 'Choose file and upload'}
            </label>
            <span className="text-xs text-slate-400">Up to {MAX_MATERIAL_MB} MB per file.</span>
            <button
              onClick={() => {
                setOpen(false)
                setErr(null)
              }}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Material</th>
                <th className="px-4 py-3 font-medium">Course</th>
                <th className="px-4 py-3 font-medium">Batch</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Uploaded Date</th>
                <th className="px-4 py-3 font-medium">Views / Downloads</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {slice.map((m) => (
                <tr key={m.id} className="border-t border-slate-100">
                  <td className="px-4 py-2.5">
                    <Link href={`/materials/${m.id}`} className="flex items-center gap-3 group">
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${KIND_STYLE[m.kind].icon}`}>
                        <FileIcon kind={m.kind} className="h-4 w-4" />
                      </span>
                      <span className="font-medium text-slate-800 group-hover:text-blue-600">{m.title}</span>
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{m.course ?? '—'}</td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {m.batches.length ? m.batches.join(', ') : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <TypeBadge kind={m.kind} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">{fmtStamp(m.uploadedAt)}</td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {m.views} / {m.downloads}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/materials/${m.id}`}
                        className="rounded-md bg-slate-100 p-1.5 text-slate-600 hover:bg-slate-200"
                        aria-label={`Open ${m.title}`}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Link>
                      {m.fileUrl && (
                        <button
                          onClick={() => openFile(m, 'download')}
                          className="rounded-md bg-slate-100 p-1.5 text-slate-600 hover:bg-slate-200"
                          aria-label={`Download ${m.title}`}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => remove(m)}
                        className="rounded-md bg-rose-50 p-1.5 text-rose-500 hover:bg-rose-100"
                        aria-label={`Delete ${m.title}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!filtered.length && (
          <div className="py-16 text-center">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-blue-50 text-blue-500">
              <FolderOpen className="h-7 w-7" />
            </span>
            <p className="mt-4 text-sm font-medium text-slate-700">
              {rows.length ? 'No materials match these filters.' : 'No materials yet.'}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              {rows.length ? 'Try clearing the search or filters.' : 'Upload your first file to share it with a batch.'}
            </p>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
            <p className="text-xs text-slate-500">
              Showing {from + 1} to {Math.min(from + PAGE_SIZE, filtered.length)} of {filtered.length} materials
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
                    p === current
                      ? 'bg-blue-600 text-white'
                      : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
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
    </div>
  )
}
