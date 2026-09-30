import { MarketingModule } from '@/components/marketing/MarketingModule'
import { marketingData } from '@/lib/marketing'

export default async function MarketingPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const data = await marketingData()
  const { category } = await searchParams
  return <MarketingModule {...data} mode="tasks" category={category} />
}
