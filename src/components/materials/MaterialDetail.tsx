'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Clock, Download, Eye, EyeOff, Loader2, Trash2, User } from 'lucide-react'
import { createClient } from '@/lib/api/client'
import { fmtStamp } from '@/lib/ui'
import type { MaterialDetailData } from '@/lib/materials'
import { FileIcon, KIND_STYLE, TypeBadge, fmtSize } from './fileKind'

/**
 * One material: what it is, who it reaches, and what has been opened.
 *
 * Storage is private, so the preview runs off a signed URL fetched when
 * the page mounts. Opening the page counts as a view — that is what makes
 * the engagement figures move at all.
 */

const BUCKET = 'oms-files'
const card = 'rounded-xl border border-slate-200 bg-white p-5'
const heading = 'text-sm font-semibold text-slate-800'

export function MaterialDetail({ data }: { data: MaterialDetailData }) {
  const router = useRouter()
  const supabase = createClient()

  const { material: m, stats } = data

  const [signed, setSigned] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!m.fileUrl) return
      // Long enough to read a document without the preview expiring
      // mid-scroll, short enough that a copied URL is not a lasting leak.
      const { data: url } = await supabase.storage.from(BUCKET).createSignedUrl(m.fileUrl, 3600)
      if (!cancelled) setSigned(url?.signedUrl ?? null)
      await supabase.rpc('record_material_view', { p_material: m.id, p_kind: 'view' })
    })()
    return () => {
      cancelled = true
    }
  }, [m.id, m.fileUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  async function download() {
    if (!signed) return
    await supabase.rpc('record_material_view', { p_material: m.id, p_kind: 'download' })
    window.open(signed, '_blank')
    router.refresh()
  }

  async function remove() {
    if (!confirm(`Delete ${m.title}? The file is removed from storage.`)) return
    setBusy(true)
    if (m.fileUrl) await supabase.storage.from(BUCKET).remove([m.fileUrl])
    const { error } = await supabase
      .from('materials')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', m.id)
    setBusy(false)
    if (error) return setErr(error.message)
    router.push('/materials')
    router.refresh()
  }

  const notViewed = Math.max(0, stats.studentTotal - stats.studentViewers)
  const size = fmtSize(m.fileSize)

  return (
    <div className="space-y-5">
      <Link
        href="/materials"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Materials
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${KIND_STYLE[m.kind].icon}`}>
              <FileIcon kind={m.kind} />
            </span>
            <h1 className="text-xl font-semibold text-slate-900">{m.title}</h1>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4" /> Uploaded on {fmtStamp(m.uploadedAt)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <User className="h-4 w-4" /> Uploaded by {m.uploadedBy ?? '—'}
            </span>
            {size && <span>Size: {size}</span>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={download}
            disabled={!signed}
            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 px-3.5 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50"
          >
            <Download className="h-4 w-4" /> Download
          </button>
          <button
            onClick={remove}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3.5 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </div>
      </div>

      {err && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{err}</p>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* Preview */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <Preview kind={m.kind} url={signed} hasFile={!!m.fileUrl} />
        </div>

        {/* Facts */}
        <div className="space-y-4">
          <div className={card}>
            <h2 className={heading}>Material Details</h2>
            <dl className="mt-3 space-y-3 text-sm">
              <Row label="Course" value={m.course ?? '—'} />
              <Row
                label="Batch Assigned"
                value={data.batches.length ? data.batches.map((b) => b.name).join(', ') : '—'}
              />
              <div className="flex gap-4">
                <dt className="w-32 shrink-0 text-slate-500">Type</dt>
                <dd>
                  <TypeBadge kind={m.kind} />
                </dd>
              </div>
              <Row label="Description" value={m.description ?? '—'} />
            </dl>
          </div>

          <div className={card}>
            <h2 className={heading}>Statistics</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <Stat label="Views" value={stats.views} />
              <Stat label="Downloads" value={stats.downloads} />
              <Stat label="Total Engagement" value={stats.views + stats.downloads} />
              <Stat label="People who opened it" value={stats.viewers} />
            </dl>
          </div>

          <div className={card}>
            <h2 className={heading}>Engagement</h2>
            {stats.studentTotal ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3">
                  <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700">
                    <Eye className="h-3.5 w-3.5" /> Viewed by
                  </span>
                  <p className="mt-1 text-sm font-semibold text-emerald-800">
                    {stats.studentViewers} / {stats.studentTotal} Students
                  </p>
                </div>
                <div className="rounded-lg border border-amber-100 bg-amber-50 p-3">
                  <span className="inline-flex items-center gap-1.5 text-xs text-amber-700">
                    <EyeOff className="h-3.5 w-3.5" /> Not Viewed by
                  </span>
                  <p className="mt-1 text-sm font-semibold text-amber-800">
                    {notViewed} / {stats.studentTotal} Students
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-400">
                Not shared with a batch yet, so there is nobody to track.
              </p>
            )}
            {stats.studentTotal > 0 && stats.studentViewers === 0 && (
              <p className="mt-3 text-xs text-slate-400">
                Students cannot sign in yet, so this stays at zero. Views by staff are counted
                under Statistics above.
              </p>
            )}
          </div>

          <div className={card}>
            <h2 className={heading}>Assigned Batches</h2>
            {data.batches.length ? (
              <ul className="mt-3 space-y-2 text-sm">
                {data.batches.map((b) => (
                  <li key={b.id} className="flex items-center gap-2 text-slate-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                    {b.name}
                    <span className="text-slate-400">
                      ({b.students} {b.students === 1 ? 'Student' : 'Students'})
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-400">Not shared with any batch.</p>
            )}
          </div>

          <div className={card}>
            <h2 className={heading}>Uploaded On</h2>
            <p className="mt-2 text-sm text-slate-700">{fmtStamp(m.uploadedAt)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Renders what the browser can show inline; everything else gets a card. */
function Preview({ kind, url, hasFile }: { kind: string; url: string | null; hasFile: boolean }) {
  if (!hasFile) {
    return <Empty text="This material has no file attached." />
  }
  if (!url) {
    return (
      <div className="grid h-[560px] place-items-center text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
  }
  if (kind === 'pdf') {
    return <iframe src={url} title="Preview" className="h-[560px] w-full border-0" />
  }
  if (kind === 'image') {
    return (
      <div className="grid h-[560px] place-items-center bg-slate-50 p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="Preview" className="max-h-full max-w-full object-contain" />
      </div>
    )
  }
  if (kind === 'video') {
    return <video src={url} controls className="h-[560px] w-full bg-black" />
  }
  return <Empty text="No inline preview for this file type — download it to open." />
}

function Empty({ text }: { text: string }) {
  return (
    <div className="grid h-[560px] place-items-center px-6 text-center">
      <p className="text-sm text-slate-400">{text}</p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4">
      <dt className="w-32 shrink-0 text-slate-500">{label}</dt>
      <dd className="text-slate-800">{value}</dd>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-semibold text-slate-900">{value}</dd>
    </div>
  )
}
