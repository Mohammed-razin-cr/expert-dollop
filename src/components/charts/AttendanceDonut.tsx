'use client'

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { pctLabel } from '@/lib/format'

export type DonutDatum = { name: string; value: number; color: string }

/**
 * Attendance breakdown as a ring with a legend beside it.
 *
 * `overall` fills the hole with a headline figure — pass null for a figure
 * that cannot be computed yet, which still reads as "nothing here" rather
 * than leaving the middle blank. Omit it entirely for a plain ring.
 */
export function AttendanceDonut({
  data,
  overall,
  overallLabel = 'Overall',
}: {
  data: DonutDatum[]
  overall?: number | null
  overallLabel?: string
}) {
  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <div className="flex items-center gap-6">
      <div className="relative h-40 w-40 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={total ? data : [{ name: 'No data', value: 1, color: '#e2e8f0' }]}
              dataKey="value"
              innerRadius={48}
              outerRadius={70}
              paddingAngle={2}
              stroke="none"
            >
              {(total ? data : [{ color: '#e2e8f0' }]).map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {overall !== undefined && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="text-center">
              <p className="text-xl font-semibold text-slate-900">
                {overall === null ? '—' : `${overall}%`}
              </p>
              <p className="text-[11px] text-slate-400">{overallLabel}</p>
            </div>
          </div>
        )}
      </div>

      <ul className="space-y-2.5 text-sm">
        {data.map((d) => (
          <li key={d.name} className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
            <span className="w-16 text-slate-600">{d.name}</span>
            <span className="w-8 text-right font-medium text-slate-900">{d.value}</span>
            <span className="w-16 text-right text-slate-500">({pctLabel(d.value, total)})</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
