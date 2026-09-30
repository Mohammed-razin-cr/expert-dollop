'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save } from 'lucide-react'
import { createClient } from '@/lib/api/client'

const inp = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100'

export function SettingsClient({ initial }: { initial: Record<string, string> }) {
  const router = useRouter()
  const supabase = createClient()
  const [f, setF] = useState({
    commission_pct: initial.commission_pct ?? '5',
    aptitude_fee: initial.aptitude_fee ?? '99',
    gsheet_url: initial.gsheet_url ?? '',
    auto_backup: (initial.auto_backup ?? 'true') === 'true',
  })
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const set = (k: string, v: any) => { setF((p) => ({ ...p, [k]: v })); setSaved(false) }

  async function save() {
    setBusy(true)
    const rows = [
      { key: 'commission_pct', value: String(f.commission_pct) },
      { key: 'aptitude_fee', value: String(f.aptitude_fee) },
      { key: 'gsheet_url', value: f.gsheet_url },
      { key: 'auto_backup', value: String(f.auto_backup) },
    ].map((r) => ({ ...r, updated_at: new Date().toISOString() }))
    await supabase.from('app_settings').upsert(rows, { onConflict: 'key' })
    setBusy(false); setSaved(true); router.refresh()
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div><h1 className="text-xl font-semibold text-slate-900">Settings</h1><p className="text-sm text-slate-500">System configuration</p></div>

      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">BD Commission Rate (%)</label>
          <input className={inp} type="number" value={f.commission_pct} onChange={(e) => set('commission_pct', e.target.value)} />
          <p className="mt-1 text-xs text-slate-400">Used by the BD Finance commission card.</p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Default Aptitude Fee (₹)</label>
          <input className={inp} type="number" value={f.aptitude_fee} onChange={(e) => set('aptitude_fee', e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Google Sheet Apps Script URL</label>
          <input className={inp} placeholder="https://script.google.com/macros/s/…/exec" value={f.gsheet_url} onChange={(e) => set('gsheet_url', e.target.value)} />
          <p className="mt-1 text-xs text-slate-400">Used by the Google-Sheet lead import.</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={f.auto_backup} onChange={(e) => set('auto_backup', e.target.checked)} /> Enable daily auto-backup reminder
        </label>
        <div className="flex items-center gap-3 pt-1">
          <button onClick={save} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"><Save className="h-4 w-4" /> {busy ? 'Saving…' : 'Save Settings'}</button>
          {saved && <span className="text-sm text-emerald-600">Saved ✓</span>}
        </div>
      </div>
    </div>
  )
}
