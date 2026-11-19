export type OccurrenceStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "DONE"
  | "SKIPPED"
  | "CANCELLED";

export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type AccentToken =
  | "LAVENDER"
  | "SAGE"
  | "PEACH"
  | "ROSE"
  | "BUTTER"
  | "SKY"
  | "SLATE";

export type PeriodType = "YEAR" | "QUARTER" | "MONTH" | "WEEK" | "DAY";

export interface UserSettings {
  id: string;
  timezone: string;
  week_starts_on: number;
  locale: string;
  theme: "LIGHT" | "DARK" | "SYSTEM";
  color_theme: string;
  working_hours_json: Record<string, unknown> | null;
}

export interface User {
  id: string;
  email: string;
  display_name: string;
  status: string;
  last_login_at: string | null;
  created_at: string;
  settings: UserSettings | null;
}

export interface Category {
  id: string;
  name: string;
  accent_token: AccentToken;
  sort_order: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  title: string;
  description: string | null;
  category_id: string | null;
  status: "PLANNED" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED";
  start_date: string | null;
  target_date: string | null;
  version: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskOccurrence {
  id: string;
  task_id: string;
  recurrence_rule_id: string | null;
  recurrence_key: string;
  scheduled_date: string | null;
  start_at: string | null;
  end_at: string | null;
  due_at: string | null;
  estimated_minutes: number | null;
  status: OccurrenceStatus;
  completed_at: string | null;
  is_override: boolean;
  sort_order: number;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  project_id: string | null;
  category_id: string | null;
  parent_task_id: string | null;
  title: string;
  description: string | null;
  priority: TaskPriority;
  estimated_minutes: number | null;
  due_at: string | null;
  is_recurring: boolean;
  version: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  occurrences: TaskOccurrence[];
}

export interface OccurrenceWithTask extends TaskOccurrence {
  task: Omit<Task, "occurrences">;
}

export interface TimeEntry {
  id: string;
  occurrence_id: string | null;
  source: "TIMER" | "MANUAL";
  status: "RUNNING" | "PAUSED" | "COMPLETED" | "CANCELLED";
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
}

export interface PlanningPeriod {
  id: string;
  period_type: PeriodType;
  period_key: string;
  start_date: string;
  end_date_exclusive: string;
  focus_summary: string | null;
  status: "DRAFT" | "ACTIVE" | "CLOSED" | "ARCHIVED";
}

export interface Goal {
  id: string;
  title: string;
  metric_unit: string;
  target_value: number;
  current_value: number;
  start_date: string;
  end_date: string;
  status: "NOT_STARTED" | "ACTIVE" | "ON_HOLD" | "ACHIEVED" | "CANCELLED";
}

export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    details: Record<string, unknown> | null;
  };
  request_id: string;
}
