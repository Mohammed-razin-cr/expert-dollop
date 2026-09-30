'use client'

import { useMemo, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Columns3, Download, Plug, Upload, Link2, Users } from 'lucide-react'
import { createClient } from '@/lib/api/client'
import { collectHeaders, columnHoldsDates, isFollowupHeader, parseFollowupHeader, parseSheetFile, parseGoogleSheetLink, parseFlexibleDate, resolveRowRange, sliceRowRange, type DateOrder } from '@/lib/sheetImport'
import { normHeaderLoose } from '@/lib/headerMatch'
import { CustomizeColumnsModal, fieldsForHeader, pickColumns, selectedFields, type Aliases, type FieldDef } from './CustomizeColumns'
import { COLS, PCOLS, LEAD_FIELDS, PROJECT_FIELDS, LEAD_KEYS, PROJECT_KEYS,
  aliasesForLeads, aliasesForProjects, describeDetected } from '@/lib/sheetFields'
import { CustomizeAssignmentModal, allocate, describePlan, type SplitPlan } from './CustomizeAssignment'
import type { Enum } from '@/lib/database.types'

const inp = 'rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300'
const outlineBtn = 'inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60'
type BD = { id: string; full_name: string }
type Course = { id: string; name: string }
type Mode = 'leads' | 'projects'

const last10 = (p: any) => String(p ?? '').replace(/\D/g, '').slice(-10)

// Real sheets often punctuate a header like a label — "Phone number:" —
// which a plain trim leaves as "phone number:", matching none of the
// alias lists below. Stripping a trailing colon (and the space it
// leaves) lines it back up with 'phone number' etc.
const normHeader = (k: string) => k.toLowerCase().trim().replace(/:+\s*$/, '')

function pick(row: any, keys: string[]): string {
  const lower: Record<string, any> = {}
  for (const k of Object.keys(row)) lower[normHeader(k)] = row[k]
  for (const k of keys) if (lower[k] != null && lower[k] !== '') return String(lower[k]).trim()
  return ''
}

// collectHeaders() trims, but a sheet's actual keys often keep trailing
// spaces — "follow up on 12 aug " is a real header from a real sheet.
// Looking a cell up by its trimmed name keeps the two lined up; a plain
// row[header] silently misses every column typed with a stray space.
function cellByHeader(row: any, header: string): string {
  const want = String(header).trim().toLowerCase()
  for (const k of Object.keys(row)) {
    if (String(k).trim().toLowerCase() === want) return String(row[k] ?? '').trim()
  }
  return ''
}

// Some real sheets type the same header twice (e.g. "Response" and
// "Status" columns each appear twice) — the parser disambiguates them
// as "response"/"response_1", "status"/"status_1" in column order.
// This returns their values in that original left-to-right order.
function colsByBase(row: any, base: string): string[] {
  const re = new RegExp(`^${base}(_\\d+)?$`, 'i')
  return Object.keys(row)
    .filter((k) => re.test(k.trim()))
    .map((k) => String(row[k] ?? '').trim())
    .filter(Boolean)
}

// ---------------------------------------------------------------- Leads mode
// leads.course_interest is `uuid references courses(id)`, so the raw text a
// sheet carries in its Course column cannot be written to it — Postgres
// rejects the row with 22P02 and the lead is lost to the failed count.
// Resolve it to a real course id instead, and import the lead without a
// course when nothing matches rather than failing the whole row.
//
// Compared on a normalised form because sheets abbreviate and punctuate
// differently: "Full Stack" for "Full Stack Dev", "AI/ML" for "AI & ML".
//
// A partial match has to be a *prefix* one, not merely a substring, and has
// to be the only course that fits. Plain substring matching read "N/A" as
// Data Analytics, because "na" happens to sit inside "dataanalytics" —
// exactly the kind of wrong-but-plausible link nobody would go looking for
// later. Requiring a shared start keeps the abbreviations that matter
// ("Python" -> Python Programming) and drops the coincidences.
const normCourse = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
function resolveCourse(goal: string, courses: Course[]): string | null {
  const v = normCourse(goal)
  if (v.length < 3) return null
  const exact = courses.find((c) => normCourse(c.name) === v)
  if (exact) return exact.id
  const near = courses.filter((c) => {
    const n = normCourse(c.name)
    return n.length >= 3 && (n.startsWith(v) || v.startsWith(n))
  })
  return near.length === 1 ? near[0].id : null
}
const SOCIAL = new Set(['dm', 'digital marketing', 'instagram', 'facebook', 'instagram ads', 'facebook ads'])
function mapSource(s: string): Enum<'lead_source'> {
  const v = (s || '').toLowerCase()
  // The sheets spell it "Just dail" as often as "Just Dial".
  if (/just\s*d[ai]{1,2}l/.test(v)) return 'just_dial'
  // Written with and without the space, and sometimes truncated. Matched
  // before the generic rules because none of them would claim it — it fell
  // through to 'website', which is what every other named source guards
  // against.
  if (/skill\s*fin/.test(v)) return 'skillfinity'
  if (SOCIAL.has(v) || v.includes('insta') || v.includes('face')) return 'social_media'
  if (v.includes('college') || v.includes('campus')) return 'college'
  if (v.includes('refer')) return 'referral'
  if (v.includes('walk')) return 'walk_in'
  return 'website'
}
// leads.cgpa is numeric(4,2): 100 or more overflows the column, and an
// overflow fails the whole insert chunk rather than the offending row.
//
// The value arrives already coerced by the spreadsheet reader, which is
// where most of the difficulty is:
//   "78%"     -> 0.78   a percentage, handed over as its fraction
//   "8.5/10"  -> 40395  read as a date, because it looks like one
//   "8.5"     -> 8.5
// So a value below 1 is a percentage being scaled back up, and anything
// three digits or more is a date serial, not a mark. Neither is worth
// guessing past: a cell that cannot be read keeps nothing, and the preview
// says so rather than importing a number nobody typed.
// "N/A", "-", "nil" are a BD saying there is no mark, not a cell we failed
// to read. Warning about them would make the warning worth ignoring.
const BLANKISH = /^(n\.?\/?a\.?|na|nil|none|null|-+|\.+)$/i
function parseCgpa(v: string): number | null {
  const m = String(v ?? '').match(/\d+(\.\d+)?/)
  if (!m) return null
  let n = Number(m[0])
  if (!Number.isFinite(n) || n < 0) return null
  if (n > 0 && n < 1) n = n * 100
  return n < 100 ? Math.round(n * 100) / 100 : null
}

// "2025", "2025-26" and "Batch 2024" all turn up under a passing-year
// header. Take the first four-digit year that could plausibly be one.
function parseYear(v: string): number | null {
  const m = String(v ?? '').match(/(19|20)\d{2}/)
  if (!m) return null
  const n = Number(m[0])
  return n >= 1950 && n <= 2099 ? n : null
}

// graduation_status is a fixed dropdown on both lead forms, so free text
// from a sheet would show as an empty select and be silently rewritten the
// next time anyone saved that lead. Map onto the four values the forms
// offer and keep nothing when the sheet says something else — a blank field
// is recoverable, a wrong one that looks deliberate is not.
//
// 'pursu' is tested before 'graduat' so "pursuing graduation" reads as
// Pursuing rather than Graduated.
const GRAD_STATUS: [RegExp, string][] = [
  [/pursu|ongoing|studying|appearing|final year|\d(st|nd|rd|th)\s*year/, 'Pursuing'],
  [/await|result|backlog/, 'Awaiting Results'],
  [/drop|discontinu/, 'Dropped'],
  [/graduat|passed|complet/, 'Graduated'],
]
function mapGradStatus(v: string): string | null {
  const t = (v || '').toLowerCase().trim()
  if (!t) return null
  for (const [re, out] of GRAD_STATUS) if (re.test(t)) return out
  return null
}

// `fallback` lets a sheet with no dedicated Stage column still get a real
// status: many working sheets only record the outcome in Remarks
// ("No Response", "Not Interested"), which otherwise left every imported
// lead stuck on the default 'new'.
// These are typed by hand into a spreadsheet, hundreds of times a week,
// and the spelling wanders: real sheets carry "interested", "intersted"
// and "intrested", plus "no response" and "no responsse". Matching the
// dictionary spelling alone left every one of those on the default 'new'.
//
// [er]{0,3} covers the transpositions around the middle of the word;
// 'no respon' stops short of the ending that gets doubled.
const INTERESTED = /int[er]{0,3}sted|interest/
const NOT_INTERESTED = /not\s*int[er]{0,3}sted|not\s*interest/
const NO_RESPONSE = /no\s*respon|not\s*reachable|not\s*responding|switched\s*off/
function mapStage(s: string, fallback = ''): Enum<'lead_status'> {
  const v = (s || fallback || '').toLowerCase()
  if (NO_RESPONSE.test(v)) return 'no_response'
  if (v.includes('contact')) return 'contacted'
  if (NOT_INTERESTED.test(v)) return 'not_interested'
  if (INTERESTED.test(v)) return 'interested'
  if (v.includes('aptitude')) return 'aptitude_shared'
  // A status the UI has always offered and the enum has always held, but
  // that nothing ever produced from a sheet — so a BD who called someone
  // and judged them irrelevant got a lead reading 'new', indistinguishable
  // from one nobody had touched. Sits with the other dead-end outcomes.
  if (v.includes('irrelevant')) return 'irrelevant'
  if (v.includes('lost')) return 'lost'
  if (v.includes('enroll')) return 'enrolled'
  return 'new'
}

