import { redirect } from 'next/navigation'
import { createClient } from '@/lib/api/server'
import { isStaff, type Role } from '@/lib/rbac'
import { CAMPAIGN_TYPES, MARKETING_TYPES, SOCIAL_TYPES, type MarketingActivity, type MarketingAnalytics, type MarketingEmployee, type MarketingTask } from '@/lib/marketing-shared'

const TASK_COLUMNS = 'id,title,description,marketing_type,marketing_status,due_date,status,priority,assigned_to,created_by,business_unit,platform,campaign_name,work_url,proof_file_url,proof_file_name,deliverable_count,follower_start,follower_end,target_value,actual_value,budget,notes,assigned_at,submitted_at,approved_at,published_at,created_at,updated_at'

const monthBounds = (value?: string) => {
  const key = /^\d{4}-\d{2}$/.test(value ?? '') ? value! : new Date().toISOString().slice(0, 7)
  const [year, month] = key.split('-').map(Number)
  const start = new Date(Date.UTC(year, month - 1, 1)); const end = new Date(Date.UTC(year, month, 1)); const previousStart = new Date(Date.UTC(year, month - 2, 1))
  return { key, start: start.toISOString(), end: end.toISOString(), previousStart: previousStart.toISOString(), label: start.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }), previousLabel: previousStart.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }) }
}
const inRange = (date: string | null, from: string, to: string) => !!date && date >= from && date < to
const percent = (current: number, previous: number) => previous ? ((current - previous) / previous) * 100 : null

export function buildMarketingAnalytics(tasks: MarketingTask[], snapshots: any[], month?: string): MarketingAnalytics {
  const b = monthBounds(month)
  const valueFor = (task: MarketingTask) => Number(task.deliverable_count || 1)
  const metrics = MARKETING_TYPES.filter((type) => !['brochure', 'seo', 'other'].includes(type.key)).map((type) => {
    const current = tasks.filter((t) => t.marketing_type === type.key && inRange(t.published_at, b.start, b.end)).reduce((sum, t) => sum + valueFor(t), 0)
    const previous = tasks.filter((t) => t.marketing_type === type.key && inRange(t.published_at, b.previousStart, b.start)).reduce((sum, t) => sum + valueFor(t), 0)
    return { key: type.key, label: type.label, current, previous, difference: current - previous, percentage: percent(current, previous) }
  })
  const monthlyTrend = Array.from({ length: 6 }, (_, index) => {
    const end = new Date(b.end); end.setUTCMonth(end.getUTCMonth() - (5 - index)); const start = new Date(end); start.setUTCMonth(start.getUTCMonth() - 1)
    const rows = tasks.filter((t) => inRange(t.published_at, start.toISOString(), end.toISOString()))
    const sum = (keys: readonly string[]) => rows.filter((t) => keys.includes(t.marketing_type ?? '')).reduce((n, t) => n + valueFor(t), 0)
    return { month: start.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' }), poster: sum(['poster']), video: sum(['video', 'ai_video']), blog: sum(['blog']), social: sum(SOCIAL_TYPES), campaigns: sum(CAMPAIGN_TYPES), workshop: sum(['workshop']) }
  })
  const platforms = [...new Set((snapshots ?? []).map((row: any) => row.platform))] as string[]
  const latest = (platform: string, from: string, to: string) => (snapshots ?? []).filter((row: any) => row.platform === platform && `${row.snapshot_date}T00:00:00.000Z` >= from && `${row.snapshot_date}T00:00:00.000Z` < to).sort((a: any, z: any) => z.snapshot_date.localeCompare(a.snapshot_date))[0]?.follower_count ?? 0
  const followerGrowth = platforms.map((platform) => { const current = Number(latest(platform, b.start, b.end)); const previous = Number(latest(platform, b.previousStart, b.start)); return { platform, current, previous, growth: current - previous, percentage: percent(current, previous) } })
  return { currentLabel: b.label, previousLabel: b.previousLabel, metrics, monthlyTrend, followerGrowth }
}

async function sharedData(scope: 'mine' | 'all', month?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('full_name,role,role_key').eq('id', user.id).single()
  const role = (profile?.role ?? 'student') as Role
  if (scope === 'mine' && profile?.role_key !== 'digital_marketing') redirect('/dashboard')
  if (scope === 'all' && !isStaff(role)) redirect('/dashboard')
  let taskQuery = supabase.from('tasks').select(TASK_COLUMNS).eq('related_type', 'digital_marketing').is('deleted_at', null).order('created_at', { ascending: false }).limit(5000)
  if (scope === 'mine') taskQuery = taskQuery.eq('assigned_to', user.id)
  const [{ data: taskRows = [], error }, { data: employees = [] }, { data: units = [] }, { data: platforms = [] }] = await Promise.all([
    taskQuery,
    supabase.from('profiles').select('id,full_name,email').eq('role_key', 'digital_marketing').is('deleted_at', null).order('full_name'),
    supabase.from('marketing_business_units').select('key,label').eq('active', true).order('sort'),
    supabase.from('marketing_platforms').select('key,label').eq('active', true).order('sort'),
  ])
  const tasks = (taskRows ?? []) as unknown as MarketingTask[]; const employeeList = (employees ?? []) as MarketingEmployee[]
  const names = Object.fromEntries(employeeList.map((employee) => [employee.id, employee.full_name])); tasks.forEach((task) => { task.assignee_name = task.assigned_to ? names[task.assigned_to] ?? 'Unassigned' : 'Unassigned' })
  const taskIds = tasks.map((task) => task.id)
  const [{ data: activityRows = [] }, { data: snapshots = [] }, { data: files = [] }] = await Promise.all([
    taskIds.length ? supabase.from('marketing_task_activity').select('id,task_id,actor_id,action,from_status,to_status,details,created_at').in('task_id', taskIds).order('created_at', { ascending: false }).limit(1000) : Promise.resolve({ data: [] }),
    supabase.from('marketing_social_snapshots').select('*').order('snapshot_date', { ascending: false }).limit(5000),
    taskIds.length ? supabase.from('marketing_task_files').select('*').in('task_id', taskIds).is('deleted_at', null).order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),
  ])
  const titles = Object.fromEntries(tasks.map((task) => [task.id, task.title])); const activities = (activityRows ?? []).map((row: any) => ({ ...row, actor_name: row.actor_id ? names[row.actor_id] ?? 'Admin' : 'System', task_title: titles[row.task_id] ?? 'Task' })) as MarketingActivity[]
  return { userId: user.id, firstName: (profile?.full_name ?? 'there').split(' ')[0], role, tasks, employees: employeeList, activities, files: files ?? [], units: units ?? [], platforms: platforms ?? [], snapshots: snapshots ?? [], analytics: buildMarketingAnalytics(tasks, snapshots ?? [], month), error: error?.message ?? null }
}

export const marketingData = (month?: string) => sharedData('mine', month)
export const adminMarketingData = (month?: string) => sharedData('all', month)
