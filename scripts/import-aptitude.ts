/**
 * Import aptitude records from the v7 OMS backup JSON into Supabase.
 *
 *   npx tsx scripts/import-aptitude.ts "C:\\path\\to\\ElectrobtechOMS_Backup_2026-06-20.json"
 *
 * Run supabase/aptitude.sql (Supabase SQL Editor) FIRST.
 * Upserts on apt_key, so it is safe to re-run.
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { readFileSync } from 'fs'
config({ path: '.env.local' })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
if (!url || !serviceKey) throw new Error('Missing SUPABASE env vars in .env.local')

const file = process.argv[2] ?? './ElectrobtechOMS_Backup_2026-06-20.json'
const db = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

const s = (v: unknown) => (v == null ? null : String(v).trim() || null)
const d = (v: unknown) => {
  const t = String(v ?? '').slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null
}
const b = (v: unknown) => v === true || v === 'true'
const n = (v: unknown) => (v == null || v === '' ? 0 : Number(v) || 0)

async function main() {
  const data = JSON.parse(readFileSync(file, 'utf8'))
  const apt: any[] = data.aptitude ?? []
  console.log(`Found ${apt.length} aptitude records`)

  const rows = apt.map((a) => ({
    apt_key: s(a.key),
    lead_ref: s(a.leadId),
    name: s(a.name),
    phone: s(a.phone),
    email: s(a.email),
    college: s(a.college),
    cgpa: s(a.cgpa),
    goal: s(a.goal),
    bd: s(a.bd),
    source: s(a.source),
    round: s(a.round) ?? 'Round 1',
    status: s(a.status) ?? 'Form Filled',
    result: s(a.result),
    score: s(a.score),
    venue: s(a.venue),
    mode: s(a.mode),
    apt_date: d(a.date) ?? d(a.created),
    next_action: s(a.nextAction),
    remarks: s(a.remarks),
    invite_sent: b(a.inviteSent),
    payment_done: b(a.paymentDone),
    payment_amt: n(a.paymentAmt),
    payment_mode: s(a.paymentMode),
    payment_txn: s(a.paymentTxn),
    payment_date: d(a.paymentDate),
    created_at: a.createdAt ?? new Date().toISOString(),
  }))

  const { error } = await db.from('aptitude').upsert(rows, { onConflict: 'apt_key' })
  if (error) throw error

  const { count } = await db.from('aptitude').select('*', { count: 'exact', head: true })
  console.log(`✓ Imported. aptitude now has ${count} rows.`)
}
main().catch((e) => { console.error(e); process.exit(1) })
