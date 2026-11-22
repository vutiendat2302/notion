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
  preferences_json?: Record<string, unknown> | null;
}

export interface User {
  id: string;
  username: string | null;
  email: string | null;
  phone: string | null;
  display_name: string;
  role: "ADMIN" | "USER";
  status: "ACTIVE" | "DISABLED" | "PENDING_DELETION";
  avatar_file_id?: string | null;
  last_login_at: string | null;
  created_at: string;
  settings: UserSettings | null;
}

export interface TimeEntry {
  id: string;
  user_id: string;
  occurrence_id: string | null;
  task_id: string | null;
  task_title: string | null;
  source: "TIMER" | "MANUAL";
  status: "RUNNING" | "PAUSED" | "COMPLETED" | "CANCELLED";
  started_at: string;
  last_resumed_at: string | null;
  paused_at: string | null;
  paused_seconds: number;
  ended_at: string | null;
  duration_seconds: number;
  planned_duration_seconds: number | null;
  effective_elapsed_seconds: number;
  note: string | null;
  server_now: string;
}

export interface ActiveTimerResponse {
  user_id: string;
  active_entry: TimeEntry | null;
  server_now: string;
  auto_paused_stale: boolean;
}

export interface SoundOption {
  id: string;
  kind: "countdown" | "finish";
  name: string;
  stream_url: string;
  is_default: boolean;
}

export interface SoundCatalog {
  defaults: SoundOption[];
  custom: SoundOption[];
}

export interface HabitLog {
  id: string;
  habit_id: string;
  log_date: string;
  status: "COMPLETED" | "SKIPPED";
  value: number | null;
  note: string | null;
  logged_at: string;
}

export interface Habit {
  id: string;
  category_id: string | null;
  title: string;
  habit_type: "BOOLEAN" | "QUANTITATIVE";
  target_value: number | null;
  unit: string | null;
  schedule_type: "DAILY" | "WEEKDAYS" | "X_PER_WEEK";
  weekdays_mask: number | null;
  target_per_week: number | null;
  starts_on: string;
  archived_at: string | null;
  created_at: string;
  logs: HabitLog[];
}

export interface GoalMilestone {
  id: string;
  goal_id: string;
  title: string;
  target_date: string | null;
  status: "PENDING" | "COMPLETED";
  completed_at: string | null;
  sort_order: number;
}

export interface GoalLinkItem {
  id: string;
  goal_id: string;
  project_id: string | null;
  task_id: string | null;
  target_key: string;
}

export interface Goal {
  id: string;
  title: string;
  description: string | null;
  category_id: string | null;
  goal_type: string;
  metric_unit: string;
  target_value: number;
  baseline_value: number;
  measurement_mode: string;
  start_date: string;
  end_date: string;
  status: "NOT_STARTED" | "ACTIVE" | "ON_HOLD" | "ACHIEVED" | "CANCELLED";
  version: number;
  current_value: number;
  progress_percent: number;
  milestones: GoalMilestone[];
  links: GoalLinkItem[];
  archived_at: string | null;
  created_at: string;
}

export interface StreakData {
  timezone: string;
  today_date: string;
  current_streak: number;
  best_streak: number;
  consistency_30d: number;
  total_active_days: number;
  today_is_active: boolean;
  active_dates: string[];
}

export interface ChartCatalogItem {
  chart_key: string;
  space: string;
  title_vi: string;
  title_en: string;
  widget_kind: string;
}

export interface ChartEnvelope {
  chart_key: string;
  space: string;
  timezone: string;
  period: Record<string, string | null>;
  filters_applied: Record<string, string | null>;
  data_status: "OK" | "NO_DATA";
  summary: Record<string, unknown>;
  series: Array<Record<string, unknown>>;
  meta: Record<string, unknown>;
}

export interface SidebarNavItem {
  id: string;
  title: string;
  href: string;
  icon_type: "preset" | "upload";
  icon_value: string;
  pinned?: boolean;
  dashboard_id?: string | null;
}

export interface SidebarGroup {
  id: string;
  title: string;
  items: SidebarNavItem[];
}

