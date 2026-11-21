import { apiRequest } from "@/lib/api/client";
import type { Project } from "@/types/domain";

export type ProjectInput = Pick<Project, "title" | "description" | "category_id" | "status" | "start_date" | "target_date">;

export function createProject(payload: ProjectInput): Promise<Project> {
  return apiRequest<Project>("/projects", { method: "POST", body: JSON.stringify(payload) });
}

export function updateProject(id: string, payload: Partial<ProjectInput> & { expected_version: number; archived?: boolean }): Promise<Project> {
  return apiRequest<Project>(`/projects/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}