// "follow up on 6th aug" names a month and day but no year. The sheet's
// own enquiry dates supply one — the calls belong to the same period as
// the enquiries they follow — falling back to this year for a sheet with
// no readable date at all.
// `cols` carries the sheet's own header spellings (see aliasesForLeads),
// so a Date column this sheet calls something else still supplies a year.
function yearHintFrom(raw: any[], order: DateOrder, cols: Aliases = COLS): number {
  for (const row of raw) {
    const d = parseFlexibleDate(pick(row, cols.date), order)
    if (d) return Number(d.slice(0, 4))
  }
  return new Date().getUTCFullYear()
}

// Outcomes that mean the lead came back to life. Only these overturn a
// "Not Interested" verdict.
const REENGAGED = new Set<string>(['interested', 'demo_scheduled', 'aptitude_shared', 'passed', 'enrolled'])

// A sheet gives two answers about a lead: the BD's summary column, which
// carries no date, and the dated call columns. Neither is reliably the
// newer one, so which wins is a policy rather than a deduction:
//
//   · A call whose text says nothing we recognise is not evidence —
//     the summary stands.
//   · "Not Interested" is a decision the lead made, not a call that went
//     unanswered, so a later "no response" doesn't undo it. Only the lead
//     re-engaging does.
//   · Otherwise the dated call is the freshest thing we have and wins —
//     which is what stops a stale "Intersted" outliving a fortnight of
//     unanswered calls.
function resolveLeadStatus(summary: Enum<'lead_status'>, latest: Enum<'lead_status'> | null): Enum<'lead_status'> {
  if (!latest || latest === 'new') return summary
  if (summary === 'not_interested' && !REENGAGED.has(latest)) return 'not_interested'
  return latest
}

async function fetchSheet(url: string): Promise<any[]> {
  const strategies = [
    (u: string) => u,
    (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  ]
  for (const s of strategies) {
    try {
      const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 8000)
      const res = await fetch(s(url), { signal: ctrl.signal }); clearTimeout(t)
      if (!res.ok) continue
      const json = JSON.parse(await res.text())
      const leads = json.leads ?? (Array.isArray(json) ? json : [])
      if (Array.isArray(leads)) return leads
    } catch { /* try next */ }
  }
  throw new Error('Could not fetch the sheet (all strategies failed). Check the Apps Script URL & deployment.')
}

// -------------------------------------------------------------- Projects mode


function mapProjectStatus(s: string): string {
  const v = (s || '').toLowerCase()
  if (v.includes('progress') || v.includes('process')) return 'in_progress'
  if (v.includes('deliver') || v.includes('complete')) return 'delivered'
  if (v.includes('order')) return 'project_ordered'
  // "on hold" has no equivalent stage anymore — treated as still being
  // talked through rather than a committed order.
  if (v.includes('discuss') || v.includes('hold')) return 'in_discussion'
  if (v.includes('declin') || v.includes('reject')) return 'declined'
  return 'new'
}

// Pairs each row the import will actually create with the BD dealt to it.
// Duplicates and invalid rows are dropped first — they create nothing, so
// counting them in the split would quietly hand every BD a smaller share
// than the numbers they typed.
//
// Keyed on the row object rather than its index: fresh rows aren't
// contiguous in the preview, and the identity is stable because both the
// preview column and the insert filter the very same `rows` array.
function dealRows(rows: any[], plan: SplitPlan | null): Map<any, string | null> {
  const fresh = rows.filter((r) => !r._dup && r._valid)
  const deal = allocate(fresh.length, plan)
  return new Map(fresh.map((r, i) => [r, deal[i]]))
}

// true when a Postgres/PostgREST error is a unique-constraint violation (duplicate contact)
const isDuplicateErr = (e: any) => {
  if (!e) return false
  const code = String(e.code ?? '')
  const msg = String(e.message ?? '') + ' ' + String(e.details ?? '') + ' ' + String(e.hint ?? '')
  return (
    code === '23505' ||                       // Postgres unique_violation
    code === '409' ||                          // PostgREST conflict
    e.status === 409 ||
    /duplicate key|unique constraint|conflict/i.test(msg)
  )
}

// ------------------------------------------------- Preview table columns
// One entry per importable field. `key` de-duplicates: Remarks is fed by
// two different leads fields but is one column in the table.
type PreviewCol = { key: string; label: string; cls?: string; title?: (r: any) => string; cell: (r: any) => ReactNode }
const dash = (v: any) => (v ? String(v) : '—')
const missingName = (r: any) => r.name || <span className="text-rose-500">missing</span>

const LEAD_REMARKS: PreviewCol = { key: 'remarks', label: 'Remarks', cls: 'max-w-[220px] truncate text-slate-500', title: (r) => r.remarks, cell: (r) => dash(r.remarks) }
const LEAD_PREVIEW: Record<string, PreviewCol> = {
  name: { key: 'name', label: 'Name', cls: 'font-medium text-slate-800', cell: missingName },
  phone: { key: 'phone', label: 'Phone', cls: 'text-slate-600', cell: (r) => dash(r.phone) },
  email: { key: 'email', label: 'Email', cls: 'text-slate-600', cell: (r) => dash(r.email) },
  college: { key: 'college', label: 'College', cls: 'text-slate-600', cell: (r) => dash(r.college) },
  source: { key: 'source', label: 'Source', cls: 'text-slate-500', cell: (r) => dash(r.source) },
  category: { key: 'category', label: 'Category', cls: 'text-slate-600', cell: (r) => dash(r.category) },
  goal: {
    key: 'goal', label: 'Course', cls: 'text-slate-600',
    title: (r) => (r.goal && !r.courseId ? `No course matches "${r.goal}" — the lead imports without one` : ''),
    cell: (r) => (r.goal && !r.courseId
      ? <span className="text-amber-600">{r.goal}</span>
      : dash(r.goal)),
  },
  placeCity: { key: 'placeCity', label: 'Place / City', cls: 'text-slate-600', cell: (r) => dash(r.placeCity) },
  currentLocation: { key: 'currentLocation', label: 'Current Location', cls: 'text-slate-600', cell: (r) => dash(r.currentLocation) },
  branch: { key: 'branch', label: 'Branch', cls: 'text-slate-600', cell: (r) => dash(r.branch) },
  degree: { key: 'degree', label: 'Degree', cls: 'text-slate-600', cell: (r) => dash(r.degree) },
  cgpa: {
    key: 'cgpa', label: 'CGPA', cls: 'text-slate-600',
    title: (r) => (r.cgpaUnreadable ? 'Could not read a CGPA from this cell — it imports empty' : ''),
    cell: (r) => (r.cgpaUnreadable ? <span className="text-amber-600">unreadable</span> : dash(r.cgpa)),
  },
  yearOfPassing: { key: 'yearOfPassing', label: 'Year of Passing', cls: 'text-slate-600', cell: (r) => dash(r.yearOfPassing) },
  dob: { key: 'dob', label: 'Date of Birth', cls: 'text-slate-500', cell: (r) => dash(r.dob) },
  graduationStatus: { key: 'graduationStatus', label: 'Graduation Status', cls: 'text-slate-600', cell: (r) => dash(r.graduationStatus) },
  plan: { key: 'plan', label: 'Plan', cls: 'text-slate-600', cell: (r) => dash(r.plan) },
  nextFollowup: { key: 'nextFollowup', label: 'Next Follow-up', cls: 'text-slate-500', cell: (r) => dash(r.nextFollowup) },
  notes: LEAD_REMARKS,
  outcome: LEAD_REMARKS,
  date: { key: 'date', label: 'Enquiry Date', cls: 'text-slate-500', cell: (r) => dash(r.enquiryDate) },
  // For a lead already here, show the move rather than just the result —
  // the import writes this, so the preview should say so before it does.
  stage: {
    key: 'stage',
    label: 'Stage',
    cls: 'text-slate-500',
    cell: (r) =>
      r._existingStatus && r._existingStatus !== r.leadStatus ? (
        <>
          <span className="text-slate-400 line-through">{String(r._existingStatus).replace('_', ' ')}</span>
          {' → '}
          <span className="font-medium text-blue-700">{r.leadStatus.replace('_', ' ')}</span>
        </>
      ) : (
        r.leadStatus.replace('_', ' ')
      ),
  },
}
// The columns an uncustomised preview shows — unchanged from before the
// picker existed, so an import nobody customised looks exactly as it did.
// 'goal' is shown by default because it is written by default: has() treats
// an unpicked field as included, so a sheet with a Course column imported it
// while the preview never mentioned it. It is also where the unmatched-course
// warning appears, which is no use in a column nobody sees.
const LEAD_PREVIEW_DEFAULT = ['name', 'phone', 'college', 'source', 'category', 'goal', 'notes', 'date', 'stage']

