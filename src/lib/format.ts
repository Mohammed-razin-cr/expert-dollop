/**
 * Percentage as a label, e.g. "90%", "7.5%", "0%".
 *
 * Rounded to one decimal and trimmed, so a clean 90 reads "90%" rather
 * than "90.0%" while a genuine 7.5 keeps its half. Screens that show a
 * breakdown — 36 / 3 / 1 out of 40 — need that precision, otherwise the
 * small slices all collapse to the same rounded integer.
 */
export function pctLabel(part: number, total: number): string {
  if (!total) return '0%'
  const v = (part / total) * 100
  return `${Number.isInteger(v) ? v : Number(v.toFixed(1))}%`
}
