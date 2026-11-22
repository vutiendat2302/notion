import { apiRequest } from "@/lib/api/client";
import type {
  Category,
  OccurrenceStatus,
  OccurrenceWithTask,
  Project,
  Task,
  TaskOccurrence,
  TaskPriority,
  ChecklistItem,
  ChecklistState,
  RecurrenceRule,
  RecurrenceRuleInput,
  TaskDependency,
  TaskProgress,
} from "@/types/domain";

export interface OccurrenceListPayload {
  items: OccurrenceWithTask[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

export interface OccurrenceFilters {
  scope?: "inbox" | "today" | "upcoming" | "completed" | "all";
  project_id?: string;
  category_id?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export async function fetchOccurrences(
  scope: string,
  filters: Omit<OccurrenceFilters, "scope"> = {}
): Promise<OccurrenceListPayload> {
  const params = new URLSearchParams({ scope });
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  return apiRequest<OccurrenceListPayload>(`/occurrences?${params.toString()}`);
}

export interface OccurrenceCatalog {
  items: OccurrenceWithTask[];
  total: number;
  truncated: boolean;
}

export async function fetchOccurrenceCatalog(): Promise<OccurrenceCatalog> {
  const limit = 200;
  const maxItems = 10_000;
  const first = await fetchOccurrences("all", { limit, offset: 0 });
  const items = [...first.items];
  for (let offset = limit; offset < first.pagination.total && offset < maxItems; offset += limit) {
    const page = await fetchOccurrences("all", { limit, offset });
    items.push(...page.items);
  }
  const uniqueItems = [...new Map(items.map((item) => [item.id, item])).values()];
  return {
    items: uniqueItems,
    total: first.pagination.total,
    truncated: uniqueItems.length < first.pagination.total,
  };
}

export async function fetchCategories(): Promise<Category[]> {
  return apiRequest<Category[]>("/categories");
}

export function createCategory(payload: Pick<Category, "name" | "accent_token">): Promise<Category> {
  return apiRequest<Category>("/categories", { method: "POST", body: JSON.stringify(payload) });
}

export function updateCategory(id: string, payload: Partial<Pick<Category, "name" | "accent_token">> & { archived?: boolean }): Promise<Category> {
  return apiRequest<Category>(`/categories/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export async function fetchProjects(): Promise<Project[]> {
  return apiRequest<Project[]>("/projects");
}

export async function createProject(payload: {
  title: string;
  description?: string | null;
  category_id?: string | null;
  status?: "PLANNED" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED";
  start_date?: string | null;
  target_date?: string | null;
}): Promise<Project> {
  return apiRequest<Project>("/projects", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateProject(
  projectId: string,
  payload: Partial<{
    title: string;
    description: string | null;
    category_id: string | null;
    status: "PLANNED" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED";
    start_date: string | null;
    target_date: string | null;
    archived: boolean;
    expected_version: number;
  }>
): Promise<Project> {
  return apiRequest<Project>(`/projects/${projectId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteProject(projectId: string): Promise<void> {
  return apiRequest<void>(`/projects/${projectId}`, { method: "DELETE" });
}

export async function createTask(payload: {
  title: string;
  description?: string | null;
  scheduled_date?: string | null;
  start_at?: string | null;
  end_at?: string | null;
  due_at?: string | null;
  priority?: TaskPriority;
  status?: OccurrenceStatus;
  category_id?: string | null;
  project_id?: string | null;
  estimated_minutes?: number | null;
}): Promise<Task> {
  return apiRequest<Task>("/tasks", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function completeOccurrence(occurrenceId: string): Promise<TaskOccurrence> {
  return apiRequest<TaskOccurrence>(`/occurrences/${occurrenceId}/complete`, {
    method: "POST",
  });
}

export async function reopenOccurrence(occurrenceId: string): Promise<TaskOccurrence> {
  return apiRequest<TaskOccurrence>(`/occurrences/${occurrenceId}/reopen`, {
    method: "POST",
  });
}

export async function patchTaskTitle(
  taskId: string,
  title: string,
  expectedVersion: number
): Promise<Task> {
  return apiRequest<Task>(`/tasks/${taskId}`, {
    method: "PATCH",
    body: JSON.stringify({ title, expected_version: expectedVersion }),
  });
}

export async function fetchTask(taskId: string): Promise<Task> {
  return apiRequest<Task>(`/tasks/${taskId}`);
}

export async function searchTasks(search: string): Promise<Task[]> {
  const params = new URLSearchParams({ search, limit: "20" });
  const result = await apiRequest<{ items: Task[] }>(`/tasks?${params}`);
  return result.items;
}

export async function patchTask(
  taskId: string,
  payload: Partial<Pick<Task, "title" | "description" | "priority" | "estimated_minutes" | "due_at" | "category_id" | "project_id" | "parent_task_id">> & { expected_version: number }
): Promise<Task> {
  return apiRequest<Task>(`/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export async function patchOccurrence(
  occurrenceId: string,
  payload: Partial<Pick<TaskOccurrence, "scheduled_date" | "start_at" | "end_at" | "due_at" | "estimated_minutes">> & { expected_version: number }
): Promise<TaskOccurrence> {
  return apiRequest<TaskOccurrence>(`/occurrences/${occurrenceId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function setOccurrenceStatus(
  occurrenceId: string,
  action: "start" | "complete" | "reopen" | "skip" | "cancel"
): Promise<TaskOccurrence> {
  return apiRequest<TaskOccurrence>(`/occurrences/${occurrenceId}/${action}`, { method: "POST" });
}

export async function fetchRecurrence(taskId: string): Promise<RecurrenceRule> {
  return apiRequest<RecurrenceRule>(`/tasks/${taskId}/recurrence`);
}

export async function fetchRecurrencePreview(taskId: string): Promise<string[]> {
  const data = await apiRequest<{ task_id: string; dates: string[] }>(
    `/tasks/${taskId}/recurrence/preview?count=5`
  );
  return data.dates;
}

export async function createRecurrence(
  taskId: string,
  payload: RecurrenceRuleInput
): Promise<RecurrenceRule> {
  return apiRequest<RecurrenceRule>(`/tasks/${taskId}/recurrence`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateFutureRecurrence(
  taskId: string,
  payload: RecurrenceRuleInput & { effective_date: string; expected_rule_version: number }
): Promise<RecurrenceRule> {
  return apiRequest<RecurrenceRule>(`/tasks/${taskId}/recurrence/future`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function setRecurrencePaused(
  taskId: string,
  paused: boolean,
  version: number
): Promise<RecurrenceRule> {
  const params = new URLSearchParams({ expected_rule_version: String(version) });
  return apiRequest<RecurrenceRule>(
    `/tasks/${taskId}/recurrence/${paused ? "pause" : "resume"}?${params}`,
    { method: "POST" }
  );
}

export async function fetchChecklist(taskId: string): Promise<ChecklistItem[]> {
  return apiRequest<ChecklistItem[]>(`/tasks/${taskId}/checklist`);
}

export async function createChecklistItem(taskId: string, title: string): Promise<ChecklistItem> {
  return apiRequest<ChecklistItem>(`/tasks/${taskId}/checklist`, {
    method: "POST",
    body: JSON.stringify({ title }),
  });
}

export async function archiveChecklistItem(taskId: string, itemId: string): Promise<ChecklistItem> {
  return apiRequest<ChecklistItem>(`/tasks/${taskId}/checklist/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify({ archived: true }),
  });
}

export async function fetchChecklistStates(occurrenceId: string): Promise<ChecklistState[]> {
  return apiRequest<ChecklistState[]>(`/occurrences/${occurrenceId}/checklist`);
}

export async function setChecklistState(
  occurrenceId: string,
  itemId: string,
  isChecked: boolean
): Promise<ChecklistState> {
  return apiRequest<ChecklistState>(`/occurrences/${occurrenceId}/checklist/${itemId}`, {
    method: "PUT",
    body: JSON.stringify({ is_checked: isChecked }),
  });
}

export async function fetchSubtasks(taskId: string): Promise<Task[]> {
  return apiRequest<Task[]>(`/tasks/${taskId}/subtasks`);
}

export async function createSubtask(taskId: string, title: string): Promise<Task> {
  return apiRequest<Task>(`/tasks/${taskId}/subtasks`, {
    method: "POST",
    body: JSON.stringify({ title }),
  });
}

export async function fetchDependencies(taskId: string): Promise<TaskDependency[]> {
  return apiRequest<TaskDependency[]>(`/tasks/${taskId}/dependencies`);
}

export async function createDependency(
  taskId: string,
  blockingTaskId: string
): Promise<TaskDependency> {
  return apiRequest<TaskDependency>(`/tasks/${taskId}/dependencies`, {
    method: "POST",
    body: JSON.stringify({ blocking_task_id: blockingTaskId }),
  });
}

export async function removeDependency(taskId: string, dependencyId: string): Promise<void> {
  return apiRequest<void>(`/tasks/${taskId}/dependencies/${dependencyId}`, { method: "DELETE" });
}

export async function fetchTaskProgress(taskId: string): Promise<TaskProgress> {
  return apiRequest<TaskProgress>(`/tasks/${taskId}/progress`);
}
