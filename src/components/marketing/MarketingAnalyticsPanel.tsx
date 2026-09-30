'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart3, Download, FileSpreadsheet, Printer, TrendingDown, TrendingUp } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { MarketingAnalytics } from '@/lib/marketing-shared'

const chartTooltip = { fontSize: 12, borderRadius: 6, border: '1px solid #e2e8f0' }

export function MarketingAnalyticsPanel({ analytics, month, reports = false }: { analytics: MarketingAnalytics; month: string; reports?: boolean }) {
  const router = useRouter()
  const comparison = useMemo(() => analytics.metrics.map((metric) => ({ name: metric.label.replace('Lead Campaigns', 'Campaigns').replace('Followers & Community', 'Followers'), current: metric.current, previous: metric.previous })), [analytics])
  const exportCsv = () => {
    const lines = [['Metric', analytics.currentLabel, analytics.previousLabel, 'Difference', 'Change %'], ...analytics.metrics.map((m) => [m.label, m.current, m.previous, m.difference, m.percentage == null ? 'New' : m.percentage.toFixed(2)])]
    const blob = new Blob([lines.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `digital-marketing-${month}.csv`; link.click(); URL.revokeObjectURL(url)
  }
  const exportExcel = async () => {
    const XLSX = await import('xlsx')
    const rows = analytics.metrics.map((m) => ({ Metric: m.label, [analytics.currentLabel]: m.current, [analytics.previousLabel]: m.previous, Difference: m.difference, 'Change %': m.percentage == null ? 'New' : Number(m.percentage.toFixed(2)) }))
    const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Monthly comparison'); XLSX.writeFile(workbook, `digital-marketing-${month}.xlsx`)
  }
  return <div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-xl font-semibold text-slate-900">{reports ? 'Digital Marketing Report' : 'Marketing Analytics'}</h1><p className="mt-1 text-sm text-slate-500">Published output and growth from persistent activity records.</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs font-medium text-slate-600">Month<input aria-label="Report month" type="month" value={month} onChange={(event) => router.push(`?month=${event.target.value}`)} className="ml-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm" /></label>
        {reports && <><button type="button" onClick={exportCsv} className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"><Download className="h-4 w-4" />CSV</button><button type="button" onClick={exportExcel} className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"><FileSpreadsheet className="h-4 w-4" />Excel</button><button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"><Printer className="h-4 w-4" />Print</button></>}
      </div>
    </div>

    <section className="overflow-hidden rounded-md border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-3"><h2 className="text-sm font-semibold text-slate-900">{analytics.currentLabel} vs {analytics.previousLabel}</h2></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="px-4 py-3 font-medium">Metric</th><th className="px-4 py-3 font-medium">{analytics.currentLabel}</th><th className="px-4 py-3 font-medium">{analytics.previousLabel}</th><th className="px-4 py-3 font-medium">Difference</th><th className="px-4 py-3 font-medium">Change</th></tr></thead><tbody>{analytics.metrics.map((metric) => { const up = metric.difference >= 0; const Icon = up ? TrendingUp : TrendingDown; return <tr key={metric.key} className="border-t border-slate-100"><td className="px-4 py-3 font-medium text-slate-800">{metric.label}</td><td className="px-4 py-3 font-semibold text-slate-900">{metric.current}</td><td className="px-4 py-3 text-slate-600">{metric.previous}</td><td className={`px-4 py-3 font-medium ${up ? 'text-emerald-700' : 'text-rose-700'}`}>{up ? '+' : ''}{metric.difference}</td><td className="px-4 py-3"><span className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium ${up ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}><Icon className="h-3.5 w-3.5" />{metric.percentage == null ? (metric.current ? 'New' : '0%') : `${metric.percentage >= 0 ? '+' : ''}${metric.percentage.toFixed(2)}%`}</span></td></tr> })}</tbody></table></div>
    </section>

    <div className="grid gap-5 xl:grid-cols-2">
      <section className="rounded-md border border-slate-200 bg-white p-4"><div className="mb-4 flex items-center gap-2"><BarChart3 className="h-4 w-4 text-blue-700" /><h2 className="text-sm font-semibold text-slate-900">Current vs previous month</h2></div><div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={comparison} margin={{ left: -20, right: 8 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} interval={0} angle={-25} textAnchor="end" height={72} /><YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#64748b' }} /><Tooltip contentStyle={chartTooltip} /><Legend /><Bar name={analytics.currentLabel} dataKey="current" fill="#2563eb" radius={[3,3,0,0]} /><Bar name={analytics.previousLabel} dataKey="previous" fill="#94a3b8" radius={[3,3,0,0]} /></BarChart></ResponsiveContainer></div></section>
      <section className="rounded-md border border-slate-200 bg-white p-4"><h2 className="mb-4 text-sm font-semibold text-slate-900">Six-month published output</h2><div className="h-72"><ResponsiveContainer width="100%" height="100%"><LineChart data={analytics.monthlyTrend} margin={{ left: -20, right: 8 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} /><YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#64748b' }} /><Tooltip contentStyle={chartTooltip} /><Legend /><Line type="monotone" dataKey="poster" name="Posters" stroke="#2563eb" strokeWidth={2} /><Line type="monotone" dataKey="video" name="Videos" stroke="#0891b2" strokeWidth={2} /><Line type="monotone" dataKey="blog" name="Blogs" stroke="#7c3aed" strokeWidth={2} /><Line type="monotone" dataKey="social" name="Social" stroke="#16a34a" strokeWidth={2} /><Line type="monotone" dataKey="campaigns" name="Campaigns" stroke="#d97706" strokeWidth={2} /><Line type="monotone" dataKey="workshop" name="Workshops" stroke="#e11d48" strokeWidth={2} /></LineChart></ResponsiveContainer></div></section>
    </div>

    <section className="rounded-md border border-slate-200 bg-white"><div className="border-b border-slate-100 px-4 py-3"><h2 className="text-sm font-semibold text-slate-900">Follower & community growth</h2></div>{analytics.followerGrowth.length ? <div className="grid gap-px bg-slate-100 sm:grid-cols-2 xl:grid-cols-4">{analytics.followerGrowth.map((row) => <div key={row.platform} className="bg-white p-4"><p className="text-xs text-slate-500">{row.platform}</p><p className="mt-1 text-xl font-semibold text-slate-900">{row.current.toLocaleString('en-IN')}</p><p className={`mt-1 text-xs font-medium ${row.growth >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{row.growth >= 0 ? '+' : ''}{row.growth.toLocaleString('en-IN')} {row.percentage == null ? '' : `(${row.percentage.toFixed(2)}%)`}</p></div>)}</div> : <p className="px-4 py-10 text-center text-sm text-slate-500">No follower snapshots recorded for this period.</p>}</section>
  </div>
}
