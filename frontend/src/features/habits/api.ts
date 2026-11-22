import { apiRequest } from "@/lib/api/client";
import type { Habit, HabitLog } from "@/types/domain";

export async function listHabits(periodKey?: string): Promise<Habit[]> {
  const qs = periodKey ? `?period_key=${encodeURIComponent(periodKey)}` : "";
  return apiRequest<Habit[]>(`/habits${qs}`);
}

export async function createHabit(payload: {
  title: string;
  habit_type?: "BOOLEAN" | "QUANTITATIVE";
  schedule_type?: "DAILY" | "WEEKDAYS" | "X_PER_WEEK";
  starts_on?: string;
}): Promise<Habit> {
  return apiRequest<Habit>("/habits", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function logHabit(
  habitId: string,
  payload: { log_date: string; status: "COMPLETED" | "SKIPPED"; value?: number | null }
): Promise<HabitLog> {
  return apiRequest<HabitLog>(`/habits/${habitId}/logs`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
