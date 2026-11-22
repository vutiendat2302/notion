"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Flame, Plus, SlidersHorizontal } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { DynamicChartCard } from "@/features/analytics/chart-renderer";
import { fetchStreak } from "@/features/analytics/api";
import { dateInTimeZone } from "@/features/planning/period";
import {
  completeOccurrence,
  createTask,
  fetchCategories,
  fetchOccurrences,
  fetchProjects,
  reopenOccurrence,
} from "@/features/tasks/api";
import { TaskDetailPanel } from "@/features/tasks/task-detail-panel";
import { fetchCurrentUser } from "@/features/users/api";
import { useI18n } from "@/i18n/i18n-provider";
import { apiRequest } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import type { OccurrenceStatus, OccurrenceWithTask, TaskPriority } from "@/types/domain";

export default function TodoListPage() {
  const { locale, translateStatus, translatePriority } = useI18n();
  const client = useQueryClient();

  const userQuery = useQuery({ queryKey: ["me"], queryFn: fetchCurrentUser, retry: false });
  const timezone = userQuery.data?.settings?.timezone ?? "Asia/Ho_Chi_Minh";
  const todayIso = dateInTimeZone(new Date(), timezone);

  // Quick Create 3 core fields (Title, Date/Time, Status) + optional expandable fields
  const [title, setTitle] = useState("");
  const [scheduledDate, setScheduledDate] = useState(todayIso);
  const [status, setStatus] = useState<"NOT_STARTED" | "IN_PROGRESS" | "DONE">("NOT_STARTED");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [description, setDescription] = useState("");
  const [estimatedMinutes, setEstimatedMinutes] = useState<string>("");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [projectId, setProjectId] = useState("");
  const [categoryId, setCategoryId] = useState("");

  const [viewMode, setViewMode] = useState<"list" | "kanban" | "table">("list");
  const [selectedItem, setSelectedItem] = useState<OccurrenceWithTask | null>(null);

  const occsQuery = useQuery({
    queryKey: ["occurrences", "all", "todo-list"],
    queryFn: () => fetchOccurrences("all", { limit: 200 }),
  });
  const streakQuery = useQuery({ queryKey: ["streak"], queryFn: fetchStreak });
  const projectsQuery = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });
  const categoriesQuery = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });

  const createMut = useMutation({
    mutationFn: () =>
      createTask({
        title: title.trim(),
        scheduled_date: scheduledDate || null,
        status,
        description: showAdvanced ? description.trim() || null : null,
        estimated_minutes:
          showAdvanced && estimatedMinutes ? Math.max(1, Number(estimatedMinutes)) : null,
        priority: showAdvanced ? priority : "MEDIUM",
        project_id: showAdvanced && projectId ? projectId : null,
        category_id: showAdvanced && categoryId ? categoryId : null,
      }),
    onSuccess: async () => {
      setTitle("");
      setDescription("");
      setEstimatedMinutes("");
      await Promise.all([
        client.invalidateQueries({ queryKey: ["occurrences"] }),
        client.invalidateQueries({ queryKey: ["streak"] }),
      ]);
      toast.success(locale === "en" ? "Task added" : "Đã thêm nhiệm vụ");
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
      if (nextStatus === "NOT_STARTED" && item.status === "DONE") return reopenOccurrence(item.id);
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

  const items = useMemo(() => occsQuery.data?.items ?? [], [occsQuery.data?.items]);
  const stats = useMemo(() => {
    const total = items.length;
    const notStarted = items.filter((i) => i.status === "NOT_STARTED").length;
    const inProgress = items.filter((i) => i.status === "IN_PROGRESS").length;
    const done = items.filter((i) => i.status === "DONE").length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    return { total, notStarted, inProgress, done, pct };
  }, [items]);

  function handleQuickCreate(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    createMut.mutate();
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="sr-only">Todo List</h1>
          {streakQuery.data && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
              <Flame className="h-3.5 w-3.5 text-primary" />
              <span>{streakQuery.data.current_streak}d</span>
            </span>
          )}
        </div>

        <div className="inline-flex rounded-xl border border-border bg-card p-1 text-xs">
          {(["list", "kanban", "table"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={cn(
                "rounded-lg px-3 py-1.5 font-medium capitalize",
                viewMode === mode ? "bg-accent text-accent-foreground" : "text-muted-foreground"
              )}
            >
              {mode}
            </button>
          ))}
        </div>
      </header>

      {/* Status Statistics Strip */}
      <section className="grid gap-3 border-y border-border/70 py-3 sm:grid-cols-4">
        <div className="px-2">
          <p className="text-xs text-muted-foreground">
            {locale === "en" ? "Not started" : "Chưa làm"}
          </p>
          <p className="mt-0.5 font-mono text-2xl font-semibold">{stats.notStarted}</p>
        </div>
        <div className="px-2 sm:border-l sm:border-border/60 sm:pl-5">
          <p className="text-xs text-muted-foreground">
            {locale === "en" ? "In progress" : "Đang làm"}
          </p>
          <p className="mt-0.5 font-mono text-2xl font-semibold text-primary">{stats.inProgress}</p>
        </div>
        <div className="px-2 sm:border-l sm:border-border/60 sm:pl-5">
          <p className="text-xs text-muted-foreground">
            {locale === "en" ? "Done" : "Hoàn thành"}
          </p>
          <p className="mt-0.5 font-mono text-2xl font-semibold">{stats.done}</p>
        </div>
        <div className="px-2 sm:border-l sm:border-border/60 sm:pl-5">
          <p className="text-xs text-muted-foreground">
            {locale === "en" ? "Completion" : "Tiến độ"}
          </p>
          <p className="mt-0.5 font-mono text-2xl font-semibold">{stats.pct}%</p>
        </div>
      </section>

      {/* Quick Create (3 Core Fields + Expandable Details) */}
      <form onSubmit={handleQuickCreate} className="space-y-3 border-b border-border/70 pb-4">
        <div className="grid gap-2.5 sm:grid-cols-[1fr_10rem_9.5rem_auto]">
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={
              locale === "en" ? "Task title..." : "Tiêu đề nhiệm vụ..."
            }
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
          />
          <input
            type="date"
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
            aria-label="Date"
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
          />
          <select
            value={status}
            onChange={(e) =>
              setStatus(e.target.value as "NOT_STARTED" | "IN_PROGRESS" | "DONE")
            }
            aria-label="Status"
            className="h-10 rounded-lg border border-input bg-background px-2.5 text-xs font-medium"
          >
            <option value="NOT_STARTED">{translateStatus("NOT_STARTED")}</option>
            <option value="IN_PROGRESS">{translateStatus("IN_PROGRESS")}</option>
            <option value="DONE">{translateStatus("DONE")}</option>
          </select>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setShowAdvanced((p) => !p)}
              title={locale === "en" ? "More details" : "Thêm chi tiết"}
              className={cn(
                "inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border hover:bg-secondary",
                showAdvanced && "border-primary bg-accent text-accent-foreground"
              )}
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
            <button
              type="submit"
              disabled={!title.trim() || createMut.isPending}
              className="inline-flex h-10 items-center gap-1 rounded-lg bg-primary px-4 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              <span>{locale === "en" ? "Add" : "Thêm"}</span>
            </button>
          </div>
        </div>

        {showAdvanced && (
          <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-4">
            <input
              type="number"
              min={1}
              max={1440}
              value={estimatedMinutes}
              onChange={(e) => setEstimatedMinutes(e.target.value)}
              placeholder={locale === "en" ? "Duration (min)" : "Thời lượng (phút)"}
              className="h-9 rounded-lg border border-input bg-background px-3 text-xs"
            />
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className="h-9 rounded-lg border border-input bg-background px-2.5 text-xs"
            >
              {(["LOW", "MEDIUM", "HIGH", "URGENT"] as const).map((p) => (
                <option key={p} value={p}>
                  {translatePriority(p)}
                </option>
              ))}
            </select>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="h-9 rounded-lg border border-input bg-background px-2.5 text-xs"
            >
              <option value="">{locale === "en" ? "No Project" : "Không có dự án"}</option>
              {(projectsQuery.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="h-9 rounded-lg border border-input bg-background px-2.5 text-xs"
            >
              <option value="">{locale === "en" ? "No Category" : "Không có danh mục"}</option>
              {(categoriesQuery.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={locale === "en" ? "Notes..." : "Ghi chú chi tiết..."}
              className="rounded-lg border border-input bg-background p-2.5 text-xs sm:col-span-4"
            />
          </div>
        )}
      </form>

      {/* Views */}
      {viewMode === "kanban" ? (
        <div className="grid gap-6 md:grid-cols-3">
          {(["NOT_STARTED", "IN_PROGRESS", "DONE"] as const).map((colStatus) => {
            const colItems = items.filter((i) => i.status === colStatus);
            return (
              <div key={colStatus} className="border-t border-border/70 pt-3">
                <div className="mb-3 flex items-center justify-between px-1">
                  <span className="text-xs font-semibold text-foreground">
                    {translateStatus(colStatus)}
                  </span>
                  <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px]">
                    {colItems.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {colItems.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
                      className="cursor-pointer rounded-lg border border-border/70 bg-background/70 p-3 text-xs hover:border-primary/50"
                    >
                      <p className="font-medium text-foreground">{item.task.title}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {item.scheduled_date ?? "Inbox"} · {translatePriority(item.task.priority)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : viewMode === "table" ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Task</th>
                <th className="py-2 pr-4 font-medium">{locale === "en" ? "Date" : "Ngày"}</th>
                <th className="py-2 pr-4 font-medium">{locale === "en" ? "Status" : "Trạng thái"}</th>
                <th className="py-2 pr-4 font-medium">{locale === "en" ? "Priority" : "Ưu tiên"}</th>
                <th className="py-2 font-medium">{locale === "en" ? "Est." : "Dự kiến"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-secondary/40">
                  <td className="py-2.5 pr-4 font-medium">
                    <button
                      type="button"
                      onClick={() => setSelectedItem(item)}
                      className="text-left hover:underline"
                    >
                      {item.task.title}
                    </button>
                  </td>
                  <td className="py-2.5 pr-4 font-mono text-muted-foreground">
                    {item.scheduled_date ?? "Inbox"}
                  </td>
                  <td className="py-2.5 pr-4">
                    <select
                      value={item.status}
                      onChange={(e) =>
                        transitionMut.mutate({
                          item,
                          nextStatus: e.target.value as OccurrenceStatus,
                        })
                      }
                      className="h-7 rounded border border-border bg-background px-1.5 text-[11px]"
                    >
                      <option value="NOT_STARTED">{translateStatus("NOT_STARTED")}</option>
                      <option value="IN_PROGRESS">{translateStatus("IN_PROGRESS")}</option>
                      <option value="DONE">{translateStatus("DONE")}</option>
                    </select>
                  </td>
                  <td className="py-2.5 pr-4">{translatePriority(item.task.priority)}</td>
                  <td className="py-2.5 font-mono text-muted-foreground">
                    {item.estimated_minutes ? `${item.estimated_minutes}m` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="divide-y divide-border/60">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-2 px-1 py-2.5 text-sm transition-colors hover:bg-secondary/30"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <input
                  type="checkbox"
                  checked={item.status === "DONE"}
                  onChange={(e) =>
                    transitionMut.mutate({
                      item,
                      nextStatus: e.target.checked ? "DONE" : "NOT_STARTED",
                    })
                  }
                  className="h-4 w-4 accent-primary"
                />
                <button
                  type="button"
                  onClick={() => setSelectedItem(item)}
                  className={cn(
                    "truncate text-left font-medium hover:underline",
                    item.status === "DONE" && "line-through text-muted-foreground"
                  )}
                >
                  {item.task.title}
                </button>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">{item.scheduled_date ?? "Inbox"}</span>
                <span className="rounded bg-secondary px-2 py-0.5 text-[11px]">
                  {translateStatus(item.status)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Expanded Detail + Task Execution & Duration Charts */}
      {selectedItem && (
        <div className="space-y-4">
          <TaskDetailPanel item={selectedItem} onClose={() => setSelectedItem(null)} />
          <div className="grid gap-6 border-t border-border/70 pt-5 md:grid-cols-2">
            <DynamicChartCard
              chartKey="task_execution_history"
              title="Execution History"
              filters={{ task_id: selectedItem.task_id }}
            />
            <DynamicChartCard
              chartKey="task_duration_trend"
              title="Duration Trend"
              filters={{ task_id: selectedItem.task_id }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