const PROJECT_PREVIEW: Record<string, PreviewCol> = {
  date: { key: 'date', label: 'Date', cls: 'text-slate-500', cell: (r) => dash(r.entryDate) },
  name: { key: 'name', label: 'Name', cls: 'font-medium text-slate-800', cell: missingName },
  phone: { key: 'phone', label: 'Mobile', cls: 'text-slate-600', cell: (r) => dash(r.phone) },
  college: { key: 'college', label: 'College', cls: 'text-slate-600', cell: (r) => dash(r.college) },
  department: { key: 'department', label: 'Department', cls: 'text-slate-600', cell: (r) => dash(r.department) },
  source: { key: 'source', label: 'Source', cls: 'text-slate-500', cell: (r) => dash(r.source) },
  category: { key: 'category', label: 'Category', cls: 'text-slate-600', cell: (r) => dash(r.category) },
  response: { key: 'response', label: 'Response', cls: 'text-slate-600', cell: (r) => dash(r.response) },
  remarks: { key: 'remarks', label: 'Remarks', cls: 'max-w-[220px] truncate text-slate-500', title: (r) => r.remarks, cell: (r) => dash(r.remarks) },
  notes: { key: 'notes', label: 'Notes', cls: 'max-w-[220px] truncate text-slate-500', title: (r) => r.notes, cell: (r) => dash(r.notes) },
  projectName: { key: 'projectName', label: 'Project', cls: 'text-slate-600', cell: (r) => dash(r.projectName) },
  vendorName: { key: 'vendorName', label: 'Vendor', cls: 'text-slate-600', cell: (r) => dash(r.vendorName) },
  vendorCost: { key: 'vendorCost', label: 'Vendor Cost', cls: 'text-slate-600', cell: (r) => dash(r.vendorCost) },
  companyCost: { key: 'companyCost', label: 'Company Cost', cls: 'text-slate-600', cell: (r) => dash(r.companyCost) },
  paid: { key: 'paid', label: 'Amount Paid', cls: 'text-slate-600', cell: (r) => dash(r.paid) },
  referralDeduction: { key: 'referralDeduction', label: 'Referral Deduction', cls: 'text-slate-600', cell: (r) => dash(r.referralDeduction) },
  status: { key: 'status', label: 'Project Status', cls: 'text-slate-500', cell: (r) => mapProjectStatus(r.statusRaw).replace('_', ' ') },
}
const PROJECT_PREVIEW_DEFAULT = ['date', 'name', 'phone', 'college', 'department', 'response', 'projectName', 'vendorName']

// Preview columns for the current selection, in the order the user
// arranged them; the default list when nothing was customised.
function previewColumns(
  selection: string[] | null,
  cols: Aliases,
  fields: FieldDef[],
  defs: Record<string, PreviewCol>,
  fallback: string[],
  headers: string[] = [],
): PreviewCol[] {
  // With nothing explicitly picked, has() treats every field as included —
  // so the preview has to show the ones this sheet actually carries, not a
  // fixed list. A column that is written but never shown is how the Course
  // column stayed broken without anyone seeing it. The fallback still leads,
  // so the familiar columns keep their order and the sheet's extras follow.
  const source = selection
    ? selection.flatMap((h) => fieldsForHeader(h, cols, fields))
    : [...fallback, ...headers.flatMap((h) => fieldsForHeader(h, cols, fields))]
  const out: PreviewCol[] = []
  const seen = new Set<string>()
  for (const field of source) {
    const def = defs[field]
    if (!def || seen.has(def.key)) continue
    seen.add(def.key)
    out.push(def)
  }
  return out
}

