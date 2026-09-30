'use client'

import { useMemo, useState } from 'react'
import { Check, ChevronDown, ChevronUp, Columns3, Lock, Plus, X } from 'lucide-react'

const inp = 'rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300'

// One field the importer knows how to write. `key` is a key of the COLS /
// PCOLS alias tables — the aliases stay there, next to the mapping code
// that reads them, so there is only ever one list of header spellings.
export type FieldDef = { key: string; label: string; required?: boolean }
export type Aliases = Record<string, string[]>

// A repeated header is disambiguated by the parser with a numeric suffix
// ("response", "response_1"), and both spellings mean the same field —
// so match on the base name. No real alias ends in _<digits>, which is
// what makes stripping the suffix safe here.
export function normalizeHeader(header: string): string {
  return String(header ?? '').toLowerCase().trim().replace(/_\d+$/, '')
}

// Every field a single header feeds. It can be more than one: a Projects
// sheet's "Remarks" column is read as both `remarks` and `notes`.
export function fieldsForHeader(header: string, cols: Aliases, fields: FieldDef[]): string[] {
  const h = normalizeHeader(header)
  return fields.filter((f) => (cols[f.key] ?? []).includes(h)).map((f) => f.key)
}

// Some columns are recognised by shape rather than by name — a leads
// sheet's follow-up log heads each column with the call date, so there is
// no alias to match. `extra` returns a label for such a header, or null.
export type ExtraLabel = (header: string) => string | null

// A header the importer has no field for (a sheet's "City", say) can be
// listed but not picked — selecting it could only ever look like it did
// something.
export const isSupportedHeader = (header: string, cols: Aliases, fields: FieldDef[], extra?: ExtraLabel) =>
  fieldsForHeader(header, cols, fields).length > 0 || !!extra?.(header)

// The fields a set of chosen headers covers — what the preview renders
// and what the insert payload is allowed to carry.
export function selectedFields(selection: string[], cols: Aliases, fields: FieldDef[]): Set<string> {
  const out = new Set<string>()
  for (const h of selection) for (const f of fieldsForHeader(h, cols, fields)) out.add(f)
  return out
}

// What an uncustomised import reads: every header the importer
// understands, in sheet order.
export function defaultSelection(headers: string[], cols: Aliases, fields: FieldDef[], extra?: ExtraLabel): string[] {
  return headers.filter((h) => isSupportedHeader(h, cols, fields, extra))
}

// Narrows a row to the chosen columns so the existing row mapping —
// pick(), colsByBase(), duplicate detection, validation — runs unchanged
// on what's left and simply finds nothing for the columns dropped.
export function pickColumns(row: any, selection: string[]): any {
  const keep = new Set(selection.map((h) => String(h).toLowerCase().trim()))
  const out: Record<string, any> = {}
  for (const k of Object.keys(row ?? {})) if (keep.has(k.toLowerCase().trim())) out[k] = row[k]
  return out
}

const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v === b[i])

