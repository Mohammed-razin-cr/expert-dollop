'use client'

import { useState } from 'react'
import { FileText, ShieldCheck, Download, CheckCircle2 } from 'lucide-react'
import { offerLetterBody, ndaBody, type OnboardDetails } from './letters'
import { printDoc } from '@/lib/printDoc'

// function printDoc(title: string, bodyHTML: string) {
//   const w = window.open('', '_blank', 'width=820,height=900')
//   if (!w) return
//   w.document.write(`<!doctype html><html><head><title>${title}</title>
//   <style>*{font-family:Arial,Helvetica,sans-serif;box-sizing:border-box} body{margin:0;padding:36px;color:#1e293b} @media print{.noprint{display:none}}</style>
//   </head><body>${bodyHTML}
//   <div class="noprint" style="margin-top:24px;text-align:center"><button onclick="window.print()" style="background:#2563eb;color:#fff;border:0;padding:10px 20px;border-radius:8px;cursor:pointer;font-size:14px">Print / Save as PDF</button></div>
//   </body></html>`)
//   w.document.close()
// }

export function AcceptPortal({ token, details, alreadyAccepted, acceptedName }: { token: string; details: OnboardDetails; alreadyAccepted: boolean; acceptedName: string | null }) {
  const offer = offerLetterBody(details)
  const nda = ndaBody(details)
  const [tab, setTab] = useState<'offer' | 'nda'>('offer')
  const [okOffer, setOkOffer] = useState(false)
  const [okNda, setOkNda] = useState(false)
  const [name, setName] = useState(acceptedName ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState(alreadyAccepted)

  async function accept() {
    if (!okOffer || !okNda) return setErr('Please accept both the Offer Letter and the NDA.')
    if (!name.trim()) return setErr('Please type your full name as your signature.')
    setBusy(true); setErr(null)
    try {
      const res = await fetch('/api/onboard/accept', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, name: name.trim() }) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Could not record acceptance.')
      setDone(true)
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-5 flex items-center gap-3">
          <img src="/electrobtech-logo.jpg" alt="Electrobtech" className="h-11 w-11 rounded-lg object-contain" />
          <div><h1 className="text-lg font-semibold text-slate-900">Welcome, {details.intern_name}</h1><p className="text-sm text-slate-500">Please review and accept your onboarding documents</p></div>
        </div>

        {done && (
          <div className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            <CheckCircle2 className="h-5 w-5" /> Documents accepted{acceptedName ? ` by ${acceptedName}` : ''}. You can download your copies below.
          </div>
        )}

        <div className="mb-3 flex gap-1 rounded-lg border border-slate-200 bg-white p-1 text-sm w-fit">
          <button onClick={() => setTab('offer')} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium ${tab === 'offer' ? 'bg-blue-600 text-white' : 'text-slate-600'}`}><FileText className="h-4 w-4" /> Offer Letter</button>
          <button onClick={() => setTab('nda')} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium ${tab === 'nda' ? 'bg-blue-600 text-white' : 'text-slate-600'}`}><ShieldCheck className="h-4 w-4" /> NDA</button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div dangerouslySetInnerHTML={{ __html: tab === 'offer' ? offer : nda }} />
        </div>

        {!done ? (
          <div className="mt-5 rounded-xl border border-slate-200 bg-white p-5">
            <label className="flex items-start gap-2 py-1.5 text-sm text-slate-700"><input type="checkbox" checked={okOffer} onChange={(e) => setOkOffer(e.target.checked)} className="mt-0.5" /> I have read and accept the <b>Internship Offer Letter</b>.</label>
            <label className="flex items-start gap-2 py-1.5 text-sm text-slate-700"><input type="checkbox" checked={okNda} onChange={(e) => setOkNda(e.target.checked)} className="mt-0.5" /> I have read and accept the <b>Non-Disclosure Agreement</b>.</label>
            <div className="mt-3"><label className="mb-1 block text-xs text-slate-500">Type your full name (digital signature)</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="w-full max-w-sm rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300" /></div>
            {err && <p className="mt-2 text-sm text-rose-600">{err}</p>}
            <button onClick={accept} disabled={busy} className="mt-4 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{busy ? 'Submitting…' : 'Accept & Continue'}</button>
          </div>
        ) : (
          <div className="mt-5 flex flex-wrap gap-3">
            <button onClick={() => printDoc('Internship Offer Letter', offer)} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"><Download className="h-4 w-4" /> Download Offer Letter</button>
            <button onClick={() => printDoc('Non-Disclosure Agreement', nda)} className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-900"><Download className="h-4 w-4" /> Download NDA</button>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-slate-400">Electrobtech Innovations Pvt Ltd · This is a secure onboarding link.</p>
      </div>
    </div>
  )
}
