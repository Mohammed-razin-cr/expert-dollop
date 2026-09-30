'use client'

import { useRouter } from 'next/navigation'
import { Calendar } from 'lucide-react'

// baseHref should already contain any params to preserve, e.g. "/followups?filter=overdue".
export function MonthFilter({ month, baseHref, label }: { month: string; baseHref: string; label?: string }) {
  const router = useRouter()
  const sep = baseHref.includes('?') ? '&' : '?'
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
      <Calendar className="h-4 w-4 text-slate-400" />
      <span className="text-slate-500">{label ?? 'Month'}:</span>
      <input
        type="month"
        value={month}
        onChange={(e) => router.push(e.target.value ? `${baseHref}${sep}m=${e.target.value}` : baseHref)}
        className="rounded-lg border border-slate-200 px-2 py-1 text-sm outline-none focus:border-blue-300"
      />
      {month && <button onClick={() => router.push(baseHref)} className="rounded-lg border border-slate-200 px-3 py-1 text-slate-600 hover:bg-slate-50">All time</button>}
    </div>
  )
}
