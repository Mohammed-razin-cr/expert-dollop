// Sheet headers are typed by hand, hundreds of times a week, by people who
// are not thinking about the importer. The same field arrives as "Name",
// "Full Name", "Student's Name:", "NAME " and "naem". Matching them against
// an exact alias list meant every unlisted spelling imported as nothing —
// the row arrived with that field blank, and no warning said so.
//
// This resolves a header to a field by scoring it against each field's
// aliases three ways, cheapest first:
//
//   1. the same string once normalised            -> certain      (1.00)
//   2. within a typo or two of it                 -> near-certain (~0.90)
//   3. the alias plus filler words around it      -> likely       (scored)
//
// A field is claimed only when the best score clears THRESHOLD *and* beats
// the runner-up by MARGIN. An ambiguous header — "Cost", on a sheet with
// both a vendor and a company cost — stays unmapped rather than guessing,
// which is the same outcome it has today and leaves the column picker to
// settle it.

export type Aliases = Record<string, string[]>

// Words that qualify a header without changing which field it names:
// "Full Name" is the Name column, "Enquiry Date" is the Date column.
// Dropped outright, so what is left is the field itself.
const NOISE = new Set([
  'full', 'the', 'a', 'an', 'of', 'for', 'in', 'is', 'pls', 'please', 'kindly',
  'sheet', 'col', 'column', 'field', 'data', 'info', 'information',
  'details', 'detail', 'student', 'students', 'candidate', 'candidates',
  'customer', 'client', 'enquiry', 'enquiries', 'inquiry', 'lead', 'leads',
  'sr', 'srno', 'sno', 'his', 'her', 'their', 'new',
])

// Words too common across fields to name one on their own. They still
// count, at a quarter weight — which is what makes "College Name" the
// college column rather than the name column.
const GENERIC = new Set([
  'name', 'no', 'nos', 'number', 'num', 'id', 'code', 'type', 'date',
  'cost', 'amount', 'amt', 'value', 'total',
])

const GENERIC_WEIGHT = 0.25

// Tuned against the alias tables in Gsheetsyncclient: 0.5 admits
// "Mobile No" and "College Name" (0.59) while leaving "Follow Up Date"
// (0.12) to the follow-up detector, which is what should claim it.
const THRESHOLD = 0.5
const MARGIN = 0.08

/** Lowercase, trimmed, and stripped of a trailing colon — the form the
 *  importer's own row lookup uses, so an alias added here is findable. */
export const normHeaderLoose = (h: string) =>
  String(h ?? '').toLowerCase().trim().replace(/:+\s*$/, '')

/** The parser numbers a repeated header ("response", "response_1"); both
 *  spellings mean the same column. */
export const stripDupSuffix = (h: string) => h.replace(/_\d+$/, '')

