"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpDown,
  Filter,
  Plus,
  Search,
  Table2,
  Columns3,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { dateInTimeZone } from "@/features/planning/period";
import {
  completeOccurrence,
  createTask,
  fetchOccurrences,
  fetchProjects,
  patchTask,
  reopenOccurrence,
} from "@/features/tasks/api";
import { TaskDetailPanel } from "@/features/tasks/task-detail-panel";
import { fetchCurrentUser } from "@/features/users/api";
import { useI18n } from "@/i18n/i18n-provider";
import { apiRequest } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import type { OccurrenceStatus, OccurrenceWithTask, TaskPriority } from "@/types/domain";

type StatusRule = "NOT_COMPLETE" | "ALL" | OccurrenceStatus;
type TickboxRule = "ALL" | "UNCHECKED" | "CHECKED";
type SortField = "DATE_ASC" | "DATE_DESC" | "PRIORITY" | "TITLE";

const STATUS_BADGE_MAP: Record<OccurrenceStatus, { dot: string; bg: string }> = {
  NOT_STARTED: {
    dot: "bg-slate-400",
    bg: "bg-slate-500/15 text-slate-600 dark:text-slate-300",
  },
  IN_PROGRESS: {
    dot: "bg-sky-400",
    bg: "bg-sky-500/20 text-sky-600 dark:text-sky-300",
  },
  DONE: {
    dot: "bg-emerald-400",
    bg: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-300",
  },
  SKIPPED: {
    dot: "bg-amber-400",
    bg: "bg-amber-500/20 text-amber-600 dark:text-amber-300",
  },
  CANCELLED: {
    dot: "bg-rose-400",
    bg: "bg-rose-500/20 text-rose-600 dark:text-rose-300",
  },
};

