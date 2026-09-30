/**
 * Import real leads from the v7 OMS backup JSON into Supabase.
 *
 *   npx tsx scripts/import-leads.ts "C:\\path\\to\\ElectrobtechOMS_Backup_2026-06-20.json"
 *
 * - Maps their fields -> our leads schema
 * - De-dupes by normalized phone (keeps first)
 * - Assigns all to Sangeetha (the BD)
 * - REPLACES existing leads (clears demo leads first)
 *
 * Run the ALTERs in alter-leads.sql (Supabase SQL Editor) BEFORE this.
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

const normPhone = (p: unknown) => {
  let s = String(p ?? '').replace(/\D/g, '')
  if (s.length > 10 && s.startsWith('91')) s = s.slice(-10)
  return s.length === 10 ? s : ''
}

const SOCIAL = new Set(['dm', 'digital marketing', 'instagram ads', 'facebook ads', 'pipeline/dm', 'instagram', 'facebook'])
const mapSource = (s: string) => {
  const v = (s || '').trim().toLowerCase()
  if (SOCIAL.has(v)) return 'social_media'
  if (v.includes('college') || v.includes('outreach')) return 'college'
  return 'website'
}
const mapStatus = (stage: string) => {
  const v = (stage || '').trim().toLowerCase()
  return ({ 'new lead': 'new', new: 'new', 'follow-up': 'contacted', 'no response': 'contacted', interested: 'interested', aptitude: 'aptitude_shared', lost: 'lost' } as Record<string, string>)[v] ?? 'new'
}
const mapTemp = (t: string) => {
  const v = (t || '').toLowerCase()
  if (v.includes('hot')) return 'hot'
  if (v.includes('cold')) return 'cold'
  return null
}
const isoOrNull = (v: unknown) => {
  if (!v) return null
  const d = new Date(String(v))
  return isNaN(d.getTime()) ? null : d.toISOString()
}

async function main() {
  console.log('Reading', file)
  const backup = JSON.parse(readFileSync(file, 'utf8'))
  const leads: any[] = backup.leads ?? []
  console.log('Leads in file:', leads.length)

  // BD owner
  const { data: bd } = await db.from('profiles').select('id').eq('email', 'sangee@electrobtech.in').single()
  if (!bd) throw new Error('BD user sangee@electrobtech.in not found — run the seed first.')
  const bdId = bd.id

  const seen = new Set<string>()
  let blank = 0, dupe = 0
  const rows = []
  for (const l of leads) {
    const phone = normPhone(l.phone)
    if (phone) {
      if (seen.has(phone)) { dupe++; continue }
      seen.add(phone)
    } else blank++

    const bdRaw = (l.bd || '').trim()
    const noteBits = [
      bdRaw && !/sangeetha/i.test(bdRaw) ? `BD: ${bdRaw}` : '',
      (l.course || '').trim() ? `Course: ${l.course}` : '',
      (l.college || '').trim() ? `College: ${l.college}` : '',
      (l.goal || '').trim() ? `Goal: ${l.goal}` : '',
      (l.notes || '').trim(),
    ].filter(Boolean)

    rows.push({
      name: (l.name || '').trim() || 'Unknown',
      mobile: phone || null,
      email: (l.email || '').trim() || null,
      source: mapSource(l.src),
      source_detail: (l.src || '').trim() || null,
      temperature: mapTemp(l.temp),
      status: mapStatus(l.stage),
      assigned_bd: bdId,
      next_followup_at: isoOrNull(l.fud),
      notes: noteBits.join(' • ') || null,
      created_at: isoOrNull(l.createdAt) ?? isoOrNull(l.created) ?? new Date().toISOString(),
    })
  }
  console.log(`Prepared ${rows.length} rows  (blank phone: ${blank}, phone dupes removed: ${dupe})`)

  console.log('Clearing existing leads…')
  await db.from('leads').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  console.log('Inserting…')
  let done = 0
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500)
    const { error } = await db.from('leads').insert(chunk)
    if (error) { console.error('Insert error at row', i, error.message); process.exit(1) }
    done += chunk.length
    process.stdout.write(`  ${done}/${rows.length}\r`)
  }
  console.log(`\n[done] Imported ${done} leads, all assigned to Sangeetha.`)
}

main().catch((e) => { console.error(e); process.exit(1) })
