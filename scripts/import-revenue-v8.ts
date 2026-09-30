/**
 * Import revenue records from the v7 OMS backup into the v8 `revenue` table.
 *
 *   npx tsx scripts/import-revenue-v8.ts "C:\\path\\to\\ElectrobtechOMS_Backup_2026-06-20.json"
 *
 * Run supabase/v8-foundation.sql FIRST (creates the revenue table).
 * Upserts on rev_key, so it is safe to re-run.
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
const num = (v: unknown) => (v == null || v === '' ? 0 : Number(v) || 0)
const d = (v: unknown) => { const t = String(v ?? '').slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null }
const fp = (date: string, name: string, amt: number, mode: string) => `${date}|${(name || '').toLowerCase().trim()}|${amt}|${mode}`

async function main() {
  const data = JSON.parse(readFileSync(file, 'utf8'))
  const rev: any[] = data.revenue ?? []
  console.log(`Found ${rev.length} revenue records`)

  const rows = rev.map((r) => {
    const date = d(r.date) ?? d(r.createdAt) ?? null
    const amt = num(r.amt ?? r.totalAmt)
    return {
      rev_key: s(r.key) ?? `rev_${r.txnId ?? Math.random().toString(36).slice(2)}`,
      txn_id: s(r.txnId), date, name: s(r.name), phone: s(r.phone), email: s(r.email), college: s(r.college),
      program: s(r.program), plan: s(r.plan), src: s(r.src) ?? 'Aptitude',
      amt, total_amt: num(r.totalAmt ?? r.amt), pending_amt: num(r.pendingAmt),
      base: amt, gst: 0, mode: s(r.mode), txn: s(r.txn), bd: s(r.bd),
      status: s(r.status) ?? 'Received', verified: s(r.verified) ?? 'No',
      inv_no: s(r.invNo), apt_key: s(r.aptKey), no_invoice: r.noInvoice === true,
      created_by: s(r.createdBy), fingerprint: fp(date ?? '', r.name ?? '', amt, r.mode ?? ''),
      created_at: r.createdAt ?? new Date().toISOString(),
    }
  })

  const { error } = await db.from('revenue').upsert(rows, { onConflict: 'rev_key' })
  if (error) throw error
  const { count } = await db.from('revenue').select('*', { count: 'exact', head: true })
  console.log(`✓ Imported. revenue now has ${count} rows.`)
}
main().catch((e) => { console.error(e); process.exit(1) })
