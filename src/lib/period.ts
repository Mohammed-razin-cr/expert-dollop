/**
 * The dashboard period filter — one definition of "Overall / Today / This
 * Week / This Month", shared by the page that reads the query string and
 * every panel that has to query for it.
 *
 * Dates are formatted from the *local* calendar rather than through
 * toISOString(). The two disagree in IST for the first five and a half
 * hours of every day, so a UTC-derived "today" returned yesterday's rows
 * until 05:30 — which is exactly when an early-shift BD looks at it.
 *
 * Each period also carries the previous equivalent stretch. That is what
 * the growth indicators on the KPI cards compare against: this week
 * against the same days last week, month-to-date against the same days of
 * last month, rather than against a whole calendar month that has not
 * finished yet.
 */

// 'custom' is a hand-picked start/end range (the dashboard's date filter).
// It behaves like a bounded period everywhere the others do — the trend
// chart fills between its own from/to, the KPI queries range on it — the
// only difference is the label and the previous-window it compares against.
export type PeriodKey = 'overall' | 'today' | 'week' | 'month' | 'custom'

export const PERIOD_KEYS: PeriodKey[] = ['overall', 'today', 'week', 'month']

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  overall: 'Overall',
  today: 'Today',
  week: 'This Week',
  month: 'This Month',
  custom: 'Selected range',
}

/** How a growth badge names the stretch it is comparing against. */
const PREV_LABELS: Record<PeriodKey, string> = {
  overall: '',
  today: 'vs yesterday',
  week: 'vs last week',
  month: 'vs last month',
  custom: 'vs previous period',
}

export type Period = {
  key: PeriodKey
  label: string
  /** Inclusive YYYY-MM-DD bounds, or null/null for Overall. */
  from: string | null
  to: string | null
  /** The previous equivalent stretch. Null for Overall — nothing precedes it. */
  prevFrom: string | null
  prevTo: string | null
  /** Empty for Overall, which has no comparison. */
  prevLabel: string
}

/** Local calendar date as YYYY-MM-DD. */
export const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/**
 * End of an inclusive day, for columns that carry a time.
 *
 * `created_at` is a timestamptz, so `lte('created_at', '2026-09-01')`
 * compares against midnight and drops everything that happened during the
 * day — the whole point of asking for it.
 */
export const dayEnd = (d: string) => `${d}T23:59:59.999`

const shift = (d: Date, days: number) => {
  const x = new Date(d)
  x.setDate(x.getDate() + days)
  return x
}

export function asPeriodKey(v: string | null | undefined): PeriodKey {
  return (PERIOD_KEYS as string[]).includes(v ?? '') ? (v as PeriodKey) : 'overall'
}

export function resolvePeriod(raw: string | null | undefined, now = new Date()): Period {
  const key = asPeriodKey(raw)
  const base = { key, label: PERIOD_LABELS[key], prevLabel: PREV_LABELS[key] }

  if (key === 'today') {
    const t = ymd(now)
    const y = ymd(shift(now, -1))
    return { ...base, from: t, to: t, prevFrom: y, prevTo: y }
  }

  if (key === 'week') {
    // Sunday start — the convention the dashboard already used.
    const start = shift(now, -now.getDay())
    return {
      ...base,
      from: ymd(start),
      to: ymd(now),
      prevFrom: ymd(shift(start, -7)),
      prevTo: ymd(shift(now, -7)),
    }
  }

  if (key === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    // Day 0 of this month is the last day of the previous one, so this is
    // that month's length. Clamping against it keeps 31 March comparing
    // against 28 February instead of rolling forward into March.
    const prevMonthDays = new Date(now.getFullYear(), now.getMonth(), 0).getDate()
    const prevEnd = new Date(
      prevStart.getFullYear(),
      prevStart.getMonth(),
      Math.min(now.getDate(), prevMonthDays),
    )
    return {
      ...base,
      from: ymd(start),
      to: ymd(now),
      prevFrom: ymd(prevStart),
      prevTo: ymd(prevEnd),
    }
  }

  return { ...base, from: null, to: null, prevFrom: null, prevTo: null }
}

const MONTH_NAME = new Intl.DateTimeFormat('en-GB', { month: 'long' })

/**
 * What a period-scoped KPI card should call itself.
 *
 * "Total Leads" is only honest on Overall. On a month it is September's
 * figure, not a total, and the difference matters: a BD whose leads were
 * all raised in August opens the dashboard to zeros, and "Total Leads 0"
 * reads as a broken screen where "September Leads 0" reads as the month
 * being quiet. Rolls to October on its own — it is the month the range
 * starts in, not a hardcoded name.
 *
 * Any range that stays inside one calendar month is named after it, not
 * just the This Month preset: picking 1-31 July by hand is July's figure
 * and should say so, and so is 1-15 July. A range spanning months has no
 * one name, so it keeps "Total" and the header carries the dates.
 *
 * Today and This Week are excluded even though they sit inside a month —
 * naming them after it would put "September Leads" over a single day's
 * count, which is worse than saying nothing.
 */
