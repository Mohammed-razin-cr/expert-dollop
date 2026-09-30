'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { RotateCcw, ShieldCheck, Trash2, Database } from 'lucide-react'
import { createClient } from '@/lib/api/client'
import { revenueFingerprint } from '@/lib/revenue'

type Tab = 'recycle' | 'duplicates' | 'audit' | 'verify' | 'backup'
const nameOf = (t: string, r: any) => r.name ?? r.full_name ?? r.title ?? r.id?.slice(0, 8) ?? '—'

/** Tables whose soft-deleted rows the recycle bin lists and can restore. */
const RECYCLE_TABLES = ['leads', 'revenue', 'aptitude', 'students', 'projects'] as const
type RecycleTable = (typeof RECYCLE_TABLES)[number]

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime }); const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url)
}
const last10 = (p: any) => String(p ?? '').replace(/\D/g, '').slice(-10)

export function DataSafetyClient() {
  const router = useRouter()
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>('recycle')
  const [counts, setCounts] = useState({ leads: 0, revenue: 0, students: 0, aptitude: 0 })
  const [recycle, setRecycle] = useState<any[]>([])
  const [dupes, setDupes] = useState<{ leads: any[]; revenue: any[] }>({ leads: [], revenue: [] })
  const [audit, setAudit] = useState<any[]>([])
  const [verify, setVerify] = useState<any[]>([])
  const [msg, setMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    (async () => {
      const t = (q: any) => q.then((r: any) => r.count ?? 0)
      const [l, rev, s, a] = await Promise.all([
        t(supabase.from('leads').select('*', { count: 'exact', head: true }).is('deleted_at', null)),
        t(supabase.from('revenue').select('*', { count: 'exact', head: true }).is('deleted_at', null)),
        t(supabase.from('students').select('*', { count: 'exact', head: true }).is('deleted_at', null)),
        t(supabase.from('aptitude').select('*', { count: 'exact', head: true }).is('deleted_at', null)),
      ])
      setCounts({ leads: l, revenue: rev, students: s, aptitude: a })
    })()
  }, [supabase])

  const loadTab = useCallback(async () => {
    setLoading(true); setMsg(null)
    if (tab === 'recycle') {
      const tables = RECYCLE_TABLES
      const res = await Promise.all(tables.map((t) => supabase.from(t).select('*').not('deleted_at', 'is', null).limit(200)))
      const all: any[] = []
      res.forEach((r, i) => (r.data ?? []).forEach((row: any) => all.push({ table: tables[i], id: row.id, name: nameOf(tables[i], row), deleted_at: row.deleted_at })))
      all.sort((a, b) => (b.deleted_at ?? '').localeCompare(a.deleted_at ?? ''))
      setRecycle(all)
    } else if (tab === 'duplicates') {
      const [{ data: leads = [] }, { data: rev = [] }] = await Promise.all([
        supabase.from('leads').select('id, name, mobile, created_at').is('deleted_at', null).limit(5000),
        supabase.from('revenue').select('id, name, fingerprint, created_at').is('deleted_at', null).limit(5000),
      ])
      const seen: Record<string, boolean> = {}; const dupL: any[] = []
      for (const l of (leads ?? []).sort((a: any, b: any) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))) { const k = last10((l as any).mobile); if (!k) continue; if (seen[k]) dupL.push(l); else seen[k] = true }
      const seenR: Record<string, boolean> = {}; const dupR: any[] = []
      for (const r of (rev ?? []).sort((a: any, b: any) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))) { const k = (r as any).fingerprint; if (!k) continue; if (seenR[k]) dupR.push(r); else seenR[k] = true }
      setDupes({ leads: dupL, revenue: dupR })
    } else if (tab === 'audit') {
      const { data = [] } = await supabase.from('audit_log').select('module, action, detail, created_at').order('created_at', { ascending: false }).limit(200)
      setAudit(data ?? [])
    } else if (tab === 'verify') {
      const [{ data: apt = [] }, { data: rev = [] }] = await Promise.all([
        supabase.from('aptitude').select('id, apt_key, name, phone, email, college, round, bd, payment_amt, payment_mode, payment_date').eq('payment_done', true).is('deleted_at', null).limit(5000),
        supabase.from('revenue').select('apt_key').is('deleted_at', null).limit(5000),
      ])
      const haveRev = new Set((rev ?? []).map((r: any) => r.apt_key).filter(Boolean))
      setVerify((apt ?? []).filter((a: any) => !haveRev.has(a.apt_key)))
    }
    setLoading(false)
  }, [tab, supabase])

  useEffect(() => { loadTab() }, [loadTab])

  async function restore(table: RecycleTable, id: string) {
    await supabase.from(table).update({ deleted_at: null }).eq('id', id); loadTab()
  }
  async function purgeDupes() {
    if (!confirm(`Soft-delete ${dupes.leads.length} duplicate leads + ${dupes.revenue.length} duplicate revenue rows?`)) return
    const now = new Date().toISOString()
    await Promise.all([
      ...dupes.leads.map((l) => supabase.from('leads').update({ deleted_at: now }).eq('id', l.id)),
      ...dupes.revenue.map((r) => supabase.from('revenue').update({ deleted_at: now }).eq('id', r.id)),
    ])
    setMsg('Duplicates moved to recycle bin.'); loadTab()
  }
  async function fixVerify() {
    const today = new Date().toISOString().slice(0, 10)
    const results = await Promise.all(verify.map((a) => {
      // Rebuild the row the aptitude screen would have written when the fee
      // was taken, not one dated today with no payment mode. Both details
      // feed the fingerprint, and a backfill that invented them produced a
      // string that could never match the real entry — so the guard let the
      // same collection in twice.
      const paidOn = a.payment_date ?? today
      const mode = a.payment_mode ?? null
      return supabase.from('revenue').upsert({
        rev_key: `rev_apt_${a.apt_key ?? a.id}`, date: paidOn, payment_date: paidOn, name: a.name, phone: a.phone, email: a.email, college: a.college,
        program: `Aptitude Test Fee — ${a.round}`, src: 'Aptitude', amt: a.payment_amt, total_amt: a.payment_amt, received_amount: a.payment_amt, pending_amount: 0, base: a.payment_amt, gst: 0,
        mode, bd: a.bd, status: 'Received', verified: 'No', apt_key: a.apt_key,
        fingerprint: revenueFingerprint(paidOn, a.name, a.payment_amt, mode),
      }, { onConflict: 'rev_key' })
    }))

    // Now that the fingerprints line up, the unique index actually fires, and
    // a swallowed failure would leave this claiming to have fixed rows it
    // never wrote. 23505 means the collection is already recorded under a
    // different rev_key — the guard doing its job, so it is reported as
    // skipped rather than as an error.
    const failed = results.filter((r: any) => r.error)
    const skipped = failed.filter((r: any) => r.error?.code === '23505').length
    const broke = failed.filter((r: any) => r.error?.code !== '23505')
    const fixed = results.length - failed.length
    setMsg([
      `Fixed ${fixed} missing revenue ${fixed === 1 ? 'entry' : 'entries'}.`,
      skipped ? `${skipped} already recorded elsewhere — skipped.` : '',
      broke.length ? `${broke.length} failed: ${(broke[0] as any).error?.message ?? 'unknown error'}` : '',
    ].filter(Boolean).join(' '))
    loadTab(); router.refresh()
  }
  async function backup() {
    const [leads, revenue, aptitude, students, followups] = await Promise.all([
      supabase.from('leads').select('*').is('deleted_at', null).limit(5000),
      supabase.from('revenue').select('*').is('deleted_at', null).limit(5000),
      supabase.from('aptitude').select('*').is('deleted_at', null).limit(5000),
      supabase.from('students').select('*').is('deleted_at', null).limit(5000),
      supabase.from('followups').select('*').limit(5000),
    ])
    download(`ElectrobtechOMS_v8_Backup_${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ version: 'v8_backup', createdAt: new Date().toISOString(), leads: leads.data, revenue: revenue.data, aptitude: aptitude.data, students: students.data, followups: followups.data }, null, 2), 'application/json')
  }

  const TABS: { k: Tab; l: string }[] = [{ k: 'recycle', l: '🗑 Recycle Bin' }, { k: 'duplicates', l: '🔍 Duplicates' }, { k: 'audit', l: '📋 Audit' }, { k: 'verify', l: '✅ Verification' }, { k: 'backup', l: '💾 Backups' }]
  const kpis = [{ l: 'Leads', v: counts.leads }, { l: 'Revenue', v: counts.revenue }, { l: 'Students', v: counts.students }, { l: 'Aptitude', v: counts.aptitude }]

  return (
    <div className="space-y-5">
      <div><h1 className="text-xl font-semibold text-slate-900">Data Safety</h1><p className="text-sm text-slate-500">Backup · recover · audit · integrity</p></div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{kpis.map((k) => (<div key={k.l} className="rounded-xl border border-slate-200 bg-white p-4"><div className="text-xs text-slate-500">Total {k.l}</div><div className="mt-1 text-xl font-semibold text-slate-900">{k.v.toLocaleString('en-IN')}</div></div>))}</div>

      <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-white p-1 text-sm w-fit">
        {TABS.map((t) => (<button key={t.k} onClick={() => setTab(t.k)} className={`rounded-md px-3 py-1.5 font-medium ${tab === t.k ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>{t.l}</button>))}
      </div>
      {msg && <p className="text-sm text-emerald-600">{msg}</p>}

      {tab === 'recycle' && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm"><thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="px-4 py-3 font-medium">Type</th><th className="px-4 py-3 font-medium">Name</th><th className="px-4 py-3 font-medium">Deleted</th><th className="px-4 py-3 font-medium"></th></tr></thead>
            <tbody>{loading ? <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">Loading…</td></tr> : recycle.length ? recycle.map((r) => (
              <tr key={`${r.table}-${r.id}`} className="border-t border-slate-100"><td className="px-4 py-2.5 capitalize text-slate-600">{r.table}</td><td className="px-4 py-2.5 font-medium text-slate-800">{r.name}</td><td className="px-4 py-2.5 text-slate-500">{String(r.deleted_at).slice(0, 16).replace('T', ' ')}</td>
                <td className="px-4 py-2.5"><button onClick={() => restore(r.table, r.id)} className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-600"><RotateCcw className="h-3 w-3" /> Restore</button></td></tr>
            )) : <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">Recycle bin empty.</td></tr>}</tbody></table>
        </div>
      )}

      {tab === 'duplicates' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 text-sm">
            <span className="text-slate-600">{dupes.leads.length} duplicate leads (by phone) · {dupes.revenue.length} duplicate revenue rows (by fingerprint)</span>
            {(dupes.leads.length + dupes.revenue.length > 0) && <button onClick={purgeDupes} className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600"><Trash2 className="h-3.5 w-3.5" /> Remove duplicates</button>}
          </div>
          {!!dupes.leads.length && <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full text-sm"><thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="px-4 py-3 font-medium">Duplicate Lead</th><th className="px-4 py-3 font-medium">Phone</th></tr></thead><tbody>{dupes.leads.slice(0, 100).map((l) => <tr key={l.id} className="border-t border-slate-100"><td className="px-4 py-2.5 font-medium text-slate-800">{l.name}</td><td className="px-4 py-2.5 text-slate-600">{l.mobile}</td></tr>)}</tbody></table></div>}
        </div>
      )}

      {tab === 'audit' && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm"><thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="px-4 py-3 font-medium">Module</th><th className="px-4 py-3 font-medium">Action</th><th className="px-4 py-3 font-medium">Detail</th><th className="px-4 py-3 font-medium">Time</th></tr></thead>
            <tbody>{loading ? <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">Loading…</td></tr> : audit.length ? audit.map((a, i) => (<tr key={i} className="border-t border-slate-100"><td className="px-4 py-2.5 text-slate-600">{a.module}</td><td className="px-4 py-2.5 text-slate-600">{a.action}</td><td className="px-4 py-2.5 text-slate-500">{a.detail}</td><td className="px-4 py-2.5 text-slate-400">{String(a.created_at).slice(0, 16).replace('T', ' ')}</td></tr>)) : <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">No audit entries yet.</td></tr>}</tbody></table>
        </div>
      )}

      {tab === 'verify' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 text-sm">
            <span className="text-slate-600">{loading ? 'Checking…' : `${verify.length} paid aptitude records missing a revenue entry`}</span>
            {verify.length > 0 && <button onClick={fixVerify} className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white"><ShieldCheck className="h-3.5 w-3.5" /> Auto-fix all</button>}
          </div>
          {!!verify.length && <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full text-sm"><thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="px-4 py-3 font-medium">Name</th><th className="px-4 py-3 font-medium">Phone</th><th className="px-4 py-3 font-medium">Amount</th></tr></thead><tbody>{verify.slice(0, 100).map((a) => <tr key={a.id} className="border-t border-slate-100"><td className="px-4 py-2.5 font-medium text-slate-800">{a.name}</td><td className="px-4 py-2.5 text-slate-600">{a.phone}</td><td className="px-4 py-2.5 text-slate-600">₹{a.payment_amt}</td></tr>)}</tbody></table></div>}
        </div>
      )}

      {tab === 'backup' && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="mb-3 text-sm text-slate-600">Download a full JSON snapshot of all live data (leads, revenue, aptitude, students, follow-ups).</p>
          <button onClick={backup} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"><Database className="h-4 w-4" /> Backup All Data</button>
        </div>
      )}
    </div>
  )
}
