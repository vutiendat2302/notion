"use client";

import { useQuery } from "@tanstack/react-query";
import { Flame } from "lucide-react";
import { useState } from "react";

import { fetchAnalyticsOverview, fetchChartCatalog } from "@/features/analytics/api";
import { DynamicChartCard, type ChartFilterParams } from "@/features/analytics/chart-renderer";
import { listGoals } from "@/features/goals/api";
import { fetchCategories, fetchOccurrences, fetchProjects } from "@/features/tasks/api";
import { useI18n } from "@/i18n/i18n-provider";
import { cn } from "@/lib/utils";

const SPACES = [
  "ALL",
  "TODAY",
  "WEEKLY",
  "MONTHLY",
  "YEARLY",
  "TASK_DETAIL",
  "PROJECT",
  "GOALS",
  "HABITS",
] as const;

export default function AnalyticsPage() {
  const { locale } = useI18n();
  const [space, setSpace] = useState<(typeof SPACES)[number]>("ALL");
  const [projectId, setProjectId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [goalId, setGoalId] = useState("");
  const [groupBy, setGroupBy] = useState("project");

  const overviewQuery = useQuery({ queryKey: ["analytics-overview"], queryFn: fetchAnalyticsOverview });
  const catalogQuery = useQuery({ queryKey: ["chart-catalog"], queryFn: fetchChartCatalog });
  const projectsQuery = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });
  const categoriesQuery = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const goalsQuery = useQuery({ queryKey: ["goals"], queryFn: listGoals });
  const occsQuery = useQuery({
    queryKey: ["occurrences", "all-analytics"],
    queryFn: () => fetchOccurrences("all", { limit: 100 }),
  });

  const filters: ChartFilterParams = {
    project_id: projectId || null,
    category_id: categoryId || null,
    task_id: taskId || null,
    goal_id: goalId || null,
    group_by: groupBy,
  };

  const streak = overviewQuery.data?.streak;
  const metrics = overviewQuery.data?.metrics;

  const charts = (catalogQuery.data ?? []).filter(
    (c) => space === "ALL" || c.space === space
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-end gap-3">
        <h1 className="sr-only">{locale === "en" ? "Analytics" : "Thống kê"}</h1>
        {streak && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-2 text-xs">
            <span className="inline-flex items-center gap-1 font-semibold text-foreground">
              <Flame className="h-4 w-4 text-primary" />
              {streak.current_streak}d Streak
            </span>
            <span className="text-muted-foreground">Best: {streak.best_streak}d</span>
            <span className="text-muted-foreground">30d: {streak.consistency_30d}%</span>
          </div>
        )}
      </header>

      {/* Top KPI Strip (Clean hairline metrics, full-width) */}
      <div className="grid gap-4 border-y border-border/70 py-4 sm:grid-cols-3">
        <div className="px-2">
          <p className="text-xs text-muted-foreground">
            {locale === "en" ? "Completion Rate" : "Tỷ lệ hoàn thành"}
          </p>
          <p className="mt-1 font-mono text-2xl font-semibold text-foreground">
            {metrics?.completion_rate !== null && metrics?.completion_rate !== undefined
              ? `${metrics.completion_rate}%`
              : "N/A"}
          </p>
        </div>
        <div className="px-2 sm:border-l sm:border-border/60 sm:pl-6">
          <p className="text-xs text-muted-foreground">
            {locale === "en" ? "Actual Focus Time" : "Thời gian tập trung thực tế"}
          </p>
          <p className="mt-1 font-mono text-2xl font-semibold text-primary">
            {metrics?.active_minutes ?? 0}m
          </p>
        </div>
        <div className="px-2 sm:border-l sm:border-border/60 sm:pl-6">
          <p className="text-xs text-muted-foreground">
            {locale === "en" ? "Active Days" : "Tổng ngày hoạt động"}
          </p>
          <p className="mt-1 font-mono text-2xl font-semibold text-foreground">
            {streak?.total_active_days ?? 0}
          </p>
        </div>
      </div>

      {/* Dynamic Space + DB Filter Controls */}
      <section className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {SPACES.map((sp) => (
            <button
              key={sp}
              type="button"
              onClick={() => setSpace(sp)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium",
                space === sp
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary/60 text-muted-foreground hover:text-foreground"
              )}
            >
              {sp}
            </button>
          ))}
        </div>

        <div className="grid gap-2.5 sm:grid-cols-5">
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="h-9 rounded-lg border border-input bg-background px-2.5 text-xs"
          >
            <option value="">{locale === "en" ? "All Projects" : "Tất cả Project"}</option>
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
            <option value="">{locale === "en" ? "All Categories" : "Tất cả Danh mục"}</option>
            {(categoriesQuery.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={taskId}
            onChange={(e) => setTaskId(e.target.value)}
            className="h-9 rounded-lg border border-input bg-background px-2.5 text-xs"
          >
            <option value="">{locale === "en" ? "All Tasks" : "Tất cả Task"}</option>
            {(occsQuery.data?.items ?? []).map((o) => (
              <option key={o.id} value={o.task_id}>
                {o.task.title}
              </option>
            ))}
          </select>

          <select
            value={goalId}
            onChange={(e) => setGoalId(e.target.value)}
            className="h-9 rounded-lg border border-input bg-background px-2.5 text-xs"
          >
            <option value="">{locale === "en" ? "All Goals" : "Tất cả Mục tiêu"}</option>
            {(goalsQuery.data ?? []).map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>

          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value)}
            className="h-9 rounded-lg border border-input bg-background px-2.5 text-xs"
          >
            <option value="project">Group: Project</option>
            <option value="category">Group: Category</option>
            <option value="tag">Group: Tag</option>
          </select>
        </div>
      </section>

      {/* Dynamic 19 Charts Full-Width Grid */}
      <section className="grid gap-6 border-t border-border/70 pt-5 md:grid-cols-2 xl:grid-cols-3">
        {charts.map((c) => (
          <div
            key={c.chart_key}
            className={cn(
              "border-b border-border/60 pb-4",
              (c.widget_kind === "HEATMAP" || c.chart_key === "yearly_time_allocation") &&
                "md:col-span-2 xl:col-span-3"
            )}
          >
            <DynamicChartCard
              chartKey={c.chart_key}
              title={locale === "en" ? c.title_en : c.title_vi}
              filters={filters}
            />
          </div>
        ))}
      </section>
    </div>
  );
}
