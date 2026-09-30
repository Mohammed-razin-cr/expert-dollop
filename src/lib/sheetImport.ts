import * as XLSX from 'xlsx'

function allSheetsToRows(wb: XLSX.WorkBook): any[] {
  const rows: any[] = []
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name]
    rows.push(...XLSX.utils.sheet_to_json(sheet, { defval: '' }))
  }
  return rows
}

// Reads an uploaded .xlsx/.xls/.csv file into an array of row objects
// keyed by each sheet's header row. Reads every sheet/tab, not just
// the first — real workbooks often split data by month.
export async function parseSheetFile(file: File): Promise<any[]> {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  return allSheetsToRows(wb)
}

// Extracts the spreadsheet id from a Google Sheets URL and pulls the
// tab named by the URL's `gid` (or the first tab if none is given) as
// CSV via the public export endpoint. Only works for sheets shared as
// "Anyone with the link can view" — there is no OAuth flow here.
//
// Google's public CSV export only returns one tab per request (there's
// no unauthenticated endpoint that lists/exports every tab at once), so
// a multi-tab sheet (e.g. one tab per month) needs one link per tab —
// copy the link after clicking each tab so the URL's `gid` matches it.
export async function parseGoogleSheetLink(url: string): Promise<any[]> {
  const idMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/)
  if (!idMatch) throw new Error('That doesn\'t look like a Google Sheets link (expected .../d/<id>/...).')
  const id = idMatch[1]
  const gidMatch = url.match(/[?&#]gid=(\d+)/)
  const gid = gidMatch ? gidMatch[1] : '0'

  const res = await fetch(`https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`)
  if (!res.ok) {
    throw new Error('Could not fetch the sheet as CSV. Make sure it\'s shared as "Anyone with the link can view".')
  }
  const csv = await res.text()
  if (/^\s*<(!doctype|html)/i.test(csv)) {
    throw new Error('Google returned a sign-in page instead of CSV. Make sure the sheet is shared as "Anyone with the link can view".')
  }
  const wb = XLSX.read(csv, { type: 'string' })
  return allSheetsToRows(wb)
}

// Every column header present across the parsed rows, in the order the
// sheet lists them. Reads more than the first row because a workbook's
// tabs don't always carry an identical header row, and a header that
// only exists on a later tab still belongs in the column picker.
//
// Blank headers ('', '__EMPTY', '__EMPTY_1' …) are what the parser names
// unlabelled columns; they carry nothing a user can map, so they're left out.
export function collectHeaders(rows: any[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const row of rows ?? []) {
    for (const key of Object.keys(row ?? {})) {
      const k = String(key).trim()
      if (!k || /^__EMPTY(_\d+)?$/.test(k) || seen.has(k)) continue
      seen.add(k)
      out.push(k)
    }
  }
  return out
}

// ------------------------------------------------------------ Row ranges
//
// A sheet of thousands of rows is rarely imported in one go — a BD works
// through it in batches ("rows 1 to 50", then "2001 to 2050" next week),
// and a whole-sheet preview gives no way to say so.
//
// Rows are counted the way they read in the spreadsheet: 1 is the first
// row of data. The header row isn't counted, because the parser has
// already turned it into the row objects' keys rather than a row.

const rowNumber = (v: unknown): number | null => {
  const n = Math.trunc(Number(v))
  return Number.isFinite(n) && n > 0 ? n : null
}

// The 1-based, inclusive bounds a typed range resolves to for a sheet of
// `length` rows, or null when it covers the whole sheet.
//
// Either end may be left blank — a `from` with no `to` runs to the end,
// a `to` with no `from` starts at row 1. Both are clamped to the sheet,
// so "1 to 500" typed against a 50-row sheet reads rows 1 to 50 rather
// than failing. A back-to-front range (`end < start`) is left as it is
// rather than swapped: it resolves to no rows, and the preview saying
// "0 rows" is more honest than silently reading a range nobody asked for.
export function resolveRowRange(
  length: number,
  from?: number | string | null,
  to?: number | string | null,
): { start: number; end: number } | null {
  const a = rowNumber(from)
  const b = rowNumber(to)
  if (a == null && b == null) return null
  return { start: Math.max(1, a ?? 1), end: Math.min(length, b ?? length) }
}

// The rows a range names. Everything when neither end is given.
export function sliceRowRange<T>(rows: T[], from?: number | string | null, to?: number | string | null): T[] {
  const r = resolveRowRange(rows.length, from, to)
  if (!r) return rows
  return r.end < r.start ? [] : rows.slice(r.start - 1, r.end)
}

// Which component a sheet's authors typed first. 'dmy' is the Indian
// convention ("22/06/2026"); 'mdy' is the US one.
export type DateOrder = 'dmy' | 'mdy'

const pad = (n: number | string) => String(n).padStart(2, '0')

// Excel's date epoch (with the 1900 leap-year bug baked in, matching
// what Excel/Sheets actually produce) — used when a date cell comes
// through as a raw serial number instead of a formatted value.
//
// A serial means Excel *did* parse the cell as a date, so it already
// applied its own locale's order. A DD/MM sheet opened by an MM/DD
// Excel silently swaps the two on any date whose day is <= 12 — the
// only cases ambiguous enough for that to happen. (Day > 12 can't be
// read as a month, so Excel leaves those as text and they arrive here
// as strings instead.) Swapping back recovers the intended date.
function serialToISO(n: number, order: DateOrder): string {
  const d = new Date(Math.round((n - 25569) * 86400 * 1000))
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth() + 1
  const day = d.getUTCDate()
  if (order === 'dmy' && day <= 12) return `${y}-${pad(day)}-${pad(m)}`
  return `${y}-${pad(m)}-${pad(day)}`
}

// Sheet data in the wild mixes real Excel dates (serial numbers) with
// plain text typed as "22/06/2026" or "18/8/2026".
// Normalizes whatever we find to YYYY-MM-DD, or '' if unparseable.
export function parseFlexibleDate(v: any, order: DateOrder = 'dmy'): string {
  if (v == null || v === '') return ''
  if (v instanceof Date) {
    return serialToISO(v.getTime() / 86400000 + 25569, order)
  }
  if (typeof v === 'number') return serialToISO(v, order)

  const s = String(v).trim()

  // Already unambiguous.
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/)
  if (iso) return iso[1]

  // Text the spreadsheet never converted — read in the sheet's own order.
  const parts = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (parts) {
    const [, a, b, y] = parts
    const day = order === 'dmy' ? a : b
    const month = order === 'dmy' ? b : a
    if (Number(month) < 1 || Number(month) > 12) return ''
    return `${y}-${pad(month)}-${pad(day)}`
  }

  // A serial that arrived as a string (any lookup that stringifies cells
  // hands us "46028" rather than 46028). Bounded to a sane date range so
  // stray numbers in a date column don't silently become 1970-era dates.
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Number(s)
    if (n >= 20000 && n <= 60000) return serialToISO(n, order)
  }
  return ''
}

