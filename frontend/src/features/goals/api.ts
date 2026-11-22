import { apiRequest } from "@/lib/api/client";
import type { Goal, GoalMilestone } from "@/types/domain";

export async function listGoals(): Promise<Goal[]> {
  return apiRequest<Goal[]>("/goals");
}

export async function createGoal(payload: {
  title: string;
  description?: string | null;
  goal_type?: string;
  metric_unit?: string;
  target_value?: number;
  start_date: string;
  end_date: string;
}): Promise<Goal> {
  return apiRequest<Goal>("/goals", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function addMilestone(
  goalId: string,
  payload: { title: string; target_date?: string | null; sort_order?: number }
): Promise<GoalMilestone> {
  return apiRequest<GoalMilestone>(`/goals/${goalId}/milestones`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function toggleMilestone(
  goalId: string,
  milestoneId: string,
  status: "PENDING" | "COMPLETED"
): Promise<GoalMilestone> {
  return apiRequest<GoalMilestone>(`/goals/${goalId}/milestones/${milestoneId}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function addMeasurement(
  goalId: string,
  payload: { measured_value: number; note?: string | null }
): Promise<Goal> {
  return apiRequest<Goal>(`/goals/${goalId}/measurements`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function addGoalLink(
  goalId: string,
  payload: { project_id?: string | null; task_id?: string | null }
): Promise<unknown> {
  return apiRequest(`/goals/${goalId}/links`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
