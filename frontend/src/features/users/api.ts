import { apiRequest } from "@/lib/api/client";
import type { User, UserListResponse, UserSession, UserSettings } from "@/types/domain";

export interface AuthTokenResponse {
  access_token: string;
  refresh_token: string;
  csrf_token?: string | null;
  token_type: string;
  expires_in: number;
  user: User;
}

export async function loginAccount(payload: {
  identifier: string;
  password: string;
  device_label?: string;
}): Promise<AuthTokenResponse> {
  return apiRequest<AuthTokenResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function registerAccount(payload: {
  username?: string | null;
  display_name: string;
  email?: string | null;
  phone?: string | null;
  password: string;
  confirm_password: string;
  accepted_policy: boolean;
  device_label?: string;
}): Promise<AuthTokenResponse> {
  return apiRequest<AuthTokenResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function logoutAccount(): Promise<{ revoked: boolean }> {
  return apiRequest<{ revoked: boolean }>("/auth/logout", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function fetchCurrentUser(): Promise<User> {
  return apiRequest<User>("/users/me");
}

export async function updateMyProfile(payload: {
  username?: string | null;
  display_name?: string;
  email?: string | null;
  phone?: string | null;
}): Promise<User> {
  return apiRequest<User>("/users/me", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function updateSettings(
  payload: Partial<
    Pick<
      UserSettings,
      "timezone" | "week_starts_on" | "locale" | "theme" | "color_theme" | "working_hours_json"
    >
  >
): Promise<UserSettings> {
  return apiRequest<UserSettings>("/users/me/settings", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function fetchMySessions(): Promise<UserSession[]> {
  return apiRequest<UserSession[]>("/users/me/sessions");
}

export async function revokeMySession(sessionId: string): Promise<void> {
  return apiRequest<void>(`/users/me/sessions/${sessionId}`, { method: "DELETE" });
}

export async function adminListUsers(params: {
  search?: string;
  role?: "ADMIN" | "USER" | "";
  status?: "ACTIVE" | "DISABLED" | "PENDING_DELETION" | "";
  limit?: number;
  offset?: number;
} = {}): Promise<UserListResponse> {
  const query = new URLSearchParams();
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.role) query.set("role", params.role);
  if (params.status) query.set("status", params.status);
  if (params.limit !== undefined) query.set("limit", String(params.limit));
  if (params.offset !== undefined) query.set("offset", String(params.offset));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<UserListResponse>(`/admin/users${suffix}`);
}

export async function adminCreateUser(payload: {
  username?: string | null;
  display_name: string;
  email?: string | null;
  phone?: string | null;
  password: string;
  role: "ADMIN" | "USER";
  status: "ACTIVE" | "DISABLED";
}): Promise<User> {
  return apiRequest<User>("/admin/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function adminUpdateUser(
  userId: string,
  payload: {
    username?: string | null;
    display_name?: string;
    email?: string | null;
    phone?: string | null;
    role?: "ADMIN" | "USER";
    status?: "ACTIVE" | "DISABLED" | "PENDING_DELETION";
    password?: string;
  }
): Promise<User> {
  return apiRequest<User>(`/admin/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function adminDisableUser(userId: string): Promise<User> {
  return apiRequest<User>(`/admin/users/${userId}`, { method: "DELETE" });
}
