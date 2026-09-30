"use client";

import { useEffect, useMemo, useState } from "react";
import * as Icons from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  MARKETING_TYPES,
  typeLabel,
  type MarketingTask,
} from "@/lib/marketing-shared";

const lifecycleColors = {
  published: "#e83e8c",
  approved: "#10b981",
  review: "#f6ad2f",
  progress: "#38a9db",
  assigned: "#6f52bd",
};

const taskColors = [
  "#f3a321",
  "#e83e8c",
  "#14b88a",
  "#7254bd",
  "#38a9db",
  "#ef6b3f",
  "#5965d8",
  "#16a3a1",
  "#d94f9d",
  "#8b5cc7",
];

function TypeIcon({ type }: { type: string | null }) {
  const name =
    MARKETING_TYPES.find((item) => item.key === type)?.icon ?? "ClipboardList";
  const Icon =
    (
      Icons as unknown as Record<
        string,
        React.ComponentType<{ className?: string }>
      >
    )[name] ?? Icons.ClipboardList;
  return <Icon className="h-4 w-4" />;
}

function TaskValueLabel(props: any) {
  const { x = 0, y = 0, width = 0, value = 0, index = 0 } = props;
  const color = taskColors[index % taskColors.length];
  return (
    <g transform={`translate(${x + width / 2 - 19}, ${Math.max(2, y - 27)})`}>
      <rect width="38" height="21" rx="6" fill={color} />
      <circle cx="10" cy="10.5" r="3" fill="white" fillOpacity="0.9" />
      <text
        x="25"
        y="14"
        textAnchor="middle"
        fill="white"
        fontSize="10"
        fontWeight="700"
      >
        {value}
      </text>
    </g>
  );
}

