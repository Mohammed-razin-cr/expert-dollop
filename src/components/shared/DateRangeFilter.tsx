'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar } from 'lucide-react'

// baseHref already contains params to preserve, e.g. "/leads?view=active".
export function DateRangeFilter({ from, to, baseHref }: { from: string; to: string; baseHref: string }) {
  const router = useRouter()
  const [f, setF] = useState(from)
  const [t, setT] = useState(to)
  const sep = baseHref.includes('?') ? '&' : '?'

  function apply(nf: string, nt: string) {
    const parts: string[] = []
    if (nf) parts.push(`from=${nf}`)
    if (nt) parts.push(`to=${nt}`)
    router.push(parts.length ? `${baseHref}${sep}${parts.join('&')}` : baseHref)
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2">
      <Calendar className="h-4 w-4 text-slate-400" />
      <input
  type="date"
  value={f}
  onChange={(e) => {
    setF(e.target.value)
    apply(e.target.value, t)
  }}
  className="w-40 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
/>
      <span className="text-slate-400">→</span>
      <input
  type="date"
  value={t}
  onChange={(e) => {
    setT(e.target.value)
    apply(f, e.target.value)
  }}
  className="w-40 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
/>
      {(f || t) && <button onClick={() => { setF(''); setT(''); router.push(baseHref) }} className="rounded-lg border border-slate-200 px-3 py-1 text-slate-600 hover:bg-slate-50">Clear</button>}
    </div>
  )
}
