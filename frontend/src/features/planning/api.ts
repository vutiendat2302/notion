import { apiRequest } from "@/lib/api/client";
import type { OccurrenceWithTask, PeriodType } from "@/types/domain";

export interface SavedPlan {
  id: string;
  period_type: PeriodType;
  period_key: string;
  start_date: string;
  end_date_exclusive: string;
  timezone: string;
  title: string | null;
  focus_summary: string | null;
  notes: string | null;
  status: "DRAFT" | "ACTIVE" | "CLOSED" | "ARCHIVED";
  version: number;
}

export interface PlanItem {
  id: string;
  period_id: string;
  task_id: string | null;
  occurrence_id: string | null;
  project_id: string | null;
  goal_id: string | null;
  target_key: string;
  priority_rank: number;
  commitment: "PLANNED" | "COMMITTED" | "OPTIONAL";
}

export interface PeriodOverview {
  period_type: PeriodType;
  period_key: string;
  start_date: string;
  end_date_exclusive: string;
  timezone: string;
  week_starts_on: number;
  saved_plan: SavedPlan | null;
  status: string;
  plan_items: PlanItem[];
  occurrences: OccurrenceWithTask[];
  overdue_occurrences: OccurrenceWithTask[];
  planned_focus_minutes: number;
  focus_metric: string;
  focus_unit: "minutes";
}

export type RolloverAction = "PIN" | "RESCHEDULE";

export interface RolloverPreview {
  source_period_type: PeriodType;
  source_period_key: string;
  target_period_key: string;
  target_start_date: string;
  action: RolloverAction;
  candidates: { occurrence_id: string; task_id: string; title: string; status: string; scheduled_date: string | null; proposed_date: string; version: number }[];
}

export function fetchPeriod(type: PeriodType, key: string): Promise<PeriodOverview> {
  return apiRequest<PeriodOverview>(`/planning/periods/${type}/${encodeURIComponent(key)}`);
}

export function savePlan(type: PeriodType, key: string, payload: {
  title: string | null; focus_summary: string | null; notes: string | null;
  status: SavedPlan["status"]; expected_version?: number;
}): Promise<SavedPlan> {
  return apiRequest<SavedPlan>(`/planning/periods/${type}/${encodeURIComponent(key)}/plan`, {
    method: "PUT", body: JSON.stringify(payload),
  });
}

export function addPlanItem(
  planId: string,
  targetId: string,
  targetType: "OCCURRENCE" | "TASK" | "PROJECT" | "GOAL" = "OCCURRENCE"
): Promise<PlanItem> {
  return apiRequest<PlanItem>(`/planning/plans/${planId}/items`, {
    method: "POST",
    body: JSON.stringify({ target_type: targetType, target_id: targetId, commitment: "COMMITTED" }),
  });
}

export function patchPlanItem(planId: string, itemId: string, payload: Partial<Pick<PlanItem, "commitment" | "priority_rank">>): Promise<PlanItem> {
  return apiRequest<PlanItem>(`/planning/plans/${planId}/items/${itemId}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export function removePlanItem(planId: string, itemId: string): Promise<void> {
  return apiRequest<void>(`/planning/plans/${planId}/items/${itemId}`, { method: "DELETE" });
}

export function previewRollover(type: PeriodType, key: string, action: RolloverAction): Promise<RolloverPreview> {
  return apiRequest<RolloverPreview>(`/planning/periods/${type}/${encodeURIComponent(key)}/rollover/preview`, {
    method: "POST", body: JSON.stringify({ action }),
  });
}

export function confirmRollover(preview: RolloverPreview, occurrenceIds: string[], idempotencyKey: string): Promise<{ processed_count: number; replayed: boolean }> {
  return apiRequest(`/planning/rollovers/confirm`, {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({
      source_period_type: preview.source_period_type,
      source_period_key: preview.source_period_key,
      action: preview.action,
      items: preview.candidates.filter((item) => occurrenceIds.includes(item.occurrence_id)).map((item) => ({ occurrence_id: item.occurrence_id, expected_version: item.version })),
    }),
  });
}