function tokens(s: string): string[] {
  return stripDupSuffix(String(s ?? '').toLowerCase())
    // Apostrophes bind ("student's" -> "students"), every other
    // separator splits.
    .replace(/['’]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((t) => t && !NOISE.has(t))
}

const weight = (t: string) => (GENERIC.has(t) ? GENERIC_WEIGHT : 1)
const sumWeight = (ts: string[]) => ts.reduce((n, t) => n + weight(t), 0)

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        prev[j] + 1,
        row[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    prev = row
  }
  return prev[b.length]
}

/** 0..1, where 1 is identical. */
function ratio(a: string, b: string): number {
  const len = Math.max(a.length, b.length)
  return len === 0 ? 1 : 1 - levenshtein(a, b) / len
}

// Short strings are left to exact matching: at four characters a single
// edit is a quarter of the word, and "bd" would sit one edit from "id".
const nearlySame = (a: string, b: string) => a.length >= 5 && b.length >= 5 && ratio(a, b) >= 0.82

/** An alias written "=catagore" matches that spelling and nothing near it.
 *  Some aliases are themselves misspellings a sheet is known to use, and
 *  letting those match fuzzily is how "Catagory" — an ordinary misspelling
 *  of Category — ends up one edit from both and mapped to neither. */
const isExactOnly = (alias: string) => alias.startsWith('=')
const aliasText = (alias: string) => (isExactOnly(alias) ? alias.slice(1) : alias)

/** How well one alias explains one header, 0 when it doesn't. */
function scoreAlias(headerTokens: string[], rawAlias: string): number {
  const exactOnly = isExactOnly(rawAlias)
  const aliasTokens = tokens(aliasText(rawAlias))
  if (!aliasTokens.length || !headerTokens.length) return 0

  const h = headerTokens.join(' ')
  const a = aliasTokens.join(' ')
  if (h === a) return 1
  if (exactOnly) return 0
  if (nearlySame(h, a)) return 0.9 * ratio(h, a)

  // Every word of the alias has to be in the header. "Vendor Name" may
  // read as the vendor column, but "Name" alone must never read as the
  // vendor one.
  const matched: string[] = []
  for (const at of aliasTokens) {
    const hit = headerTokens.find((ht) => ht === at || nearlySame(ht, at))
    if (!hit) return 0
    matched.push(hit)
  }

  // What share of the header the alias accounts for. A header that is
  // the alias plus a generic word ("Mobile No") keeps most of its weight;
  // one that is the alias plus a second real word ("Follow Up Date")
  // loses it, because that other word is doing the naming.
  return 0.8 * (sumWeight(matched) / sumWeight(headerTokens))
}

/** `keys` is usually one field, and more than one only when a column
 *  genuinely feeds several — a Projects sheet's Remarks is both. */
export type FieldMatch = { keys: string[]; score: number }

/**
 * The field(s) a header names, or null when nothing scores well enough or
 * two different fields score too close to call.
 */
export function matchHeaderToField(header: string, cols: Aliases, keys?: string[]): FieldMatch | null {
  const ht = tokens(header)
  if (!ht.length) return null

  const fieldKeys = keys ?? Object.keys(cols)
  const scored: { key: string; score: number; via: string }[] = []
  for (const key of fieldKeys) {
    let best = 0
    let via = ''
    for (const alias of cols[key] ?? []) {
      const s = scoreAlias(ht, alias)
      if (s > best) { best = s; via = aliasText(alias) }
    }
    if (best > 0) scored.push({ key, score: best, via })
  }
  if (!scored.length) return null

  scored.sort((x, y) => y.score - x.score)
  const top = scored[0]
  if (top.score < THRESHOLD) return null

  // Fields that tie because they list the *same* alias share the column on
  // purpose — Remarks and Notes both read a Projects sheet's Remarks — so
  // the header feeds all of them. Fields that tie through different
  // aliases are a coin toss, and the header is left unmapped instead.
  const tied = scored.filter((s) => top.score - s.score < MARGIN)
  if (tied.length > 1 && tied.some((s) => s.via !== top.via)) return null
  return { keys: tied.map((s) => s.key), score: top.score }
}

/**
 * The alias table a particular sheet should be read with: the hand-written
 * one, plus every header of *this* sheet that resolves to a field.
 *
 * Returning a table rather than a header->field map is what keeps the rest
 * of the importer unchanged — pick(), selectedFields() and the column
 * picker all read alias lists already, and now simply find the sheet's own
 * spellings in them. Additions go on the end so a hand-written alias still
 * wins when a sheet has both spellings.
 */
export function augmentAliases(
  headers: string[],
  base: Aliases,
  keys: string[],
  skip?: (header: string) => boolean,
): Aliases {
  // The '=' marker only governs scoring, which always reads `base`. What
  // comes back here is consumed by plain string comparison — pick(), and
  // the column picker's fieldsForHeader() — so it is stripped.
  const out: Aliases = {}
  for (const k of Object.keys(base)) out[k] = base[k].map(aliasText)

  const known = new Set<string>()
  for (const k of keys) for (const a of base[k] ?? []) known.add(aliasText(a))

  for (const header of headers ?? []) {
    if (skip?.(header)) continue
    const loose = normHeaderLoose(header)
    const bare = stripDupSuffix(loose)
    // Already spelled the way the table expects — nothing to add, and
    // adding it to a second field would only muddy the lookup.
    if (known.has(loose) || known.has(bare)) continue

    const m = matchHeaderToField(header, base, keys)
    if (!m) continue
    for (const key of m.keys) {
      out[key].push(loose)
      if (bare !== loose) out[key].push(bare)
    }
  }
  return out
}

/**
 * Which fields each header of this sheet ended up feeding — what the
 * import summary reports, so an auto-detected mapping is visible rather
 * than something the user discovers afterwards in the data.
 */
export function detectedMappings(
  headers: string[],
  base: Aliases,
  keys: string[],
  skip?: (header: string) => boolean,
): { header: string; keys: string[] }[] {
  const known = new Set<string>()
  for (const k of keys) for (const a of base[k] ?? []) known.add(aliasText(a))

  const out: { header: string; keys: string[] }[] = []
  for (const header of headers ?? []) {
    if (skip?.(header)) continue
    const loose = normHeaderLoose(header)
    if (known.has(loose) || known.has(stripDupSuffix(loose))) continue
    const m = matchHeaderToField(header, base, keys)
    if (m) out.push({ header, keys: m.keys })
  }
  return out
}
