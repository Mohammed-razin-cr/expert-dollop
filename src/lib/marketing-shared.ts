export const MARKETING_TYPES = [
  { key: 'poster', label: 'Posters', singular: 'Poster', icon: 'Image' },
  { key: 'video', label: 'Videos', singular: 'Video', icon: 'Clapperboard' },
  { key: 'ai_video', label: 'AI Videos', singular: 'AI Video', icon: 'WandSparkles' },
  { key: 'lead_campaign', label: 'Lead Campaigns', singular: 'Lead Campaign', icon: 'Target' },
  { key: 'google_ads', label: 'Google Ads', singular: 'Google Ad', icon: 'BadgeIndianRupee' },
  { key: 'broadcast', label: 'Broadcasts', singular: 'Broadcast', icon: 'Radio' },
  { key: 'blog', label: 'Blogs', singular: 'Blog', icon: 'FileText' },
  { key: 'brochure', label: 'Brochures', singular: 'Brochure', icon: 'PanelsTopLeft' },
  { key: 'seo', label: 'SEO', singular: 'SEO activity', icon: 'Search' },
  { key: 'instagram', label: 'Instagram', singular: 'Instagram content', icon: 'Instagram' },
  { key: 'facebook', label: 'Facebook', singular: 'Facebook content', icon: 'Facebook' },
  { key: 'linkedin', label: 'LinkedIn', singular: 'LinkedIn content', icon: 'Linkedin' },
  { key: 'followers', label: 'Followers & Community', singular: 'Growth update', icon: 'UsersRound' },
  { key: 'workshop', label: 'Workshops', singular: 'Workshop', icon: 'Presentation' },
  { key: 'other', label: 'Other', singular: 'Marketing activity', icon: 'ClipboardList' },
] as const

export const MARKETING_STATUSES = [
  { key: 'assigned', label: 'Assigned' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'approved', label: 'Approved' },
  { key: 'published', label: 'Published' },
  { key: 'rejected', label: 'Rejected' },
] as const

export const MARKETING_PLATFORMS = ['Instagram', 'Facebook', 'LinkedIn', 'WhatsApp', 'YouTube', 'Website', 'Email', 'Google', 'Other'] as const
export const BUSINESS_UNITS = ['Company', 'Academy', 'Skillfinity', 'Other'] as const

export type MarketingType = (typeof MARKETING_TYPES)[number]['key']
export type MarketingStatus = (typeof MARKETING_STATUSES)[number]['key']

export type MarketingTask = {
  id: string
  title: string
  description: string | null
  marketing_type: MarketingType | string | null
  marketing_status: MarketingStatus
  due_date: string | null
  status: 'pending' | 'in_progress' | 'done' | 'cancelled'
  priority: 'low' | 'medium' | 'high'
  assigned_to: string | null
  assignee_name?: string | null
  created_by: string | null
  business_unit: string | null
  platform: string | null
  campaign_name: string | null
  work_url: string | null
  proof_file_url: string | null
  proof_file_name: string | null
  deliverable_count: number
  follower_start: number | null
  follower_end: number | null
  target_value: number | null
  actual_value: number | null
  budget: number | null
  notes: string | null
  assigned_at: string
  submitted_at: string | null
  approved_at: string | null
  published_at: string | null
  created_at: string
  updated_at: string
}

export type MarketingActivity = {
  id: string
  task_id: string
  actor_id: string | null
  actor_name?: string | null
  action: string
  from_status: MarketingStatus | null
  to_status: MarketingStatus | null
  details: string | null
  created_at: string
  task_title?: string | null
}

export type MarketingEmployee = { id: string; full_name: string; email?: string | null }
export type MarketingMetric = { key: MarketingType; label: string; current: number; previous: number; difference: number; percentage: number | null }
export type MarketingAnalytics = {
  currentLabel: string
  previousLabel: string
  metrics: MarketingMetric[]
  monthlyTrend: Array<{ month: string; poster: number; video: number; blog: number; social: number; campaigns: number; workshop: number }>
  followerGrowth: Array<{ platform: string; current: number; previous: number; growth: number; percentage: number | null }>
}

export const SOCIAL_TYPES: MarketingType[] = ['instagram', 'facebook', 'linkedin']
export const CAMPAIGN_TYPES: MarketingType[] = ['lead_campaign', 'google_ads', 'broadcast']
export const typeLabel = (key: string | null | undefined) => MARKETING_TYPES.find((item) => item.key === key)?.singular ?? 'Marketing activity'
export const statusLabel = (key: string | null | undefined) => MARKETING_STATUSES.find((item) => item.key === key)?.label ?? 'Assigned'
