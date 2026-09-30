'use client'

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'

export type Slice = { name: string; value: number; color: string }

export function CategoryDonut({ data, centerLabel }: { data: Slice[]; centerLabel?: string }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  return (
    <div className="flex items-center gap-4">
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
              // recharts 3 leaves a sector unmounted until its entry animation
              // runs, and inside this ResponsiveContainer it never does: the
              // ring came out as empty <g> elements with no path, so every
              // donut showed a centre total and a legend and nothing between
              // them. Turning the animation off draws the arcs immediately.
              isAnimationActive={false}
            >
              {(total ? data : [{ color: '#e2e8f0' }]).map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="text-center">
            <p className="text-xl font-semibold text-slate-900">{total}</p>
            <p className="text-[11px] text-slate-400">{centerLabel ?? 'Total'}</p>
          </div>
        </div>
      </div>
      <ul className="space-y-1.5 text-sm">
        {data.map((d) => (
          <li key={d.name} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: d.color }} />
            <span className="text-slate-600">{d.name}</span>
            <span className="ml-auto font-medium text-slate-900">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