export function MarketingProgressTracker({
  tasks,
  selectedCategory,
  onSelectCategory,
  employee = "all",
}: {
  tasks: MarketingTask[];
  selectedCategory?: string | null;
  onSelectCategory?: (category: string | null) => void;
  employee?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReduceMotion(media.matches);
    updatePreference();
    media.addEventListener("change", updatePreference);
    setMounted(true);
    return () => media.removeEventListener("change", updatePreference);
  }, []);

  const analytics = useMemo(() => {
    const relevant = tasks.filter(
      (task) => employee === "all" || task.assigned_to === employee,
    );
    const taskValue = (task: MarketingTask) =>
      Math.max(1, Number(task.deliverable_count) || 1);
    const deliverables = relevant.reduce(
      (sum, task) => sum + taskValue(task),
      0,
    );
    const lifecycle = [
      {
        key: "published",
        name: "Published",
        value: relevant
          .filter((task) => task.marketing_status === "published")
          .reduce((sum, task) => sum + taskValue(task), 0),
      },
      {
        key: "approved",
        name: "Approved",
        value: relevant
          .filter((task) => task.marketing_status === "approved")
          .reduce((sum, task) => sum + taskValue(task), 0),
      },
      {
        key: "review",
        name: "In review",
        value: relevant
          .filter((task) => task.marketing_status === "submitted")
          .reduce((sum, task) => sum + taskValue(task), 0),
      },
      {
        key: "progress",
        name: "In progress",
        value: relevant
          .filter((task) =>
            ["in_progress", "rejected"].includes(task.marketing_status),
          )
          .reduce((sum, task) => sum + taskValue(task), 0),
      },
      {
        key: "assigned",
        name: "Assigned",
        value: relevant
          .filter((task) => task.marketing_status === "assigned")
          .reduce((sum, task) => sum + taskValue(task), 0),
      },
    ];
    const published = lifecycle[0].value;
    const completion = deliverables
      ? Math.round((published / deliverables) * 100)
      : 0;
    const categoryMap = new Map<string, { value: number; published: number }>();
    for (const task of relevant) {
      const key =
        task.marketing_type === "ai_video"
          ? "video"
          : (task.marketing_type ?? "other");
      const entry = categoryMap.get(key) ?? { value: 0, published: 0 };
      entry.value += taskValue(task);
      if (task.marketing_status === "published") {
        entry.published += taskValue(task);
      }
      categoryMap.set(key, entry);
    }
    const orderedKeys = [
      ...MARKETING_TYPES.map((type) => type.key).filter(
        (key) => key !== "ai_video" && categoryMap.has(key),
      ),
      ...[...categoryMap.keys()].filter(
        (key) => !MARKETING_TYPES.some((type) => type.key === key),
      ),
    ];
    const taskChart = orderedKeys.map((key, index) => {
      const values = categoryMap.get(key) ?? { value: 0, published: 0 };
      const rawLabel = key === "video" ? "Videos" : typeLabel(key);
      return {
        key,
        label: rawLabel.replace(" content", ""),
        shortLabel:
          key === "lead_campaign"
            ? "Campaigns"
            : key === "followers"
              ? "Community"
              : rawLabel.replace(" content", ""),
        value: values.value,
        published: values.published,
        color: taskColors[index % taskColors.length],
      };
    });
    const categories = [...taskChart]
      .sort((a, b) => b.value - a.value)
      .slice(0, 4);

    return {
      deliverables,
      published,
      completion,
      lifecycle,
      taskChart,
      categories,
    };
  }, [tasks, employee]);

  return (
    <section className="dashboard-enter grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.8fr)_minmax(280px,0.72fr)]">
      <div className="dashboard-panel dashboard-panel-primary overflow-hidden rounded-md border border-white/90 bg-white/78 shadow-[0_18px_48px_-34px_rgba(15,23,42,0.42)] backdrop-blur-xl">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3.5 sm:px-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Task output overview
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              All deliverables by activity type
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-100 bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700">
            <Icons.Clapperboard className="h-3.5 w-3.5" /> Videos + AI Videos
          </span>
        </div>

        <div className="grid gap-2 px-4 py-3 sm:grid-cols-[140px_minmax(0,1fr)] sm:px-5">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-1 sm:content-center">
            {[
              ["Total output", analytics.deliverables],
              ["Published", analytics.published],
              ["Completion", `${analytics.completion}%`],
            ].map(([label, value]) => (
              <div key={label} className="border-l-2 border-pink-400 pl-3">
                <p className="text-[11px] text-slate-400">{label}</p>
                <p className="mt-0.5 text-lg font-semibold text-slate-900">
                  {value}
                </p>
              </div>
            ))}
          </div>
          <div className="min-w-0 overflow-x-auto">
            <div
              className="h-[235px] sm:h-[210px]"
              style={{
                minWidth: Math.max(300, analytics.taskChart.length * 68),
              }}
            >
              {mounted ? (
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                  initialDimension={{ width: 650, height: 210 }}
                  debounce={50}
                >
                  <BarChart
                    data={analytics.taskChart}
                    barCategoryGap="44%"
                    margin={{ top: 30, right: 8, left: -24, bottom: 4 }}
                  >
                    <CartesianGrid
                      vertical={false}
                      stroke="#e8edf4"
                      strokeDasharray="3 3"
                    />
                    <XAxis
                      dataKey="shortLabel"
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                      tick={{ fill: "#64748b", fontSize: 10 }}
                    />
                    <YAxis
                      allowDecimals={false}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#94a3b8", fontSize: 10 }}
                    />
                    <Tooltip
                      isAnimationActive={!reduceMotion}
                      cursor={{ fill: "#f8fafc", opacity: 0.75 }}
                      content={({ active, payload }: any) => {
                        if (!active || !payload?.length) return null;
                        const item = payload[0].payload;
                        return (
                          <div className="min-w-[160px] rounded-md border border-white/90 bg-white/95 p-3 text-xs shadow-[0_16px_36px_-18px_rgba(15,23,42,.35)] backdrop-blur-xl">
                            <p className="font-semibold text-slate-900">
                              {item.label}
                            </p>
                            <div className="mt-2 space-y-1 text-slate-500">
                              <p className="flex justify-between gap-4">
                                <span>Total deliverables</span>
                                <strong className="text-slate-900">
                                  {item.value}
                                </strong>
                              </p>
                              <p className="flex justify-between gap-4">
                                <span>Published</span>
                                <strong className="text-emerald-600">
                                  {item.published}
                                </strong>
                              </p>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Bar
                      dataKey="value"
                      barSize={13}
                      radius={[4, 4, 0, 0]}
                      background={{ fill: "#eef2f7", radius: 4 }}
                      isAnimationActive={!reduceMotion}
                      animationDuration={850}
                      animationEasing="ease-out"
                    >
                      {analytics.taskChart.map((item) => (
                        <Cell key={item.key} fill={item.color} />
                      ))}
                      <LabelList dataKey="value" content={<TaskValueLabel />} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="grid h-full place-items-center text-xs text-slate-400">
                  Loading task chart...
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="border-t border-slate-100 bg-slate-50/35 px-4 py-3 sm:px-5">
          <div className="mb-2.5 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold uppercase text-slate-500">
                Top outputs
              </span>
              <p className="mt-0.5 text-[10px] text-slate-400">
                Highest-volume activity types
              </p>
            </div>
            {selectedCategory && (
              <button
                type="button"
                onClick={() => onSelectCategory?.(null)}
                className="text-[11px] font-medium text-pink-600 hover:underline"
              >
                Clear filter
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {analytics.categories.map((category) => {
              const maximum = analytics.categories[0]?.value || 1;
              const label = category.label.replace(" content", "");
              return (
                <button
                  key={category.key}
                  type="button"
                  onClick={() =>
                    onSelectCategory?.(
                      selectedCategory === category.key ? null : category.key,
                    )
                  }
                  className={`dashboard-output-card min-w-0 rounded border px-2.5 py-2 text-left transition duration-200 hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 motion-reduce:transform-none ${selectedCategory === category.key ? "border-pink-300 bg-pink-50 text-pink-700" : "border-slate-100 bg-white/80 text-slate-600 hover:border-pink-100 hover:bg-white"}`}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded bg-slate-100 text-slate-500">
                      <TypeIcon type={category.key} />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[11px] font-medium">
                      {label}
                    </span>
                    <strong className="text-xs">{category.value}</strong>
                  </div>
                  <div className="ml-9 mt-1.5 h-1 overflow-hidden rounded-full bg-slate-100">
                    <span
                      className="dashboard-progress-grow block h-full rounded-full bg-gradient-to-r from-pink-500 to-violet-500 transition-[width] duration-500 motion-reduce:transition-none"
                      style={{ width: `${(category.value / maximum) * 100}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="dashboard-panel dashboard-panel-secondary overflow-hidden rounded-md border border-white/90 bg-white/82 shadow-[0_18px_48px_-34px_rgba(15,23,42,0.42)] backdrop-blur-xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3.5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Lifecycle overview
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Current delivery distribution
            </p>
          </div>
          <span className="rounded-full border border-pink-100 bg-pink-50 px-2.5 py-1 text-[11px] font-semibold text-pink-700">
            {analytics.completion}% complete
          </span>
        </div>
        <div className="dashboard-ring relative mx-auto h-[142px] max-w-[230px]">
          {mounted && (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analytics.lifecycle}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={45}
                  outerRadius={61}
                  paddingAngle={3}
                  cornerRadius={4}
                  stroke="white"
                  strokeWidth={3}
                  isAnimationActive={!reduceMotion}
                  animationDuration={750}
                >
                  {analytics.lifecycle.map((item) => (
                    <Cell
                      key={item.key}
                      fill={
                        lifecycleColors[
                          item.key as keyof typeof lifecycleColors
                        ]
                      }
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    border: "1px solid #e2e8f0",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
            <div>
              <p className="text-2xl font-semibold text-slate-950">
                {analytics.completion}%
              </p>
              <p className="mt-0.5 text-[10px] font-medium text-slate-400">
                {analytics.published} of {analytics.deliverables} published
              </p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 px-4 pb-4">
          {analytics.lifecycle.map((item) => {
            const percentage = analytics.deliverables
              ? Math.round((item.value / analytics.deliverables) * 100)
              : 0;
            return (
              <div
                key={item.key}
                className="dashboard-lifecycle-item rounded border border-slate-100 bg-slate-50/65 px-2.5 py-2 transition duration-200 hover:border-slate-200 hover:bg-white hover:shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex min-w-0 items-center gap-1.5 text-[11px] text-slate-500">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{
                        backgroundColor:
                          lifecycleColors[
                            item.key as keyof typeof lifecycleColors
                          ],
                      }}
                    />
                    <span className="truncate">{item.name}</span>
                  </span>
                  <strong className="text-xs text-slate-900">
                    {item.value}
                  </strong>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-200/70">
                    <span
                      className="dashboard-progress-grow block h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor:
                          lifecycleColors[
                            item.key as keyof typeof lifecycleColors
                          ],
                      }}
                    />
                  </div>
                  <span className="w-7 text-right text-[10px] font-medium text-slate-400">
                    {percentage}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
