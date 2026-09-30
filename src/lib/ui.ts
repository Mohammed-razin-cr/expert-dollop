/**
 * Small formatting and layout helpers shared by the trainer screens.
 *
 * Extracted once a third screen needed them — dates that read the same way
 * everywhere, and one pager that behaves the same on every table.
 */

/** "16 Aug 2026" — the date format every trainer screen uses. */
export const fmtDate = (d: string | null) =>
  d
    ? new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—'

/** "16 Aug 2026, 10:30 am" — for values that carry a time. */
export const fmtStamp = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

/** Up to `span` page numbers, kept centred on the current page. */
export function pageWindow(current: number, count: number, span = 5) {
  const start = Math.max(1, Math.min(current - Math.floor(span / 2), count - span + 1))
  return Array.from({ length: Math.min(span, count) }, (_, i) => start + i)
}
