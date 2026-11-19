import { apiRequest } from "@/lib/api/client";
import type {
  Category,
  OccurrenceWithTask,
  Project,
  Task,
  TaskOccurrence,
  TaskPriority,
} from "@/types/domain";

export interface OccurrenceListPayload {
  items: OccurrenceWithTask[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

export async function fetchOccurrences(scope: string): Promise<OccurrenceListPayload> {
  return apiRequest<OccurrenceListPayload>(`/occurrences?scope=${encodeURIComponent(scope)}`);
}

export async function fetchCategories(): Promise<Category[]> {
  return apiRequest<Category[]>("/categories");
}

export async function fetchProjects(): Promise<Project[]> {
  return apiRequest<Project[]>("/projects");
}

export async function createTask(payload: {
  title: string;
  scheduled_date?: string | null;
  priority?: TaskPriority;
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
