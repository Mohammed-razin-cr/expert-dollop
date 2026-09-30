'use client'

import { useState } from 'react'
import { Users, X } from 'lucide-react'

const inp = 'rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300'

export type BD = { id: string; full_name: string }

// Who an import is shared out between, and how much each one takes.
//
// 'equal' deliberately keeps no numbers of its own — the shares are
// worked out from whatever row count the sheet turns out to have, so the
// same plan still splits evenly after previewing a different sheet.
// 'custom' means an admin typed the counts and they are used as written.
export type SplitPlan = { mode: 'equal' | 'custom'; entries: { bdId: string; share: number }[] }

// What each BD is down for, given a sheet of `total` rows. An even split
// rarely divides exactly (5000 across 3 BDs), so the remainder goes one
// row each to the first few rather than all of it to the last one.
export function sharesFor(plan: SplitPlan, total: number): { bdId: string; share: number }[] {
  if (plan.mode === 'custom') return plan.entries.map((e) => ({ ...e, share: Math.max(0, Math.trunc(e.share) || 0) }))
  const k = plan.entries.length
  if (!k) return []
  const base = Math.floor(Math.max(0, total) / k)
  const extra = Math.max(0, total) % k
  return plan.entries.map((e, i) => ({ bdId: e.bdId, share: base + (i < extra ? 1 : 0) }))
}

