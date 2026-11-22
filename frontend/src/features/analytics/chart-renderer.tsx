"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchChartData } from "@/features/analytics/api";
import { useI18n } from "@/i18n/i18n-provider";
import { cn } from "@/lib/utils";
import type { ChartEnvelope } from "@/types/domain";

export interface ChartFilterParams {
  date?: string | null;
  period_key?: string | null;
  project_id?: string | null;
  task_id?: string | null;
  goal_id?: string | null;
  habit_id?: string | null;
  category_id?: string | null;
  group_by?: string | null;
}

const HEATMAP_COLORS = [
  "bg-secondary/70 border-border/50",
  "bg-emerald-900/40 dark:bg-emerald-900/70 border-emerald-700/40",
  "bg-emerald-600/60 dark:bg-emerald-700 border-emerald-500/50",
  "bg-emerald-500/80 dark:bg-emerald-500 border-emerald-400/60",
  "bg-emerald-400 dark:bg-emerald-400 border-emerald-300",
];

const SERIES_COLORS = [
  "var(--primary)",
  "var(--category-sky)",
  "var(--category-sage)",
  "var(--category-lavender)",
  "var(--category-rose)",
  "var(--category-butter)",
];

function EmptyChartState() {
  const { t } = useI18n();
  return (
    <div className="flex min-h-32 items-center justify-center rounded-lg border border-dashed border-border/80 bg-background/40 p-4 text-xs text-muted-foreground">
      {t.common.noData}
    </div>
  );
}

