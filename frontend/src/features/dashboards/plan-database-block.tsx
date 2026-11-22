"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, FolderPlus, Plus, Trash2 } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { addPlanItem, fetchPeriod, removePlanItem, savePlan } from "@/features/planning/api";
import {
  dateInTimeZone,
  parsePeriod,
  periodKeyForDate,
  shiftPeriod,
  type PeriodScope,
} from "@/features/planning/period";
import {
  completeOccurrence,
  createProject,
  createTask,
  fetchOccurrences,
  fetchProjects,
  reopenOccurrence,
} from "@/features/tasks/api";
import { fetchCurrentUser } from "@/features/users/api";
import { useI18n } from "@/i18n/i18n-provider";
import { cn } from "@/lib/utils";
import type { PeriodType } from "@/types/domain";

const PERIOD_LABELS: Record<PeriodScope, { vi: string; en: string }> = {
  year: { vi: "Năm", en: "Year" },
  quarter: { vi: "Quý", en: "Quarter" },
  month: { vi: "Tháng", en: "Month" },
  week: { vi: "Tuần", en: "Week" },
  day: { vi: "Ngày", en: "Day" },
};

export function PlanDatabaseBlock({
  initialTitle = "DB Kế hoạch",
  initialPeriodType = "WEEK",
  onSpecPatch,
}: {
  initialTitle?: string;
  initialPeriodType?: PeriodType;
  onSpecPatch?: (patch: Record<string, unknown>) => void;
}) {
  const { locale } = useI18n();
  const client = useQueryClient();
  const meQuery = useQuery({ queryKey: ["me"], queryFn: fetchCurrentUser, retry: false });
  const timezone = meQuery.data?.settings?.timezone ?? "Asia/Ho_Chi_Minh";
  const todayIso = dateInTimeZone(new Date(), timezone);

  const [scope, setScope] = useState<PeriodScope>(
    (initialPeriodType.toLowerCase() as PeriodScope) || "week"
  );
  const [periodKey, setPeriodKey] = useState(
    () => periodKeyForDate((initialPeriodType.toLowerCase() as PeriodScope) || "week", todayIso) ?? todayIso
  );
  const [selectedProjectToLink, setSelectedProjectToLink] = useState("");
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [focusDraft, setFocusDraft] = useState<string | null>(null);

  const periodType = scope.toUpperCase() as PeriodType;
  const periodInfo = parsePeriod(scope, periodKey);

  const periodQuery = useQuery({
    queryKey: ["planning-period", periodType, periodKey],
    queryFn: () => fetchPeriod(periodType, periodKey),
  });
  const projectsQuery = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });
  const allOccsQuery = useQuery({
    queryKey: ["occurrences", "all", "dashboard-notion"],
    queryFn: () => fetchOccurrences("all", { limit: 250 }),
  });

  const savedPlan = periodQuery.data?.saved_plan ?? null;
  const planItems = useMemo(
    () => periodQuery.data?.plan_items ?? [],
    [periodQuery.data?.plan_items]
  );
  const occurrences = periodQuery.data?.occurrences ?? [];
  const projectsList = useMemo(
    () => projectsQuery.data ?? [],
    [projectsQuery.data]
  );

  const projectMap = useMemo(() => {
    const map = new Map<string, (typeof projectsList)[number]>();
    for (const p of projectsList) map.set(p.id, p);
    return map;
  }, [projectsList]);

  const linkedProjectItems = useMemo(
    () => planItems.filter((it) => Boolean(it.project_id)),
    [planItems]
  );

  const unlinkedProjects = useMemo(() => {
    const linkedIds = new Set(linkedProjectItems.map((it) => it.project_id));
    return projectsList.filter((p) => !linkedIds.has(p.id));
  }, [linkedProjectItems, projectsList]);

  const taskStatsByProject = useMemo(() => {
    const map = new Map<string, { done: number; total: number }>();
    for (const occ of allOccsQuery.data?.items ?? []) {
      const pid = occ.task.project_id;
      if (!pid) continue;
      const cur = map.get(pid) ?? { done: 0, total: 0 };
      cur.total += 1;
      if (occ.status === "DONE") cur.done += 1;
      map.set(pid, cur);
    }
    return map;
  }, [allOccsQuery.data?.items]);

  async function ensurePlanId(): Promise<string> {
    if (savedPlan?.id) return savedPlan.id;
    const created = await savePlan(periodType, periodKey, {
      title: periodInfo?.title ?? periodKey,
      focus_summary: null,
      notes: null,
      status: "ACTIVE",
    });
    return created.id;
  }

  const saveFocusMut = useMutation({
    mutationFn: async (summary: string) =>
      savePlan(periodType, periodKey, {
        title: savedPlan?.title ?? periodInfo?.title ?? periodKey,
        focus_summary: summary || null,
        notes: savedPlan?.notes ?? null,
        status: savedPlan?.status ?? "ACTIVE",
        ...(savedPlan ? { expected_version: savedPlan.version } : {}),
      }),
    onSuccess: async () => {
      setFocusDraft(null);
      await client.invalidateQueries({ queryKey: ["planning-period", periodType, periodKey] });
    },
  });

  const linkProjectMut = useMutation({
    mutationFn: async (projectId: string) => {
      const planId = await ensurePlanId();
      return addPlanItem(planId, projectId, "PROJECT");
    },
    onSuccess: async () => {
      setSelectedProjectToLink("");
      await client.invalidateQueries({ queryKey: ["planning-period", periodType, periodKey] });
      toast.success(locale === "en" ? "Linked project to plan" : "Đã gắn Project vào kế hoạch");
    },
  });

  const createProjectInPlanMut = useMutation({
    mutationFn: async (title: string) => {
      const proj = await createProject({
        title,
        status: "ACTIVE",
        start_date: periodInfo?.start ?? todayIso,
        target_date: periodInfo?.endInclusive ?? todayIso,
      });
      const planId = await ensurePlanId();
      await addPlanItem(planId, proj.id, "PROJECT");
      return proj;
    },
    onSuccess: async () => {
      setNewProjectTitle("");
      await Promise.all([
        client.invalidateQueries({ queryKey: ["projects"] }),
        client.invalidateQueries({ queryKey: ["planning-period", periodType, periodKey] }),
      ]);
      toast.success(locale === "en" ? "Project created & linked" : "Đã tạo & gắn Project vào kỳ");
    },
  });

  const createTaskInPlanMut = useMutation({
    mutationFn: async (title: string) => {
      const task = await createTask({
        title,
        scheduled_date: periodInfo?.start ?? todayIso,
        priority: "MEDIUM",
        status: "NOT_STARTED",
      });
      const occId = task.occurrences[0]?.id;
      if (occId) {
        const planId = await ensurePlanId();
        await addPlanItem(planId, occId, "OCCURRENCE");
      }
      return task;
    },
    onSuccess: async () => {
      setNewTaskTitle("");
      await Promise.all([
        client.invalidateQueries({ queryKey: ["planning-period", periodType, periodKey] }),
        client.invalidateQueries({ queryKey: ["occurrences"] }),
      ]);
    },
  });

  const unlinkItemMut = useMutation({
    mutationFn: async (itemId: string) => {
      if (!savedPlan?.id) return;
      await removePlanItem(savedPlan.id, itemId);
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["planning-period", periodType, periodKey] });
    },
  });

  function changeScope(nextScope: PeriodScope) {
    setScope(nextScope);
    const nextKey = periodKeyForDate(nextScope, todayIso) ?? todayIso;
    setPeriodKey(nextKey);
    onSpecPatch?.({ period_type: nextScope.toUpperCase() });
  }

  function handleStepPeriod(delta: number) {
    const nextKey = shiftPeriod(scope, periodKey, delta);
    if (nextKey) setPeriodKey(nextKey);
  }

  function handleAddProject(e: FormEvent) {
    e.preventDefault();
    if (!newProjectTitle.trim() || createProjectInPlanMut.isPending) return;
    createProjectInPlanMut.mutate(newProjectTitle.trim());
  }

  function handleAddTask(e: FormEvent) {
    e.preventDefault();
    if (!newTaskTitle.trim() || createTaskInPlanMut.isPending) return;
    createTaskInPlanMut.mutate(newTaskTitle.trim());
  }

  return (
    <section className="w-full space-y-3 text-xs">
      {/* Header: Period Scope Switcher & Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-foreground">{initialTitle}</h2>
          <span className="rounded-full bg-primary/12 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
            {periodInfo?.title ?? periodKey}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <div className="inline-flex rounded-lg border border-border bg-background p-0.5 text-[11px]">
            {(["year", "quarter", "month", "week", "day"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => changeScope(s)}
                className={cn(
                  "rounded-md px-2 py-0.5 font-medium transition-colors",
                  scope === s
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {PERIOD_LABELS[s][locale]}
              </button>
            ))}
          </div>

          <div className="inline-flex items-center rounded-lg border border-border bg-background">
            <button
              type="button"
              onClick={() => handleStepPeriod(-1)}
              className="p-1.5 text-muted-foreground hover:text-foreground"
              aria-label="Previous period"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setPeriodKey(periodKeyForDate(scope, todayIso) ?? todayIso)}
              className="px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground"
            >
              {locale === "en" ? "Current" : "Hiện tại"}
            </button>
            <button
              type="button"
              onClick={() => handleStepPeriod(1)}
              className="p-1.5 text-muted-foreground hover:text-foreground"
              aria-label="Next period"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Plan Focus Summary */}
      <input
        value={focusDraft ?? savedPlan?.focus_summary ?? ""}
        onChange={(e) => setFocusDraft(e.target.value)}
        onBlur={() => {
          if (focusDraft !== null && focusDraft !== (savedPlan?.focus_summary ?? "")) {
            saveFocusMut.mutate(focusDraft);
          }
        }}
        placeholder={
          locale === "en"
            ? "Focus objective for this period..."
            : "Trọng tâm chính của kỳ kế hoạch này..."
        }
        className="h-9 w-full rounded-lg border border-border/70 bg-background/70 px-3 text-xs outline-none focus:border-primary"
      />

      {/* Split Columns inside Plan: Linked Projects (Children) & Period Tasks */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Projects linked to this Plan */}
        <div className="space-y-2 rounded-xl border border-border/70 bg-background/40 p-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground">
              {locale === "en" ? "Projects in Plan" : "Projects thuộc kế hoạch"} (
              {linkedProjectItems.length})
            </span>
          </div>

          {linkedProjectItems.length === 0 ? (
            <p className="py-2 text-[11px] text-muted-foreground">
              {locale === "en"
                ? "No projects linked to this period yet."
                : "Chưa gắn Project nào vào kỳ kế hoạch này."}
            </p>
          ) : (
            <div className="space-y-1.5">
              {linkedProjectItems.map((item) => {
                const proj = item.project_id ? projectMap.get(item.project_id) : undefined;
                const stats = item.project_id ? taskStatsByProject.get(item.project_id) : undefined;
                const pct =
                  stats && stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-card px-2.5 py-1.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">
                        {proj?.title ?? "Project"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {proj?.status ?? "ACTIVE"} · {stats?.done ?? 0}/{stats?.total ?? 0} tasks (
                        {pct}%)
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => unlinkItemMut.mutate(item.id)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Unlink project"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {unlinkedProjects.length > 0 && (
            <div className="flex gap-1.5 pt-1">
              <select
                value={selectedProjectToLink}
                onChange={(e) => setSelectedProjectToLink(e.target.value)}
                className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-[11px]"
              >
                <option value="">
                  {locale === "en" ? "Link existing project..." : "Chọn Project có sẵn..."}
                </option>
                {unlinkedProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!selectedProjectToLink || linkProjectMut.isPending}
                onClick={() => selectedProjectToLink && linkProjectMut.mutate(selectedProjectToLink)}
                className="h-8 rounded-md border border-border bg-card px-2.5 text-[11px] font-medium hover:bg-secondary disabled:opacity-40"
              >
                Gắn
              </button>
            </div>
          )}

          <form onSubmit={handleAddProject} className="flex gap-1.5">
            <input
              value={newProjectTitle}
              onChange={(e) => setNewProjectTitle(e.target.value)}
              placeholder={locale === "en" ? "+ New project in plan..." : "+ Tạo Project mới vào kỳ..."}
              className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-[11px] outline-none"
            />
            <button
              type="submit"
              disabled={!newProjectTitle.trim() || createProjectInPlanMut.isPending}
              className="inline-flex h-8 items-center gap-1 rounded-md bg-primary px-2.5 text-[11px] font-medium text-primary-foreground disabled:opacity-40"
            >
              <FolderPlus className="h-3 w-3" />
            </button>
          </form>
        </div>

        {/* Tasks / Occurrences in this Period */}
        <div className="space-y-2 rounded-xl border border-border/70 bg-background/40 p-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground">
              {locale === "en" ? "Tasks in Period" : "Công việc trong kỳ"} ({occurrences.length})
            </span>
          </div>

          {occurrences.length === 0 ? (
            <p className="py-2 text-[11px] text-muted-foreground">
              {locale === "en"
                ? "No tasks scheduled in this period."
                : "Chưa có nhiệm vụ nào trong kỳ này."}
            </p>
          ) : (
            <div className="max-h-48 space-y-1 overflow-y-auto pr-1">
              {occurrences.slice(0, 15).map((occ) => {
                const done = occ.status === "DONE";
                const projTitle = occ.task.project_id
                  ? projectMap.get(occ.task.project_id)?.title
                  : null;
                return (
                  <label
                    key={occ.id}
                    className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1 hover:bg-secondary/40"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <input
                        type="checkbox"
                        checked={done}
                        onChange={async () => {
                          if (done) await reopenOccurrence(occ.id);
                          else await completeOccurrence(occ.id);
                          await Promise.all([
                            client.invalidateQueries({
                              queryKey: ["planning-period", periodType, periodKey],
                            }),
                            client.invalidateQueries({ queryKey: ["occurrences"] }),
                          ]);
                        }}
                        className="h-3.5 w-3.5 accent-primary"
                      />
                      <span
                        className={cn(
                          "truncate",
                          done && "line-through text-muted-foreground"
                        )}
                      >
                        {occ.task.title}
                      </span>
                    </div>
                    {projTitle && (
                      <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {projTitle}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          )}

          <form onSubmit={handleAddTask} className="flex gap-1.5 pt-1">
            <input
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder={locale === "en" ? "+ Quick task in period..." : "+ Thêm việc vào kỳ..."}
              className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-[11px] outline-none"
            />
            <button
              type="submit"
              disabled={!newTaskTitle.trim() || createTaskInPlanMut.isPending}
              className="inline-flex h-8 items-center gap-1 rounded-md bg-primary px-2.5 text-[11px] font-medium text-primary-foreground disabled:opacity-40"
            >
              <Plus className="h-3 w-3" />
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
