// The columns the sheet importer knows how to write, and the header
// spellings that name them.
//
// Separate from the importer's UI so the mapping can be exercised on its
// own: auto-detection is exactly the kind of thing that goes wrong
// silently, in the data, weeks later.

import { augmentAliases, detectedMappings, type Aliases } from './headerMatch'
import { isFollowupHeader, type DateOrder } from './sheetImport'
import type { FieldDef } from '@/app/(dashboard)/gsheet/CustomizeColumns'

export type { Aliases, FieldDef }

// ---------------------------------------------------------------- Leads
// These are the spellings worth naming outright. Anything else a sheet
// calls a column is resolved by matchHeaderToField() at preview time —
// see augmentAliases() below — so the list no longer has to anticipate
// every way a BD might type a header.
export const COLS: Record<string, string[]> = {
  name: ['name', 'student_name', 'student name', 'studentname', 'student', 'full name'],
  phone: ['phone', 'mobile', 'contact', 'phone number', 'phone_number', 'mobile number', 'mobile no', 'phone no', 'contact number', 'contact no', 'whatsapp', 'whatsapp number'],
  email: ['email', 'email id', 'email_id', 'mail', 'mail id', 'email address'],
  college: ['college', 'institution', 'college_name', 'university', 'institute', 'clg', 'college name'],
  source: ['source', 'src', 'lead_source', 'lead source', 'enquiry source'],
  category: ['category', 'course category', 'lead category'],
  bd: ['bd', 'assigned_to', 'assigned to', 'assigned bd', 'assigned_bd'],
  stage: ['stage', 'lead_stage', 'lead stage', 'status', 'lead status', 'current status'],
  goal: ['goal', 'interest', 'course', 'program', 'course interest', 'interested in', 'domain'],
  notes: ['notes', 'remarks', 'comment', 'comments', 'note', 'remark'],
  // Real sheets carry a second outcome column under this exact misspelling,
  // holding the same kind of text as Remarks ("No response", "Interested")
  // rather than anything about course category — it feeds status the same
  // way Remarks does, not the category field.
  //
  // '=' pins it to that literal spelling: it sits one edit from "catagory",
  // an ordinary misspelling of Category, and matching loosely would make
  // both columns ambiguous instead of resolving either.
  outcome: ['=catagore', '=categore'],
  date: ['enquiry date', 'enquiry_date', 'date', 'entry date', 'date of enquiry'],

  // The academic profile the lead forms already collect. Until these were
  // here a sheet could carry a CGPA or a passing year and the importer had
  // nowhere to put it, so the column was read and thrown away.
  placeCity: ['place', 'city', 'place / city', 'place city', 'native place', 'hometown', 'native'],
  currentLocation: ['current location', 'present location', 'location', 'currently in', 'residing at'],
  branch: ['branch', 'stream', 'specialization', 'specialisation', 'department', 'dept'],
  degree: ['degree', 'qualification', 'education', 'course type'],
  // Indian sheets head this column every one of these ways, often holding a
  // percentage rather than a CGPA. Both land in the same numeric field.
  cgpa: ['cgpa', 'gpa', 'aggregate', 'percentage', 'marks', 'score'],
  yearOfPassing: ['year of passing', 'year of pass', 'yop', 'passing year', 'passout year', 'passed out', 'graduation year'],
  dob: ['dob', 'date of birth', 'birth date', 'birthdate'],
  graduationStatus: ['graduation status', 'grad status', 'education status', 'academic status'],
  plan: ['plan', 'package', 'plan opted', 'course plan'],
  // Safe to name despite the wide follow-up columns: those are detected by
  // a header that parses as a date, and none of these do.
  nextFollowup: ['next followup', 'next follow up', 'next follow-up', 'next followup date', 'next follow up date', 'followup date', 'follow up date', 'next call', 'callback', 'callback date', 'next contact'],
}

// The fields the column picker offers, in the order a user reads them.
// COLS.bd is deliberately absent: nothing in the leads mapping reads it,
// so offering it would suggest an effect it doesn't have. Name and Phone
// are required — they drive row validation and duplicate detection.
export const LEAD_FIELDS: FieldDef[] = [
  { key: 'name', label: 'Name', required: true },
  { key: 'phone', label: 'Phone', required: true },
  { key: 'email', label: 'Email' },
  { key: 'college', label: 'College' },
  { key: 'source', label: 'Source' },
  { key: 'category', label: 'Category' },
  { key: 'goal', label: 'Course' },
  { key: 'notes', label: 'Remarks' },
  { key: 'outcome', label: 'Remarks' },
  { key: 'stage', label: 'Stage' },
  { key: 'date', label: 'Enquiry Date' },
  { key: 'placeCity', label: 'Place / City' },
  { key: 'currentLocation', label: 'Current Location' },
  { key: 'branch', label: 'Branch' },
  { key: 'degree', label: 'Degree' },
  { key: 'cgpa', label: 'CGPA' },
  { key: 'yearOfPassing', label: 'Year of Passing' },
  { key: 'dob', label: 'Date of Birth' },
  { key: 'graduationStatus', label: 'Graduation Status' },
  { key: 'plan', label: 'Plan' },
  { key: 'nextFollowup', label: 'Next Follow-up' },
]

