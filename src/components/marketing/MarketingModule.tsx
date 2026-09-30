"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as Icons from "lucide-react";
import { createClient } from "@/lib/api/client";
import { MarketingProgressTracker } from "./MarketingProgressTracker";
import { SocialMediaTracker } from "./SocialMediaTracker";
import { MarketingDialog } from "./MarketingDialog";
import {
  MARKETING_STATUSES,
  MARKETING_TYPES,
  statusLabel,
  typeLabel,
  type MarketingActivity,
  type MarketingAnalytics,
  type MarketingEmployee,
  type MarketingStatus,
  type MarketingTask,
  type MarketingType,
} from "@/lib/marketing-shared";

type Option = { key: string; label: string };
type FileRow = {
  id: string;
  task_id: string;
  file_url: string;
  file_name: string;
  mime_type: string | null;
  file_size: number | null;
  created_at: string;
};
type Props = {
  userId: string;
  firstName: string;
  tasks: MarketingTask[];
  employees: MarketingEmployee[];
  activities: MarketingActivity[];
  files: FileRow[];
  units: Option[];
  platforms: Option[];
  analytics: MarketingAnalytics;
  error: string | null;
  admin?: boolean;
  mode?: "dashboard" | "tasks";
  category?: string;
  testing?: boolean;
};

const input =
  "w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100";
const statusTone: Record<string, string> = {
  assigned: "bg-slate-100 text-slate-700",
  in_progress: "bg-blue-50 text-blue-700",
  submitted: "bg-amber-50 text-amber-700",
  approved: "bg-emerald-50 text-emerald-700",
  published: "bg-violet-50 text-violet-700",
  rejected: "bg-rose-50 text-rose-700",
};
const safeName = (name: string) => name.replace(/[^\w.\-]/g, "_");
const day = () =>
  new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
const displayDate = (value: string | null) =>
  value
    ? new Date(
        value.length === 10 ? `${value}T12:00:00` : value,
      ).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Not set";
const blank = {
  title: "",
  description: "",
  marketing_type: "poster" as MarketingType,
  assigned_to: "",
  due_date: "",
  priority: "medium",
  business_unit: "",
  platform: "",
  campaign_name: "",
  deliverable_count: "1",
  target_value: "",
  actual_value: "",
  budget: "",
  notes: "",
};

function TypeIcon({
  type,
  className = "h-4 w-4",
}: {
  type: string | null;
  className?: string;
}) {
  const name =
    MARKETING_TYPES.find((item) => item.key === type)?.icon ?? "ClipboardList";
  const Icon =
    (
      Icons as unknown as Record<
        string,
        React.ComponentType<{ className?: string }>
      >
    )[name] ?? Icons.ClipboardList;
  return <Icon className={className} />;
}

