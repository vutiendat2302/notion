import { apiRequest } from "@/lib/api/client";
import type { ChartCatalogItem, ChartEnvelope, StreakData } from "@/types/domain";

export interface AnalyticsOverviewPayload {
  user_id: string;
  streak: StreakData;
  metrics: {
    completion_rate: number | null;
    done_count: number;
    eligible_count: number;
    active_minutes: number;
    today_focus_minutes: number;
    planned_minutes: number;
  };
  data_status: "OK" | "NO_DATA";
}

export async function fetchAnalyticsOverview(): Promise<AnalyticsOverviewPayload> {
  return apiRequest<AnalyticsOverviewPayload>("/analytics/overview");
}

export async function fetchStreak(): Promise<StreakData> {
  return apiRequest<StreakData>("/analytics/streak");
}

export async function fetchChartCatalog(): Promise<ChartCatalogItem[]> {
  return apiRequest<ChartCatalogItem[]>("/analytics/charts");
}

export async function fetchChartData(
  chartKey: string,
  filters: {
    date?: string | null;
    period_key?: string | null;
    project_id?: string | null;
    task_id?: string | null;
    goal_id?: string | null;
    habit_id?: string | null;
    category_id?: string | null;
    group_by?: string | null;
  } = {}
): Promise<ChartEnvelope> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiRequest<ChartEnvelope>(`/analytics/charts/${encodeURIComponent(chartKey)}${suffix}`);
}
