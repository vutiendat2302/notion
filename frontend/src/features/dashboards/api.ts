import { apiRequest } from "@/lib/api/client";
import type { BlockTemplate, DashboardData, DashboardWidget, TemplateCategory } from "@/types/domain";

export async function listDashboards(): Promise<DashboardData[]> {
  return apiRequest<DashboardData[]>("/dashboards");
}

export async function createDashboard(payload: {
  title: string;
  description?: string | null;
}): Promise<DashboardData> {
  return apiRequest<DashboardData>("/dashboards", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchDashboard(dashboardId = "default"): Promise<DashboardData> {
  return apiRequest<DashboardData>(`/dashboards/${dashboardId}`);
}

export async function fetchDefaultDashboard(): Promise<DashboardData> {
  return fetchDashboard("default");
}

export async function patchDashboard(
  dashboardId: string,
  payload: {
    title?: string;
    description?: string | null;
    style_config?: Record<string, unknown>;
  }
): Promise<DashboardData> {
  return apiRequest<DashboardData>(`/dashboards/${dashboardId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function patchDefaultDashboard(payload: {
  title?: string;
  description?: string | null;
  style_config?: Record<string, unknown>;
}): Promise<DashboardData> {
  return patchDashboard("default", payload);
}

export async function deleteDashboard(dashboardId: string): Promise<void> {
  return apiRequest<void>(`/dashboards/${dashboardId}`, { method: "DELETE" });
}

export async function addDashboardWidget(
  payload: {
    widget_kind: "METRIC_CARD" | "CHART" | "HEATMAP" | "PROGRESS" | "TASK_LIST";
    title: string;
    spec_json: Record<string, unknown>;
    position_x?: number;
    position_y?: number;
    width?: number;
    height?: number;
  },
  dashboardId = "default"
): Promise<DashboardWidget> {
  return apiRequest<DashboardWidget>(`/dashboards/${dashboardId}/widgets`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function patchDashboardWidget(
  widgetId: string,
  payload: {
    title?: string;
    spec_json?: Record<string, unknown>;
    position_x?: number;
    position_y?: number;
    width?: number;
    height?: number;
  },
  dashboardId = "default"
): Promise<DashboardWidget> {
  return apiRequest<DashboardWidget>(`/dashboards/${dashboardId}/widgets/${widgetId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteDashboardWidget(
  widgetId: string,
  dashboardId = "default"
): Promise<void> {
  return apiRequest<void>(`/dashboards/${dashboardId}/widgets/${widgetId}`, {
    method: "DELETE",
  });
}

export async function listActiveBlockTemplates(): Promise<BlockTemplate[]> {
  return apiRequest<BlockTemplate[]>("/block-templates");
}

export async function adminListBlockTemplates(): Promise<BlockTemplate[]> {
  return apiRequest<BlockTemplate[]>("/admin/block-templates");
}

export async function adminCreateBlockTemplate(payload: {
  slug: string;
  category: TemplateCategory;
  name_vi: string;
  name_en: string;
  description_vi?: string;
  description_en?: string;
  icon_name?: string;
  widget_kind: "METRIC_CARD" | "CHART" | "HEATMAP" | "PROGRESS" | "TASK_LIST";
  default_title: string;
  default_width?: number;
  default_height?: number;
  default_spec_json: Record<string, unknown>;
  is_active?: boolean;
  is_user_customizable?: boolean;
  sort_order?: number;
}): Promise<BlockTemplate> {
  return apiRequest<BlockTemplate>("/admin/block-templates", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function adminPatchBlockTemplate(
  templateId: string,
  payload: Partial<{
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
  }>
): Promise<BlockTemplate> {
  return apiRequest<BlockTemplate>(`/admin/block-templates/${templateId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function adminDeleteBlockTemplate(templateId: string): Promise<void> {
  return apiRequest<void>(`/admin/block-templates/${templateId}`, {
    method: "DELETE",
  });
}
