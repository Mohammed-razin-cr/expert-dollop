'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ChevronRight as Arrow,
  ClipboardList,
  Download,
  FolderOpen,
  Loader2,
  RotateCcw,
  Trash2,
  Users,
} from 'lucide-react'
import { createClient } from '@/lib/api/client'
import { printDoc } from '@/lib/printDoc'
import { fmtStamp, pageWindow } from '@/lib/ui'
import {
  REPORT_META,
  buildReport,
  reportName,
  type ReportParams,
  type ReportType,
} from '@/lib/reportBuilders'

/**
 * Reports, for trainers.
 *
 * The history stores parameters only — Download re-runs the report against
 * current data, so an older row shows today's figures rather than the ones
 * it first produced. "Date Generated" is when it was first requested.
 *
 * Nothing here touches the BD and admin reports, which keep their own
 * screen; the page picks between them on role.
 */

const PAGE_SIZE = 5

export type ReportRow = {
  id: string
  name: string
  type: ReportType
  batch: string | null
  batchId: string | null
  from: string | null
  to: string | null
  generatedBy: string | null
  createdAt: string
}

export type Batch = { id: string; name: string }

const ICONS: Record<ReportType, typeof Users> = {
  attendance: Users,
  assessment: ClipboardList,
  performance: BarChart3,
  progress: BarChart3,
  material: FolderOpen,
}

const TYPES = Object.keys(REPORT_META) as ReportType[]

const sel =
  'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-300'

