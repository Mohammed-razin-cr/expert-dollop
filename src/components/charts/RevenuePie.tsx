'use client'

import Link from 'next/link'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

/**
 * Money per name, as a donut with a legend.
 *
 * Shaped after CategoryDonut so it reads as a sibling of Leads by Source
 * beside it, but that one prints raw counts: a legend row reading "57158"
 * is not a rupee figure, and its centre total would say the same. This
 * formats both, and makes each legend row a link to the rows behind it.
 */

export type RevenueSlice = { name: string; amount: number; href?: string }

// Distinct enough to tell apart at a glance, and deliberately not the lead
// -source palette next door — the two donuts count different things and
// should not look like the same series twice.
const COLOURS = ['#10b981', '#0ea5e9', '#f59e0b', '#8b5cf6', '#f43f5e', '#14b8a6']
const MUTED = '#cbd5e1'

const full = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN')

/** Compact enough for the centre of a 160px ring. */
const short = (n: number) => {
  if (n >= 1e7) return `₹${+(n / 1e7).toFixed(1)}Cr`
  if (n >= 1e5) return `₹${+(n / 1e5).toFixed(1)}L`
  if (n >= 1000) return `₹${Math.round(n / 1000)}k`
  return `₹${Math.round(n)}`
}

function SliceTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload as RevenueSlice & { share: number }
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <p className="text-xs font-medium text-slate-800">{d.name}</p>
      <p className="text-sm font-semibold text-emerald-600">{full(d.amount)}</p>
      <p className="text-[11px] text-slate-400">{d.share}% of collections</p>
    </div>
  )
}

export function RevenuePie({ data }: { data: RevenueSlice[] }) {
  const total = data.reduce((s, d) => s + d.amount, 0)
  // Percentages are for reading, not arithmetic — they are rounded and will
  // not always come to exactly 100.
  const slices = data.map((d, i) => ({
    ...d,
    share: total ? Math.round((d.amount / total) * 100) : 0,
    // Unattributed is greyed rather than given a colour of its own: it is an
    // absence of data, not another person.
    color: d.href ? COLOURS[i % COLOURS.length] : MUTED,
  }))

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-40 w-40 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={total ? slices : [{ name: 'No data', amount: 1, color: '#e2e8f0', share: 0 }]}
              dataKey="amount"
              innerRadius={48}
              outerRadius={70}
              paddingAngle={2}
              stroke="none"
              // Without this the sectors render as empty <g> with no path at
              // all — recharts 3 leaves the shape unmounted until its entry
              // animation runs, and here it never does. CategoryDonut has the
              // same omission and the same missing ring.
              isAnimationActive={false}
            >
              {(total ? slices : [{ color: '#e2e8f0' }]).map((d: any, i: number) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
            {!!total && <Tooltip content={<SliceTooltip />} />}
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="text-center">
            <p className="text-lg font-semibold text-slate-900">{short(total)}</p>
            <p className="text-[11px] text-slate-400">Collected</p>
          </div>
        </div>
      </div>

      <ul className="min-w-0 flex-1 space-y-1.5 text-sm">
        {slices.map((d) => {
          const row = (
            <>
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: d.color }} />
              <span className="truncate text-slate-600">{d.name}</span>
              <span className="ml-auto whitespace-nowrap font-medium text-slate-900">{full(d.amount)}</span>
            </>
          )
          // A slice with no href is a collection recorded under nobody: there
          // is no name to filter the Revenue page by.
          return d.href ? (
            <li key={d.name}>
              <Link href={d.href} className="-mx-1 flex items-center gap-2 rounded px-1 py-0.5 hover:bg-slate-50">
                {row}
              </Link>
            </li>
          ) : (
            <li key={d.name} className="-mx-1 flex items-center gap-2 px-1 py-0.5">
              {row}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