export const periodName = (p: Period): string => {
  if (!p.from || !p.to) return 'Total'
  if (p.key === 'today' || p.key === 'week') return 'Total'
  if (p.from.slice(0, 7) !== p.to.slice(0, 7)) return 'Total'
  return MONTH_NAME.format(new Date(`${p.from}T00:00:00`))
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const RANGE_LABEL = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
const labelDate = (d: string) => RANGE_LABEL.format(new Date(`${d}T00:00:00`))

/**
 * The dashboard's date filter, resolved into the same Period shape the
 * panels already read. Replaces the Overall/Today/Week/Month selector: no
 * dates means Overall (all time), otherwise a bounded custom range.
 *
 * Either side may be left open — a start alone runs to today, an end alone
 * runs from the beginning — so the range is usable the moment one date is
 * picked. The growth badges compare against the immediately preceding
 * window of the same length, but only when both ends were given: an
 * open-ended range has no well-defined "previous" to measure against.
 */
export function resolveRange(
  rawFrom: string | null | undefined,
  rawTo: string | null | undefined,
  now = new Date(),
): Period {
  const f = rawFrom && DATE_RE.test(rawFrom) ? rawFrom : null
  const t = rawTo && DATE_RE.test(rawTo) ? rawTo : null

  if (!f && !t) return resolvePeriod('overall', now)

  const bothGiven = !!f && !!t
  // Fill the open side so every panel that needs two bounds has them.
  // 1970-01-01 sits before any row this system holds, so an open start
  // means "everything up to the end date".
  const from = f ?? '1970-01-01'
  const to = t ?? ymd(now)

  const label = bothGiven
    ? `${labelDate(from)} – ${labelDate(to)}`
    : f
      ? `Since ${labelDate(from)}`
      : `Up to ${labelDate(to)}`

  const base = { key: 'custom' as const, label, prevLabel: bothGiven ? PREV_LABELS.custom : '' }
  if (!bothGiven) {
    return { ...base, from, to, prevFrom: null, prevTo: null }
  }

  // Previous equal-length window ending the day before `from`.
  const spanDays = daysBetween(from, to) // inclusive length is spanDays + 1
  const prevTo = ymd(shift(new Date(`${from}T00:00:00`), -1))
  const prevFrom = ymd(shift(new Date(`${from}T00:00:00`), -(spanDays + 1)))
  return { ...base, from, to, prevFrom, prevTo }
}

// ---------------------------------------------------------------------
// Trend bucketing
// ---------------------------------------------------------------------

const DAY_LABEL = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' })
const MONTH_LABEL = new Intl.DateTimeFormat('en-GB', { month: 'short', year: '2-digit' })

/** Safety rail: a hand-typed range can't blow the loop up into a browser hang. */
const MAX_BUCKETS = 400

/** Beyond a quarter of daily points the axis is unreadable, so Overall
 *  switches to monthly buckets. Below it, days still read as a trend. */
const DAILY_SPAN_LIMIT = 92

const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00`) - Date.parse(`${a}T00:00:00`)) / 86_400_000)

/**
 * Dated amounts to a gap-filled series for the trend chart.
 *
 * Every bucket inside the selected period gets a point, including the ones
 * with no money in — otherwise the line joins 2 June straight to 22 July
 * and reads as though revenue arrived steadily in between.
 *
 * A period fills between its own bounds. Overall has none, so it fills
 * between the first and last dated row, by day while that span is short
 * enough to plot and by month once a year of history would crowd the axis
 * into noise.
 */
export function trendBuckets(
  rows: { date: string | null | undefined; amount: number }[],
  p: Period,
): { label: string; value: number }[] {
  const dates: string[] = []
  for (const r of rows) {
    const d = (r.date ?? '').slice(0, 10)
    if (d) dates.push(d)
  }

  const overall = p.key === 'overall'
  let first = p.from
  let last = p.to
  if (overall) {
    if (!dates.length) return []
    first = dates.reduce((a, b) => (a < b ? a : b))
    last = dates.reduce((a, b) => (a > b ? a : b))
  }
  if (!first || !last) return []

  const byMonth = overall && daysBetween(first, last) > DAILY_SPAN_LIMIT

  const totals = new Map<string, number>()
  for (const r of rows) {
    const d = (r.date ?? '').slice(0, 10)
    if (!d) continue
    const k = byMonth ? d.slice(0, 7) : d
    totals.set(k, (totals.get(k) ?? 0) + r.amount)
  }

  const keys: string[] = []
  if (byMonth) {
    const stop = last.slice(0, 7)
    const [y0, m0] = first.split('-').map(Number)
    for (let c = new Date(y0, m0 - 1, 1); keys.length < MAX_BUCKETS; c.setMonth(c.getMonth() + 1)) {
      const k = `${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, '0')}`
      keys.push(k)
      if (k >= stop) break
    }
  } else {
    for (let c = new Date(`${first}T00:00:00`); keys.length < MAX_BUCKETS; c.setDate(c.getDate() + 1)) {
      const k = ymd(c)
      keys.push(k)
      if (k >= last) break
    }
  }

  return keys.map((k) => ({
    label: byMonth
      ? MONTH_LABEL.format(new Date(`${k}-01T00:00:00`))
      : DAY_LABEL.format(new Date(`${k}T00:00:00`)),
    value: totals.get(k) ?? 0,
  }))
}
