"use client";

import { appConfig } from "./app-config";
import { useAuthStore } from "./auth-store";
import type { User } from "./types";

const API_BASE = appConfig.apiUrl;

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
  auth?: boolean;
  skipRefresh?: boolean;
};

let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const response = await fetch(`${API_BASE}/auth/refresh`, {
          method: "POST",
          credentials: "include",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: "{}",
        });
        if (!response.ok) return false;
        const data = (await response.json()) as { token?: string; user?: User };
        if (!data.token || !data.user) return false;
        useAuthStore.getState().setSession(data.token, data.user);
        return true;
      } catch {
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true, skipRefresh = false } = options;
  const token = options.token ?? useAuthStore.getState().token;

  const headers: HeadersInit = {
    Accept: "application/json",
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (auth && token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    credentials: "include",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401 && auth && !skipRefresh && path !== "/auth/login") {
      const refreshed = await tryRefreshSession();
      if (refreshed) {
        return apiRequest<T>(path, { ...options, skipRefresh: true });
      }
      useAuthStore.getState().clearSession();
    } else if (response.status === 401 && auth) {
      useAuthStore.getState().clearSession();
    }
    throw new ApiError(
      typeof data.message === "string" ? data.message : "Request failed",
      response.status
    );
  }

  return data as T;
}

export async function apiLogout() {
  try {
    await apiRequest("/auth/logout", { method: "POST", skipRefresh: true });
  } catch {
    // ignore — local session cleared either way
  }
  useAuthStore.getState().clearSession();
}

export function toQuery(params: Record<string, string | number | undefined | null>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    search.set(key, String(value));
  });
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}
