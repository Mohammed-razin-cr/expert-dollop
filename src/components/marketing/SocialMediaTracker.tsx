"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  CalendarDays,
  Camera,
  Check,
  FileStack,
  MessageCircle,
  Pencil,
  Save,
  Trash2,
  TrendingUp,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

type SocialPlatform = "instagram" | "facebook" | "linkedin";

type SocialUpdate = {
  id: string;
  platform: SocialPlatform;
  date: string;
  followers: number;
  contentPosted: number;
  createdAt: string;
};

type PlatformDefinition = {
  key: SocialPlatform;
  label: string;
  Icon: LucideIcon;
  tone: string;
  iconTone: string;
};

const STORAGE_KEY = "oms-marketing-social-updates-v1";
const today = () =>
  new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);

const platforms: PlatformDefinition[] = [
  {
    key: "instagram",
    label: "Instagram",
    Icon: Camera,
    tone: "border-pink-100 bg-pink-50/65",
    iconTone: "bg-pink-100 text-pink-700",
  },
  {
    key: "facebook",
    label: "Facebook",
    Icon: MessageCircle,
    tone: "border-blue-100 bg-blue-50/65",
    iconTone: "bg-blue-100 text-blue-700",
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    Icon: BriefcaseBusiness,
    tone: "border-cyan-100 bg-cyan-50/65",
    iconTone: "bg-cyan-100 text-cyan-700",
  },
];

const formatNumber = new Intl.NumberFormat("en-IN");
const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));