export function CustomizeColumnsModal({
  title,
  headers,
  cols,
  fields,
  selection,
  extraLabel,
  onCancel,
  onSave,
}: {
  title: string
  headers: string[]
  cols: Aliases
  fields: FieldDef[]
  /** null = not customised yet, i.e. every supported column */
  selection: string[] | null
  /** labels a header recognised by shape rather than name (see ExtraLabel) */
  extraLabel?: ExtraLabel
  onCancel: () => void
  onSave: (next: string[] | null) => void
}) {
  const fallback = useMemo(() => defaultSelection(headers, cols, fields, extraLabel), [headers, cols, fields, extraLabel])

  // A saved selection is kept across previews, so it can name columns the
  // sheet now being imported doesn't have — drop those rather than show
  // rows the user can't act on.
  const [sel, setSel] = useState<string[]>(() => {
    const kept = (selection ?? fallback).filter((h) => headers.includes(h))
    return kept.length ? kept : fallback
  })
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')

  const remaining = headers.filter((h) => !sel.includes(h))
  const addable = remaining.filter((h) => isSupportedHeader(h, cols, fields, extraLabel))

  // Only a required field the sheet actually has can be enforced. If a
  // sheet simply has no Phone column there is nothing to protect, and
  // locking every row instead would just be confusing — the warning
  // below says so and the rows import as invalid, exactly as before.
  const enforceable = useMemo(
    () => fields.filter((f) => f.required && headers.some((h) => fieldsForHeader(h, cols, fields).includes(f.key))),
    [fields, headers, cols],
  )

  const covered = selectedFields(sel, cols, fields)
  const missing = fields.filter((f) => f.required && !covered.has(f.key))

  // Removable unless it is the last column feeding a required field —
  // which still allows swapping between two columns that both feed one.
  function canRemove(header: string) {
    const rest = selectedFields(sel.filter((h) => h !== header), cols, fields)
    return enforceable.every((f) => rest.has(f.key))
  }

  function add() {
    if (!draft || sel.includes(draft)) return
    setSel([...sel, draft])
    setDraft('')
    setAdding(false)
  }

  function move(i: number, by: number) {
    const j = i + by
    if (j < 0 || j >= sel.length) return
    const next = [...sel]
    ;[next[i], next[j]] = [next[j], next[i]]
    setSel(next)
  }

  function save() {
    // A selection identical to the default means "not customised", so the
    // import keeps its plain, uncustomised behaviour.
    onSave(sameList(sel, fallback) ? null : sel)
  }

  const labelsFor = (header: string) =>
    extraLabel?.(header) ??
    fieldsForHeader(header, cols, fields)
      .map((k) => fields.find((f) => f.key === k)?.label)
      .filter((l, i, a) => l && a.indexOf(l) === i)
      .join(' · ')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h3 className="flex items-center gap-2 font-semibold text-slate-900">
            <Columns3 className="h-4 w-4 text-blue-600" /> Customize Columns — {title}
          </h3>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <p className="text-sm text-slate-500">
            Pick the columns to import. Anything left out is ignored in both the preview and the import.
          </p>

          {/* ------------------------------------------- Available columns */}
          <div>
            <h4 className="mb-2 text-sm font-medium text-slate-700">Available Columns ({headers.length})</h4>
            {headers.length === 0 ? (
              <p className="text-sm text-slate-400">No columns found in this sheet.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {headers.map((h) => {
                  const supported = isSupportedHeader(h, cols, fields, extraLabel)
                  const chosen = sel.includes(h)
                  return (
                    <span
                      key={h}
                      title={supported ? `Imported as: ${labelsFor(h)}` : 'No matching import field — this column is ignored'}
                      className={`rounded-full px-2.5 py-1 text-xs ${
                        !supported
                          ? 'bg-slate-50 text-slate-400 line-through'
                          : chosen
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {h}
                    </span>
                  )
                })}
              </div>
            )}
            {headers.some((h) => !isSupportedHeader(h, cols, fields, extraLabel)) && (
              <p className="mt-2 text-xs text-slate-400">
                Struck-through columns have no matching field in {title.toLowerCase()} and can&apos;t be imported.
              </p>
            )}
          </div>

          {/* ------------------------------------- Selected import columns */}
          <div>
            <h4 className="mb-2 text-sm font-medium text-slate-700">Selected Import Columns ({sel.length})</h4>

            {sel.length === 0 && <p className="mb-2 text-sm text-slate-400">No columns selected yet.</p>}

            <ul className="space-y-1.5">
              {sel.map((h, i) => {
                const locked = !canRemove(h)
                return (
                  <li
                    key={h}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                    <span className="font-medium text-slate-800">{h}</span>
                    <span className="text-xs text-slate-400">→ {labelsFor(h)}</span>
                    {locked && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                        <Lock className="h-3 w-3" /> required
                      </span>
                    )}
                    <span className="ml-auto flex items-center gap-1">
                      <button
                        onClick={() => move(i, -1)}
                        disabled={i === 0}
                        title="Move up"
                        className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30 disabled:hover:bg-transparent"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => move(i, 1)}
                        disabled={i === sel.length - 1}
                        title="Move down"
                        className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30 disabled:hover:bg-transparent"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setSel(sel.filter((x) => x !== h))}
                        disabled={locked}
                        title={locked ? 'This column is required and can’t be removed' : 'Remove column'}
                        className="rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </span>
                  </li>
                )
              })}
            </ul>

            <div className="mt-3">
              {adding ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-slate-500">Select Column:</span>
                  <select className={`${inp} min-w-[180px] flex-1`} value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus>
                    <option value="">Choose a column…</option>
                    {remaining.map((h) => {
                      const supported = isSupportedHeader(h, cols, fields, extraLabel)
                      return (
                        <option key={h} value={h} disabled={!supported}>
                          {h}{supported ? '' : ' — not supported'}
                        </option>
                      )
                    })}
                  </select>
                  <button
                    onClick={add}
                    disabled={!draft}
                    className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => { setAdding(false); setDraft('') }}
                    className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setAdding(true)}
                  disabled={addable.length === 0}
                  title={addable.length === 0 ? 'Every importable column is already selected' : undefined}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 disabled:hover:border-slate-300 disabled:hover:text-slate-600"
                >
                  <Plus className="h-4 w-4" /> Add Column
                </button>
              )}
            </div>
          </div>

          {missing.length > 0 && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              This sheet has no {missing.map((f) => f.label).join(' or ')} column
              {missing.length > 1 ? 's' : ''}. Rows without {missing.length > 1 ? 'them' : 'it'} are flagged invalid and
              skipped on import.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 px-5 py-3">
          <button
            onClick={() => setSel(fallback)}
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Select all
          </button>
          <span className="ml-auto flex gap-2">
            <button onClick={onCancel} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={sel.length === 0}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              Save &amp; Preview
            </button>
          </span>
        </div>
      </div>
    </div>
  )
}