// A follow-up log is kept wide rather than tall: one column per call day,
// the date itself as the header ("8/21/2026"), the outcome in the cell.
// There is no fixed set of names to match — a new column appears every
// time the team calls — so a header is recognised by being a date.
//
// Deliberately strict. A header only counts if it is *nothing but* a
// date, so "Enquiry Date" and "Call Date" (which name a field rather
// than being one) are left to the ordinary column mapping.
//
// Returns YYYY-MM-DD, or '' when the header isn't a date.
export function parseHeaderDate(header: string, order: DateOrder = 'dmy'): string {
  const s = String(header ?? '').trim()
  if (!s) return ''

  // Already unambiguous.
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s

  // The common shape. Sheets re-renders a date header's year to two
  // digits on export ("8/21/2026" arrives as "8/21/26"), so accept both.
  const parts = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/)
  if (parts) {
    const [, a, b, rawY] = parts
    const y = rawY.length === 2 ? 2000 + Number(rawY) : Number(rawY)
    const A = Number(a)
    const B = Number(b)
    // A header's own digits often settle the order regardless of the
    // dropdown: "8/21" can only be month-first, because 21 is no month.
    // Honouring that matters more here than for a body cell — an
    // unreadable header isn't a wrong date, it's a whole column of
    // follow-ups silently not imported.
    let day: number
    let month: number
    if (A > 12 && B <= 12) { day = A; month = B }
    else if (B > 12 && A <= 12) { day = B; month = A }
    else { day = order === 'dmy' ? A : B; month = order === 'dmy' ? B : A }
    if (month < 1 || month > 12 || day < 1 || day > 31) return ''
    return `${y}-${pad(month)}-${pad(day)}`
  }

  // A header cell the parser handed back as a raw serial.
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Number(s)
    if (n >= 20000 && n <= 60000) return serialToISO(n, order)
  }
  return ''
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