export function GSheetSyncClient({ initialUrl, bds, courses, role, myId }: { initialUrl: string; bds: BD[]; courses: Course[]; role: string; myId: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [mode, setMode] = useState<Mode>('leads')

  // ---- Leads mode state ----
  const [url, setUrl] = useState(initialUrl)
  const [rows, setRows] = useState<any[]>([])
  const [assign, setAssign] = useState('none')
  const [specificBd, setSpecificBd] = useState(bds[0]?.id ?? '')
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Excel/CSV upload and Google Sheets link — the same two extra import
  // methods Projects mode already has, alongside the existing Apps Script URL.
  const lFileRef = useRef<HTMLInputElement>(null)
  const [lSheetLink, setLSheetLink] = useState('')
  const [lRaw, setLRaw] = useState<any[]>([])
  const [lDateOrder, setLDateOrder] = useState<DateOrder>('dmy')
  // Custom column mapping. `null` = never customised, so the import reads
  // every supported column exactly as it always has. State only, so a
  // page refresh clears it.
  const [lHeaders, setLHeaders] = useState<string[]>([])
  const [lSel, setLSel] = useState<string[] | null>(null)
  // Which BDs share this import and how much each takes. `null` = the
  // Assign BD dropdown is on something other than Split.
  const [lPlan, setLPlan] = useState<SplitPlan | null>(null)
  // The slice of the sheet to work on — blank ends mean the whole thing.
  const [lFrom, setLFrom] = useState('')
  const [lTo, setLTo] = useState('')

  // ---- Projects mode state ----
  const fileRef = useRef<HTMLInputElement>(null)
  const [sheetLink, setSheetLink] = useState('')
  const [pRows, setPRows] = useState<any[]>([])
  const [pRaw, setPRaw] = useState<any[]>([])
  const [pAssign, setPAssign] = useState('none')
  const [pSpecificBd, setPSpecificBd] = useState(bds[0]?.id ?? '')
  const [pStatus, setPStatus] = useState<string | null>(null)
  const [pBusy, setPBusy] = useState(false)
  const [dateOrder, setDateOrder] = useState<DateOrder>('dmy')
  const [pHeaders, setPHeaders] = useState<string[]>([])
  const [pSel, setPSel] = useState<string[] | null>(null)
  const [pPlan, setPPlan] = useState<SplitPlan | null>(null)
  const [pFrom, setPFrom] = useState('')
  const [pTo, setPTo] = useState('')

  // Which mode's column picker is open, if any.
  const [picker, setPicker] = useState<Mode | null>(null)
  // …and which mode's BD split picker.
  const [splitFor, setSplitFor] = useState<Mode | null>(null)

  // The range a preview was actually run with, so re-running it on blur
  // only costs a round trip when the numbers really changed.
  const appliedRange = useRef({ leads: '|', projects: '|' })

  // What a split is dividing: the rows that will really be created, which
  // is what the modal counts and what the deal below is cut from.
  const freshLeads = rows.filter((r) => !r._dup && r._valid).length
  const freshProjects = pRows.filter((r) => !r._dup && r._valid).length

  // Worked out once per preview so the "Assign to" column and the insert
  // are reading the same deal rather than each dealing their own.
  const leadDeal = useMemo(() => dealRows(rows, assign === 'split' ? lPlan : null), [rows, assign, lPlan])
  const projectDeal = useMemo(() => dealRows(pRows, pAssign === 'split' ? pPlan : null), [pRows, pAssign, pPlan])
  const bdName = (id: string | null | undefined) => bds.find((b) => b.id === id)?.full_name ?? null

  // Choosing Split has to mean something on its own: an even share between
  // every BD until the picker says otherwise. Without this, picking the
  // option and importing straight away would leave a plan of null and
  // quietly import the whole sheet unassigned.
  const defaultPlan = (): SplitPlan => ({ mode: 'equal', entries: bds.map((b) => ({ bdId: b.id, share: 0 })) })
  function chooseAssign(which: Mode, next: string) {
    if (which === 'leads') { setAssign(next); if (next === 'split' && !lPlan && bds.length) setLPlan(defaultPlan()) }
    else { setPAssign(next); if (next === 'split' && !pPlan && bds.length) setPPlan(defaultPlan()) }
  }
  function openSplit(which: Mode) {
    if (which === 'leads' && !lPlan) setLPlan(defaultPlan())
    if (which === 'projects' && !pPlan) setPPlan(defaultPlan())
    setSplitFor(which)
  }

  // Re-previews the current sheet under a changed row range. Guarded on
  // the range actually having moved, so tabbing through the two boxes
  // doesn't refetch the existing-contacts list twice for nothing.
  function applyLeadRange(from: string, to: string) {
    if (!lRaw.length || appliedRange.current.leads === `${from}|${to}`) return
    previewLeadsFromRaw(lRaw, lDateOrder, lSel, from, to)
  }
  function applyProjectRange(from: string, to: string) {
    if (!pRaw.length || appliedRange.current.projects === `${from}|${to}`) return
    previewProjectsFromRaw(pRaw, dateOrder, pSel, from, to)
  }

  // Shared by all three Leads input methods (Apps Script URL, Excel/CSV
  // upload, Google Sheets link) so duplicate-checking and column mapping
  // stay identical no matter which one was used.
  async function previewLeadsFromRaw(
    raw: any[],
    order: DateOrder = lDateOrder,
    sel: string[] | null = lSel,
    from: string = lFrom,
    to: string = lTo,
  ) {
    setLRaw(raw)
    appliedRange.current.leads = `${from}|${to}`
    // Headers come from the whole sheet, not the slice: a column the
    // chosen rows all left blank is still one of the sheet's columns, and
    // the picker offering a different list per batch would be baffling.
    const headers = collectHeaders(raw)
    setLHeaders(headers)

    // Read this sheet with its own wording folded into the alias table.
    const cols = aliasesForLeads(headers, order)
    const detected = describeDetected(headers, COLS, LEAD_KEYS, LEAD_FIELDS, (h) => isFollowupHeader(h, order))

    // A column headed "Date" whose cells hold outcomes rather than dates is
    // a follow-up log written down the column instead of across the row.
    // Read as the enquiry date it would blank the field and lose the text,
    // so it is taken out of the date lookup and answered as follow-ups
    // below — dated by the enquiry the calls belong to.
    const textDateHeaders = headers.filter(
      (h) => fieldsForHeader(h, cols, LEAD_FIELDS).includes('date') && !columnHoldsDates(raw, h, order),
    )
    if (textDateHeaders.length) {
      const drop = new Set(textDateHeaders.map(normHeaderLoose))
      cols.date = cols.date.filter((a) => !drop.has(a))
    }

    // A selection made for one sheet can't be trusted on a different one:
    // if a chosen column is missing here, its field would silently come
    // through empty — including Name or Phone, which every row is judged
    // on. Fall back to importing everything and say so.
    const stale = !!sel && !sel.every((h) => headers.includes(h))
    if (stale) { sel = null; setLSel(null) }

    // `id` and `status` as well as `mobile`: a duplicate row still carries
    // follow-up columns that belong on the lead already here, and its
    // status may have moved on since that lead was first imported.
    // `assigned_bd` too: a BD importing a sheet must not write follow-ups
    // onto a lead that belongs to someone else (see importFollowups).
    const { data: existing = [] } = await supabase.from('leads').select('id, mobile, status, assigned_bd').is('deleted_at', null).limit(10000)
    const seen = new Map<string, { id: string; status: string; bd: string | null }>()
    for (const l of existing ?? []) {
      const k = last10((l as any).mobile)
      if (k && !seen.has(k)) seen.set(k, { id: (l as any).id, status: (l as any).status, bd: (l as any).assigned_bd ?? null })
    }

    const yearHint = yearHintFrom(raw, order, cols)

    // One column per call, either headed by the date itself or named for
    // it. Ordered oldest to newest so "the latest outcome" below is
    // simply the last one.
    const fuHeaders = headers
      .map((h) => ({ header: h, date: parseFollowupHeader(h, order, yearHint) }))
      .filter((f) => f.date)
      .sort((a, b) => a.date.localeCompare(b.date))

    // Only the rows this batch covers. Duplicate detection runs over the
    // slice rather than the sheet, which is the point: rows 1–50 being
    // repeated further down the sheet is not this batch's problem.
    const inRange = sliceRowRange(raw, from, to)
    const bounds = resolveRowRange(raw.length, from, to)

    const local = new Set<string>()
    const mapped = inRange.map((row) => {
      // Narrowing the row here is all it takes for a custom selection to
      // reach every step below — mapping, validation and duplicate
      // detection each just stop finding the columns that were left out.
      const r = sel ? pickColumns(row, sel) : row
      const phone = pick(r, cols.phone); const p10 = last10(phone)
      const dup = (!!p10 && (seen.has(p10) || local.has(p10)))
      const hit = p10 ? seen.get(p10) ?? null : null
      if (p10) local.add(p10)

      const enquiryDate = parseFlexibleDate(pick(r, cols.date), order)
      const goalText = pick(r, cols.goal)
      // Outcomes logged under a "Date" header carry no date of their own,
      // so they are dated by the enquiry they belong to. With no enquiry
      // date to hang them on they are left to remarks below rather than
      // dropped — followups.scheduled_at cannot be null.
      const undated = textDateHeaders.map((h) => cellByHeader(r, h)).filter(Boolean)
      // Every follow-up column this row actually filled in, oldest first.
      const followups = [
        ...fuHeaders.map((f) => ({ date: f.date, outcome: cellByHeader(r, f.header) })),
        ...(enquiryDate ? undated.map((outcome) => ({ date: enquiryDate, outcome })) : []),
      ]
        .filter((f) => f.outcome)
        .sort((a, b) => a.date.localeCompare(b.date))
      // Remarks and the misspelled 'catagore' column both carry the same
      // kind of outcome text ("No response", "Interested") — combine them
      // so nothing is missed regardless of which one a BD actually filled
      // in, and so the derived status below sees both.
      const remarks = [pick(r, cols.notes), pick(r, cols.outcome), ...(enquiryDate ? [] : undated)]
        .filter(Boolean)
        .join('; ')
      return {
        name: pick(r, cols.name), phone, email: pick(r, cols.email), college: pick(r, cols.college),
        // Was reading r.category directly — a raw, case-sensitive key that
        // never matched a real header actually typed "Category". pick()
        // is what cols.category's alias list is for; every other field
        // here already went through it correctly.
        source: pick(r, cols.source), category: pick(r, cols.category), goal: goalText,
        // Resolved here, not at insert time, for the same reason leadStatus
        // is: the preview has to show what the import will actually write.
        courseId: resolveCourse(goalText, courses),
        // Coerced here rather than at insert time so the preview shows the
        // value that will actually be written — a CGPA the column cannot
        // hold reads as blank in the preview, not as the sheet's text.
        placeCity: pick(r, cols.placeCity), currentLocation: pick(r, cols.currentLocation),
        branch: pick(r, cols.branch), degree: pick(r, cols.degree),
        // Computed alongside the value so the preview can tell a deliberate
        // blank apart from a cell whose contents were lost.
        cgpaUnreadable: (() => {
          const raw = pick(r, cols.cgpa).trim()
          return !!raw && !BLANKISH.test(raw) && parseCgpa(raw) == null
        })(),
        cgpa: parseCgpa(pick(r, cols.cgpa)),
        yearOfPassing: parseYear(pick(r, cols.yearOfPassing)),
        dob: parseFlexibleDate(pick(r, cols.dob), order) || null,
        graduationStatus: mapGradStatus(pick(r, cols.graduationStatus)),
        plan: pick(r, cols.plan),
        nextFollowup: parseFlexibleDate(pick(r, cols.nextFollowup), order) || null,
        remarks,
        // Computed once here so the preview table and the actual import
        // always agree on what status a row will get.
        //
        // See resolveLeadStatus: the dated calls generally win over the
        // undated summary, with "Not Interested" the standing exception.
        // With no follow-up columns this is exactly the old behaviour.
        leadStatus: resolveLeadStatus(
          mapStage(pick(r, cols.stage), remarks),
          followups.length ? mapStage(followups[followups.length - 1].outcome) : null,
        ),
        enquiryDate,
        followups,
        _dup: dup, _valid: !!pick(r, cols.name) && !!p10,
        _existingId: hit?.id ?? null, _existingStatus: hit?.status ?? null, _existingBd: hit?.bd ?? null,
      }
    })
    setRows(mapped)
    const fuTotal = mapped.reduce((n, m) => n + m.followups.length, 0)
    const parts = [
      `${mapped.filter((m) => !m._dup && m._valid).length} new`,
      `${mapped.filter((m) => m._dup).length} duplicate`,
      `${mapped.length} total`,
    ]
    // Said first, because every other figure here counts only the slice —
    // "12 total" from a 5,000-row sheet otherwise looks like a failure.
    if (bounds) parts.unshift(`rows ${bounds.start}–${bounds.end} of ${raw.length}`)
    if (fuHeaders.length) parts.push(`${fuTotal} follow-up${fuTotal === 1 ? '' : 's'} across ${fuHeaders.length} dated column${fuHeaders.length === 1 ? '' : 's'}`)
    const willChange = mapped.filter((m) => m._valid && m._existingId && m._existingStatus && m.leadStatus !== m._existingStatus).length
    if (willChange) parts.push(`${willChange} existing status${willChange === 1 ? '' : 'es'} will change`)
    const counts = [parts.join(' · '), detected].filter(Boolean).join(' — ')
    setStatus(stale ? `${counts} — this sheet has different columns, so the saved column selection was cleared.` : counts)
  }

  async function preview() {
    setBusy(true); setStatus('Fetching sheet…')
    try {
      const raw = await fetchSheet(url)
      await previewLeadsFromRaw(raw)
    } catch (e: any) { setStatus(e.message) }
    setBusy(false)
  }

  // Shared by "Preview File" and "Customize Columns" so both read the
  // chosen file the same way.
  function leadFileRows() {
    const file = lFileRef.current?.files?.[0]
    if (!file) throw new Error('Choose a file first.')
    return parseSheetFile(file)
  }

  async function previewLeadsFile() {
    if (!lFileRef.current?.files?.[0]) return setStatus('Choose a file first.')
    setBusy(true); setStatus('Reading file…')
    try {
      const raw = await leadFileRows()
      await previewLeadsFromRaw(raw)
    } catch (e: any) { setStatus(e.message) }
    setBusy(false)
  }

  async function previewLeadsLink() {
    if (!lSheetLink) return setStatus('Paste a Google Sheets link first.')
    setBusy(true); setStatus('Fetching sheet…')
    try {
      const raw = await parseGoogleSheetLink(lSheetLink)
      await previewLeadsFromRaw(raw)
    } catch (e: any) { setStatus(e.message) }
    setBusy(false)
  }

  // Reads the chosen source's real headers before opening the picker, so
  // the list offered is what the sheet actually has rather than a guess.
  async function openLeadColumns(load: () => Promise<any[]>) {
    setBusy(true); setStatus('Reading columns…')
    try {
      const raw = await load()
      if (!raw.length) throw new Error('No rows found — nothing to map.')
      setLRaw(raw)
      setLHeaders(collectHeaders(raw))
      setStatus(null)
      setPicker('leads')
    } catch (e: any) { setStatus(e.message) }
    setBusy(false)
  }

  function saveLeadColumns(next: string[] | null) {
    setLSel(next)
    setPicker(null)
    if (lRaw.length) previewLeadsFromRaw(lRaw, lDateOrder, next)
  }

  async function importNew() {
    const fresh = rows.filter((r) => !r._dup && r._valid)
    // A duplicate row brings no new lead but may bring new follow-ups, and
    // those belong on the lead already here — so a sheet of nothing but
    // known contacts is still worth importing.
    const dupWithFollowups = rows.filter((r) => r._dup && r._existingId && r.followups.length)
    if (!fresh.length && !dupWithFollowups.length) return setStatus('Nothing new to import.')
    setBusy(true); setStatus(`Importing ${fresh.length}…`)

    // A field left out of the picker is left out of the insert entirely,
    // rather than written as null — that way the table's own defaults
    // (source 'website', status 'new') still apply.
    const on = lSel ? selectedFields(lSel, lAliases, LEAD_FIELDS) : null
    const has = (f: string) => !on || on.has(f)

    let rr = 0
    // Who each row was assigned to, so its follow-ups carry the same BD.
    const bdByPhone = new Map<string, string | null>()
    const toInsert = fresh.map((r) => {
      let bd: string | null = null
      if ((role === 'bd' || role === 'counsellor')) bd = myId
      else if (assign === 'specific') bd = specificBd || null
      // Already dealt, above — reading it back here is what keeps the
      // preview's "Assign to" column honest about where each row went.
      else if (assign === 'split') bd = leadDeal.get(r) ?? null
      else if (assign === 'round_robin' && bds.length) { bd = bds[rr % bds.length].id; rr++ }
      const k = last10(r.phone)
      if (k) bdByPhone.set(k, bd)
      return {
        name: r.name, mobile: r.phone,
        ...(has('email') && { email: r.email || null }),
        ...(has('college') && { college: r.college || null }),
        ...(has('source') && { source: mapSource(r.source), source_detail: r.source || null }),
        ...(has('goal') && { course_interest: r.courseId }),
        ...(has('category') && { category: r.category || null }),
        ...((has('stage') || has('notes') || has('outcome')) && { status: r.leadStatus }),
        ...((has('notes') || has('outcome')) && { remarks: r.remarks || null }),
        ...(has('date') && { enquiry_date: r.enquiryDate || null }),
        ...(has('placeCity') && { place_city: r.placeCity || null }),
        ...(has('currentLocation') && { current_location: r.currentLocation || null }),
        ...(has('branch') && { branch: r.branch || null }),
        ...(has('degree') && { degree: r.degree || null }),
        ...(has('cgpa') && { cgpa: r.cgpa }),
        ...(has('yearOfPassing') && { year_of_passing: r.yearOfPassing }),
        ...(has('dob') && { dob: r.dob }),
        ...(has('graduationStatus') && { graduation_status: r.graduationStatus }),
        ...(has('plan') && { plan: r.plan || null }),
        ...(has('nextFollowup') && { next_followup_at: r.nextFollowup }),
        assigned_bd: bd, temperature: 'Cold',
      }
    })

    // Insert in small chunks. If a chunk hits a duplicate-contact constraint,
    // fall back to row-by-row so we skip only the offending rows and keep going.
    const CHUNK = 25
    let imported = 0
    let skipped = 0
    let failed = 0
    // Filled from what the insert returns, so follow-ups can be hung off
    // the rows we just created.
    const idByPhone = new Map<string, string>()
    const remember = (recs: any[] | null) => {
      for (const l of recs ?? []) {
        const k = last10(l.mobile)
        if (k) idByPhone.set(k, l.id)
      }
    }

    for (let i = 0; i < toInsert.length; i += CHUNK) {
      const chunk = toInsert.slice(i, i + CHUNK)
      const { data, error } = await supabase.from('leads').insert(chunk).select('id, mobile')
      if (!error) { remember(data); imported += chunk.length; setStatus(`Importing… ${imported}/${toInsert.length}`); continue }

      if (isDuplicateErr(error)) {
        // one or more rows in this chunk are duplicates — retry individually
        for (const row of chunk) {
          const { data: one, error: e2 } = await supabase.from('leads').insert(row).select('id, mobile')
          if (!e2) { remember(one); imported++ }
          else if (isDuplicateErr(e2)) skipped++
          else failed++
        }
        setStatus(`Importing… ${imported}/${toInsert.length}`)
      } else {
        // a non-duplicate error (bad column, RLS, etc.) — stop and report it
        setBusy(false)
        return setStatus(`Import stopped: ${error.message} (imported ${imported} before the error)`)
      }
    }

    const fu = await importFollowups(idByPhone, bdByPhone)
    const st = await updateExistingStatuses()

    setBusy(false)
    // Spelled out because "skipped 759 duplicates" reads as "nothing
    // happened for those rows" — when in fact their follow-ups were the
    // whole point of re-importing the sheet.
    const parts = [`✓ ${imported} new lead${imported === 1 ? '' : 's'}`]
    if (skipped) parts.push(`${skipped} already existed`)
    if (failed) parts.push(`${failed} failed`)
    if (fu.added) {
      parts.push(
        fu.onExisting
          ? `${fu.added} follow-ups added (${fu.onExisting} onto leads already here)`
          : `${fu.added} follow-ups added`,
      )
    }
    if (fu.alreadyThere) parts.push(`${fu.alreadyThere} follow-up${fu.alreadyThere === 1 ? '' : 's'} already recorded`)
    if (fu.orphaned) parts.push(`${fu.orphaned} follow-ups had no lead to attach to`)
    if (fu.otherBd) parts.push(`${fu.otherBd} follow-up${fu.otherBd === 1 ? '' : 's'} not added (lead belongs to another BD)`)
    if (fu.failed) parts.push(`${fu.failed} follow-ups failed`)
    if (st.updated) parts.push(`${st.updated} status${st.updated === 1 ? '' : 'es'} updated`)
    // Named rather than swallowed: RLS lets a BD update only their own
    // leads, and an UPDATE that matches nothing is not an error — so
    // without this the rest would look like they simply had nothing to change.
    if (st.blocked) parts.push(`${st.blocked} not updated (assigned to another BD)`)
    setStatus(parts.join(' · '))
    setRows([]); router.refresh()
  }

  // Brings leads that are already here in line with what the sheet now
  // says. Only `status` is written, and only where it actually differs.
  async function updateExistingStatuses(): Promise<{ updated: number; blocked: number }> {
    const changed = rows.filter(
      (r) => r._valid && r._existingId && r._existingStatus && r.leadStatus !== r._existingStatus,
    )
    if (!changed.length) return { updated: 0, blocked: 0 }

    setStatus(`Updating ${changed.length} lead statuses…`)

    // Grouped by target status so this is a handful of requests rather
    // than one per lead.
    const byStatus = new Map<Enum<'lead_status'>, string[]>()
    for (const r of changed) {
      const list = byStatus.get(r.leadStatus) ?? []
      list.push(r._existingId)
      byStatus.set(r.leadStatus, list)
    }

    let updated = 0
    const CHUNK = 100
    for (const [status, ids] of byStatus) {
      for (let i = 0; i < ids.length; i += CHUNK) {
        const slice = ids.slice(i, i + CHUNK)
        // `.select()` returns the rows that actually changed — the count
        // RLS allowed through, which is what makes the blocked figure real
        // rather than assumed.
        const { data, error } = await supabase
          .from('leads')
          .update({ status })
          .in('id', slice)
          .select('id')
        if (!error) updated += (data ?? []).length
      }
    }
    return { updated, blocked: changed.length - updated }
  }

  // Turns the sheet's wide follow-up log into `followups` rows: one per
  // filled dated cell, dated by the column header.
  //
  // Re-importing the same sheet is normal here — it grows a column every
  // time the team calls — so anything already recorded against that lead
  // on that date is skipped rather than added twice.
  async function importFollowups(
    idByPhone: Map<string, string>,
    bdByPhone: Map<string, string | null>,
  ): Promise<{ added: number; onExisting: number; alreadyThere: number; failed: number; orphaned: number; otherBd: number }> {
    const pending: { leadId: string; date: string; outcome: string; bd: string | null; existing: boolean }[] = []
    // Rows whose follow-ups have nowhere to go — no phone, so no lead was
    // created and none could be matched. Counted rather than dropped
    // quietly, since the row's calls are simply lost.
    let orphaned = 0
    // A BD's sheet can hold contacts that are another BD's leads. Those
    // calls aren't this BD's to log on that lead — the lead would show
    // history its owner never made — so they're counted and left out.
    let otherBd = 0
    const isBdRole = role === 'bd' || role === 'counsellor'
    // One follow-up per lead per day: the same phone on two sheet rows, or
    // two columns with the same date, would otherwise insert both — the
    // check against the database below only sees what's already saved.
    const queued = new Set<string>()
    let repeated = 0
    for (const r of rows) {
      if (!r.followups?.length) continue
      if (isBdRole && r._existingId && r._existingBd !== myId) { otherBd += r.followups.length; continue }
      const p10 = last10(r.phone)
      const leadId = r._existingId ?? (p10 ? idByPhone.get(p10) : null)
      if (!leadId) { orphaned += r.followups.length; continue }
      const bd = (p10 ? bdByPhone.get(p10) : null) ?? (isBdRole ? myId : null)
      for (const f of r.followups) {
        const key = `${leadId}|${f.date}`
        if (queued.has(key)) { repeated++; continue }
        queued.add(key)
        pending.push({ leadId, date: f.date, outcome: f.outcome, bd, existing: !!r._existingId })
      }
    }
    if (!pending.length) return { added: 0, onExisting: 0, alreadyThere: repeated, failed: 0, orphaned, otherBd }

    setStatus(`Importing ${pending.length} follow-ups…`)

    const leadIds = [...new Set(pending.map((p) => p.leadId))]
    const already = new Set<string>()
    const ID_CHUNK = 100
    for (let i = 0; i < leadIds.length; i += ID_CHUNK) {
      const { data } = await supabase
        .from('followups')
        .select('lead_id, scheduled_at')
        .in('lead_id', leadIds.slice(i, i + ID_CHUNK))
        .is('deleted_at', null)
      for (const f of data ?? []) already.add(`${(f as any).lead_id}|${String((f as any).scheduled_at).slice(0, 10)}`)
    }

    const toInsert = pending.filter((p) => !already.has(`${p.leadId}|${p.date}`))
    const alreadyThere = pending.length - toInsert.length + repeated

    let added = 0
    let onExisting = 0
    let failed = 0
    const CHUNK = 50
    for (let i = 0; i < toInsert.length; i += CHUNK) {
      const slice = toInsert.slice(i, i + CHUNK)
      const sliceOnExisting = slice.filter((p) => p.existing).length
      const chunk = slice.map((p) => ({
        lead_id: p.leadId,
        bd_id: p.bd,
        // The sheet logs calls; the date column is the day it was made.
        type: 'Call',
        outcome: p.outcome,
        scheduled_at: `${p.date}T00:00:00Z`,
        // These are calls that already happened, not ones to make.
        status: 'done' as const,
      }))
      const { error } = await supabase.from('followups').insert(chunk)
      if (error) failed += chunk.length
      else {
        added += chunk.length
        onExisting += sliceOnExisting
        setStatus(`Importing follow-ups… ${added}/${toInsert.length}`)
      }
    }
    return { added, onExisting, alreadyThere, failed, orphaned, otherBd }
  }

  // ------------------------------------------------------------ Projects mode
  async function previewProjectsFromRaw(
    raw: any[],
    order: DateOrder = dateOrder,
    sel: string[] | null = pSel,
    from: string = pFrom,
    to: string = pTo,
  ) {
    setPRaw(raw)
    appliedRange.current.projects = `${from}|${to}`
    const headers = collectHeaders(raw)
    setPHeaders(headers)

    // Read this sheet with its own wording folded into the alias table.
    const cols = aliasesForProjects(headers)
    const detected = describeDetected(headers, PCOLS, PROJECT_KEYS, PROJECT_FIELDS)

    const stale = !!sel && !sel.every((h) => headers.includes(h))
    if (stale) { sel = null; setPSel(null) }

    const { data: existing = [] } = await supabase.from('projects').select('mobile').is('deleted_at', null).limit(10000)
    const seen = new Set((existing ?? []).map((p: any) => last10(p.mobile)).filter(Boolean))
    // A contact already in Leads belongs to that lead's BD — importing it
    // here would give them a second record under whoever ran the import.
    // Keyed to the lead's BD name (or '' when unassigned) so the preview
    // can say whose it is.
    const { data: leadRows = [] } = await supabase.from('leads').select('mobile, bd:assigned_bd(full_name)').is('deleted_at', null).limit(10000)
    const asLead = new Map<string, string>()
    for (const l of leadRows ?? []) {
      const k = last10((l as any).mobile)
      if (k && !asLead.has(k)) asLead.set(k, (l as any).bd?.full_name ?? '')
    }
    const inRange = sliceRowRange(raw, from, to)
    const bounds = resolveRowRange(raw.length, from, to)
    const local = new Set<string>()
    const mapped = inRange.map((row) => {
      const r = sel ? pickColumns(row, sel) : row
      const phone = pick(r, cols.phone); const p10 = last10(phone)
      const leadBd = p10 ? asLead.get(p10) : undefined
      const dup = (!!p10 && (seen.has(p10) || local.has(p10) || leadBd !== undefined))
      if (p10) local.add(p10)

      // Some sheets type "Response" and "Status" headers twice — the
      // first Response is the qualification, the second is a follow-up
      // note; the first Status is a pipeline stage, the second (or only,
      // if there's just one) is the actual outcome.
      const responseCols = colsByBase(r, 'response')
      const statusCols = colsByBase(r, 'status')
      const response = responseCols[0] || pick(r, cols.response)
      const stageNote = statusCols.length > 1 ? statusCols[0] : ''
      const statusRaw = statusCols.length > 1 ? statusCols[statusCols.length - 1] : (statusCols[0] || pick(r, cols.status))
      const extraNotes = [stageNote && `Stage: ${stageNote}`, responseCols[1], pick(r, cols.notes)].filter(Boolean).join('; ')

      return {
        entryDate: parseFlexibleDate(pick(r, cols.date), order), source: pick(r, cols.source), category: pick(r, cols.category),
        name: pick(r, cols.name), phone, department: pick(r, cols.department), college: pick(r, cols.college),
        response, remarks: pick(r, cols.remarks),
        vendorName: pick(r, cols.vendorName), vendorCost: pick(r, cols.vendorCost), companyCost: pick(r, cols.companyCost),
        paid: pick(r, cols.paid), referralDeduction: pick(r, cols.referralDeduction),
        statusRaw, projectName: pick(r, cols.projectName), notes: extraNotes,
        _dup: dup, _valid: !!pick(r, cols.name),
        // Set only when the match is in Leads rather than Projects.
        _leadBd: leadBd ?? null,
      }
    })
    setPRows(mapped)
    const inLeads = mapped.filter((m) => m._leadBd !== null).length
    const counts = [
      // Said first, because every other figure counts only the slice.
      ...(bounds ? [`rows ${bounds.start}–${bounds.end} of ${raw.length}`] : []),
      `${mapped.filter((m) => !m._dup && m._valid).length} new`,
      `${mapped.filter((m) => m._dup && m._leadBd === null).length} duplicate`,
      ...(inLeads ? [`${inLeads} already in Leads`] : []),
      `${mapped.length} total`,
    ].join(' · ')
    const withDetected = [counts, detected].filter(Boolean).join(' — ')
    setPStatus(stale ? `${withDetected} — this sheet has different columns, so the saved column selection was cleared.` : withDetected)
  }

  function projectFileRows() {
    const file = fileRef.current?.files?.[0]
    if (!file) throw new Error('Choose a file first.')
    return parseSheetFile(file)
  }

  async function previewProjectsFile() {
    if (!fileRef.current?.files?.[0]) return setPStatus('Choose a file first.')
    setPBusy(true); setPStatus('Reading file…')
    try {
      const raw = await projectFileRows()
      await previewProjectsFromRaw(raw)
    } catch (e: any) { setPStatus(e.message) }
    setPBusy(false)
  }

  async function previewProjectsLink() {
    if (!sheetLink) return setPStatus('Paste a Google Sheets link first.')
    setPBusy(true); setPStatus('Fetching sheet…')
    try {
      const raw = await parseGoogleSheetLink(sheetLink)
      await previewProjectsFromRaw(raw)
    } catch (e: any) { setPStatus(e.message) }
    setPBusy(false)
  }

  async function openProjectColumns(load: () => Promise<any[]>) {
    setPBusy(true); setPStatus('Reading columns…')
    try {
      const raw = await load()
      if (!raw.length) throw new Error('No rows found — nothing to map.')
      setPRaw(raw)
      setPHeaders(collectHeaders(raw))
      setPStatus(null)
      setPicker('projects')
    } catch (e: any) { setPStatus(e.message) }
    setPBusy(false)
  }

  function saveProjectColumns(next: string[] | null) {
    setPSel(next)
    setPicker(null)
    if (pRaw.length) previewProjectsFromRaw(pRaw, dateOrder, next)
  }

  async function importProjects() {
    const fresh = pRows.filter((r) => !r._dup && r._valid)
    if (!fresh.length) return setPStatus('Nothing new to import.')
    setPBusy(true); setPStatus(`Importing ${fresh.length}…`)

    const on = pSel ? selectedFields(pSel, pAliases, PROJECT_FIELDS) : null
    const has = (f: string) => !on || on.has(f)

    let rr = 0
    const toInsert = fresh.map((r) => {
      let owner: string | null = null
      if ((role === 'bd' || role === 'counsellor')) owner = myId
      else if (pAssign === 'specific') owner = pSpecificBd || null
      else if (pAssign === 'split') owner = projectDeal.get(r) ?? null
      else if (pAssign === 'round_robin' && bds.length) { owner = bds[rr % bds.length].id; rr++ }
      return {
        name: r.name,
        mobile: r.phone || null,
        ...(has('date') && { entry_date: r.entryDate || null }),
        ...(has('source') && { source: r.source || null }),
        ...(has('category') && { category: r.category || null }),
        ...(has('department') && { department: r.department || null }),
        ...(has('college') && { college: r.college || null }),
        ...(has('response') && { response: r.response || null }),
        ...(has('remarks') && { remarks: r.remarks || null }),
        ...(has('vendorName') && { vendor_name: r.vendorName || null }),
        ...(has('vendorCost') && { vendor_cost: r.vendorCost ? Number(r.vendorCost) : null }),
        ...(has('companyCost') && { company_cost: r.companyCost ? Number(r.companyCost) : null }),
        ...(has('paid') && { amount_paid: r.paid ? Number(r.paid) : null }),
        ...(has('referralDeduction') && { referral_deduction: r.referralDeduction ? Number(r.referralDeduction) : null }),
        ...(has('status') && { status: mapProjectStatus(r.statusRaw) }),
        ...(has('projectName') && { project_name: r.projectName || null }),
        // Notes are stitched together from the Notes, Status and Response
        // columns, so any one of them being kept is reason to write it.
        ...((has('notes') || has('status') || has('response')) && { notes: r.notes || null }),
        owner_id: owner,
      }
    })

    const CHUNK = 25
    let imported = 0
    let skipped = 0
    let failed = 0

    for (let i = 0; i < toInsert.length; i += CHUNK) {
      const chunk = toInsert.slice(i, i + CHUNK)
      const { error } = await supabase.from('projects').insert(chunk)
      if (!error) { imported += chunk.length; setPStatus(`Importing… ${imported}/${toInsert.length}`); continue }

      if (isDuplicateErr(error)) {
        for (const row of chunk) {
          const { error: e2 } = await supabase.from('projects').insert(row)
          if (!e2) imported++
          else if (isDuplicateErr(e2)) skipped++
          else failed++
        }
        setPStatus(`Importing… ${imported}/${toInsert.length}`)
      } else {
        setPBusy(false)
        return setPStatus(`Import stopped: ${error.message} (imported ${imported} before the error)`)
      }
    }

    setPBusy(false)
    const parts = [`✓ Imported ${imported}`]
    if (skipped) parts.push(`skipped ${skipped} duplicate${skipped === 1 ? '' : 's'}`)
    if (failed) parts.push(`${failed} failed`)
    setPStatus(parts.join(' · '))
    setPRows([]); router.refresh()
  }

  // The same widened tables the previews were built with, rebuilt from the
  // headers in state. The column picker and the preview headings have to
  // agree with the mapping about which field a header feeds, or a
  // auto-detected column would import while showing as unsupported.
  const lAliases = useMemo(() => aliasesForLeads(lHeaders, lDateOrder), [lHeaders, lDateOrder])
  const pAliases = useMemo(() => aliasesForProjects(pHeaders), [pHeaders])

  // Preview headings follow the picked columns, in the picked order.
  const leadCols = previewColumns(lSel, lAliases, LEAD_FIELDS, LEAD_PREVIEW, LEAD_PREVIEW_DEFAULT, lHeaders)
  // Only worth a column when the sheet actually keeps a follow-up log.
  const anyFollowups = rows.some((r) => r.followups?.length)
  // Same year the preview used, so the picker labels a follow-up column
  // with the date it will actually be imported under.
  const lYearHint = yearHintFrom(lRaw, lDateOrder, lAliases)
  const projectCols = previewColumns(pSel, pAliases, PROJECT_FIELDS, PROJECT_PREVIEW, PROJECT_PREVIEW_DEFAULT)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Google Sheet Sync</h1>
        <p className="text-sm text-slate-500">Import leads or projects from a sheet</p>
      </div>

      <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1 text-sm w-fit">
        <button onClick={() => setMode('leads')} className={`rounded-md px-3 py-1.5 font-medium ${mode === 'leads' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>Leads</button>
        <button onClick={() => setMode('projects')} className={`rounded-md px-3 py-1.5 font-medium ${mode === 'projects' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>Projects</button>
      </div>

      {mode === 'leads' && (
        <>
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <label className="block text-sm font-medium text-slate-700">Apps Script Web App URL</label>
            <div className="flex flex-wrap gap-2">
              <input className={`${inp} min-w-[280px] flex-1`} placeholder="https://script.google.com/macros/s/…/exec" value={url} onChange={(e) => setUrl(e.target.value)} />
              <button onClick={preview} disabled={!url || busy} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-60"><Plug className="h-4 w-4" /> Test / Preview</button>
              <button onClick={() => openLeadColumns(() => fetchSheet(url))} disabled={!url || busy} className={outlineBtn}><Columns3 className="h-4 w-4" /> Customize Columns</button>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200" />or<span className="h-px flex-1 bg-slate-200" /></div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Upload Excel / CSV</label>
              <div className="flex flex-wrap gap-2">
                <input ref={lFileRef} type="file" accept=".xlsx,.xls,.csv" className={`${inp} flex-1`} />
                <button onClick={previewLeadsFile} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-60"><Upload className="h-4 w-4" /> Preview File</button>
                <button onClick={() => openLeadColumns(leadFileRows)} disabled={busy} className={outlineBtn}><Columns3 className="h-4 w-4" /> Customize Columns</button>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200" />or<span className="h-px flex-1 bg-slate-200" /></div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Google Sheets Link</label>
              <p className="mb-2 text-xs text-slate-400">Sheet must be shared as &quot;Anyone with the link can view&quot;. One tab per import — copy the link with that tab open.</p>
              <div className="flex flex-wrap gap-2">
                <input className={`${inp} min-w-[280px] flex-1`} placeholder="https://docs.google.com/spreadsheets/d/…" value={lSheetLink} onChange={(e) => setLSheetLink(e.target.value)} />
                <button onClick={previewLeadsLink} disabled={!lSheetLink || busy} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-60"><Link2 className="h-4 w-4" /> Preview Link</button>
                <button onClick={() => openLeadColumns(() => parseGoogleSheetLink(lSheetLink))} disabled={!lSheetLink || busy} className={outlineBtn}><Columns3 className="h-4 w-4" /> Customize Columns</button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-slate-500">Sheet date format:</span>
              <select
                className={inp}
                value={lDateOrder}
                onChange={(e) => {
                  const next = e.target.value as DateOrder
                  setLDateOrder(next)
                  if (lRaw.length) previewLeadsFromRaw(lRaw, next)
                }}
              >
                <option value="dmy">Day first — 22/06/2026</option>
                <option value="mdy">Month first — 06/22/2026</option>
              </select>
              <span className="text-xs text-slate-400">Only affects the Excel/Sheet methods above — check the Enquiry Date column looks right.</span>
            </div>

            {/* Not behind the role check: working a big sheet in batches is
                exactly what a BD does with their own share of it. */}
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-slate-500">Rows:</span>
              <input
                type="number" min={1} placeholder="from" className={`${inp} w-24`} value={lFrom}
                onChange={(e) => setLFrom(e.target.value)}
                onBlur={() => applyLeadRange(lFrom, lTo)}
                onKeyDown={(e) => { if (e.key === 'Enter') applyLeadRange(lFrom, lTo) }}
              />
              <span className="text-slate-400">to</span>
              <input
                type="number" min={1} placeholder="to" className={`${inp} w-24`} value={lTo}
                onChange={(e) => setLTo(e.target.value)}
                onBlur={() => applyLeadRange(lFrom, lTo)}
                onKeyDown={(e) => { if (e.key === 'Enter') applyLeadRange(lFrom, lTo) }}
              />
              {(lFrom || lTo) && (
                <button
                  // Keeps focus in the box being left, so clicking this
                  // doesn't re-preview the old range on the way out.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { setLFrom(''); setLTo(''); applyLeadRange('', '') }}
                  className="text-xs font-medium text-blue-700 underline hover:text-blue-900"
                >
                  Whole sheet
                </button>
              )}
              <span className="text-xs text-slate-400">Import a batch at a time — 1 to 50, then 2001 to 2050. Blank means the whole sheet.</span>
            </div>

            {(role !== 'bd' && role !== 'counsellor') && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-slate-500">Assign BD:</span>
                <select className={inp} value={assign} onChange={(e) => chooseAssign('leads', e.target.value)}><option value="none">No auto-assign</option><option value="round_robin">Round Robin</option><option value="specific">Specific BD</option><option value="split">Split between BDs</option></select>
                {assign === 'specific' && <select className={inp} value={specificBd} onChange={(e) => setSpecificBd(e.target.value)}>{bds.map((b) => <option key={b.id} value={b.id}>{b.full_name}</option>)}</select>}
                {assign === 'split' && (
                  <button onClick={() => openSplit('leads')} disabled={bds.length === 0} title={bds.length === 0 ? 'No BDs to split between' : undefined} className={outlineBtn}>
                    <Users className="h-4 w-4" /> Customize Split
                  </button>
                )}
              </div>
            )}
            {(role !== 'bd' && role !== 'counsellor') && assign === 'split' && lPlan && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">
                <span className="font-medium">
                  {freshLeads > 0
                    ? `Splitting ${freshLeads.toLocaleString()} new lead${freshLeads === 1 ? '' : 's'} between ${lPlan.entries.length} BD${lPlan.entries.length === 1 ? '' : 's'}:`
                    : `Split set up for ${lPlan.entries.length} BD${lPlan.entries.length === 1 ? '' : 's'} — preview a sheet to see the counts:`}
                </span>
                <span className="text-blue-700">{describePlan(lPlan, bds, freshLeads)}</span>
                <button onClick={() => openSplit('leads')} className="ml-auto font-medium underline hover:text-blue-900">Change split</button>
              </div>
            )}
            {lSel && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">
                <span className="font-medium">Importing {lSel.length} of {lHeaders.length} columns:</span>
                <span className="text-blue-700">{lSel.join(', ')}</span>
                <button
                  onClick={() => { setLSel(null); if (lRaw.length) previewLeadsFromRaw(lRaw, lDateOrder, null) }}
                  className="ml-auto font-medium underline hover:text-blue-900"
                >
                  Reset to all columns
                </button>
              </div>
            )}
            {status && <p className="text-sm text-slate-600">{status}</p>}
          </div>

          {rows.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Preview ({rows.length} rows)</span>
                <button onClick={importNew} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"><Download className="h-4 w-4" /> Import New Leads</button>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-sm"><thead className="bg-slate-50 text-left text-xs text-slate-500"><tr>
                  {leadCols.map((c) => <th key={c.key} className="px-4 py-3 font-medium">{c.label}</th>)}
                  {anyFollowups && <th className="px-4 py-3 font-medium">Follow-ups</th>}
                  {assign === 'split' && <th className="px-4 py-3 font-medium">Assign to</th>}
                  <th className="px-4 py-3 font-medium">Status</th>
                  </tr></thead>
                  <tbody>{rows.slice(0, 200).map((r, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      {leadCols.map((c) => <td key={c.key} className={`px-4 py-2.5 ${c.cls ?? ''}`} title={c.title?.(r)}>{c.cell(r)}</td>)}
                      {anyFollowups && (
                        <td className="px-4 py-2.5 text-slate-500" title={r.followups.map((f: any) => `${f.date}: ${f.outcome}`).join('\n')}>
                          {r.followups.length
                            ? <>{r.followups.length} · <span className="text-slate-400">last {r.followups[r.followups.length - 1].date} “{r.followups[r.followups.length - 1].outcome}”</span></>
                            : '—'}
                        </td>
                      )}
                      {assign === 'split' && (
                        // A duplicate or invalid row creates no lead, so it
                        // is dealt no share and says so rather than naming
                        // a BD who will never see it.
                        <td className="px-4 py-2.5 text-slate-600">
                          {!r._valid || r._dup ? '—' : (bdName(leadDeal.get(r)) ?? <span className="text-amber-600">unassigned</span>)}
                        </td>
                      )}
                      <td className="px-4 py-2.5">{!r._valid ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">invalid</span> : r._dup ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-600">⚠️ Dup</span> : <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-600">✅ New</span>}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {mode === 'projects' && (
        <>
          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Upload Excel / CSV</label>
              <div className="flex flex-wrap gap-2">
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className={`${inp} flex-1`} />
                <button onClick={previewProjectsFile} disabled={pBusy} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-60"><Upload className="h-4 w-4" /> Preview File</button>
                <button onClick={() => openProjectColumns(projectFileRows)} disabled={pBusy} className={outlineBtn}><Columns3 className="h-4 w-4" /> Customize Columns</button>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200" />or<span className="h-px flex-1 bg-slate-200" /></div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Google Sheets Link</label>
              <p className="mb-2 text-xs text-slate-400">Sheet must be shared as &quot;Anyone with the link can view&quot;. One tab per import — copy the link with that tab open.</p>
              <div className="flex flex-wrap gap-2">
                <input className={`${inp} min-w-[280px] flex-1`} placeholder="https://docs.google.com/spreadsheets/d/…" value={sheetLink} onChange={(e) => setSheetLink(e.target.value)} />
                <button onClick={previewProjectsLink} disabled={!sheetLink || pBusy} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-60"><Link2 className="h-4 w-4" /> Preview Link</button>
                <button onClick={() => openProjectColumns(() => parseGoogleSheetLink(sheetLink))} disabled={!sheetLink || pBusy} className={outlineBtn}><Columns3 className="h-4 w-4" /> Customize Columns</button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-slate-500">Sheet date format:</span>
              <select
                className={inp}
                value={dateOrder}
                onChange={(e) => {
                  const next = e.target.value as DateOrder
                  setDateOrder(next)
                  if (pRaw.length) previewProjectsFromRaw(pRaw, next)
                }}
              >
                <option value="dmy">Day first — 22/06/2026</option>
                <option value="mdy">Month first — 06/22/2026</option>
              </select>
              <span className="text-xs text-slate-400">Check the Date column below looks right.</span>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-slate-500">Rows:</span>
              <input
                type="number" min={1} placeholder="from" className={`${inp} w-24`} value={pFrom}
                onChange={(e) => setPFrom(e.target.value)}
                onBlur={() => applyProjectRange(pFrom, pTo)}
                onKeyDown={(e) => { if (e.key === 'Enter') applyProjectRange(pFrom, pTo) }}
              />
              <span className="text-slate-400">to</span>
              <input
                type="number" min={1} placeholder="to" className={`${inp} w-24`} value={pTo}
                onChange={(e) => setPTo(e.target.value)}
                onBlur={() => applyProjectRange(pFrom, pTo)}
                onKeyDown={(e) => { if (e.key === 'Enter') applyProjectRange(pFrom, pTo) }}
              />
              {(pFrom || pTo) && (
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { setPFrom(''); setPTo(''); applyProjectRange('', '') }}
                  className="text-xs font-medium text-blue-700 underline hover:text-blue-900"
                >
                  Whole sheet
                </button>
              )}
              <span className="text-xs text-slate-400">Import a batch at a time — 1 to 50, then 2001 to 2050. Blank means the whole sheet.</span>
            </div>

            {(role !== 'bd' && role !== 'counsellor') && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-slate-500">Assign BD:</span>
                <select className={inp} value={pAssign} onChange={(e) => chooseAssign('projects', e.target.value)}><option value="none">No auto-assign</option><option value="round_robin">Round Robin</option><option value="specific">Specific BD</option><option value="split">Split between BDs</option></select>
                {pAssign === 'specific' && <select className={inp} value={pSpecificBd} onChange={(e) => setPSpecificBd(e.target.value)}>{bds.map((b) => <option key={b.id} value={b.id}>{b.full_name}</option>)}</select>}
                {pAssign === 'split' && (
                  <button onClick={() => openSplit('projects')} disabled={bds.length === 0} title={bds.length === 0 ? 'No BDs to split between' : undefined} className={outlineBtn}>
                    <Users className="h-4 w-4" /> Customize Split
                  </button>
                )}
              </div>
            )}
            {(role !== 'bd' && role !== 'counsellor') && pAssign === 'split' && pPlan && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">
                <span className="font-medium">
                  {freshProjects > 0
                    ? `Splitting ${freshProjects.toLocaleString()} new project${freshProjects === 1 ? '' : 's'} between ${pPlan.entries.length} BD${pPlan.entries.length === 1 ? '' : 's'}:`
                    : `Split set up for ${pPlan.entries.length} BD${pPlan.entries.length === 1 ? '' : 's'} — preview a sheet to see the counts:`}
                </span>
                <span className="text-blue-700">{describePlan(pPlan, bds, freshProjects)}</span>
                <button onClick={() => openSplit('projects')} className="ml-auto font-medium underline hover:text-blue-900">Change split</button>
              </div>
            )}
            {pSel && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">
                <span className="font-medium">Importing {pSel.length} of {pHeaders.length} columns:</span>
                <span className="text-blue-700">{pSel.join(', ')}</span>
                <button
                  onClick={() => { setPSel(null); if (pRaw.length) previewProjectsFromRaw(pRaw, dateOrder, null) }}
                  className="ml-auto font-medium underline hover:text-blue-900"
                >
                  Reset to all columns
                </button>
              </div>
            )}
            {pStatus && <p className="text-sm text-slate-600">{pStatus}</p>}
          </div>

          {pRows.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Preview ({pRows.length} rows)</span>
                <button onClick={importProjects} disabled={pBusy} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"><Download className="h-4 w-4" /> Import New Projects</button>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-sm"><thead className="bg-slate-50 text-left text-xs text-slate-500"><tr>
                  {projectCols.map((c) => <th key={c.key} className="px-4 py-3 font-medium">{c.label}</th>)}
                  {pAssign === 'split' && <th className="px-4 py-3 font-medium">Assign to</th>}
                  <th className="px-4 py-3 font-medium">Status</th>
                  </tr></thead>
                  <tbody>{pRows.slice(0, 200).map((r, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      {projectCols.map((c) => <td key={c.key} className={`px-4 py-2.5 ${c.cls ?? ''}`} title={c.title?.(r)}>{c.cell(r)}</td>)}
                      {pAssign === 'split' && (
                        <td className="px-4 py-2.5 text-slate-600">
                          {!r._valid || r._dup ? '—' : (bdName(projectDeal.get(r)) ?? <span className="text-amber-600">unassigned</span>)}
                        </td>
                      )}
                      <td className="px-4 py-2.5">{!r._valid ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">invalid</span> : r._leadBd !== null ? <span className="whitespace-nowrap rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-600">⚠️ In Leads — {r._leadBd || 'unassigned'}</span> : r._dup ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-600">⚠️ Dup</span> : <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-600">✅ New</span>}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {picker === 'leads' && (
        <CustomizeColumnsModal
          title="Leads"
          headers={lHeaders}
          cols={lAliases}
          fields={LEAD_FIELDS}
          selection={lSel}
          // The follow-up log's columns are headed by the call date, so
          // they're recognised by shape and labelled here rather than
          // living in the alias table.
          extraLabel={(h) => (isFollowupHeader(h, lDateOrder, lYearHint) ? `Follow-up ${parseFollowupHeader(h, lDateOrder, lYearHint)}` : null)}
          onCancel={() => setPicker(null)}
          onSave={saveLeadColumns}
        />
      )}
      {picker === 'projects' && (
        <CustomizeColumnsModal
          title="Projects"
          headers={pHeaders}
          cols={pAliases}
          fields={PROJECT_FIELDS}
          selection={pSel}
          onCancel={() => setPicker(null)}
          onSave={saveProjectColumns}
        />
      )}

      {/* `total` is the rows that will really be created, so the shares the
          admin sets are shares of the import rather than of the sheet. */}
      {splitFor === 'leads' && (
        <CustomizeAssignmentModal
          title="Leads"
          bds={bds}
          total={freshLeads}
          plan={lPlan}
          onCancel={() => setSplitFor(null)}
          onSave={(next) => { setLPlan(next); setSplitFor(null) }}
        />
      )}
      {splitFor === 'projects' && (
        <CustomizeAssignmentModal
          title="Projects"
          bds={bds}
          total={freshProjects}
          plan={pPlan}
          onCancel={() => setSplitFor(null)}
          onSave={(next) => { setPPlan(next); setSplitFor(null) }}
        />
      )}
    </div>
  )
}
