import { apiRequest } from "@/lib/api/client";
import type { ActiveTimerResponse, SoundCatalog, TimeEntry } from "@/types/domain";

export async function fetchActiveTimer(): Promise<ActiveTimerResponse> {
  return apiRequest<ActiveTimerResponse>("/time-entries/active");
}

export async function listTimeEntries(params?: {
  date_from?: string;
  date_to?: string;
  task_id?: string;
  occurrence_id?: string;
  limit?: number;
}): Promise<TimeEntry[]> {
  const qs = new URLSearchParams();
  if (params?.date_from) qs.set("date_from", params.date_from);
  if (params?.date_to) qs.set("date_to", params.date_to);
  if (params?.task_id) qs.set("task_id", params.task_id);
  if (params?.occurrence_id) qs.set("occurrence_id", params.occurrence_id);
  if (params?.limit) qs.set("limit", String(params.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiRequest<TimeEntry[]>(`/time-entries${suffix}`);
}

export async function startTimer(payload: {
  occurrence_id?: string | null;
  quick_task_title?: string | null;
  quick_task_scheduled_date?: string | null;
  planned_duration_seconds?: number | null;
  stop_existing?: boolean;
  note?: string | null;
}): Promise<TimeEntry> {
  return apiRequest<TimeEntry>("/time-entries/start", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function pauseTimer(entryId: string, clientEventAt?: string): Promise<TimeEntry> {
  return apiRequest<TimeEntry>(`/time-entries/${entryId}/pause`, {
    method: "POST",
    body: JSON.stringify(clientEventAt ? { client_event_at: clientEventAt } : {}),
  });
}

export async function resumeTimer(entryId: string, clientEventAt?: string): Promise<TimeEntry> {
  return apiRequest<TimeEntry>(`/time-entries/${entryId}/resume`, {
    method: "POST",
    body: JSON.stringify(clientEventAt ? { client_event_at: clientEventAt } : {}),
  });
}

export async function completeTimer(
  entryId: string,
  payload: { mark_occurrence_done?: boolean; client_event_at?: string } = {}
): Promise<TimeEntry> {
  return apiRequest<TimeEntry>(`/time-entries/${entryId}/complete`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function cancelTimer(entryId: string): Promise<TimeEntry> {
  return apiRequest<TimeEntry>(`/time-entries/${entryId}/cancel`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function fetchSoundCatalog(): Promise<SoundCatalog> {
  return apiRequest<SoundCatalog>("/storage/sounds");
}