// The other convention real sheets use: the column is *named* for the
// call rather than headed by a bare date — "follow up on 6th aug",
// "Follow up on 20 th aug". No year is written, so one is supplied by
// the caller from the sheet's own dates.
//
// Returns YYYY-MM-DD, or '' when the header isn't a datable follow-up.
export function parseFollowupHeader(header: string, order: DateOrder = 'dmy', yearHint?: number): string {
  const s = String(header ?? '').trim()
  if (!s) return ''

  // A bare date column is a follow-up column too.
  const asDate = parseHeaderDate(s, order)
  if (asDate) return asDate

  // Beyond this point only columns that say so count, so an ordinary
  // field like "Call Date" is never mistaken for a follow-up.
  if (!/follow[\s._-]*up/i.test(s)) return ''

  const y = yearHint ?? new Date().getUTCFullYear()
  const lower = s.toLowerCase()
  const mon = `(${MONTHS.join('|')})[a-z]*`
  // "6th aug", "12 aug", "14 th aug" — and the reverse, "aug 6".
  const m =
    lower.match(new RegExp(`(\\d{1,2})\\s*(?:st|nd|rd|th)?\\s*(?:of\\s*)?${mon}`)) ??
    lower.match(new RegExp(`${mon}\\s*(?:of\\s*)?(\\d{1,2})\\s*(?:st|nd|rd|th)?`))
  if (!m) return ''

  // The two patterns capture day and month in opposite groups.
  const dayRaw = /^\d/.test(m[1]) ? m[1] : m[2]
  const monRaw = /^\d/.test(m[1]) ? m[2] : m[1]
  const day = Number(dayRaw)
  const month = MONTHS.indexOf(monRaw.slice(0, 3)) + 1
  if (!month || day < 1 || day > 31) return ''
  return `${y}-${pad(month)}-${pad(day)}`
}

export const isFollowupHeader = (header: string, order: DateOrder = 'dmy', yearHint?: number) =>
  !!parseFollowupHeader(header, order, yearHint)

// A header saying "Date" does not mean the column holds dates. Sheets log
// follow-ups down a column as often as across a row — the header names the
// call ("Date", "Response Date") and the cells below hold what was said —
// and reading those cells as dates throws every one of them away, leaving
// the field blank with nothing to show for it.
//
// Answers from the column's own contents: true when what is there really
// is dates. An empty column counts as dates, because there is nothing to
// reclassify and the header is all we have to go on.
export function columnHoldsDates(rows: any[], header: string, order: DateOrder = 'dmy'): boolean {
  const want = String(header ?? '').trim().toLowerCase()
  let filled = 0
  let dated = 0
  for (const row of rows ?? []) {
    for (const k of Object.keys(row ?? {})) {
      if (String(k).trim().toLowerCase() !== want) continue
      const v = row[k]
      if (v == null || String(v).trim() === '') continue
      filled++
      if (parseFlexibleDate(v, order)) dated++
    }
  }
  // Half is deliberately forgiving: a genuine date column with a few
  // "NA"/"pending" cells stays a date column.
  return filled === 0 || dated * 2 >= filled
}
