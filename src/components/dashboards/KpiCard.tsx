import Link from 'next/link'
import { Minus, TrendingDown, TrendingUp } from 'lucide-react'

/**
 * A dashboard KPI card: figure, growth against the previous equivalent
 * period, and a click through to the screen that figure lives on.
 *
 * The card carried a row of small link chips under a divider — View / Add /
 * Manage. That row is gone and the whole card is the link instead, which is
 * how the BD dashboard's cards have always worked: one obvious destination
 * per figure rather than three competing ones under it.
 */

export type Delta = {
  current: number
  previous: number
  /** e.g. "vs last week". Empty means no comparison is available. */
  note: string
  /**
   * True when a rise is bad news — pending fees going up is not growth.
   * Only colours the badge; the arrow still follows the actual direction.
   */
  invert?: boolean
}

const pct = (v: number) => {
  const r = Math.abs(v) >= 100 ? Math.round(v) : Number(v.toFixed(1))
  return `${v > 0 ? '+' : ''}${r}%`
}

function GrowthBadge({ current, previous, note, invert }: Delta) {
  // Nothing then and nothing now is not a trend, it is an empty period.
  if (!note || (!current && !previous)) return null

  const flat = current === previous
  const up = current > previous
  // A previous period of zero has no ratio to report — "+∞%" is noise, so
  // the badge says what actually happened instead.
  const text = flat ? 'No change' : previous === 0 ? 'New' : pct(((current - previous) / previous) * 100)
  const good = invert ? !up : up
  const Icon = flat ? Minus : up ? TrendingUp : TrendingDown

  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
      <span
        title={`${note}: ${previous.toLocaleString('en-IN')}`}
        className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
          flat
            ? 'bg-slate-100 text-slate-500'
            : good
              ? 'bg-emerald-50 text-emerald-600'
              : 'bg-rose-50 text-rose-600'
        }`}
      >
        <Icon className="h-3 w-3" />
        {text}
      </span>
      <span className="text-[10px] text-slate-400">{note}</span>
    </p>
  )
}

export function KpiCard({
  icon: Icon,
  label,
  value,
  tint,
  href,
  delta,
  extra,
}: {
  icon: any
  label: string
  value: React.ReactNode
  tint: string
  /** Where the figure lives. Omit for a card with nowhere sensible to go. */
  href?: string
  delta?: Delta
  /** Slot for an action that needs client state, e.g. Send Reminder. */
  extra?: React.ReactNode
}) {
  return (
    <div className="relative flex flex-col rounded-xl border border-slate-200 bg-white p-4 transition-all hover:border-blue-400 hover:shadow-md">
      {/* A stretched link, so the whole tile is the click target. Wrapping
          only the figure left the padding around it dead — you had to hit the
          text itself for anything to happen. */}
      {href && <Link href={href} aria-label={label} className="absolute inset-0 rounded-xl" />}

      {/* `flex-1` takes the slack the grid handed this tile for being shorter
          than its neighbours, and `items-center` puts the figure in the middle
          of it — so a card without a growth badge reads as centred rather than
          top-heavy beside one that has it. */}
      <div className="flex flex-1 items-center gap-3">
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${tint}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-slate-500">{label}</p>
          <p className="truncate text-lg font-semibold text-slate-900">{value}</p>
          {delta && <GrowthBadge {...delta} />}
        </div>
      </div>

      {/* Sits above the stretched link, so Send Reminder opens its dialog
          rather than following the card's href. */}
      {extra && (
        <div className="relative z-10 mt-2.5 border-t border-slate-100 pt-2">{extra}</div>
      )}
    </div>
  )
}