export function SocialMediaTracker({ employeeName }: { employeeName: string }) {
  const [updates, setUpdates] = useState<SocialUpdate[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [month, setMonth] = useState(today().slice(0, 7));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    platform: "instagram" as SocialPlatform,
    date: today(),
    followers: "",
    contentPosted: "0",
  });

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (
          !Array.isArray(parsed) ||
          parsed.some(
            (row) =>
              !row ||
              typeof row.id !== "string" ||
              !platforms.some((p) => p.key === row.platform) ||
              typeof row.date !== "string" ||
              !/^\d{4}-\d{2}-\d{2}$/.test(row.date) ||
              !Number.isSafeInteger(row.followers) ||
              row.followers < 0 ||
              !Number.isSafeInteger(row.contentPosted) ||
              row.contentPosted < 0,
          )
        )
          throw new Error();
        setUpdates(parsed);
        const existing = parsed.find(
          (row: SocialUpdate) =>
            row.platform === "instagram" && row.date === today(),
        );
        if (existing)
          setForm({
            platform: "instagram",
            date: existing.date,
            followers: String(existing.followers),
            contentPosted: String(existing.contentPosted),
          });
      }
      setHydrated(true);
    } catch {
      setError(
        "Saved social updates could not be loaded. Your existing data has been kept; reload before making changes.",
      );
    }
  }, []);

  const persist = (rows: SocialUpdate[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
      setUpdates(rows);
      setError(null);
      return true;
    } catch {
      setError(
        "This update could not be saved. Browser storage is full or unavailable.",
      );
      setSaved(false);
      return false;
    }
  };

  const monthRows = useMemo(
    () =>
      updates
        .filter((row) => row.date.startsWith(month))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [month, updates],
  );

  const summaries = useMemo(
    () =>
      platforms.map((platform) => {
        const allRows = updates
          .filter((row) => row.platform === platform.key)
          .sort((a, b) => a.date.localeCompare(b.date));
        const rows = allRows.filter((row) => row.date.startsWith(month));
        const previousClosing = allRows
          .filter((row) => row.date < `${month}-01`)
          .at(-1);
        const first = rows[0];
        const latest = rows.at(-1);
        const baseline =
          previousClosing ?? (rows.length > 1 ? first : undefined);
        return {
          ...platform,
          followers: latest?.followers ?? null,
          growth:
            latest && baseline ? latest.followers - baseline.followers : null,
          baselineDate: baseline?.date ?? null,
          content: rows.reduce((total, row) => total + row.contentPosted, 0),
          days: new Set(rows.map((row) => row.date)).size,
        };
      }),
    [month, updates],
  );

  const totalContent = summaries.reduce((sum, item) => sum + item.content, 0);
  const totalGrowth = summaries.reduce(
    (sum, item) => sum + (item.growth ?? 0),
    0,
  );

  const loadEntry = (platform: SocialPlatform, date: string) => {
    const exact = updates.find(
      (row) => row.platform === platform && row.date === date,
    );
    const latest = updates
      .filter((row) => row.platform === platform && row.date <= date)
      .sort((a, b) => a.date.localeCompare(b.date))
      .at(-1);
    setForm({
      platform,
      date,
      followers: String(exact?.followers ?? latest?.followers ?? ""),
      contentPosted: String(exact?.contentPosted ?? 0),
    });
    setSaved(false);
    setError(null);
  };

  const saveUpdate = () => {
    const followers = Number(form.followers);
    const contentPosted = Number(form.contentPosted);
    if (
      !hydrated ||
      !form.date ||
      form.date > today() ||
      form.followers === "" ||
      !Number.isSafeInteger(followers) ||
      followers < 0 ||
      form.contentPosted === "" ||
      !Number.isSafeInteger(contentPosted) ||
      contentPosted < 0
    ) {
      setError(
        "Enter a date no later than today and non-negative whole numbers for followers and content.",
      );
      setSaved(false);
      return;
    }

    const existing = updates.find(
      (row) => row.platform === form.platform && row.date === form.date,
    );
    const next: SocialUpdate = {
      id: existing?.id ?? crypto.randomUUID(),
      platform: form.platform,
      date: form.date,
      followers: Math.round(followers),
      contentPosted: Math.round(contentPosted),
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    if (!persist([...updates.filter((row) => row.id !== existing?.id), next]))
      return;
    setMonth(form.date.slice(0, 7));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  const deleteUpdate = (id: string) => {
    if (!window.confirm("Delete this daily update?")) return;
    persist(updates.filter((row) => row.id !== id));
    setSaved(false);
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-md border border-white/80 bg-white/75 p-4 shadow-[0_18px_44px_-32px_rgba(15,23,42,0.42)] backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-blue-50 text-blue-700">
              <UsersRound className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Social media daily tracker
              </h2>
              <p className="text-xs text-slate-500">
                Updated by {employeeName}
              </p>
            </div>
          </div>
        </div>
        <label className="text-xs font-medium text-slate-600">
          Reporting month
          <input
            type="month"
            value={month}
            onChange={(event) => {
              if (event.target.value) setMonth(event.target.value);
            }}
            className="mt-1 block rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {summaries.map(
          ({
            key,
            label,
            Icon,
            tone,
            iconTone,
            followers,
            growth,
            content,
            days,
            baselineDate,
          }) => (
            <article
              key={key}
              className={`overflow-hidden rounded-md border p-4 shadow-[0_16px_36px_-30px_rgba(15,23,42,0.5)] ${tone}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`grid h-9 w-9 place-items-center rounded-md ${iconTone}`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      {label}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      {days} {days === 1 ? "day" : "days"} updated
                    </p>
                  </div>
                </div>
                <span
                  title={
                    baselineDate
                      ? `Follower change since ${formatDate(baselineDate)}`
                      : "A previous follower count is needed"
                  }
                  className={`text-xs font-semibold ${growth == null ? "text-slate-500" : growth >= 0 ? "text-emerald-700" : "text-rose-700"}`}
                >
                  {growth == null
                    ? "No baseline"
                    : `${growth >= 0 ? "+" : ""}${formatNumber.format(growth)}`}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/80 pt-3">
                <div>
                  <p className="text-[11px] text-slate-500">Latest followers</p>
                  <p className="mt-0.5 text-xl font-semibold text-slate-950">
                    {followers == null
                      ? "No update"
                      : formatNumber.format(followers)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500">
                    Content this month
                  </p>
                  <p className="mt-0.5 text-xl font-semibold text-slate-950">
                    {formatNumber.format(content)}
                  </p>
                </div>
              </div>
              {baselineDate && (
                <p className="mt-2 text-[11px] text-slate-600">
                  Growth since {formatDate(baselineDate)}
                </p>
              )}
            </article>
          ),
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(300px,0.72fr)_minmax(0,1.28fr)]">
        <section className="rounded-md border border-white/80 bg-white/78 p-4 shadow-[0_18px_44px_-32px_rgba(15,23,42,0.42)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Daily update
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Save today&apos;s account totals
              </p>
            </div>
            {saved && (
              <span
                role="status"
                className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700"
              >
                <Check className="h-3 w-3" /> Saved
              </span>
            )}
          </div>

          {error && (
            <p role="alert" className="mt-3 text-sm text-rose-700">
              {error}
            </p>
          )}

          <div className="mt-4 grid grid-cols-3 gap-2">
            {platforms.map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                aria-pressed={form.platform === key}
                onClick={() => loadEntry(key, form.date)}
                className={`flex min-w-0 flex-col items-center gap-1 rounded-md border px-2 py-2.5 text-xs font-medium transition ${form.platform === key ? "border-blue-300 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50/50"}`}
              >
                <Icon className="h-4 w-4" />
                <span className="truncate">{label}</span>
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <label className="text-xs font-medium text-slate-600">
              Update date
              <div className="relative mt-1">
                <CalendarDays className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="date"
                  max={today()}
                  value={form.date}
                  onChange={(event) =>
                    loadEntry(form.platform, event.target.value)
                  }
                  className="w-full rounded-md border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </label>
            <label className="text-xs font-medium text-slate-600">
              Current followers
              <input
                type="number"
                min="0"
                value={form.followers}
                onChange={(event) =>
                  setForm({ ...form, followers: event.target.value })
                }
                placeholder="Enter total followers"
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="text-xs font-medium text-slate-600 sm:col-span-2 xl:col-span-1 2xl:col-span-2">
              Content posted today
              <input
                type="number"
                min="0"
                value={form.contentPosted}
                onChange={(event) =>
                  setForm({ ...form, contentPosted: event.target.value })
                }
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </label>
          </div>

          <button
            type="button"
            onClick={saveUpdate}
            disabled={!hydrated || !form.date || form.followers === ""}
            className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-blue-700 px-4 text-sm font-semibold text-white shadow-[0_10px_24px_-14px_rgba(29,78,216,0.9)] transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-4 w-4" /> Save daily update
          </button>
        </section>

        <section className="min-w-0 overflow-hidden rounded-md border border-white/80 bg-white/78 shadow-[0_18px_44px_-32px_rgba(15,23,42,0.42)] backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Monthly activity
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Daily follower and publishing history
              </p>
            </div>
            <div className="flex gap-4 text-xs">
              <span className="inline-flex items-center gap-1.5 text-slate-600">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                <strong className="text-slate-900">
                  {totalGrowth >= 0 ? "+" : ""}
                  {formatNumber.format(totalGrowth)}
                </strong>{" "}
                recorded growth
              </span>
              <span className="inline-flex items-center gap-1.5 text-slate-600">
                <FileStack className="h-3.5 w-3.5 text-blue-600" />
                <strong className="text-slate-900">
                  {formatNumber.format(totalContent)}
                </strong>{" "}
                content
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-slate-50/80 text-xs font-medium text-slate-500">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Platform</th>
                  <th className="px-4 py-3 text-right">Followers</th>
                  <th className="px-4 py-3 text-right">Content posted</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {monthRows.map((row) => {
                  const platform = platforms.find(
                    (item) => item.key === row.platform,
                  )!;
                  return (
                    <tr key={row.id} className="transition hover:bg-blue-50/35">
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {formatDate(row.date)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2 font-medium text-slate-800">
                          <platform.Icon className="h-4 w-4 text-slate-500" />{" "}
                          {platform.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">
                        {formatNumber.format(row.followers)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">
                        {formatNumber.format(row.contentPosted)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => loadEntry(row.platform, row.date)}
                            aria-label={`Edit ${platform.label} update for ${formatDate(row.date)}`}
                            className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-blue-50 hover:text-blue-700"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteUpdate(row.id)}
                            aria-label={`Delete ${platform.label} update for ${formatDate(row.date)}`}
                            className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-rose-50 hover:text-rose-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!monthRows.length && (
            <div className="px-4 py-12 text-center">
              <UsersRound className="mx-auto h-7 w-7 text-slate-300" />
              <p className="mt-2 text-sm font-medium text-slate-700">
                No updates for this month
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Add the first daily follower and content update.
              </p>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