function SimpleBarChart({ data }: { data: ChartEnvelope }) {
  const maxVal = Math.max(
    1,
    ...data.series.map((s) =>
      Math.max(
        Number(s.value ?? 0),
        Number(s.done ?? 0),
        Number(s.total ?? 0),
        Number(s.planned ?? 0),
        Number(s.actual ?? 0),
        Number(s.actual_hours ?? 0),
        Number(s.planned_hours ?? 0),
        Number(s.actual_minutes ?? 0),
        Number(s.cumulative_hours ?? 0),
        Number(s.progress_percent ?? 0)
      )
    )
  );

  if (!data.series.length) return <EmptyChartState />;

  return (
    <div className="space-y-2">
      <div className="flex h-40 items-end gap-1.5 overflow-x-auto pb-1">
        {data.series.map((item, idx) => {
          const rawPrimary = Number(
            item.actual ??
              item.done ??
              item.actual_hours ??
              item.actual_minutes ??
              item.cumulative_hours ??
              item.progress_percent ??
              item.value ??
              0
          );
          const rawSecondary = item.planned ?? item.total ?? item.planned_hours ?? item.estimated_minutes;
          const h1 = Math.max(4, Math.round((rawPrimary / maxVal) * 100));
          const h2 =
            rawSecondary !== undefined && rawSecondary !== null
              ? Math.max(4, Math.round((Number(rawSecondary) / maxVal) * 100))
              : null;

          return (
            <div key={idx} className="flex min-w-7 flex-1 flex-col items-center gap-1">
              <div className="flex h-28 w-full items-end justify-center gap-0.5">
                {h2 !== null && (
                  <div
                    title={`Plan: ${rawSecondary}`}
                    style={{ height: `${h2}%` }}
                    className="w-2.5 rounded-t bg-muted-foreground/35"
                  />
                )}
                <div
                  title={`${item.label}: ${rawPrimary}`}
                  style={{ height: `${h1}%` }}
                  className="w-3 rounded-t bg-primary transition-all"
                />
              </div>
              <span className="max-w-12 truncate text-[10px] text-muted-foreground">
                {String(item.label ?? "")}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ActivityHeatmap({ data }: { data: ChartEnvelope }) {
  if (!data.series.length) return <EmptyChartState />;
  const isYearly = data.chart_key === "yearly_activity_heatmap";
  return (
    <div className="space-y-2">
      <div
        className={cn(
          "grid gap-1",
          isYearly ? "grid-flow-col grid-rows-7 overflow-x-auto pb-2" : "grid-cols-7"
        )}
      >
        {data.series.map((cell, idx) => {
          const level = Math.min(4, Math.max(0, Number(cell.level ?? 0)));
          return (
            <div
              key={idx}
              title={`${cell.date}: ${cell.value} điểm (${cell.done_count} task, ${cell.focus_minutes}m)`}
              className={cn(
                "rounded-[3px] border",
                isYearly ? "h-3 w-3" : "h-7 w-full flex items-center justify-center text-[10px]",
                HEATMAP_COLORS[level]
              )}
            >
              {!isYearly && <span>{String(cell.label ?? "")}</span>}
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
        <span>Less</span>
        {HEATMAP_COLORS.map((cls, i) => (
          <span key={i} className={cn("h-2.5 w-2.5 rounded-[2px] border", cls)} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

function TimeAllocationChart({ data }: { data: ChartEnvelope }) {
  if (!data.series.length || data.data_status === "NO_DATA") return <EmptyChartState />;
  const totalHours = Number(data.summary.primary_value ?? 0);
  const maxMin = Math.max(1, ...data.series.map((s) => Number(s.minutes ?? 0)));
  return (
    <div className="grid gap-4 sm:grid-cols-[10rem_1fr] sm:items-center">
      <div className="mx-auto flex h-32 w-32 flex-col items-center justify-center rounded-full border-8 border-primary/80 bg-background text-center">
        <span className="font-mono text-lg font-bold text-foreground">{totalHours}h</span>
        <span className="text-[11px] text-muted-foreground">{data.series.length} groups</span>
      </div>
      <div className="space-y-2">
        {data.series.slice(0, 6).map((item, idx) => {
          const pct = Math.max(6, Math.round((Number(item.minutes ?? 0) / maxMin) * 100));
          return (
            <div key={idx} className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="font-medium text-foreground">{String(item.label)}</span>
                <span className="font-mono text-muted-foreground">{String(item.hours)}h</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  style={{
                    width: `${pct}%`,
                    backgroundColor: SERIES_COLORS[idx % SERIES_COLORS.length],
                  }}
                  className="h-full rounded-full"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HabitMatrixChart({ data }: { data: ChartEnvelope }) {
  if (!data.series.length) return <EmptyChartState />;
  return (
    <div className="space-y-2 overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <tbody>
          {data.series.map((habit) => {
            const days = (habit.days as Array<{ date: string; day: number; status: string }>) ?? [];
            return (
              <tr key={String(habit.habit_id)} className="border-b border-border/50">
                <td className="min-w-32 py-1.5 pr-3 font-medium text-foreground">
                  {String(habit.label)}
                </td>
                <td className="py-1.5">
                  <div className="flex gap-0.5">
                    {days.map((d) => (
                      <span
                        key={d.date}
                        title={`${d.date}: ${d.status}`}
                        className={cn(
                          "inline-flex h-5 w-5 items-center justify-center rounded-[3px] text-[9px] font-semibold",
                          d.status === "COMPLETED" && "bg-emerald-500/80 text-white",
                          d.status === "MISSED" && "bg-amber-400/70 text-amber-950",
                          d.status === "EXCLUDED" && "bg-secondary text-muted-foreground",
                          d.status === "FUTURE" && "border border-border/60 bg-background/40"
                        )}
                      >
                        {d.status === "COMPLETED" ? "✓" : d.status === "MISSED" ? "×" : ""}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="pl-3 text-right font-mono text-muted-foreground">
                  {String(habit.total_done ?? 0)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ChartBody({ data }: { data: ChartEnvelope }) {
  if (data.data_status === "NO_DATA" && !data.series.length) {
    return <EmptyChartState />;
  }

  if (
    data.chart_key === "yearly_activity_heatmap" ||
    data.chart_key === "monthly_activity_heatmap"
  ) {
    return <ActivityHeatmap data={data} />;
  }
  if (data.chart_key === "habit_consistency_heatmap") {
    return <HabitMatrixChart data={data} />;
  }
  if (data.chart_key === "yearly_time_allocation") {
    return <TimeAllocationChart data={data} />;
  }
  if (data.chart_key === "today_completion_ring" || data.chart_key === "project_progress") {
    const val = data.summary.primary_value;
    return (
      <div className="space-y-3">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-3xl font-bold text-primary">
            {val === null || val === undefined ? "0%" : `${val}%`}
          </span>
          <span className="text-xs text-muted-foreground">
            {String(data.summary.done ?? 0)} / {String(data.summary.total ?? data.summary.eligible ?? 0)}
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            style={{ width: `${Math.min(100, Number(val ?? 0))}%` }}
            className="h-full rounded-full bg-primary transition-all"
          />
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {data.series.map((s, i) => (
            <span key={i}>
              {String(s.label)}: <strong className="text-foreground">{String(s.value)}</strong>
            </span>
          ))}
        </div>
      </div>
    );
  }
  if (data.chart_key === "today_daily_timeline") {
    if (!data.series.length) return <EmptyChartState />;
    return (
      <div className="space-y-2">
        {data.series.map((item, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between rounded-lg border border-border bg-background/60 px-3 py-2 text-xs"
          >
            <span className="font-medium text-foreground">{String(item.label)}</span>
            <span className="font-mono text-muted-foreground">
              {String(item.start_time)} – {String(item.end_time)} ({String(item.minutes)}m)
            </span>
          </div>
        ))}
      </div>
    );
  }
  if (data.chart_key === "goal_milestone_timeline") {
    if (!data.series.length) return <EmptyChartState />;
    return (
      <div className="space-y-2">
        {data.series.map((m, i) => (
          <div key={i} className="flex items-center justify-between gap-2 text-xs">
            <span className={m.status === "COMPLETED" ? "line-through text-muted-foreground" : "font-medium"}>
              {m.status === "COMPLETED" ? "✓ " : "○ "}
              {String(m.label)}
            </span>
            <span className="font-mono text-muted-foreground">{String(m.target_date ?? "—")}</span>
          </div>
        ))}
      </div>
    );
  }

  return <SimpleBarChart data={data} />;
}

export function DynamicChartCard({
  chartKey,
  title,
  filters = {},
}: {
  chartKey: string;
  title?: string;
  filters?: ChartFilterParams;
}) {
  const { t } = useI18n();
  const query = useQuery({
    queryKey: ["chart", chartKey, filters],
    queryFn: () => fetchChartData(chartKey, filters),
  });

  return (
    <div className="space-y-3">
      {title && (
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {query.data && (
            <span className="font-mono text-xs text-primary">
              {query.data.summary.primary_value !== null &&
              query.data.summary.primary_value !== undefined
                ? `${query.data.summary.primary_value} ${query.data.summary.unit ?? ""}`
                : ""}
            </span>
          )}
        </div>
      )}
      {query.isLoading ? (
        <div className="h-32 animate-pulse rounded-lg bg-secondary/50" />
      ) : query.isError ? (
        <p className="text-xs text-destructive">{t.common.noData}</p>
      ) : query.data ? (
        <ChartBody data={query.data} />
      ) : (
        <EmptyChartState />
      )}
    </div>
  );
}
