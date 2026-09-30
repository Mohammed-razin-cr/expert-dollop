import Link from 'next/link'
import { ArrowRight, Megaphone } from 'lucide-react'
import { createClient } from '@/lib/api/server'

const groups = [
  { label: 'Posters', keys: ['poster'] }, { label: 'Videos', keys: ['video','ai_video'] },
  { label: 'Blogs', keys: ['blog'] }, { label: 'Campaigns', keys: ['lead_campaign','google_ads','broadcast'] },
  { label: 'Social Posts', keys: ['instagram','facebook','linkedin'] }, { label: 'Workshops', keys: ['workshop'] },
]

export async function AdminMarketingSummary() {
  const now = new Date(); const current = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)); const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)); const previous = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  const supabase = await createClient()
  const { data = [] } = await supabase.from('tasks').select('marketing_type,published_at,deliverable_count').eq('related_type','digital_marketing').eq('marketing_status','published').is('deleted_at',null).gte('published_at',previous.toISOString()).lt('published_at',next.toISOString())
  const sum = (keys: string[], from: Date, to: Date) => (data ?? []).filter((row: any) => keys.includes(row.marketing_type) && row.published_at >= from.toISOString() && row.published_at < to.toISOString()).reduce((total: number,row: any) => total + Number(row.deliverable_count || 1),0)
  return <section className="rounded-xl border border-slate-200 bg-white p-5"><div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-50 text-blue-700"><Megaphone className="h-4 w-4" /></span><div><h2 className="text-sm font-semibold text-slate-900">Digital Marketing</h2><p className="text-xs text-slate-500">Published this month vs last month</p></div></div><Link href="/admin/digital-marketing" className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline">Open module<ArrowRight className="h-3.5 w-3.5" /></Link></div><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{groups.map((group) => { const a=sum(group.keys,current,next); const b=sum(group.keys,previous,current); const d=a-b; return <Link key={group.label} href={`/admin/digital-marketing?category=${group.keys[0]}`} className="rounded-lg bg-slate-50 px-3 py-2.5 hover:bg-blue-50"><div className="flex items-center justify-between"><span className="text-xs text-slate-600">{group.label}</span><span className={`text-xs font-medium ${d >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{d >= 0 ? '+' : ''}{d}</span></div><p className="mt-1 text-lg font-semibold text-slate-900">{a}</p></Link>})}</div></section>
}
