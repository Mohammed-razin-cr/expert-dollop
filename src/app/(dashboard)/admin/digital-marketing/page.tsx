import { MarketingAnalyticsPanel } from '@/components/marketing/MarketingAnalyticsPanel'
import { MarketingModule } from '@/components/marketing/MarketingModule'
import { adminMarketingData } from '@/lib/marketing'

export default async function AdminMarketingPage({ searchParams }: { searchParams: Promise<{ view?: string; month?: string; category?: string }> }) {
  const { view = 'overview', month = new Date().toISOString().slice(0, 7), category } = await searchParams
  const data = await adminMarketingData(month)
  if (view === 'analytics' || view === 'reports') return <MarketingAnalyticsPanel analytics={data.analytics} month={month} reports={view === 'reports'} />
  return <MarketingModule {...data} admin mode={view === 'tasks' || view === 'approvals' ? 'tasks' : 'dashboard'} category={category} />
}