export function MarketingModule(props: Props) {
  const {
    userId,
    firstName,
    employees,
    units,
    platforms,
    analytics,
    admin = false,
    mode = "dashboard",
    category,
    testing = false,
  } = props;
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [employee, setEmployee] = useState("all");
  const [platform, setPlatform] = useState("all");
  const [unit, setUnit] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selected, setSelected] = useState<MarketingTask | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const [workUrl, setWorkUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [count, setCount] = useState("1");
  const [followersStart, setFollowersStart] = useState("");
  const [followersEnd, setFollowersEnd] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(props.error);
  const [localTasks, setLocalTasks] = useState<MarketingTask[]>(props.tasks);
  const [localFiles, setLocalFiles] = useState<FileRow[]>(props.files);
  const [localActivities, setLocalActivities] = useState<MarketingActivity[]>(
    props.activities,
  );
  const [localHydrated, setLocalHydrated] = useState(!testing);
  const [storageLoadError, setStorageLoadError] = useState<string | null>(null);
  const messageIsError = Boolean(
    props.error ||
    storageLoadError ||
    /required|before|failed|error|choose|could not|storage|unavailable|not saved/i.test(
      message ?? "",
    ),
  );
  const sourceTasks = testing ? localTasks : props.tasks;
  const files = testing ? localFiles : props.files;
  const activities = testing ? localActivities : props.activities;
  const canEditWork =
    !admin &&
    !!selected &&
    ["in_progress", "rejected"].includes(selected.marketing_status);

  useEffect(() => {
    if (!testing) return;
    try {
      const saved = localStorage.getItem("oms-marketing-demo-data");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (
          !parsed ||
          !Array.isArray(parsed.tasks) ||
          !Array.isArray(parsed.files) ||
          !Array.isArray(parsed.activities) ||
          parsed.tasks.some(
            (task: MarketingTask) =>
              !task ||
              typeof task.id !== "string" ||
              typeof task.title !== "string" ||
              !MARKETING_STATUSES.some(
                (status) => status.key === task.marketing_status,
              ),
          ) ||
          parsed.files.some(
            (file: FileRow) =>
              !file ||
              typeof file.task_id !== "string" ||
              typeof file.file_url !== "string",
          ) ||
          parsed.activities.some(
            (activity: MarketingActivity) =>
              !activity ||
              typeof activity.task_id !== "string" ||
              typeof activity.created_at !== "string",
          )
        )
          throw new Error("Invalid saved tasks");
        setLocalTasks(parsed.tasks);
        setLocalFiles(parsed.files);
        setLocalActivities(parsed.activities);
      }
    } catch {
      setStorageLoadError(
        "Saved tasks could not be loaded. Your existing browser data has been kept unchanged. Reload before making changes.",
      );
    } finally {
      setLocalHydrated(true);
    }
  }, [testing]);

  useEffect(() => {
    if (!testing || !localHydrated || storageLoadError) return;
    try {
      localStorage.setItem(
        "oms-marketing-demo-data",
        JSON.stringify({
          tasks: localTasks,
          files: localFiles,
          activities: localActivities,
        }),
      );
    } catch {
      setMessage(
        "Browser storage is full or unavailable. Recent changes are not saved. Keep this page open and free browser storage before continuing.",
      );
    }
  }, [
    testing,
    localHydrated,
    storageLoadError,
    localTasks,
    localFiles,
    localActivities,
  ]);
  const today = day();
  const normalizedCategory = category === "ai_video" ? "video" : category;
  const activeCategory = mode === "dashboard" ? undefined : normalizedCategory;
  const categoryHref = (value: string | null) =>
    testing
      ? `/marketing-preview?view=work${value ? `&category=${value}` : ""}`
      : admin
        ? `/admin/digital-marketing?view=tasks${value ? `&category=${value}` : ""}`
        : `/marketing${value ? `?category=${value}` : ""}`;
  const currentType = MARKETING_TYPES.find(
    (item) => item.key === activeCategory,
  );
  const hasActiveFilters = Boolean(
    search ||
    status !== "all" ||
    employee !== "all" ||
    platform !== "all" ||
    unit !== "all" ||
    from ||
    to,
  );
  const tasks = useMemo(
    () =>
      sourceTasks.filter((task) => {
        if (activeCategory) {
          const matchesCategory =
            activeCategory === "video"
              ? ["video", "ai_video"].includes(task.marketing_type ?? "")
              : task.marketing_type === activeCategory;
          if (!matchesCategory) return false;
        }
        if (status !== "all" && task.marketing_status !== status) return false;
        if (employee !== "all" && task.assigned_to !== employee) return false;
        if (platform !== "all" && task.platform !== platform) return false;
        if (unit !== "all" && task.business_unit !== unit) return false;
        if (from && (task.due_date ?? "") < from) return false;
        if (to && (task.due_date ?? "9999-12-31") > to) return false;
        const haystack =
          `${task.title} ${task.description ?? ""} ${task.assignee_name ?? ""} ${task.campaign_name ?? ""} ${task.platform ?? ""}`.toLowerCase();
        return haystack.includes(search.toLowerCase());
      }),
    [
      sourceTasks,
      activeCategory,
      status,
      employee,
      platform,
      unit,
      from,
      to,
      search,
    ],
  );
  const counts = {
    assigned: sourceTasks.filter((t) => t.marketing_status === "assigned")
      .length,
    progress: sourceTasks.filter((t) => t.marketing_status === "in_progress")
      .length,
    submitted: sourceTasks.filter((t) => t.marketing_status === "submitted")
      .length,
    published: sourceTasks.filter((t) => t.marketing_status === "published")
      .length,
    overdue: sourceTasks.filter(
      (t) =>
        t.due_date &&
        t.due_date < today &&
        !["approved", "published"].includes(t.marketing_status),
    ).length,
  };
  const visibleMetrics = useMemo(() => {
    if (!testing) return analytics.metrics;
    const currentMonth = day().slice(0, 7);
    const currentStart = new Date(`${currentMonth}-01T00:00:00`);
    const previousMonth = new Date(currentStart);
    previousMonth.setMonth(previousMonth.getMonth() - 1);
    const previousKey = `${previousMonth.getFullYear()}-${String(previousMonth.getMonth() + 1).padStart(2, "0")}`;

    return analytics.metrics.map((metric) => {
      const published = sourceTasks.filter(
        (task) =>
          task.marketing_type === metric.key &&
          task.marketing_status === "published",
      );
      const current = published
        .filter((task) => task.published_at?.slice(0, 7) === currentMonth)
        .reduce(
          (sum, task) => sum + Math.max(1, task.deliverable_count || 1),
          0,
        );
      const previous = published
        .filter((task) => task.published_at?.slice(0, 7) === previousKey)
        .reduce(
          (sum, task) => sum + Math.max(1, task.deliverable_count || 1),
          0,
        );
      const difference = current - previous;
      return {
        ...metric,
        current,
        previous,
        difference,
        percentage: previous
          ? (difference / previous) * 100
          : current
            ? 100
            : null,
      };
    });
  }, [analytics.metrics, sourceTasks, testing]);

  const refresh = () => {
    setBusy(false);
    router.refresh();
  };
  const addLocalActivity = (
    task: MarketingTask,
    action: string,
    fromStatus: MarketingStatus | null,
    toStatus: MarketingStatus | null,
    details?: string,
  ) => {
    setLocalActivities((rows) => [
      {
        id: crypto.randomUUID(),
        task_id: task.id,
        actor_id: userId,
        actor_name: firstName,
        action,
        from_status: fromStatus,
        to_status: toStatus,
        details: details ?? null,
        created_at: new Date().toISOString(),
        task_title: task.title,
      },
      ...rows,
    ]);
  };
  async function transition(task: MarketingTask, next: MarketingStatus) {
    if (testing && (!localHydrated || storageLoadError)) {
      setMessage(storageLoadError ?? "Saved tasks are still loading.");
      return;
    }
    setBusy(true);
    setMessage(null);
    if (next === "submitted") {
      if (!Number.isSafeInteger(Number(count)) || Number(count) < 1) {
        setBusy(false);
        setMessage(
          "Enter a whole number of completed deliverables, at least 1.",
        );
        return;
      }
      if (
        task.marketing_type === "followers" &&
        [followersStart, followersEnd].some(
          (value) =>
            value !== "" &&
            (!Number.isSafeInteger(Number(value)) || Number(value) < 0),
        )
      ) {
        setBusy(false);
        setMessage("Follower counts must be non-negative whole numbers.");
        return;
      }
      const link = workUrl.trim() || task.work_url;
      if (link) {
        try {
          if (!["http:", "https:"].includes(new URL(link).protocol))
            throw new Error();
        } catch {
          setBusy(false);
          setMessage(
            "Enter a valid work link starting with https:// or http://.",
          );
          return;
        }
      }
    }
    const payload: any = { marketing_status: next };
    if (next === "submitted")
      Object.assign(payload, {
        work_url: workUrl.trim() || task.work_url,
        notes: notes.trim() || task.notes,
        deliverable_count: Math.max(1, Number(count) || 1),
        follower_start: followersStart
          ? Number(followersStart)
          : task.follower_start,
        follower_end: followersEnd ? Number(followersEnd) : task.follower_end,
      });
    if (testing) {
      const hasProof =
        files.some((file) => file.task_id === task.id) ||
        !!(workUrl.trim() || task.work_url);
      if (next === "submitted" && !hasProof) {
        setBusy(false);
        setMessage("Add a proof file or work link before submitting.");
        return;
      }
      const now = new Date().toISOString();
      setLocalTasks((rows) =>
        rows.map((row) =>
          row.id === task.id
            ? {
                ...row,
                ...payload,
                marketing_status: next,
                status:
                  next === "assigned"
                    ? "pending"
                    : ["approved", "published"].includes(next)
                      ? "done"
                      : "in_progress",
                submitted_at: next === "submitted" ? now : row.submitted_at,
                approved_at: next === "approved" ? now : row.approved_at,
                published_at: next === "published" ? now : row.published_at,
                updated_at: now,
              }
            : row,
        ),
      );
      addLocalActivity(task, next, task.marketing_status, next);
      setSelected(null);
      setBusy(false);
      return;
    }
    const supabase = createClient();
    const { error } = await supabase
      .from("tasks")
      .update(payload)
      .eq("id", task.id)
      .eq("related_type", "digital_marketing");
    if (error) {
      setBusy(false);
      setMessage(error.message);
      return;
    }
    if (
      next === "published" &&
      task.marketing_type === "followers" &&
      task.assigned_to &&
      task.platform &&
      task.follower_end != null
    ) {
      await supabase.from("marketing_social_snapshots").upsert(
        {
          employee_id: task.assigned_to,
          platform: task.platform,
          business_unit: task.business_unit,
          snapshot_date: day(),
          follower_count: task.follower_end,
          created_by: userId,
        },
        { onConflict: "employee_id,platform,business_unit,snapshot_date" },
      );
    }
    setSelected(null);
    refresh();
  }
  async function uploadProof(task: MarketingTask, file: File) {
    if (testing && (!localHydrated || storageLoadError)) {
      setMessage(storageLoadError ?? "Saved tasks are still loading.");
      return;
    }
    setBusy(true);
    setMessage(null);
    if (testing) {
      if (file.size > 1_500_000) {
        setBusy(false);
        setMessage(
          "Testing mode stores files in this browser. Choose a file under 1.5 MB or add a work link.",
        );
        return;
      }
      let dataUrl: string;
      try {
        dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        });
      } catch {
        setBusy(false);
        setMessage("The proof file could not be read. Please try again.");
        return;
      }
      // Check the storage budget before accepting a base64 attachment.
      try {
        const saved = localStorage.getItem("oms-marketing-demo-data") || "";
        localStorage.setItem("oms-marketing-proof-check", dataUrl);
        localStorage.removeItem("oms-marketing-proof-check");
        if (saved.length + dataUrl.length * 2 > 4_500_000) throw new Error();
      } catch {
        setBusy(false);
        setMessage(
          "Browser storage is full or unavailable. Use a work link for this proof.",
        );
        return;
      }
      const row: FileRow = {
        id: crypto.randomUUID(),
        task_id: task.id,
        file_url: dataUrl,
        file_name: file.name,
        mime_type: file.type || null,
        file_size: file.size,
        created_at: new Date().toISOString(),
      };
      setLocalFiles((rows) => [row, ...rows]);
      setLocalTasks((rows) =>
        rows.map((item) =>
          item.id === task.id
            ? {
                ...item,
                proof_file_url: dataUrl,
                proof_file_name: file.name,
                updated_at: new Date().toISOString(),
              }
            : item,
        ),
      );
      addLocalActivity(
        task,
        "proof_updated",
        task.marketing_status,
        task.marketing_status,
        file.name,
      );
      setBusy(false);
      setMessage("Proof added in local testing mode.");
      return;
    }
    const supabase = createClient();
    const path = `marketing/${task.id}/${userId}_${Date.now()}_${safeName(file.name)}`;
    const { error: uploadError } = await supabase.storage
      .from("oms-files")
      .upload(path, file);
    if (uploadError) {
      setBusy(false);
      setMessage(uploadError.message);
      return;
    }
    const { error } = await supabase.from("marketing_task_files").insert({
      task_id: task.id,
      file_url: path,
      file_name: file.name,
      mime_type: file.type || null,
      file_size: file.size,
      uploaded_by: userId,
    });
    if (!error)
      await supabase
        .from("tasks")
        .update({ proof_file_url: path, proof_file_name: file.name })
        .eq("id", task.id);
    if (error) {
      setBusy(false);
      setMessage(error.message);
      return;
    }
    refresh();
  }
  async function openProof(row: FileRow) {
    if (testing) {
      try {
        const response = await fetch(row.file_url);
        if (!response.ok) throw new Error("Proof unavailable");
        const url = URL.createObjectURL(await response.blob());
        const download = document.createElement("a");
        download.href = url;
        download.download = row.file_name;
        download.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch {
        setMessage("This proof could not be downloaded. Please try again.");
      }
      return;
    }
    const supabase = createClient();
    const { data } = await supabase.storage
      .from("oms-files")
      .createSignedUrl(row.file_url, 120);
    if (data?.signedUrl)
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }
  async function createTask() {
    if (testing && (!localHydrated || storageLoadError)) {
      setMessage(storageLoadError ?? "Saved tasks are still loading.");
      return;
    }
    if (
      !form.title.trim() ||
      (!testing && !form.assigned_to) ||
      !form.due_date
    ) {
      setMessage(
        testing
          ? "Title and due date are required."
          : "Title, employee, and due date are required.",
      );
      return;
    }
    if (
      !Number.isSafeInteger(Number(form.deliverable_count)) ||
      Number(form.deliverable_count) < 1
    ) {
      setMessage("Expected deliverables must be a whole number of at least 1.");
      return;
    }
    setBusy(true);
    setMessage(null);
    if (testing) {
      const now = new Date().toISOString();
      const task: MarketingTask = {
        id: crypto.randomUUID(),
        title: form.title.trim(),
        description: form.description.trim() || null,
        marketing_type: form.marketing_type,
        marketing_status: "assigned",
        due_date: form.due_date,
        status: "pending",
        priority: form.priority as "low" | "medium" | "high",
        assigned_to: userId,
        assignee_name: firstName,
        created_by: userId,
        business_unit: form.business_unit || null,
        platform: form.platform || null,
        campaign_name: form.campaign_name.trim() || null,
        work_url: null,
        proof_file_url: null,
        proof_file_name: null,
        deliverable_count: Math.max(1, Number(form.deliverable_count) || 1),
        follower_start: null,
        follower_end: null,
        target_value: form.target_value ? Number(form.target_value) : null,
        actual_value: form.actual_value ? Number(form.actual_value) : null,
        budget: form.budget ? Number(form.budget) : null,
        notes: form.notes.trim() || null,
        assigned_at: now,
        submitted_at: null,
        approved_at: null,
        published_at: null,
        created_at: now,
        updated_at: now,
      };
      setLocalTasks((rows) => [task, ...rows]);
      addLocalActivity(task, "created", null, "assigned");
      setCreateOpen(false);
      setForm({ ...blank, assigned_to: userId });
      setBusy(false);
      setMessage("Task added. It is saved only in this browser.");
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.from("tasks").insert({
      title: form.title.trim(),
      description: form.description.trim() || null,
      marketing_type: form.marketing_type,
      assigned_to: form.assigned_to,
      created_by: userId,
      due_date: form.due_date,
      priority: form.priority as "low" | "medium" | "high",
      related_type: "digital_marketing",
      business_unit: form.business_unit || null,
      platform: form.platform || null,
      campaign_name: form.campaign_name.trim() || null,
      deliverable_count: Math.max(1, Number(form.deliverable_count) || 1),
      target_value: form.target_value ? Number(form.target_value) : null,
      actual_value: form.actual_value ? Number(form.actual_value) : null,
      budget: form.budget ? Number(form.budget) : null,
      notes: form.notes.trim() || null,
    });
    if (error) {
      setBusy(false);
      setMessage(error.message);
      return;
    }
    setCreateOpen(false);
    setForm(blank);
    refresh();
  }
  function deleteLocalTask(task: MarketingTask) {
    if (storageLoadError) {
      setMessage(storageLoadError);
      return;
    }
    if (
      !testing ||
      !window.confirm(`Delete “${task.title}” from this browser?`)
    )
      return;
    setLocalTasks((rows) => rows.filter((row) => row.id !== task.id));
    setLocalFiles((rows) => rows.filter((row) => row.task_id !== task.id));
    setLocalActivities((rows) => rows.filter((row) => row.task_id !== task.id));
    setSelected(null);
    setMessage("Task removed from local testing data.");
  }
  async function saveAdminChanges() {
    if (!selected || !form.assigned_to || !form.due_date)
      return setMessage("Employee and due date are required.");
    setBusy(true);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("tasks")
      .update({
        title: form.title.trim(),
        description: form.description.trim() || null,
        marketing_type: form.marketing_type,
        assigned_to: form.assigned_to,
        due_date: form.due_date,
        priority: form.priority as "low" | "medium" | "high",
        business_unit: form.business_unit || null,
        platform: form.platform || null,
        campaign_name: form.campaign_name.trim() || null,
        deliverable_count: Math.max(1, Number(form.deliverable_count) || 1),
        target_value: form.target_value ? Number(form.target_value) : null,
        actual_value: form.actual_value ? Number(form.actual_value) : null,
        budget: form.budget ? Number(form.budget) : null,
        notes: form.notes.trim() || null,
      })
      .eq("id", selected.id)
      .eq("related_type", "digital_marketing");
    if (error) {
      setBusy(false);
      setMessage(error.message);
      return;
    }
    setSelected(null);
    refresh();
  }
  const openDetails = (task: MarketingTask) => {
    setSelected(task);
    setForm({
      title: task.title,
      description: task.description ?? "",
      marketing_type: (task.marketing_type ?? "other") as MarketingType,
      assigned_to: task.assigned_to ?? "",
      due_date: task.due_date ?? "",
      priority: task.priority,
      business_unit: task.business_unit ?? "",
      platform: task.platform ?? "",
      campaign_name: task.campaign_name ?? "",
      deliverable_count: String(task.deliverable_count || 1),
      target_value: task.target_value == null ? "" : String(task.target_value),
      actual_value: task.actual_value == null ? "" : String(task.actual_value),
      budget: task.budget == null ? "" : String(task.budget),
      notes: task.notes ?? "",
    });
    setWorkUrl(task.work_url ?? "");
    setNotes(task.notes ?? "");
    setCount(String(task.deliverable_count || 1));
    setFollowersStart(
      task.follower_start == null ? "" : String(task.follower_start),
    );
    setFollowersEnd(task.follower_end == null ? "" : String(task.follower_end));
    setMessage(null);
  };

  const Filters = (
    <div
      className={`grid gap-2 rounded-md border p-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 ${
        mode === "dashboard"
          ? "border-white/80 bg-white/72 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.38)] backdrop-blur-xl"
          : "border-slate-200 bg-white shadow-sm"
      }`}
    >
      <div className="relative sm:col-span-2">
        <Icons.Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <input
          aria-label="Search marketing tasks"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title, campaign, platform"
          className={`${input} pl-9`}
        />
      </div>
      {admin && (
        <select
          aria-label="Employee filter"
          value={employee}
          onChange={(e) => setEmployee(e.target.value)}
          className={input}
        >
          <option value="all">All employees</option>
          {employees.map((x) => (
            <option key={x.id} value={x.id}>
              {x.full_name}
            </option>
          ))}
        </select>
      )}
      <select
        aria-label="Status filter"
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className={input}
      >
        <option value="all">All statuses</option>
        {MARKETING_STATUSES.map((x) => (
          <option key={x.key} value={x.key}>
            {x.label}
          </option>
        ))}
      </select>
      <select
        aria-label="Platform filter"
        value={platform}
        onChange={(e) => setPlatform(e.target.value)}
        className={input}
      >
        <option value="all">All platforms</option>
        {platforms.map((x) => (
          <option key={x.key} value={x.label}>
            {x.label}
          </option>
        ))}
      </select>
      <select
        aria-label="Business unit filter"
        value={unit}
        onChange={(e) => setUnit(e.target.value)}
        className={input}
      >
        <option value="all">All business units</option>
        {units.map((x) => (
          <option key={x.key} value={x.label}>
            {x.label}
          </option>
        ))}
      </select>
      <input
        aria-label="From date"
        type="date"
        value={from}
        onChange={(e) => setFrom(e.target.value)}
        className={input}
      />
      <input
        aria-label="To date"
        type="date"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        className={input}
      />
      {hasActiveFilters && (
        <button
          type="button"
          onClick={() => {
            setSearch("");
            setStatus("all");
            setEmployee("all");
            setPlatform("all");
            setUnit("all");
            setFrom("");
            setTo("");
          }}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
        >
          <Icons.RotateCcw className="h-4 w-4" aria-hidden="true" />
          Reset
        </button>
      )}
    </div>
  );

  const TaskTable = (
    <section
      className={`max-w-full overflow-hidden rounded-md border ${
        mode === "dashboard"
          ? "border-white/80 bg-white/78 shadow-[0_18px_44px_-30px_rgba(15,23,42,0.4)] backdrop-blur-xl"
          : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            {!currentType ? "Work queue" : "Marketing tasks"}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {tasks.length} task{tasks.length === 1 ? "" : "s"} · earliest due
            first
          </p>
        </div>
        <Icons.ListFilter
          className="h-4 w-4 text-slate-400"
          aria-hidden="true"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              {admin && <th className="px-4 py-3 font-medium">Employee</th>}
              <th className="px-4 py-3 font-medium">Task</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Business / Platform</th>
              <th className="px-4 py-3 font-medium">Due</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Proof</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tasks
              .sort((a, b) =>
                (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"),
              )
              .map((task) => {
                const overdue =
                  task.due_date &&
                  task.due_date < today &&
                  !["approved", "published"].includes(task.marketing_status);
                const taskFiles = files.filter((f) => f.task_id === task.id);
                return (
                  <tr
                    key={task.id}
                    className="border-t border-slate-100 align-top hover:bg-slate-50/60"
                  >
                    {admin && (
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                        {task.assignee_name}
                      </td>
                    )}
                    <td className="max-w-72 px-4 py-3">
                      <button
                        type="button"
                        onClick={() => openDetails(task)}
                        className="text-left font-medium text-slate-900 hover:text-blue-700"
                      >
                        {task.title}
                      </button>
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {task.campaign_name ||
                          task.description ||
                          "No description"}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="inline-flex items-center gap-2 text-slate-700">
                        <TypeIcon type={task.marketing_type} />
                        {typeLabel(task.marketing_type)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      <p>{task.business_unit || "—"}</p>
                      <p className="mt-1 text-slate-400">
                        {task.platform || "—"}
                      </p>
                    </td>
                    <td
                      className={`whitespace-nowrap px-4 py-3 text-xs ${overdue ? "font-medium text-rose-700" : "text-slate-600"}`}
                    >
                      {displayDate(task.due_date)}
                      {overdue && <p>Overdue</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`whitespace-nowrap rounded px-2 py-1 text-xs font-medium ${statusTone[task.marketing_status]}`}
                      >
                        {statusLabel(task.marketing_status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {taskFiles.length ? (
                        <button
                          onClick={() => openProof(taskFiles[0])}
                          className="inline-flex items-center gap-1 text-blue-700 hover:underline"
                        >
                          <Icons.Paperclip className="h-3.5 w-3.5" />
                          {taskFiles.length} file
                          {taskFiles.length > 1 ? "s" : ""}
                        </button>
                      ) : task.work_url ? (
                        <a
                          href={task.work_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-700 hover:underline"
                        >
                          Open link
                        </a>
                      ) : (
                        <span className="text-slate-400">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {!admin && task.marketing_status === "assigned" && (
                          <button
                            disabled={busy}
                            onClick={() => transition(task, "in_progress")}
                            className="rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                          >
                            Start
                          </button>
                        )}
                        {!admin &&
                          ["in_progress", "rejected"].includes(
                            task.marketing_status,
                          ) && (
                            <button
                              onClick={() => openDetails(task)}
                              className="rounded bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100"
                            >
                              Submit
                            </button>
                          )}
                        {admin && task.marketing_status === "submitted" && (
                          <>
                            <button
                              disabled={busy}
                              onClick={() => transition(task, "approved")}
                              className="rounded bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700"
                            >
                              Approve
                            </button>
                            <button
                              disabled={busy}
                              onClick={() => transition(task, "rejected")}
                              className="rounded bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {admin && task.marketing_status === "approved" && (
                          <button
                            disabled={busy}
                            onClick={() => transition(task, "published")}
                            className="rounded bg-violet-50 px-2 py-1 text-xs font-medium text-violet-700"
                          >
                            Publish
                          </button>
                        )}
                        <button
                          onClick={() => openDetails(task)}
                          aria-label={`View ${task.title}`}
                          className="rounded p-1.5 text-slate-500 hover:bg-slate-100"
                        >
                          <Icons.Eye className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      {!tasks.length && (
        <p className="px-4 py-12 text-center text-sm text-slate-500">
          No tasks match these filters.
        </p>
      )}
    </section>
  );

  return (
    <div
      className={`mx-auto flex min-w-0 max-w-[1600px] flex-col gap-5 ${
        mode === "dashboard" ? "marketing-dashboard" : ""
      }`}
    >
      <div
        className={`order-1 flex flex-wrap items-start justify-between gap-4 ${
          mode === "dashboard"
            ? "dashboard-enter rounded-lg border border-white/80 bg-white/72 p-5 shadow-[0_20px_55px_-38px_rgba(15,23,42,0.5)] backdrop-blur-xl sm:p-6"
            : ""
        }`}
      >
        <div>
          {mode === "dashboard" && (
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50/80 px-2.5 py-1 text-xs font-semibold text-blue-700">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:animate-none" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Marketing workspace
            </div>
          )}
          <h1
            className={`${
              mode === "dashboard"
                ? "text-2xl font-semibold text-slate-950 sm:text-[28px]"
                : "text-xl font-semibold text-slate-900"
            }`}
          >
            {admin
              ? "Digital Marketing"
              : mode === "dashboard"
                ? "Digital Marketing Dashboard"
                : currentType
                  ? currentType.label
                  : "My Tasks"}
          </h1>
          <p
            className={`mt-1 text-sm ${
              mode === "dashboard"
                ? "max-w-2xl text-slate-600"
                : "text-slate-500"
            }`}
          >
            {admin
              ? "Assignments, approvals, published output, and employee activity."
              : mode === "dashboard"
                ? `Welcome back, ${firstName}. Here is your live delivery overview.`
                : "Track work from assignment through publication."}
          </p>
        </div>
        {mode === "dashboard" && (
          <div className="flex shrink-0 flex-col items-end gap-2.5">
            <div className="hidden min-h-10 items-center gap-2 rounded-md border border-slate-200/80 bg-white/75 px-3 text-sm text-slate-600 shadow-sm sm:flex">
              <Icons.CalendarDays className="h-4 w-4 text-slate-400" />
              {new Intl.DateTimeFormat("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              }).format(new Date())}
            </div>
            {(admin || testing) && (
              <button
                onClick={() => {
                  setMessage(null);
                  setForm({ ...blank, assigned_to: testing ? userId : "" });
                  setCreateOpen(true);
                }}
                className="dashboard-new-task inline-flex min-h-10 items-center gap-2 rounded-md bg-blue-700 px-4 text-sm font-semibold text-white shadow-[0_10px_24px_-12px_rgba(29,78,216,0.9)] transition duration-200 hover:-translate-y-0.5 hover:bg-blue-800 hover:shadow-[0_14px_30px_-12px_rgba(29,78,216,0.95)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 motion-reduce:transform-none"
              >
                <Icons.Plus className="h-4 w-4" />
                {testing && !admin ? "New task" : "Assign task"}
              </button>
            )}
          </div>
        )}
      </div>
      {testing && (
        <div className="dashboard-enter order-3 flex items-start gap-2 rounded-md border border-blue-200/80 bg-blue-50/72 px-4 py-3 text-sm text-blue-800 shadow-[0_12px_30px_-24px_rgba(30,64,175,0.6)] backdrop-blur-lg">
          <Icons.FlaskConical
            className="mt-0.5 h-4 w-4 shrink-0"
            aria-hidden="true"
          />
          <p>
            <span className="font-medium">Local testing mode.</span> Tasks,
            links, and proof files stay in this browser; no database is
            connected.
          </p>
        </div>
      )}
      {(storageLoadError || message) && !selected && !createOpen && (
        <div
          role={messageIsError ? "alert" : "status"}
          className={`order-4 flex items-center gap-2 rounded-md border px-4 py-3 text-sm ${
            messageIsError
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {messageIsError ? (
            <Icons.AlertCircle className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Icons.CircleCheck className="h-4 w-4" aria-hidden="true" />
          )}
          {storageLoadError || message}
        </div>
      )}
      {mode === "dashboard" && (
        <div className="order-5">
          <MarketingProgressTracker
            tasks={sourceTasks}
            selectedCategory={activeCategory}
            onSelectCategory={(cat) => router.push(categoryHref(cat))}
            employee={employee}
          />
        </div>
      )}

      {currentType?.key !== "followers" && (
        <div className="dashboard-kpi-grid order-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            {
              label: "Assigned",
              value: counts.assigned,
              icon: Icons.ClipboardList,
              tone: "bg-white/16 text-white",
              taskTone: "bg-slate-100 text-slate-700",
              surface: "from-[#d8328a] to-[#b83db1]",
            },
            {
              label: "In progress",
              value: counts.progress,
              icon: Icons.Clock3,
              tone: "bg-white/16 text-white",
              taskTone: "bg-blue-50 text-blue-700",
              surface: "from-[#7155c7] to-[#5145aa]",
            },
            {
              label: "Awaiting approval",
              value: counts.submitted,
              icon: Icons.Send,
              tone: "bg-white/16 text-white",
              taskTone: "bg-amber-50 text-amber-700",
              surface: "from-[#26a9d6] to-[#477fd7]",
            },
            {
              label: "Published",
              value: counts.published,
              icon: Icons.CircleCheck,
              tone: "bg-white/16 text-white",
              taskTone: "bg-emerald-50 text-emerald-700",
              surface: "from-[#11b889] to-[#0f9f79]",
            },
            {
              label: "Overdue",
              value: counts.overdue,
              icon: Icons.AlertTriangle,
              tone: "bg-white/16 text-white",
              taskTone: "bg-rose-50 text-rose-700",
              surface: "from-[#f6a625] to-[#ef6b3f]",
            },
          ].map((x) => (
            <div
              key={x.label}
              className={`dashboard-enter group relative flex min-h-[92px] items-center gap-3 overflow-hidden rounded-md border p-3 transition duration-200 ${
                mode === "dashboard"
                  ? `border-white/40 bg-gradient-to-br ${x.surface} text-white shadow-[0_18px_38px_-24px_rgba(15,23,42,0.6)] hover:-translate-y-0.5 hover:shadow-[0_22px_42px_-22px_rgba(15,23,42,0.65)] motion-reduce:transform-none`
                  : "border-slate-200 bg-white shadow-sm"
              }`}
            >
              {mode === "dashboard" && (
                <span
                  className="dashboard-card-orbit absolute -bottom-9 -right-5 h-24 w-24 rounded-full border border-white/15 bg-white/10"
                  aria-hidden="true"
                />
              )}
              <span
                className={`dashboard-icon-pop grid h-11 w-11 shrink-0 place-items-center rounded-md ring-1 ring-inset ring-black/[0.03] transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-110 motion-reduce:transform-none ${mode === "dashboard" ? x.tone : x.taskTone}`}
              >
                <x.icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p
                  className={`text-xs font-medium ${mode === "dashboard" ? "text-white/80" : "text-slate-500"}`}
                >
                  {x.label}
                </p>
                <p
                  className={`mt-0.5 text-2xl font-semibold leading-none ${mode === "dashboard" ? "text-white" : "text-slate-950"}`}
                >
                  {x.value}
                </p>
                <p
                  className={`mt-2 text-[11px] ${mode === "dashboard" ? "text-white/70" : "text-slate-400"}`}
                >
                  Live workload
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {mode !== "dashboard" && (
        <label className="order-4 block text-xs font-medium text-slate-600 md:hidden">
          Task category
          <select
            value={activeCategory ?? ""}
            onChange={(event) =>
              router.push(categoryHref(event.target.value || null))
            }
            className={`mt-1 min-h-11 ${input}`}
          >
            <option value="">All tasks</option>
            {MARKETING_TYPES.filter((type) => type.key !== "ai_video").map(
              (type) => (
                <option key={type.key} value={type.key}>
                  {type.label}
                </option>
              ),
            )}
          </select>
        </label>
      )}
      {mode !== "dashboard" && !currentType ? (
        <div className="order-6 min-w-0 space-y-4">
          {Filters}
          <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(280px,0.72fr)_minmax(0,1.8fr)]">
            <div className="space-y-4">
              <section className="dashboard-enter overflow-hidden rounded-md border border-white/80 bg-white/76 shadow-[0_18px_44px_-30px_rgba(15,23,42,0.42)] backdrop-blur-xl">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <h2 className="text-sm font-semibold text-slate-900">
                    Published this month
                  </h2>
                  {testing ? (
                    <span className="text-xs font-medium text-slate-500">
                      This month
                    </span>
                  ) : (
                    <Link
                      href={
                        admin
                          ? "/admin/digital-marketing?view=analytics"
                          : "/marketing/analytics"
                      }
                      className="text-xs font-medium text-blue-700 hover:underline"
                    >
                      Analytics
                    </Link>
                  )}
                </div>
                <div className="divide-y divide-slate-100">
                  {visibleMetrics.slice(0, 8).map((m) => (
                    <Link
                      key={m.key}
                      href={
                        testing
                          ? `/marketing-preview?view=work&category=${m.key}`
                          : admin
                            ? `/admin/digital-marketing?type=${m.key}`
                            : `/marketing?category=${m.key}`
                      }
                      className="group flex items-center gap-3 px-4 py-2.5 transition hover:bg-blue-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
                    >
                      <span className="grid h-7 w-7 place-items-center rounded bg-slate-100 text-slate-600 transition group-hover:bg-white group-hover:text-blue-700">
                        <TypeIcon type={m.key} />
                      </span>
                      <span className="flex-1 text-sm text-slate-700">
                        {m.label}
                      </span>
                      <span className="font-semibold text-slate-900">
                        {m.current}
                      </span>
                      <span
                        className={`text-xs ${m.difference >= 0 ? "text-emerald-700" : "text-rose-700"}`}
                      >
                        {m.difference >= 0 ? "+" : ""}
                        {m.difference}
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
              <section className="dashboard-enter overflow-hidden rounded-md border border-white/80 bg-white/76 shadow-[0_18px_44px_-30px_rgba(15,23,42,0.42)] backdrop-blur-xl">
                <div className="border-b border-slate-100 px-4 py-3">
                  <h2 className="text-sm font-semibold text-slate-900">
                    Recent activity
                  </h2>
                </div>
                <div className="divide-y divide-slate-100">
                  {activities.slice(0, 8).map((a) => (
                    <div key={a.id} className="relative px-4 py-3 pl-9">
                      <span className="absolute left-4 top-[18px] h-2 w-2 rounded-full bg-blue-500 ring-4 ring-blue-50" />
                      <p className="text-sm text-slate-800">
                        <span className="font-medium">{a.actor_name}</span>{" "}
                        {a.action.replaceAll("_", " ")}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {a.task_title} · {displayDate(a.created_at)}
                      </p>
                    </div>
                  ))}
                  {!activities.length && (
                    <p className="px-4 py-8 text-center text-sm text-slate-500">
                      No activity yet.
                    </p>
                  )}
                </div>
              </section>
            </div>
            <div className="min-w-0">{TaskTable}</div>
          </div>
        </div>
      ) : mode !== "dashboard" &&
        currentType?.key === "followers" &&
        testing ? (
        <div className="order-6 min-w-0 space-y-5">
          <SocialMediaTracker employeeName={firstName} />
          {Filters}
          {TaskTable}
        </div>
      ) : mode === "dashboard" ? null : (
        <div className="order-6 space-y-5">
          {Filters}
          {TaskTable}
        </div>
      )}

      {selected && (
        <MarketingDialog
          titleId="task-details-title"
          onClose={() => setSelected(null)}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-blue-700">
                {typeLabel(selected.marketing_type)}
              </p>
              <h2
                id="task-details-title"
                className="mt-1 break-words text-lg font-semibold text-slate-900"
              >
                {selected.title}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {selected.description || "No description provided."}
              </p>
            </div>
            <button
              onClick={() => setSelected(null)}
              aria-label="Close"
              className="rounded p-1 text-slate-500 hover:bg-slate-100"
            >
              <Icons.X className="h-5 w-5" />
            </button>
          </div>
          {message && (
            <p
              role="alert"
              className="mt-4 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900"
            >
              {message}
            </p>
          )}
          {admin && (
            <div className="mt-5 grid gap-3 rounded-md border border-slate-200 p-4 sm:grid-cols-2">
              <label className="text-xs font-medium text-slate-600">
                Employee
                <select
                  className={`mt-1 ${input}`}
                  value={form.assigned_to}
                  onChange={(e) =>
                    setForm({ ...form, assigned_to: e.target.value })
                  }
                >
                  {employees.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.full_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium text-slate-600">
                Due date
                <input
                  type="date"
                  className={`mt-1 ${input}`}
                  value={form.due_date}
                  onChange={(e) =>
                    setForm({ ...form, due_date: e.target.value })
                  }
                />
              </label>
              <label className="text-xs font-medium text-slate-600">
                Priority
                <select
                  className={`mt-1 ${input}`}
                  value={form.priority}
                  onChange={(e) =>
                    setForm({ ...form, priority: e.target.value })
                  }
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>
              <label className="text-xs font-medium text-slate-600">
                Platform
                <select
                  className={`mt-1 ${input}`}
                  value={form.platform}
                  onChange={(e) =>
                    setForm({ ...form, platform: e.target.value })
                  }
                >
                  <option value="">Not specified</option>
                  {platforms.map((x) => (
                    <option key={x.key} value={x.label}>
                      {x.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          <div className="mt-5 grid gap-3 rounded-md bg-slate-50 p-4 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs text-slate-500">Employee</p>
              <p className="font-medium text-slate-800">
                {selected.assignee_name}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Due date</p>
              <p className="font-medium text-slate-800">
                {displayDate(selected.due_date)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Status</p>
              <span
                className={`mt-1 inline-block rounded px-2 py-1 text-xs font-medium ${statusTone[selected.marketing_status]}`}
              >
                {statusLabel(selected.marketing_status)}
              </span>
            </div>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-medium text-slate-600">
              Published/work link
              <input
                value={workUrl}
                onChange={(e) => setWorkUrl(e.target.value)}
                placeholder="https://..."
                className={`mt-1 ${input}`}
                disabled={!canEditWork}
              />
            </label>
            <label className="text-xs font-medium text-slate-600">
              Deliverables completed
              <input
                type="number"
                min="1"
                value={count}
                onChange={(e) => setCount(e.target.value)}
                className={`mt-1 ${input}`}
                disabled={!canEditWork}
              />
            </label>
            {selected.marketing_type === "followers" && (
              <>
                <label className="text-xs font-medium text-slate-600">
                  Starting followers
                  <input
                    type="number"
                    min="0"
                    value={followersStart}
                    disabled={!canEditWork}
                    onChange={(e) => setFollowersStart(e.target.value)}
                    className={`mt-1 ${input}`}
                  />
                </label>
                <label className="text-xs font-medium text-slate-600">
                  Ending followers
                  <input
                    type="number"
                    min="0"
                    value={followersEnd}
                    disabled={!canEditWork}
                    onChange={(e) => setFollowersEnd(e.target.value)}
                    className={`mt-1 ${input}`}
                  />
                </label>
              </>
            )}
            <label className="text-xs font-medium text-slate-600 sm:col-span-2">
              Notes
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={`mt-1 ${input}`}
                disabled={!canEditWork}
              />
            </label>
          </div>
          <div className="mt-4 rounded-md border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-slate-800">
                  Proof files
                </p>
                <p className="text-xs text-slate-500">
                  Images, video, documents, or screenshots.
                </p>
              </div>
              {canEditWork && (
                <>
                  <input
                    ref={fileRef}
                    type="file"
                    className="hidden"
                    id="marketing-proof"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (f) uploadProof(selected, f);
                    }}
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => fileRef.current?.click()}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <Icons.Upload className="h-4 w-4" />
                    {busy ? "Uploading..." : "Upload proof"}
                  </button>
                </>
              )}
            </div>
            <div className="mt-3 space-y-2">
              {files
                .filter((f) => f.task_id === selected.id)
                .map((f) => (
                  <button
                    key={f.id}
                    onClick={() => openProof(f)}
                    className="flex w-full items-center gap-2 rounded bg-slate-50 px-3 py-2 text-left text-sm text-blue-700 hover:bg-blue-50"
                  >
                    <Icons.Paperclip className="h-4 w-4" />
                    {f.file_name}
                  </button>
                ))}
              {!files.some((f) => f.task_id === selected.id) && (
                <p className="text-sm text-slate-400">No files uploaded.</p>
              )}
            </div>
          </div>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            {testing && (
              <button
                onClick={() => deleteLocalTask(selected)}
                className="mr-auto rounded-md border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50"
              >
                Delete task
              </button>
            )}
            <button
              onClick={() => setSelected(null)}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700"
            >
              Close
            </button>
            {admin && (
              <button
                disabled={busy}
                onClick={saveAdminChanges}
                className="rounded-md border border-blue-200 px-4 py-2 text-sm font-medium text-blue-700"
              >
                Save changes
              </button>
            )}
            {!admin && selected.marketing_status === "assigned" && (
              <button
                disabled={busy}
                onClick={() => transition(selected, "in_progress")}
                className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white"
              >
                Start work
              </button>
            )}
            {!admin &&
              ["in_progress", "rejected"].includes(
                selected.marketing_status,
              ) && (
                <button
                  disabled={busy}
                  onClick={() => transition(selected, "submitted")}
                  className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  Submit for approval
                </button>
              )}
            {admin && selected.marketing_status === "submitted" && (
              <>
                <button
                  disabled={busy}
                  onClick={() => transition(selected, "rejected")}
                  className="rounded-md border border-rose-200 px-4 py-2 text-sm font-medium text-rose-700"
                >
                  Return work
                </button>
                <button
                  disabled={busy}
                  onClick={() => transition(selected, "approved")}
                  className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white"
                >
                  Approve
                </button>
              </>
            )}
            {admin && selected.marketing_status === "approved" && (
              <button
                disabled={busy}
                onClick={() => transition(selected, "published")}
                className="rounded-md bg-violet-700 px-4 py-2 text-sm font-medium text-white"
              >
                Mark published
              </button>
            )}
          </div>
        </MarketingDialog>
      )}

      {createOpen && (
        <MarketingDialog
          titleId="new-task-title"
          onClose={() => setCreateOpen(false)}
          glass
        >
          <div className="relative z-10 flex items-center justify-between border-b border-white/70 pb-4">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-md border border-white/80 bg-white/55 text-blue-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_8px_20px_-14px_rgba(30,64,175,0.8)] backdrop-blur-md">
                <Icons.ClipboardPlus className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2
                id="new-task-title"
                className="text-lg font-semibold text-slate-900"
              >
                {testing && !admin ? "Add new task" : "Assign marketing task"}
              </h2>
            </div>
            <button
              onClick={() => setCreateOpen(false)}
              aria-label="Close"
              className="liquid-glass-icon-button grid h-9 w-9 place-items-center rounded-md text-slate-500 transition hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <Icons.X className="h-5 w-5" />
            </button>
          </div>
          {message && (
            <p
              role="alert"
              className="relative z-10 mt-4 rounded-md border border-rose-200 bg-white/80 p-3 text-sm text-rose-800"
            >
              {message}
            </p>
          )}
          <div className="relative z-10 mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-medium text-slate-600 sm:col-span-2">
              Title *
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className={`mt-1 ${input}`}
              />
            </label>
            {testing && !admin ? (
              <div className="text-xs font-medium text-slate-600">
                Assigned to
                <div className="liquid-glass-static mt-1 rounded-md px-3 py-2 text-sm font-medium text-slate-800">
                  {firstName} (you)
                </div>
              </div>
            ) : (
              <label className="text-xs font-medium text-slate-600">
                Employee *
                <select
                  value={form.assigned_to}
                  onChange={(e) =>
                    setForm({ ...form, assigned_to: e.target.value })
                  }
                  className={`mt-1 ${input}`}
                >
                  <option value="">Select employee</option>
                  {employees.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.full_name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="text-xs font-medium text-slate-600">
              Activity type
              <select
                value={form.marketing_type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    marketing_type: e.target.value as MarketingType,
                  })
                }
                className={`mt-1 ${input}`}
              >
                {MARKETING_TYPES.map((x) => (
                  <option key={x.key} value={x.key}>
                    {x.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-slate-600">
              Due date *
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                className={`mt-1 ${input}`}
              />
            </label>
            <label className="text-xs font-medium text-slate-600">
              Priority
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className={`mt-1 ${input}`}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
            <label className="text-xs font-medium text-slate-600">
              Business unit
              <select
                value={form.business_unit}
                onChange={(e) =>
                  setForm({ ...form, business_unit: e.target.value })
                }
                className={`mt-1 ${input}`}
              >
                <option value="">Not specified</option>
                {units.map((x) => (
                  <option key={x.key} value={x.label}>
                    {x.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-slate-600">
              Platform
              <select
                value={form.platform}
                onChange={(e) => setForm({ ...form, platform: e.target.value })}
                className={`mt-1 ${input}`}
              >
                <option value="">Not specified</option>
                {platforms.map((x) => (
                  <option key={x.key} value={x.label}>
                    {x.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-slate-600">
              Campaign
              <input
                value={form.campaign_name}
                onChange={(e) =>
                  setForm({ ...form, campaign_name: e.target.value })
                }
                className={`mt-1 ${input}`}
              />
            </label>
            <label className="text-xs font-medium text-slate-600">
              Expected deliverables
              <input
                type="number"
                min="1"
                value={form.deliverable_count}
                onChange={(e) =>
                  setForm({ ...form, deliverable_count: e.target.value })
                }
                className={`mt-1 ${input}`}
              />
            </label>
            <label className="text-xs font-medium text-slate-600 sm:col-span-2">
              Description
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                className={`mt-1 ${input}`}
              />
            </label>
          </div>
          <div className="relative z-10 mt-5 flex justify-end gap-2 border-t border-white/70 pt-4">
            <button
              onClick={() => setCreateOpen(false)}
              className="liquid-glass-cancel rounded-md px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-white/80 hover:text-slate-950"
            >
              Cancel
            </button>
            <button
              disabled={busy}
              onClick={createTask}
              className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_26px_-14px_rgba(29,78,216,0.9)] transition hover:-translate-y-0.5 hover:bg-blue-800 hover:shadow-[0_16px_30px_-14px_rgba(29,78,216,0.95)] disabled:opacity-50 motion-reduce:transform-none"
            >
              {busy
                ? "Saving..."
                : testing && !admin
                  ? "Add task"
                  : "Assign task"}
            </button>
          </div>
        </MarketingDialog>
      )}
    </div>
  );
}
