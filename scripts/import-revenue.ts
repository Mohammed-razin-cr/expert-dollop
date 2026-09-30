/**
 * Import real revenue (payments) from the v7 backup into the invoices table.
 *   npx tsx scripts/import-revenue.ts "C:\\path\\to\\ElectrobtechOMS_Backup_2026-06-20.json"
 *
 * - Maps each revenue record -> an invoice (mostly ₹99 aptitude fees)
 * - REPLACES demo invoices with the real payments
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

const isoOrNull = (v: unknown) => {
  if (!v) return null
  const d = new Date(String(v))
  return isNaN(d.getTime()) ? null : d.toISOString()
}
const dateOnly = (v: unknown) => (isoOrNull(v) ?? new Date().toISOString()).slice(0, 10)

async function main() {
  const backup = JSON.parse(readFileSync(file, 'utf8'))
  const revenue: any[] = backup.revenue ?? []
  console.log('Revenue records in file:', revenue.length)

  const seen = new Set<string>()
  const rows = []
  for (const r of revenue) {
    const rawNo = (r.invNo || '').trim()
    const invoice_no = rawNo || 'REV-' + (r.key || r.txnId || Math.random().toString(36).slice(2))
    if (seen.has(invoice_no)) continue
    seen.add(invoice_no)
    const amount = Number(r.amt ?? r.totalAmt ?? 0)
    const status = (r.status || '').toLowerCase().includes('receiv') || Number(r.pendingAmt ?? 0) === 0 ? 'paid' : 'pending'
    rows.push({
      invoice_no,
      amount,
      status,
      issued_date: dateOnly(r.date),
      created_at: isoOrNull(r.createdAt) ?? isoOrNull(r.date) ?? new Date().toISOString(),
    })
  }
  console.log('Prepared', rows.length, 'invoices')

  console.log('Clearing demo invoices…')
  await db.from('invoices').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  const { error } = await db.from('invoices').insert(rows)
  if (error) { console.error('Insert error:', error.message); process.exit(1) }

  const total = rows.filter((r) => r.status === 'paid').reduce((s, r) => s + r.amount, 0)
  console.log(`[done] Imported ${rows.length} invoices. Real revenue (paid): ₹${total.toLocaleString('en-IN')}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