export interface AIAgentOption {
  id: "local" | "claude" | "codex" | "gemini";
  label: string;
  model_id: string;
  requires_api_key: boolean;
  server_configured: boolean;
}

export type TemplateCategory = "TEXT_FORMAT" | "PRODUCTIVITY" | "FORM_TABLE" | "CHART";

export interface BlockTemplate {
  id: string;
  slug: string;
  category: TemplateCategory;
  name_vi: string;
  name_en: string;
  description_vi: string;
  description_en: string;
  icon_name: string;
  widget_kind: "METRIC_CARD" | "CHART" | "HEATMAP" | "PROGRESS" | "TASK_LIST";
  default_title: string;
  default_width: number;
  default_height: number;
  default_spec_json: Record<string, unknown>;
  is_active: boolean;
  is_user_customizable: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface DashboardWidget {
  id: string;
  dashboard_id: string;
  widget_kind: "METRIC_CARD" | "CHART" | "HEATMAP" | "PROGRESS" | "TASK_LIST";
  title: string;
  spec_json: Record<string, unknown>;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  created_at: string;
  updated_at: string;
}

export interface DashboardData {
  id: string;
  title: string;
  description: string | null;
  layout_mode: string;
  is_default: boolean;
  style_config: Record<string, unknown>;
  widgets: DashboardWidget[];
  created_at: string;
  updated_at: string;
}

export interface ProposedTaskItem {
  title: string;
  scheduled_date: string | null;
  start_at: string | null;
  end_at: string | null;
  estimated_minutes: number | null;
  priority: TaskPriority;
  status: "NOT_STARTED" | "IN_PROGRESS" | "DONE";
  project_id: string | null;
  category_id: string | null;
  description: string | null;
}

export interface AIChatResponse {
  conversation_id: string | null;
  proposal_id: string | null;
  status: "INFO_ONLY" | "AWAITING_CONFIRMATION";
  reply_message: string;
  ocr_text: string | null;
  provider: string;
  model_id: string;
  proposed_tasks: ProposedTaskItem[];
  citations: Array<Record<string, string>>;
}

export interface UserListResponse {
  items: User[];
  total: number;
  limit: number;
  offset: number;
}

export interface UserSession {
  id: string;
  device_label: string | null;
  issued_at: string;
  last_used_at: string | null;
  expires_at: string;
  is_current: boolean;
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

export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    details: Record<string, unknown> | null;
  };
  request_id: string;
}

export interface RecurrenceRule {
  id: string;
  task_id: string;
  frequency: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  interval_value: number;
  weekdays_mask: number | null;
  month_day: number | null;
  monthly_overflow_policy: "SKIP" | "CLAMP_TO_LAST_DAY";
  default_start_time: string | null;
  default_duration_minutes: number | null;
  starts_on: string;
  ends_on: string | null;
  max_count: number | null;
  timezone: string;
  is_paused: boolean;
  rule_version: number;
  created_at: string;
  updated_at: string;
}

export interface RecurrenceRuleInput {
  frequency: RecurrenceRule["frequency"];
  interval_value: number;
  weekdays_mask?: number | null;
  month_day?: number | null;
  monthly_overflow_policy: RecurrenceRule["monthly_overflow_policy"];
  default_start_time?: string | null;
  default_duration_minutes?: number | null;
  starts_on: string;
  ends_on?: string | null;
  max_count?: number | null;
  timezone: string;
}

export interface ChecklistItem {
  id: string;
  task_id: string;
  title: string;
  sort_order: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChecklistState {
  occurrence_id: string;
  checklist_item_id: string;
  is_checked: boolean;
  checked_at: string | null;
}

export interface TaskDependency {
  id: string;
  user_id: string;
  blocking_task_id: string;
  blocked_task_id: string;
  relation_type: "FINISH_TO_START";
  created_at: string;
}

export interface TaskProgress {
  task_id: string;
  metric_type: "OCCURRENCE_COMPLETION";
  unit: "percent";
  timezone: string;
  window_start: string | null;
  window_end_exclusive: string | null;
  as_of: string;
  eligible_count: number;
  completed_count: number;
  skipped_count: number;
  cancelled_count: number;
  future_excluded_count: number;
  completion_rate: number | null;
  policy: string;
}
