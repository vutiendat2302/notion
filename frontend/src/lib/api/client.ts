import type { ApiErrorEnvelope } from "@/types/domain";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

export function resolveMediaUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("blob:") || url.startsWith("data:")) {
    return url;
  }
  if (url.startsWith("/api/v1/")) {
    const apiOrigin = API_BASE_URL.replace(/\/api\/v1\/?$/, "");
    return `${apiOrigin}${url}`;
  }
  return url;
}

export class ApiClientError extends Error {
  status: number;
  code: string;
  requestId?: string;
  details?: Record<string, unknown> | null;

  constructor(
    status: number,
    code: string,
    message: string,
    requestId?: string,
    details?: Record<string, unknown> | null
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.details = details;
  }
}

const MUTATION_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);
const AUTH_NO_REFRESH_PATHS = new Set([
  "/auth/login",
  "/auth/register",
  "/auth/bootstrap",
  "/auth/refresh",
  "/auth/logout",
]);

let refreshPromise: Promise<boolean> | null = null;

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  const parts = document.cookie.split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      return decodeURIComponent(trimmed.slice(prefix.length));
    }
  }
  return null;
}

async function tryRefreshSession(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      return response.ok;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  allowRetry = true
): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const method = (options.method ?? "GET").toUpperCase();
  const headers: Record<string, string> = {
    ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers as Record<string, string> | undefined),
  };

  if (MUTATION_METHODS.has(method)) {
    const csrfToken = readCookie("csrf_token");
    if (csrfToken && !headers["X-CSRF-Token"]) {
      headers["X-CSRF-Token"] = csrfToken;
    }
  }

  const response = await fetch(`${API_BASE_URL}${normalizedPath}`, {
    ...options,
    method,
    credentials: "include",
    headers,
  });

  if (
    response.status === 401 &&
    allowRetry &&
    !AUTH_NO_REFRESH_PATHS.has(normalizedPath)
  ) {
    const refreshed = await tryRefreshSession();
    if (refreshed) {
      return apiRequest<T>(path, options, false);
    }
  }

  if (!response.ok) {
    let envelope: ApiErrorEnvelope | null = null;
    try {
      envelope = (await response.json()) as ApiErrorEnvelope;
    } catch {
      envelope = null;
    }
    throw new ApiClientError(
      response.status,
      envelope?.error?.code ?? "HTTP_ERROR",
      envelope?.error?.message ?? `Request failed with status ${response.status}`,
      envelope?.request_id,
      envelope?.error?.details ?? null
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function fetchBinaryWithRefresh(
  url: string,
  allowRetry = true
): Promise<{ buffer: ArrayBuffer; contentType: string }> {
  const targetUrl = resolveMediaUrl(url);
  const response = await fetch(targetUrl, { credentials: "include" });
  if (response.status === 401 && allowRetry) {
    const refreshed = await tryRefreshSession();
    if (refreshed) {
      return fetchBinaryWithRefresh(url, false);
    }
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch media (${response.status})`);
  }
  return {
    buffer: await response.arrayBuffer(),
    contentType: response.headers.get("content-type") || "audio/mpeg",
  };
}