const PRIORITY_RANK: Record<TaskPriority, number> = {
  URGENT: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

function formatDisplayDate(dateIso: string | null, locale: "vi" | "en"): string {
  if (!dateIso) return "—";
  const parsed = new Date(`${dateIso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateIso;
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parsed);
}

export function NotionTaskDatabase({
  initialTitle = "Today Timeline",
  onTitleChange,
}: {
  initialTitle?: string;
  onTitleChange?: (next: string) => void;
}) {
  const { locale, translateStatus, translatePriority } = useI18n();
  const client = useQueryClient();

  const userQuery = useQuery({ queryKey: ["me"], queryFn: fetchCurrentUser, retry: false });
  const timezone = userQuery.data?.settings?.timezone ?? "Asia/Ho_Chi_Minh";
  const todayIso = dateInTimeZone(new Date(), timezone);

  const occsQuery = useQuery({
    queryKey: ["occurrences", "all", "dashboard-notion"],
    queryFn: () => fetchOccurrences("all", { limit: 250 }),
  });
  const projectsQuery = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });

  const [blockTitle, setBlockTitle] = useState(initialTitle);
  const [editingTitle, setEditingTitle] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "board">("table");
  const [showFilters, setShowFilters] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [searchText, setSearchText] = useState("");

  // Active filter rules (Notion-style chips)
  const [statusRule, setStatusRule] = useState<StatusRule>("NOT_COMPLETE");
  const [tickboxRule, setTickboxRule] = useState<TickboxRule>("UNCHECKED");
  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [projectFilter, setProjectFilter] = useState<string>("");
  const [showExtraFilterMenu, setShowExtraFilterMenu] = useState(false);
  const filterMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!showExtraFilterMenu) return;
    const onMouseDown = (e: MouseEvent) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target as Node)) {
        setShowExtraFilterMenu(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowExtraFilterMenu(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [showExtraFilterMenu]);

  const [sortBy, setSortBy] = useState<SortField>("DATE_ASC");
  const [selectedItem, setSelectedItem] = useState<OccurrenceWithTask | null>(null);

  // Inline quick create row ("+ New page")
  const [creatingInline, setCreatingInline] = useState(false);
  const [inlineTitle, setInlineTitle] = useState("");
  const [inlineDate, setInlineDate] = useState(todayIso);
  const [inlineStatus, setInlineStatus] = useState<"NOT_STARTED" | "IN_PROGRESS" | "DONE">(
    "IN_PROGRESS"
  );

  const projectMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of projectsQuery.data ?? []) map.set(p.id, p.title);
    return map;
  }, [projectsQuery.data]);

  const createMut = useMutation({
    mutationFn: () =>
      createTask({
        title: inlineTitle.trim(),
        scheduled_date: inlineDate || todayIso,
        status: inlineStatus,
        priority: "MEDIUM",
        project_id: projectFilter && projectFilter !== "__INBOX__" ? projectFilter : null,
      }),
    onSuccess: async () => {
      setInlineTitle("");
      setCreatingInline(false);
      await Promise.all([
        client.invalidateQueries({ queryKey: ["occurrences"] }),
        client.invalidateQueries({ queryKey: ["streak"] }),
      ]);
      toast.success(locale === "en" ? "Task created" : "Đã tạo nhiệm vụ");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
  });

  const transitionMut = useMutation({
    mutationFn: async ({
      item,
      nextStatus,
    }: {
      item: OccurrenceWithTask;
      nextStatus: OccurrenceStatus;
    }) => {
      if (nextStatus === "DONE") return completeOccurrence(item.id);
      if (nextStatus === "NOT_STARTED") {
        if (item.status === "DONE") return reopenOccurrence(item.id);
        return apiRequest(`/occurrences/${item.id}/reopen`, { method: "POST" });
      }
      if (nextStatus === "IN_PROGRESS") {
        if (item.status === "DONE") await reopenOccurrence(item.id);
        return apiRequest(`/occurrences/${item.id}/start`, { method: "POST" });
      }
      return apiRequest(`/occurrences/${item.id}/cancel`, { method: "POST" });
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["occurrences"] }),
        client.invalidateQueries({ queryKey: ["streak"] }),
      ]);
    },
  });

  const activeRuleCount =
    (statusRule !== "ALL" ? 1 : 0) +
    (tickboxRule !== "ALL" ? 1 : 0) +
    (priorityFilter ? 1 : 0) +
    (projectFilter ? 1 : 0);

  const filteredRows = useMemo(() => {
    const raw = occsQuery.data?.items ?? [];
    const q = searchText.trim().toLowerCase();

    const matched = raw.filter((item) => {
      if (statusRule === "NOT_COMPLETE") {
        if (item.status === "DONE" || item.status === "CANCELLED" || item.status === "SKIPPED") {
          return false;
        }
      } else if (statusRule !== "ALL" && item.status !== statusRule) {
        return false;
      }

      if (tickboxRule === "CHECKED" && item.status !== "DONE") return false;
      if (tickboxRule === "UNCHECKED" && item.status === "DONE") return false;

      if (priorityFilter && item.task.priority !== priorityFilter) return false;
      if (projectFilter === "__INBOX__") {
        if (item.task.project_id !== null) return false;
      } else if (projectFilter && item.task.project_id !== projectFilter) {
        return false;
      }

      if (q) {
        const titleHit = item.task.title.toLowerCase().includes(q);
        const noteHit = (item.task.description ?? "").toLowerCase().includes(q);
        if (!titleHit && !noteHit) return false;
      }
      return true;
    });

    return [...matched].sort((a, b) => {
      if (sortBy === "TITLE") return a.task.title.localeCompare(b.task.title);
      if (sortBy === "PRIORITY") {
        return PRIORITY_RANK[a.task.priority] - PRIORITY_RANK[b.task.priority];
      }
      const da = a.scheduled_date ?? "9999-12-31";
      const db = b.scheduled_date ?? "9999-12-31";
      return sortBy === "DATE_DESC" ? db.localeCompare(da) : da.localeCompare(db);
    });
  }, [occsQuery.data?.items, priorityFilter, projectFilter, searchText, sortBy, statusRule, tickboxRule]);

  function handleInlineSubmit(e: FormEvent) {
    e.preventDefault();
    if (!inlineTitle.trim() || createMut.isPending) return;
    createMut.mutate();
  }

  return (
    <section className="w-full space-y-3">
      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          {editingTitle ? (
            <input
              autoFocus
              value={blockTitle}
              onChange={(e) => setBlockTitle(e.target.value)}
              onBlur={() => {
                setEditingTitle(false);
                onTitleChange?.(blockTitle.trim() || "Today Timeline");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setEditingTitle(false);
                  onTitleChange?.(blockTitle.trim() || "Today Timeline");
                }
              }}
              className="border-b border-primary bg-transparent text-lg font-semibold text-foreground outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditingTitle(true)}
              className="text-left text-lg font-semibold tracking-tight text-foreground hover:opacity-80"
            >
              {blockTitle}
            </button>
          )}
        </div>
      </div>

      {/* View Switcher + Notion Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
              viewMode === "table"
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-secondary/60"
            )}
          >
            <Table2 className="h-3.5 w-3.5" />
            <span>Table</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("board")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
              viewMode === "board"
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-secondary/60"
            )}
          >
            <Columns3 className="h-3.5 w-3.5" />
            <span>Board</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {showSearch && (
            <div className="relative flex items-center">
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder={locale === "en" ? "Filter title..." : "Tìm kiếm..."}
                className="h-7 w-40 rounded-md border border-border bg-background px-2 pr-6 text-xs outline-none focus:border-primary"
              />
              {searchText && (
                <button
                  type="button"
                  onClick={() => setSearchText("")}
                  className="absolute right-1.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowFilters((p) => !p)}
            title={locale === "en" ? "Toggle filters" : "Bộ lọc"}
            className={cn(
              "inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs transition-colors",
              showFilters
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-secondary"
            )}
          >
            <Filter className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() =>
              setSortBy((prev) =>
                prev === "DATE_ASC"
                  ? "DATE_DESC"
                  : prev === "DATE_DESC"
                    ? "PRIORITY"
                    : prev === "PRIORITY"
                      ? "TITLE"
                      : "DATE_ASC"
              )
            }
            title={locale === "en" ? "Cycle sort" : "Đổi kiểu sắp xếp"}
            className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            <span className="hidden text-[11px] sm:inline">
              {sortBy === "DATE_ASC"
                ? "Date ↑"
                : sortBy === "DATE_DESC"
                  ? "Date ↓"
                  : sortBy === "PRIORITY"
                    ? "Priority"
                    : "A–Z"}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowSearch((p) => !p)}
            title={locale === "en" ? "Search" : "Tìm kiếm"}
            className={cn(
              "inline-flex h-7 items-center rounded-md px-2 text-xs transition-colors",
              showSearch
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-secondary"
            )}
          >
            <Search className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setCreatingInline(true)}
            className="inline-flex h-7 items-center gap-1 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:opacity-95"
          >
            <span>New</span>
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Inline Notion-style Filter Rule Bar */}
      {showFilters && (
        <div className="relative flex flex-wrap items-center gap-1.5 py-0.5 text-xs">
          <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 font-medium text-primary">
            <Filter className="h-3 w-3" />
            <span>
              {activeRuleCount} {locale === "en" ? "rules" : "quy tắc"}
            </span>
          </span>

          {/* Status rule chip */}
          <label className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-full border border-sky-500/40 bg-sky-500/10 px-2.5 text-sky-600 dark:text-sky-300">
            <span className="font-medium">Status :</span>
            <select
              aria-label="Filter by status"
              value={statusRule}
              onChange={(e) => setStatusRule(e.target.value as StatusRule)}
              className="cursor-pointer bg-transparent font-medium outline-none"
            >
              <option value="NOT_COMPLETE" className="bg-card text-foreground">
                {locale === "en" ? "Not Complete" : "Chưa xong"}
              </option>
              <option value="ALL" className="bg-card text-foreground">
                {locale === "en" ? "All" : "Tất cả"}
              </option>
              <option value="IN_PROGRESS" className="bg-card text-foreground">
                {translateStatus("IN_PROGRESS")}
              </option>
              <option value="NOT_STARTED" className="bg-card text-foreground">
                {translateStatus("NOT_STARTED")}
              </option>
              <option value="DONE" className="bg-card text-foreground">
                {translateStatus("DONE")}
              </option>
            </select>
          </label>

          {/* Tickbox rule chip */}
          <label className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-full border border-border bg-secondary/40 px-2.5 text-foreground">
            <span className="font-medium">Tickbox :</span>
            <select
              aria-label="Filter by tickbox"
              value={tickboxRule}
              onChange={(e) => setTickboxRule(e.target.value as TickboxRule)}
              className="cursor-pointer bg-transparent font-medium outline-none"
            >
              <option value="UNCHECKED" className="bg-card text-foreground">
                {locale === "en" ? "Unchecked" : "Chưa tick"}
              </option>
              <option value="CHECKED" className="bg-card text-foreground">
                {locale === "en" ? "Checked" : "Đã tick"}
              </option>
              <option value="ALL" className="bg-card text-foreground">
                {locale === "en" ? "All" : "Tất cả"}
              </option>
            </select>
          </label>

          {/* Optional Priority filter chip */}
          {priorityFilter && (
            <span className="inline-flex h-7 items-center gap-1 rounded-full border border-border bg-secondary/40 px-2.5">
              <span>Priority : {translatePriority(priorityFilter as TaskPriority)}</span>
              <button type="button" onClick={() => setPriorityFilter("")}>
                <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
              </button>
            </span>
          )}

          {/* Optional Project filter chip */}
          {projectFilter && (
            <span className="inline-flex h-7 items-center gap-1 rounded-full border border-border bg-secondary/40 px-2.5">
              <span>
                Project :{" "}
                {projectFilter === "__INBOX__"
                  ? "Inbox"
                  : (projectMap.get(projectFilter) ?? projectFilter)}
              </span>
              <button type="button" onClick={() => setProjectFilter("")}>
                <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
              </button>
            </span>
          )}

          {/* + Filter */}
          <div ref={filterMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setShowExtraFilterMenu((p) => !p)}
              className="inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <Plus className="h-3 w-3" />
              <span>Filter</span>
            </button>

            {showExtraFilterMenu && (
              <div className="absolute left-0 top-8 z-30 w-56 space-y-2 rounded-xl border border-border bg-card p-3 shadow-xl">
                <label className="grid gap-1 text-[11px]">
                  <span className="font-medium text-muted-foreground">Priority</span>
                  <select
                    value={priorityFilter}
                    onChange={(e) => {
                      setPriorityFilter(e.target.value);
                      setShowExtraFilterMenu(false);
                    }}
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                  >
                    <option value="">All</option>
                    <option value="URGENT">{translatePriority("URGENT")}</option>
                    <option value="HIGH">{translatePriority("HIGH")}</option>
                    <option value="MEDIUM">{translatePriority("MEDIUM")}</option>
                    <option value="LOW">{translatePriority("LOW")}</option>
                  </select>
                </label>

                <label className="grid gap-1 text-[11px]">
                  <span className="font-medium text-muted-foreground">Project</span>
                  <select
                    value={projectFilter}
                    onChange={(e) => {
                      setProjectFilter(e.target.value);
                      setShowExtraFilterMenu(false);
                    }}
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                  >
                    <option value="">All</option>
                    <option value="__INBOX__">Inbox (No Project)</option>
                    {(projectsQuery.data ?? []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setStatusRule("ALL");
                    setTickboxRule("ALL");
                    setPriorityFilter("");
                    setProjectFilter("");
                    setShowExtraFilterMenu(false);
                  }}
                  className="w-full rounded-md py-1 text-left text-[11px] text-primary hover:underline"
                >
                  {locale === "en" ? "Reset all filters" : "Hiển thị tất cả"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notion Table View (Full-Width Borderless Hairline Table) */}
      {viewMode === "table" ? (
        <div className="w-full overflow-x-auto border-t border-border/70">
          <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-border/70 text-xs font-normal text-muted-foreground">
                <th className="w-[30%] py-2 pr-3 font-normal">Aa Task</th>
                <th className="w-[18%] border-l border-border/50 px-3 py-2 font-normal">Project</th>
                <th className="w-[17%] border-l border-border/50 px-3 py-2 font-normal">Time</th>
                <th className="w-[14%] border-l border-border/50 px-3 py-2 font-normal">Status</th>
                <th className="w-[8%] border-l border-border/50 px-3 py-2 font-normal text-center">
                  Tickbox
                </th>
                <th className="w-[13%] border-l border-border/50 px-3 py-2 font-normal">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {occsQuery.isLoading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-muted-foreground">
                    {locale === "en" ? "Loading…" : "Đang tải…"}
                  </td>
                </tr>
              ) : filteredRows.length === 0 && !creatingInline ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-muted-foreground">
                    {locale === "en"
                      ? "No items match current filters."
                      : "Không có nhiệm vụ nào khớp bộ lọc."}
                  </td>
                </tr>
              ) : (
                filteredRows.map((item) => {
                  const badge = STATUS_BADGE_MAP[item.status];
                  const isOverdueOrToday =
                    item.status !== "DONE" &&
                    item.scheduled_date &&
                    item.scheduled_date <= todayIso;
                  return (
                    <tr
                      key={item.id}
                      className="group transition-colors hover:bg-secondary/35"
                    >
                      <td className="py-2 pr-3 font-medium text-foreground">
                        <button
                          type="button"
                          onClick={() => setSelectedItem(item)}
                          className={cn(
                            "w-full truncate text-left hover:underline",
                            item.status === "DONE" && "line-through text-muted-foreground"
                          )}
                        >
                          {item.task.title}
                        </button>
                      </td>

                      <td className="border-l border-border/50 px-2 py-1.5">
                        <select
                          aria-label={`Project for ${item.task.title}`}
                          value={item.task.project_id ?? ""}
                          onChange={async (e) => {
                            await patchTask(item.task.id, {
                              project_id: e.target.value || null,
                              expected_version: item.task.version,
                            });
                            await client.invalidateQueries({ queryKey: ["occurrences"] });
                          }}
                          className="h-7 w-full max-w-36 cursor-pointer truncate rounded bg-transparent px-1 text-[11px] text-muted-foreground outline-none hover:bg-secondary/60 focus:text-foreground"
                        >
                          <option value="" className="bg-card text-foreground">
                            — Inbox —
                          </option>
                          {(projectsQuery.data ?? []).map((p) => (
                            <option key={p.id} value={p.id} className="bg-card text-foreground">
                              {p.title}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td
                        className={cn(
                          "border-l border-border/50 px-3 py-2 font-normal whitespace-nowrap",
                          isOverdueOrToday
                            ? "text-rose-500 dark:text-rose-400"
                            : "text-muted-foreground"
                        )}
                      >
                        {formatDisplayDate(item.scheduled_date, locale)}
                      </td>

                      <td className="border-l border-border/50 px-3 py-1.5">
                        <select
                          aria-label={`Status for ${item.task.title}`}
                          value={item.status}
                          onChange={(e) =>
                            transitionMut.mutate({
                              item,
                              nextStatus: e.target.value as OccurrenceStatus,
                            })
                          }
                          className={cn(
                            "h-6 cursor-pointer rounded-full px-2.5 text-[11px] font-medium outline-none",
                            badge.bg
                          )}
                        >
                          <option value="NOT_STARTED" className="bg-card text-foreground">
                            {translateStatus("NOT_STARTED")}
                          </option>
                          <option value="IN_PROGRESS" className="bg-card text-foreground">
                            {translateStatus("IN_PROGRESS")}
                          </option>
                          <option value="DONE" className="bg-card text-foreground">
                            {translateStatus("DONE")}
                          </option>
                        </select>
                      </td>

                      <td className="border-l border-border/50 px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={item.status === "DONE"}
                          onChange={(e) =>
                            transitionMut.mutate({
                              item,
                              nextStatus: e.target.checked ? "DONE" : "NOT_STARTED",
                            })
                          }
                          aria-label={`Complete ${item.task.title}`}
                          className="h-4 w-4 cursor-pointer rounded border-border accent-primary"
                        />
                      </td>

                      <td className="max-w-xs truncate border-l border-border/50 px-3 py-2 text-xs text-muted-foreground">
                        {item.task.description ?? ""}
                      </td>
                    </tr>
                  );
                })
              )}

              {/* Inline "+ New page" creation row */}
              {creatingInline && (
                <tr className="bg-secondary/20">
                  <td colSpan={6} className="py-2 px-1">
                    <form onSubmit={handleInlineSubmit} className="flex flex-wrap items-center gap-2">
                      <input
                        autoFocus
                        value={inlineTitle}
                        onChange={(e) => setInlineTitle(e.target.value)}
                        placeholder={locale === "en" ? "New task title..." : "Tên nhiệm vụ mới..."}
                        className="h-8 min-w-[220px] flex-1 rounded-md border border-primary/50 bg-background px-2.5 text-xs outline-none"
                      />
                      <input
                        type="date"
                        value={inlineDate}
                        onChange={(e) => setInlineDate(e.target.value)}
                        className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                      />
                      <select
                        value={inlineStatus}
                        onChange={(e) =>
                          setInlineStatus(
                            e.target.value as "NOT_STARTED" | "IN_PROGRESS" | "DONE"
                          )
                        }
                        className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                      >
                        <option value="NOT_STARTED">{translateStatus("NOT_STARTED")}</option>
                        <option value="IN_PROGRESS">{translateStatus("IN_PROGRESS")}</option>
                        <option value="DONE">{translateStatus("DONE")}</option>
                      </select>
                      <button
                        type="submit"
                        disabled={!inlineTitle.trim() || createMut.isPending}
                        className="h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-50"
                      >
                        {locale === "en" ? "Save" : "Lưu"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCreatingInline(false);
                          setInlineTitle("");
                        }}
                        className="h-8 rounded-md px-2 text-xs text-muted-foreground hover:text-foreground"
                      >
                        {locale === "en" ? "Cancel" : "Hủy"}
                      </button>
                    </form>
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {!creatingInline && (
            <button
              type="button"
              onClick={() => setCreatingInline(true)}
              className="flex w-full items-center gap-1.5 border-t border-border/50 py-2 text-xs text-muted-foreground transition-colors hover:bg-secondary/30 hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{locale === "en" ? "New page" : "Thêm mới"}</span>
            </button>
          )}
        </div>
      ) : (
        /* Compact Notion Board View */
        <div className="grid gap-4 md:grid-cols-3">
          {(["NOT_STARTED", "IN_PROGRESS", "DONE"] as const).map((colStatus) => {
            const colItems = filteredRows.filter((i) => i.status === colStatus);
            const badge = STATUS_BADGE_MAP[colStatus];
            return (
              <div key={colStatus} className="space-y-2 border-t border-border/70 pt-3">
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
                      badge.bg
                    )}
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full", badge.dot)} />
                    {translateStatus(colStatus)}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">{colItems.length}</span>
                </div>
                <div className="space-y-1.5">
                  {colItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedItem(item)}
                      className="block w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-left text-xs transition-colors hover:bg-secondary/40"
                    >
                      <p className="font-medium text-foreground">{item.task.title}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {formatDisplayDate(item.scheduled_date, locale)}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <TaskDetailPanel item={selectedItem} onClose={() => setSelectedItem(null)} />
    </section>
  );
}
