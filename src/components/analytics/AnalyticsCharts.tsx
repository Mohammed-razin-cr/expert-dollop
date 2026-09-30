'use client'

import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from 'recharts'

const COLORS = ['#6366f1', '#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#64748b']
type D = { name: string; value: number }

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 text-sm font-semibold text-slate-800">{title}</div>
      <div style={{ width: '100%', height: 260, minWidth: 0 }}>
        {mounted ? children : <div className="h-full w-full animate-pulse rounded-lg bg-slate-50" />}
      </div>
    </div>
  )
}

export function AnalyticsCharts({ source, track, revBd, leadBd, trend }: { source: D[]; track: D[]; revBd: D[]; leadBd: D[]; trend: { month: string; value: number }[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card title="Leads by Source">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}><BarChart data={source}><CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
      </Card>
      <Card title="Students by Track">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}><PieChart><Pie data={track} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>{track.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
      </Card>
      <Card title="Revenue per BD">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}><BarChart data={revBd}><CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip formatter={(v: any) => '₹' + Number(v).toLocaleString('en-IN')} /><Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
      </Card>
      <Card title="Lead Distribution per BD">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}><PieChart><Pie data={leadBd} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>{leadBd.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
      </Card>
      <div className="lg:col-span-2"><Card title="Lead Trend (by month)">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}><LineChart data={trend}><CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} /></LineChart></ResponsiveContainer>
      </Card></div>
    </div>
  )
}
