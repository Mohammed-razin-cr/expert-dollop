import { notFound } from "next/navigation";
import Link from "next/link";
import {
  BadgeIndianRupee,
  BriefcaseBusiness,
  CalendarDays,
  Camera,
  Clapperboard,
  ClipboardList,
  FileText,
  Image as ImageIcon,
  LayoutDashboard,
  ListTodo,
  MessageCircle,
  PanelsTopLeft,
  Presentation,
  Radio,
  Search,
  Target,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { MarketingModule } from "@/components/marketing/MarketingModule";
import { PreviewProfileMenu } from "@/components/marketing/PreviewProfileMenu";
import { buildMarketingAnalytics } from "@/lib/marketing";
import {
  MARKETING_TYPES,
  MARKETING_PLATFORMS,
  type MarketingStatus,
  type MarketingTask,
  type MarketingType,
} from "@/lib/marketing-shared";

const makeTask = (
  id: string,
  title: string,
  marketing_type: MarketingType,
  marketing_status: MarketingStatus,
  due_date: string,
  published_at: string | null = null,
): MarketingTask => ({
  id,
  title,
  marketing_type,
  marketing_status,
  due_date,
  published_at,
  description: `${title} deliverable and publishing details`,
  status: ["approved", "published"].includes(marketing_status)
    ? "done"
    : marketing_status === "assigned"
      ? "pending"
      : "in_progress",
  priority: id === "1" ? "high" : "medium",
  assigned_to: "preview",
  assignee_name: "Saqib",
  created_by: "admin",
  business_unit: id === "3" ? "Skillfinity" : "Academy",
  platform:
    marketing_type === "google_ads"
      ? "Google"
      : marketing_type === "blog"
        ? "Website"
        : "Instagram",
  campaign_name: "October Admissions",
  work_url: published_at ? "https://example.com/work" : null,
  proof_file_url: null,
  proof_file_name: null,
  deliverable_count: marketing_type === "instagram" ? 4 : 1,
  follower_start: null,
  follower_end: null,
  target_value: null,
  actual_value: null,
  budget: null,
  notes: null,
  assigned_at: "2026-09-18T09:00:00Z",
  submitted_at: ["submitted", "approved", "published"].includes(
    marketing_status,
  )
    ? "2026-09-22T10:00:00Z"
    : null,
  approved_at: ["approved", "published"].includes(marketing_status)
    ? "2026-09-23T10:00:00Z"
    : null,
  created_at: "2026-09-18T09:00:00Z",
  updated_at: "2026-09-24T09:00:00Z",
});
const sample: MarketingTask[] = [
  makeTask(
    "1",
    "Course launch explainer video",
    "video",
    "in_progress",
    "2026-09-25",
  ),
  makeTask(
    "2",
    "October admissions poster",
    "poster",
    "submitted",
    "2026-09-26",
  ),
  makeTask(
    "3",
    "Skillfinity AI testimonial",
    "ai_video",
    "approved",
    "2026-09-28",
  ),
  makeTask(
    "4",
    "Admissions lead campaign",
    "lead_campaign",
    "assigned",
    "2026-09-29",
  ),
  makeTask(
    "5",
    "Career guide blog",
    "blog",
    "published",
    "2026-09-20",
    "2026-09-20T12:00:00Z",
  ),
  makeTask(
    "6",
    "September social content",
    "instagram",
    "published",
    "2026-09-22",
    "2026-09-22T12:00:00Z",
  ),
  makeTask(
    "7",
    "Search admissions campaign",
    "google_ads",
    "rejected",
    "2026-09-30",
  ),
];

const categoryIcons: Record<Exclude<MarketingType, "ai_video">, LucideIcon> = {
  poster: ImageIcon,
  video: Clapperboard,
  lead_campaign: Target,
  google_ads: BadgeIndianRupee,
  broadcast: Radio,
  blog: FileText,
  brochure: PanelsTopLeft,
  seo: Search,
  instagram: Camera,
  facebook: MessageCircle,
  linkedin: BriefcaseBusiness,
  followers: UsersRound,
  workshop: Presentation,
  other: ClipboardList,
};

export default async function MarketingPreview({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; category?: string }>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { view, category: requestedCategory } = await searchParams;
  const category =
    requestedCategory === "ai_video" ? "video" : requestedCategory;
  const work = view === "work";
  return (
    <div className="flex min-h-screen w-full max-w-full bg-slate-50">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-5">
          <img
            src="/electrobtech-logo.jpg"
            alt="Electrobtech"
            className="h-9 w-9 rounded-md object-contain"
          />
          <div>
            <p className="text-sm font-semibold text-slate-900">Electrobtech</p>
            <p className="text-xs text-slate-400">OMS · Digital Marketing</p>
          </div>
        </div>
        <nav className="space-y-1 px-3 py-4">
          <Link
            href="/marketing-preview"
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm ${work ? "text-slate-600" : "bg-blue-50 font-medium text-blue-700"}`}
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Link>
          <Link
            href="/marketing-preview?view=work"
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm ${work && !category ? "bg-blue-50 font-medium text-blue-700" : "text-slate-600"}`}
          >
            <ListTodo className="h-4 w-4" />
            Tasks
          </Link>
          {MARKETING_TYPES.filter((type) => type.key !== "ai_video").map(
            (type) => {
              const CategoryIcon = categoryIcons[type.key];
              return (
                <Link
                  key={type.key}
                  href={`/marketing-preview?view=work&category=${type.key}`}
                  className={`flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors ${category === type.key ? "bg-blue-50 font-medium text-blue-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}
                >
                  <CategoryIcon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{type.label}</span>
                </Link>
              );
            },
          )}
        </nav>
        <div className="mt-auto border-t border-slate-100 px-6 py-4 text-xs text-slate-500">
          Local testing · no database
        </div>
      </aside>
      <div className="min-w-0 w-full flex-1">
        <header className="flex h-16 items-center justify-end gap-5 border-b border-slate-200 bg-white px-6">
          <span className="hidden items-center gap-2 text-sm text-slate-500 sm:flex">
            <CalendarDays className="h-4 w-4" />
            {new Intl.DateTimeFormat("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            }).format(new Date())}
          </span>
          <PreviewProfileMenu />
        </header>
        <main className="p-4 pb-20 sm:p-6">
          <MarketingModule
            testing
            userId="preview"
            firstName="Saqib"
            tasks={sample}
            employees={[{ id: "preview", full_name: "Saqib" }]}
            activities={[]}
            files={[]}
            units={[
              { key: "academy", label: "Academy" },
              { key: "skillfinity", label: "Skillfinity" },
            ]}
            platforms={MARKETING_PLATFORMS.map((label) => ({
              key: label.toLowerCase(),
              label,
            }))}
            analytics={buildMarketingAnalytics(sample, [])}
            error={null}
            mode={work ? "tasks" : "dashboard"}
            category={category}
          />
        </main>
      </div>
      <nav
        aria-label="Preview mobile navigation"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-200 bg-white md:hidden"
      >
        <Link
          href="/marketing-preview"
          className={`flex flex-1 flex-col items-center gap-1 py-2 text-xs ${work ? "text-slate-500" : "text-blue-700"}`}
        >
          <LayoutDashboard className="h-5 w-5" />
          Dashboard
        </Link>
        <Link
          href="/marketing-preview?view=work"
          className={`flex flex-1 flex-col items-center gap-1 py-2 text-xs ${work ? "text-blue-700" : "text-slate-500"}`}
        >
          <ListTodo className="h-5 w-5" />
          Work
        </Link>
      </nav>
    </div>
  );
}
