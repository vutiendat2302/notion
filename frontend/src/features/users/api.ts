import { apiRequest } from "@/lib/api/client";
import type { User, UserSettings } from "@/types/domain";

export async function fetchCurrentUser(): Promise<User> {
  return apiRequest<User>("/users/me");
}

export function updateSettings(payload: Partial<Pick<UserSettings, "timezone" | "week_starts_on" | "locale" | "theme" | "color_theme" | "working_hours_json">>): Promise<UserSettings> {
  return apiRequest<UserSettings>("/users/me/settings", { method: "PATCH", body: JSON.stringify(payload) });
}