// How many rows each BD can actually take, once the typed shares are
// measured against the sheet in front of them.
//
// Under-subscribed shares stand as written — "give Anil 50 and nobody
// else anything" leaves the rest of the sheet unassigned on purpose.
// Over-subscribed ones are scaled down in proportion instead of being
// capped one by one: an admin who types 2000 for one BD and 1000 for four
// others is saying that BD takes twice as many, and simply capping would
// hand out 1000 each and flatten the very difference they typed.
//
// Largest-remainder, so the scaled shares still add up to exactly the
// rows available rather than losing a few to rounding.
function capsFor(plan: SplitPlan, total: number): number[] {
  const want = sharesFor(plan, total).map((s) => s.share)
  const sum = want.reduce((a, b) => a + b, 0)
  if (sum <= total || sum === 0) return want

  const exact = want.map((w) => (w * total) / sum)
  const caps = exact.map(Math.floor)
  const spare = total - caps.reduce((a, b) => a + b, 0)
  const byRemainder = exact
    .map((e, i) => ({ i, frac: e - Math.floor(e) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i)
  for (let k = 0; k < spare; k++) caps[byRemainder[k].i]++
  return caps
}

// Which BD each of `total` rows goes to, in sheet order.
//
// Rows are dealt one at a time in turn rather than in contiguous blocks:
// a sheet is normally ordered by enquiry date or by campaign, so handing
// out the first 1000 rows as a block would give one BD every stale lead
// and another every fresh one. Dealing round the table gives each BD the
// same mix of whatever the sheet holds.
//
// A BD drops out of the deal once their share is full. Rows still left
// when every share is full come back as null and are imported unassigned.
export function allocate(total: number, plan: SplitPlan | null): (string | null)[] {
  const out: (string | null)[] = new Array(Math.max(0, total)).fill(null)
  if (!plan?.entries.length) return out

  const shares = sharesFor(plan, out.length)
  const left = capsFor(plan, out.length)
  if (!left.some((n) => n > 0)) return out

  let at = 0
  for (let i = 0; i < out.length; i++) {
    let hops = 0
    while (left[at] <= 0) {
      at = (at + 1) % left.length
      if (++hops >= left.length) return out // every share is full — the rest stay unassigned
    }
    out[i] = shares[at].bdId
    left[at]--
    at = (at + 1) % left.length
  }
  return out
}

// How many rows each BD actually ends up with — the shares as dealt, not
// as typed. The two differ whenever the typed shares add up to more rows
// than the sheet has, and it is the dealt figure the admin needs to see.
export function dealtCounts(total: number, plan: SplitPlan | null): Map<string, number> {
  const out = new Map<string, number>()
  for (const bdId of allocate(total, plan)) if (bdId) out.set(bdId, (out.get(bdId) ?? 0) + 1)
  return out
}

// A one-line description of a saved plan, for the summary strip on the
// page — the same figures the modal showed, without reopening it.
export function describePlan(plan: SplitPlan, bds: BD[], total: number): string {
  const name = (id: string) => bds.find((b) => b.id === id)?.full_name ?? 'a removed BD'
  const dealt = dealtCounts(total, plan)
  if (total === 0) return plan.entries.map((e) => name(e.bdId)).join(', ')
  return plan.entries.map((e) => `${name(e.bdId)} ${(dealt.get(e.bdId) ?? 0).toLocaleString()}`).join(' · ')
}

export function CustomizeAssignmentModal({
  title,
  bds,
  total,
  plan,
  onCancel,
  onSave,
}: {
  title: string
  bds: BD[]
  /** rows the import will actually create — duplicates and invalid rows already excluded */
  total: number
  /** null = no split set yet, i.e. start with every BD sharing the sheet evenly */
  plan: SplitPlan | null
  onCancel: () => void
  onSave: (next: SplitPlan) => void
}) {
  // A saved plan can name someone who has since stopped being a BD, which
  // would list a share nobody can be assigned — drop those, and fall back
  // to everyone when that empties the plan.
  const [picked, setPicked] = useState<string[]>(() => {
    const kept = (plan?.entries.map((e) => e.bdId) ?? bds.map((b) => b.id)).filter((id) => bds.some((b) => b.id === id))
    return kept.length ? kept : bds.map((b) => b.id)
  })
  const [mode, setMode] = useState<'equal' | 'custom'>(plan?.mode ?? 'equal')
  const [shares, setShares] = useState<Record<string, number>>(() =>
    Object.fromEntries((plan?.entries ?? []).map((e) => [e.bdId, e.share])),
  )

  const draft: SplitPlan = { mode, entries: picked.map((id) => ({ bdId: id, share: shares[id] ?? 0 })) }
  // What each input shows: the typed number in custom mode, the worked-out
  // even split in equal mode.
  const shown = new Map(sharesFor(draft, total).map((s) => [s.bdId, s.share]))
  const dealt = dealtCounts(total, draft)

  const typed = [...shown.values()].reduce((a, b) => a + b, 0)
  const assigned = [...dealt.values()].reduce((a, b) => a + b, 0)
  const leftOver = Math.max(0, total - assigned)

  // Keeps `picked` in the order the page listed the BDs, which is the
  // order rows are dealt in — so the list reads the way it will run.
  function toggle(id: string) {
    setPicked(
      picked.includes(id)
        ? picked.filter((x) => x !== id)
        : bds.filter((b) => b.id === id || picked.includes(b.id)).map((b) => b.id),
    )
  }

  function setShare(id: string, raw: string) {
    // Switching to custom freezes whatever the even split was showing, so
    // typing one BD's number doesn't silently reset every other one to 0.
    const base = Object.fromEntries(shown)
    setShares({ ...base, [id]: Math.max(0, Math.trunc(Number(raw)) || 0) })
    setMode('custom')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h3 className="flex items-center gap-2 font-semibold text-slate-900">
            <Users className="h-4 w-4 text-blue-600" /> Customize Assignment — {title}
          </h3>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <p className="text-sm text-slate-500">
            {total > 0 ? (
              <>Share the <span className="font-medium text-slate-700">{total.toLocaleString()}</span> new row{total === 1 ? '' : 's'} out between the BDs you tick. </>
            ) : (
              <>Pick the BDs to share this import between. The counts appear once you preview a sheet. </>
            )}
            Rows are dealt one at a time in turn, so each BD gets a mix of the whole sheet rather than one block of it.
          </p>

          {bds.length === 0 ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
              No BDs found. Add users with the BD role before splitting an import.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {bds.map((b) => {
                const on = picked.includes(b.id)
                const gets = dealt.get(b.id) ?? 0
                const short = on && total > 0 && gets < (shown.get(b.id) ?? 0)
                return (
                  <li
                    key={b.id}
                    className={`flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 text-sm ${on ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50'}`}
                  >
                    <label className="flex flex-1 cursor-pointer items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggle(b.id)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600"
                      />
                      <span className={on ? 'font-medium text-slate-800' : 'text-slate-400'}>{b.full_name}</span>
                    </label>
                    <input
                      type="number"
                      min={0}
                      title={on ? 'How many rows this BD takes' : 'Tick this BD to give them a share'}
                      className={`${inp} w-28 text-right disabled:bg-slate-50 disabled:text-slate-300`}
                      value={on ? String(shown.get(b.id) ?? 0) : ''}
                      disabled={!on}
                      onChange={(e) => setShare(b.id, e.target.value)}
                    />
                    <span className={`w-32 text-right text-xs ${short ? 'text-amber-600' : 'text-slate-400'}`}>
                      {!on ? '—' : total === 0 ? 'awaiting preview' : `gets ${gets.toLocaleString()}`}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}

          {total > 0 && picked.length > 0 && (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              {assigned.toLocaleString()} of {total.toLocaleString()} row{total === 1 ? '' : 's'} shared out
              {leftOver > 0 && <> · <span className="font-medium text-amber-700">{leftOver.toLocaleString()} left unassigned</span></>}
            </p>
          )}

          {total > 0 && typed > total && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              The shares add up to {typed.toLocaleString()}, more rows than this sheet has, so they are scaled down to
              fit. Everyone keeps their proportion of the split — the &ldquo;gets&rdquo; figures on the right are what
              will actually happen.
            </p>
          )}
          {leftOver > 0 && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              {leftOver.toLocaleString()} row{leftOver === 1 ? '' : 's'} {leftOver === 1 ? 'falls' : 'fall'} outside every
              share and will be imported unassigned. Raise a share, or use Split equally to cover the whole sheet.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 px-5 py-3">
          <button
            onClick={() => { setMode('equal'); setShares({}) }}
            disabled={picked.length === 0}
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
          >
            Split equally
          </button>
          <button
            onClick={() => setPicked(bds.map((b) => b.id))}
            disabled={picked.length === bds.length}
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
          >
            Select all
          </button>
          <span className="ml-auto flex gap-2">
            <button onClick={onCancel} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
              Cancel
            </button>
            <button
              onClick={() => onSave(draft)}
              disabled={picked.length === 0}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              Save Split
            </button>
          </span>
        </div>
      </div>
    </div>
  )
}