export function TrainerReports({
  rows,
  batches,
  myBatchIds,
  userId,
}: {
  rows: ReportRow[]
  batches: Batch[]
  myBatchIds: string[]
  userId: string
}) {
  const router = useRouter()
  const supabase = createClient()

  // `draft` is what is selected; `applied` is what the table is filtered by,
  // so the Apply button does something real rather than being decorative.
  const empty = { type: 'all', batch: 'all', from: '', to: '' }
  const [draft, setDraft] = useState(empty)
  const [applied, setApplied] = useState(empty)
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const set = (k: keyof typeof empty, v: string) => setDraft((p) => ({ ...p, [k]: v }))

  function paramsFor(batchId: string, from: string, to: string): ReportParams {
    return {
      batchId: batchId === 'all' ? null : batchId,
      batchName: batchId === 'all' ? null : (batches.find((b) => b.id === batchId)?.name ?? null),
      from: from || null,
      to: to || null,
    }
  }

  /** Render and open the print window. Shared by generate and download. */
  async function render(type: ReportType, params: ReportParams) {
    const html = await buildReport(type, supabase, params, myBatchIds)
    printDoc(reportName(type, params), html)
  }

  async function generate(type: ReportType) {
    setBusy(type)
    setErr(null)
    const params = paramsFor(draft.batch, draft.from, draft.to)
    try {
      await render(type, params)
      const { error } = await supabase.from('reports').insert({
        name: reportName(type, params),
        type,
        batch_id: params.batchId,
        date_from: params.from,
        date_to: params.to,
        generated_by: userId,
      })
      if (error) throw new Error(error.message)
      router.refresh()
    } catch (e: any) {
      setErr(e?.message ?? 'Could not generate that report')
    } finally {
      setBusy(null)
    }
  }

  async function download(r: ReportRow) {
    setBusy(r.id)
    setErr(null)
    try {
      await render(r.type, {
        batchId: r.batchId,
        batchName: r.batch,
        from: r.from,
        to: r.to,
      })
    } catch (e: any) {
      setErr(e?.message ?? 'Could not rebuild that report')
    } finally {
      setBusy(null)
    }
  }

  async function remove(r: ReportRow) {
    if (!confirm(`Remove "${r.name}" from the history?`)) return
    const { error } = await supabase
      .from('reports')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', r.id)
    if (error) return setErr(error.message)
    router.refresh()
  }

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (applied.type !== 'all' && r.type !== applied.type) return false
        if (applied.batch !== 'all' && r.batchId !== applied.batch) return false
        const day = r.createdAt.slice(0, 10)
        if (applied.from && day < applied.from) return false
        if (applied.to && day > applied.to) return false
        return true
      }),
    [rows, applied],
  )

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, pageCount)
  const from = (current - 1) * PAGE_SIZE
  const slice = filtered.slice(from, from + PAGE_SIZE)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Reports</h1>
        <p className="text-sm text-slate-500">
          Generate and download various reports to track student and batch performance.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-400">
            Report Type
          </label>
          <select value={draft.type} onChange={(e) => set('type', e.target.value)} className={sel}>
            <option value="all">All Reports</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {REPORT_META[t].label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-400">
            Batch
          </label>
          <select value={draft.batch} onChange={(e) => set('batch', e.target.value)} className={sel}>
            <option value="all">All Batches</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-400">
            Date Range
          </label>
          <div className="flex items-center gap-2">
            <input type="date" value={draft.from} onChange={(e) => set('from', e.target.value)} className={sel} aria-label="From" />
            <span className="text-slate-400">–</span>
            <input type="date" value={draft.to} onChange={(e) => set('to', e.target.value)} className={sel} aria-label="To" />
          </div>
        </div>

        <button
          onClick={() => {
            setApplied(draft)
            setPage(1)
          }}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Apply
        </button>

        <button
          onClick={() => {
            setDraft(empty)
            setApplied(empty)
            setPage(1)
          }}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          <RotateCcw className="h-4 w-4" /> Reset
        </button>
      </div>

      <p className="text-xs text-slate-400">
        The range and batch above are used both to filter this list and for anything you generate below.
      </p>

      {err && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{err}</p>
      )}

      {/* History */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">Generated Reports</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Report Name</th>
                <th className="px-4 py-3 font-medium">Report Type</th>
                <th className="px-4 py-3 font-medium">Batch / Course</th>
                <th className="px-4 py-3 font-medium">Date Generated</th>
                <th className="px-4 py-3 font-medium">Generated By</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {slice.map((r) => {
                const Icon = ICONS[r.type]
                return (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="font-medium text-slate-800">{r.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-block rounded-md border px-2 py-0.5 text-xs font-medium ${REPORT_META[r.type].tone}`}>
                        {REPORT_META[r.type].label.replace(' Report', '')}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{r.batch ?? 'All batches'}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">{fmtStamp(r.createdAt)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{r.generatedBy ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => download(r)}
                          disabled={busy === r.id}
                          className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                        >
                          {busy === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                          Download
                        </button>
                        <button
                          onClick={() => remove(r)}
                          className="rounded-md bg-rose-50 p-1.5 text-rose-500 hover:bg-rose-100"
                          aria-label={`Remove ${r.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {!filtered.length && (
          <div className="py-12 text-center">
            <p className="text-sm font-medium text-slate-700">
              {rows.length ? 'No reports match these filters.' : 'No reports generated yet.'}
            </p>
            <p className="mt-1 text-sm text-slate-400">Pick one below to generate your first.</p>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
            <p className="text-xs text-slate-500">
              Showing {from + 1} to {Math.min(from + PAGE_SIZE, filtered.length)} of {filtered.length} reports
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

      {/* Quick types */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Quick Report Types</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {TYPES.map((t) => {
            const Icon = ICONS[t]
            const meta = REPORT_META[t]
            return (
              <div key={t} className="flex flex-col rounded-xl border border-slate-200 bg-white p-5">
                <span className={`grid h-12 w-12 place-items-center rounded-xl border ${meta.tone}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-3 text-sm font-semibold text-slate-900">{meta.label}</h3>
                <p className="mt-1 text-sm text-slate-500">{meta.blurb}</p>
                <button
                  onClick={() => generate(t)}
                  disabled={busy === t}
                  className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                >
                  {busy === t ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Generate Report
                  <Arrow className="h-4 w-4" />
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
