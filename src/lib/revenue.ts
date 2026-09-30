// Where a revenue entry came from. Stored in `revenue.src`, which is a plain
// text column with no constraint, so this list is the only thing defining the
// vocabulary — the Revenue page filters and the Add Revenue form both read it.
export const REVENUE_SOURCES = [
  'Aptitude',
  'Projects',
  'Courses',
  'Webinars',
  'Direct',
] as const

export type RevenueSource = (typeof REVENUE_SOURCES)[number]

// Who may change a revenue row.
//
// A collection belongs to the BD whose name is on it: `revenue.bd` carries a
// profile's full_name, stamped there by the Add Revenue form. Admins and
// super admins are unrestricted; every other role gets nothing.
//
// The database is the real gate — the `revenue_bd` RLS policy only lets a BD
// touch rows whose `bd` matches their own full_name — so this exists to keep
// controls the write would refuse from appearing at all. It is deliberately
// stricter than the Revenue list's `bd ilike '%name%'` filter, under which a
// BD named "Megha" also matches rows belonging to "Meghana": showing up in
// someone's list is not the same as being theirs to edit.
export function canEditRevenue(
  row: { bd?: string | null },
  role: string | null | undefined,
  myName: string,
): boolean {
  if (role === 'admin' || role === 'super_admin') return true
  // Counsellor is BD-equivalent: it owns rows carrying its own name, same
  // as a BD. Anything else gets no edit.
  if (role !== 'bd' && role !== 'counsellor') return false
  const owner = (row.bd ?? '').trim().toLowerCase()
  return owner.length > 0 && owner === (myName ?? '').trim().toLowerCase()
}

/**
 * The duplicate guard on a collection: `date|name|amount|mode`, enforced by
 * the unique index `idx_revenue_fingerprint` over live rows.
 *
 * Every writer has to build this string the same way or the guard quietly
 * stops working — two rows for one payment collide only when their
 * fingerprints match byte for byte. That is not hypothetical: the aptitude
 * screen stamped the payment mode into the fingerprint while the Data Safety
 * backfill left that segment empty, so one ₹99 fee went in twice without
 * tripping the index. Four copies of the format was three too many; this is
 * the one definition.
 */
export const revenueFingerprint = (
  date: string,
  name: string | null | undefined,
  amt: number,
  mode: string | null | undefined,
) => `${date}|${(name ?? '').toLowerCase().trim()}|${amt}|${mode ?? ''}`

export const num = (v: unknown) => Number(v ?? 0)

// Some rows (aptitude fees, older imports) carry the amount in total_amt but
// never had received_amount filled in, so they read ₹0 despite status
// "Received". Derive the figures for display without changing the data: a
// "Received" row is settled in full; a "Pending" row keeps whatever partial
// received_amount it has, the rest being pending.
//
// These live here rather than in the Revenue page because the edit form has
// to open on the same figures the list shows — a second copy of the rule
// would drift, and the form would then save the number it drifted to.
export const receivedOf = (r: any) => {
  const rec = num(r.received_amount)
  if (rec > 0) return rec
  // A "Received" row is settled in full, which with something written off
  // means the total less the deduction rather than the whole total.
  if (r.status === 'Received') return Math.max(num(r.total_amt ?? r.amt) - num(r.deductions), 0)
  // `amt` is a legacy column that always mirrors total_amt (never an
  // independent "received" figure) — falling back to it here made every
  // Pending row with received_amount unset look fully paid. If nothing
  // was recorded as received, the honest answer is 0.
  return 0
}

// A deduction is written off the balance, so it comes off what's still
// owed alongside what was actually paid. Rows predating the column carry
// 0, so every existing figure reads exactly as it did before.
export const pendingOf = (r: any) => {
  const p = num(r.pending_amount)
  if (p > 0) return p
  return Math.max(num(r.total_amt ?? r.amt) - receivedOf(r) - num(r.deductions), 0)
}
