'use client'

import { useState } from 'react'
import { Download, Database } from 'lucide-react'
import { createClient } from '@/lib/api/client'

const inp = 'rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300'
const one = (x: any) => (Array.isArray(x) ? x[0] : x)

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url)
}
function toCSV(rows: any[], cols: { key: string; header: string }[]) {
  const esc = (v: any) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  const head = cols.map((c) => c.header).join(',')
  const body = rows.map((r) => cols.map((c) => esc(r[c.key])).join(',')).join('\n')
  return head + '\n' + body
}

function range(period: string, from: string, to: string): { gte?: string; lte?: string } {
  const today = new Date(); const iso = (d: Date) => d.toISOString().slice(0, 10)
  if (period === 'daily') return { gte: iso(today), lte: iso(today) }
  if (period === 'weekly') { const d = new Date(today); d.setDate(d.getDate() - 7); return { gte: iso(d) } }
  if (period === 'monthly') return { gte: iso(today).slice(0, 7) + '-01' }
  if (from || to) return { gte: from || undefined, lte: to || undefined }
  return {}
}

export function ReportsClient({ canSeeBD }: { canSeeBD: boolean }) {
  const supabase = createClient()
  const [period, setPeriod] = useState('all')
  const [from, setFrom] = useState(''); const [to, setTo] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const applyRange = (q: any, col: string) => {
    const r = range(period, from, to)
    if (r.gte) q = q.gte(col, r.gte)
    if (r.lte) q = q.lte(col, col === 'created_at' || col === 'scheduled_at' ? r.lte + 'T23:59:59' : r.lte)
    return q
  }

  async function expLeads() {
    setBusy('leads')
    const { data: profiles = [] } = await supabase.from('profiles').select('id, full_name')
    const nameById: Record<string, string> = {}; for (const p of profiles ?? []) nameById[(p as any).id] = (p as any).full_name
    const { data = [] } = await applyRange(supabase.from('leads').select('id, name, mobile, email, college, source, type, status, temperature, fu_count, assigned_bd, created_at').is('deleted_at', null), 'created_at').limit(5000)
    const rows = (data ?? []).map((l: any) => ({ ...l, created_at: String(l.created_at).slice(0, 10), bd: nameById[l.assigned_bd] ?? '' }))
    download('leads.csv', toCSV(rows, [{ key: 'id', header: 'ID' }, { key: 'name', header: 'Name' }, { key: 'mobile', header: 'Phone' }, { key: 'email', header: 'Email' }, { key: 'college', header: 'College' }, { key: 'source', header: 'Source' }, { key: 'type', header: 'Type' }, { key: 'status', header: 'Stage' }, { key: 'temperature', header: 'Temperature' }, { key: 'bd', header: 'BD' }, { key: 'fu_count', header: 'FU Count' }, { key: 'created_at', header: 'Created' }]), 'text/csv')
    setBusy(null)
  }
  async function expRevenue() {
    setBusy('rev')
    const { data = [] } = await applyRange(supabase.from('revenue').select('date, inv_no, name, phone, program, amt, gst, mode, bd, status, verified, txn').is('deleted_at', null), 'date').limit(5000)
    download('revenue.csv', toCSV(data ?? [], [{ key: 'date', header: 'Date' }, { key: 'inv_no', header: 'Invoice' }, { key: 'name', header: 'Name' }, { key: 'phone', header: 'Phone' }, { key: 'program', header: 'Program' }, { key: 'amt', header: 'Amount' }, { key: 'gst', header: 'GST' }, { key: 'mode', header: 'Mode' }, { key: 'bd', header: 'BD' }, { key: 'status', header: 'Status' }, { key: 'verified', header: 'Verified' }, { key: 'txn', header: 'TXN' }]), 'text/csv')
    setBusy(null)
  }
  async function expAptitude() {
    setBusy('apt')
    const { data = [] } = await applyRange(supabase.from('aptitude').select('apt_date, name, phone, college, round, status, result, score, payment_done, payment_amt, payment_mode, bd').is('deleted_at', null), 'apt_date').limit(5000)
    download('aptitude.csv', toCSV(data ?? [], [{ key: 'apt_date', header: 'Date' }, { key: 'name', header: 'Name' }, { key: 'phone', header: 'Phone' }, { key: 'college', header: 'College' }, { key: 'round', header: 'Round' }, { key: 'status', header: 'Status' }, { key: 'result', header: 'Result' }, { key: 'score', header: 'Score' }, { key: 'payment_done', header: 'Paid' }, { key: 'payment_amt', header: 'Amount' }, { key: 'payment_mode', header: 'Mode' }, { key: 'bd', header: 'BD' }]), 'text/csv')
    setBusy(null)
  }
  async function expFollowups() {
    setBusy('fu')
    const { data = [] } = await applyRange(supabase.from('followups').select('scheduled_at, type, outcome, notes, status, leads(name, mobile)'), 'scheduled_at').limit(5000)
    const rows = (data ?? []).map((f: any) => ({ date: String(f.scheduled_at).slice(0, 10), name: one(f.leads)?.name ?? '', phone: one(f.leads)?.mobile ?? '', type: f.type, outcome: f.outcome, notes: f.notes, status: f.status }))
    download('followups.csv', toCSV(rows, [{ key: 'date', header: 'Date' }, { key: 'name', header: 'Lead Name' }, { key: 'phone', header: 'Phone' }, { key: 'type', header: 'Type' }, { key: 'outcome', header: 'Outcome' }, { key: 'notes', header: 'Notes' }, { key: 'status', header: 'Status' }]), 'text/csv')
    setBusy(null)
  }
  async function expProjects() {
    setBusy('proj')
    // Ranged on entry_date, which is when the work was taken on — created_at
    // is when the row was typed in, often an import long afterwards. The
    // other exports here range on the equivalent business date for the same
    // reason.
    const { data = [] } = await applyRange(
      supabase
        .from('projects')
        .select(
          'entry_date, name, mobile, college, department, project_name, category, source, status, response, remarks, vendor_name, vendor_cost, vendor2_name, vendor2_cost, company_cost, amount_paid, referral_deduction, notes, owner:owner_id(full_name)',
        )
        .is('deleted_at', null),
      'entry_date',
    ).limit(5000)

    // The owner is the BD the row belongs to; flattened out of the join so
    // the column reads as a name rather than an object.
    const rows = (data ?? []).map((p: any) => ({ ...p, bd: one(p.owner)?.full_name ?? '' }))

    download(
      'projects.csv',
      toCSV(rows, [
        { key: 'entry_date', header: 'Entry Date' },
        { key: 'name', header: 'Client Name' },
        { key: 'mobile', header: 'Phone' },
        { key: 'college', header: 'College' },
        { key: 'department', header: 'Department' },
        { key: 'project_name', header: 'Project' },
        { key: 'category', header: 'Category' },
        { key: 'source', header: 'Source' },
        { key: 'status', header: 'Status' },
        { key: 'bd', header: 'BD' },
        { key: 'response', header: 'Response' },
        { key: 'remarks', header: 'Remarks' },
        { key: 'vendor_name', header: 'Vendor' },
        { key: 'vendor_cost', header: 'Vendor Cost' },
        { key: 'vendor2_name', header: 'Vendor 2' },
        { key: 'vendor2_cost', header: 'Vendor 2 Cost' },
        { key: 'company_cost', header: 'Company Cost' },
        { key: 'amount_paid', header: 'Amount Paid' },
        { key: 'referral_deduction', header: 'Referral Deduction' },
        { key: 'notes', header: 'Notes' },
      ]),
      'text/csv',
    )
    setBusy(null)
  }

  async function backup() {
    setBusy('backup')
    const [leads, revenue, aptitude, students, followups] = await Promise.all([
      supabase.from('leads').select('*').is('deleted_at', null).limit(5000),
      supabase.from('revenue').select('*').is('deleted_at', null).limit(5000),
      supabase.from('aptitude').select('*').is('deleted_at', null).limit(5000),
      supabase.from('students').select('*').is('deleted_at', null).limit(5000),
      supabase.from('followups').select('*').limit(5000),
    ])
    const snap = { version: 'v8_backup', createdAt: new Date().toISOString(), leads: leads.data ?? [], revenue: revenue.data ?? [], aptitude: aptitude.data ?? [], students: students.data ?? [], followups: followups.data ?? [] }
    download(`ElectrobtechOMS_v8_Backup_${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(snap, null, 2), 'application/json')
    setBusy(null)
  }

  const reports: { key: string; label: string; fn: () => void; show: boolean }[] = [
    { key: 'leads', label: 'Export Leads CSV', fn: expLeads, show: true },
    { key: 'rev', label: 'Export Revenue CSV', fn: expRevenue, show: canSeeBD },
    { key: 'apt', label: 'Export Aptitude CSV', fn: expAptitude, show: true },
    { key: 'fu', label: 'Export Follow-ups CSV', fn: expFollowups, show: true },
    { key: 'proj', label: 'Export Projects CSV', fn: expProjects, show: true },
  ]

  return (
    <div className="space-y-5">
      <div><h1 className="text-xl font-semibold text-slate-900">Reports</h1><p className="text-sm text-slate-500">Filter by period, then export</p></div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div><label className="mb-1 block text-xs text-slate-500">Period</label>
          <select className={inp} value={period} onChange={(e) => setPeriod(e.target.value)}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="all">All Time</option></select>
        </div>
        <div><label className="mb-1 block text-xs text-slate-500">From</label><input className={inp} type="date" value={from} onChange={(e) => setFrom(e.target.value)} disabled={period !== 'all'} /></div>
        <div><label className="mb-1 block text-xs text-slate-500">To</label><input className={inp} type="date" value={to} onChange={(e) => setTo(e.target.value)} disabled={period !== 'all'} /></div>
        <span className="text-xs text-slate-400">Date range applies when Period = All Time</span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {reports.filter((r) => r.show).map((r) => (
          <button key={r.key} onClick={r.fn} disabled={!!busy} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60">
            {r.label}<Download className="h-4 w-4 text-blue-600" />
          </button>
        ))}
        <button onClick={backup} disabled={!!busy} className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-60 sm:col-span-2">
          {busy === 'backup' ? 'Preparing backup…' : 'Download Full Backup (JSON)'}<Database className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
