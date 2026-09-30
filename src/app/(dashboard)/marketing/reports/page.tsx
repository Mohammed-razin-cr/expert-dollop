import { MarketingAnalyticsPanel } from '@/components/marketing/MarketingAnalyticsPanel'
import { marketingData } from '@/lib/marketing'

export default async function MarketingReportsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month = new Date().toISOString().slice(0, 7) } = await searchParams
  const data = await marketingData(month)
  return <MarketingAnalyticsPanel analytics={data.analytics} month={month} reports />
}