// -------------------------------------------------------------- Projects
export const PCOLS: Record<string, string[]> = {
  date: ['enquiry date', 'enquiry_date', 'entry date', 'entry_date', 'date', 'date of enquiry'],
  source: ['source', 'src', 'lead source', 'enquiry source'],
  category: ['category', 'course category', 'project category'],
  name: ['name', 'student name', 'student_name', 'candidate', 'candidate name', 'full name', 'client name'],
  phone: ['mobile', 'phone', 'contact', 'phone number', 'phone_number', 'mobile number', 'mobile no', 'phone no', 'contact number', 'contact no', 'whatsapp', 'whatsapp number'],
  department: ['department', 'dept', 'branch', 'stream'],
  college: ['college', 'institution', 'college_name', 'university', 'institute', 'clg', 'college name'],
  response: ['response', 'feedback', 'reply'],
  remarks: ['remarks', 'remark'],
  vendorName: ['vendor name', 'vendor_name', 'vendor'],
  vendorCost: ['vendor cost', 'vendor_cost', 'vendor amount', 'vendor price'],
  companyCost: ['company cost', 'company_cost', 'cmpy cost', 'company amount', 'company price'],
  // 'catagore'/'categore' hold the outcome on a Projects sheet exactly as
  // they do on a Leads one — see COLS.outcome for why they are pinned.
  status: ['status', 'project status', 'current status', 'outcome', 'result', '=catagore', '=categore'],
  projectName: ['project name', 'project_name', 'project', 'project title', 'title'],
  notes: ['notes', 'remarks', 'comment', 'note'],
  paid: ['paid', 'amount paid', 'amount_paid', 'paid amount', 'payment', 'amount received'],
  referralDeduction: ['referral deduction', 'referral_deduction', 'ref deduction', 'referal deduction', 'referral amount'],
}

// Projects only validate on Name, but Mobile is what duplicate detection
// compares — dropping it would silently re-import rows already in the
// table, so both stay required here too.
export const PROJECT_FIELDS: FieldDef[] = [
  { key: 'name', label: 'Name', required: true },
  { key: 'phone', label: 'Mobile', required: true },
  { key: 'date', label: 'Date' },
  { key: 'source', label: 'Source' },
  { key: 'category', label: 'Category' },
  { key: 'department', label: 'Department' },
  { key: 'college', label: 'College' },
  { key: 'response', label: 'Response' },
  { key: 'remarks', label: 'Remarks' },
  { key: 'notes', label: 'Notes' },
  { key: 'projectName', label: 'Project' },
  { key: 'vendorName', label: 'Vendor' },
  { key: 'vendorCost', label: 'Vendor Cost' },
  { key: 'companyCost', label: 'Company Cost' },
  { key: 'paid', label: 'Amount Paid' },
  { key: 'referralDeduction', label: 'Referral Deduction' },
  { key: 'status', label: 'Project Status' },
]

// ------------------------------------------------- Auto-detected columns
//
// The alias tables above name the spellings worth stating outright; a real
// sheet then heads the same column "Full Name", "Mobile No" or "Categore".
// These widen the table with whatever *this* sheet calls its columns, so
// nothing downstream has to change: pick(), the column picker and
// selectedFields() all read alias lists already, and now find the sheet's
// own wording in them.
export const LEAD_KEYS = LEAD_FIELDS.map((f) => f.key)
export const PROJECT_KEYS = PROJECT_FIELDS.map((f) => f.key)

// A follow-up column is recognised by shape rather than by name, and must
// not be claimed as an ordinary field as well.
export const aliasesForLeads = (headers: string[], order: DateOrder) =>
  augmentAliases(headers, COLS, LEAD_KEYS, (h) => isFollowupHeader(h, order))
export const aliasesForProjects = (headers: string[]) => augmentAliases(headers, PCOLS, PROJECT_KEYS)

// What to tell the user was worked out rather than recognised, so an
// auto-detected mapping is something they read in the summary instead of
// something they discover afterwards in the data.
export function describeDetected(
  headers: string[],
  base: Aliases,
  keys: string[],
  fields: FieldDef[],
  skip?: (h: string) => boolean,
): string {
  const found = detectedMappings(headers, base, keys, skip)
  if (!found.length) return ''
  const label = (k: string) => fields.find((f) => f.key === k)?.label ?? k
  const parts = found.map((d) => {
    const seen: string[] = []
    for (const k of d.keys) { const l = label(k); if (!seen.includes(l)) seen.push(l) }
    return `${d.header} → ${seen.join(' · ')}`
  })
  return `auto-detected ${parts.join(', ')}`
}
