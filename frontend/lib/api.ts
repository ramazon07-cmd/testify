import { clearTokens, getAccessToken, getRefreshToken, saveAccessToken, saveTokens } from "./auth";

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

function errorMessage(data: unknown): string {
  if (!data || typeof data !== "object") return "Server xatoligi yuz berdi.";
  if ("detail" in data) return String((data as { detail: unknown }).detail);
  const first = Object.values(data as Record<string, unknown>)[0];
  if (Array.isArray(first) && first.length) return String(first[0]);
  if (typeof first === "string") return first;
  return "Kiritilgan ma’lumotlarni tekshiring.";
}

async function refreshAccessToken(): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) return false;
  const response = await fetch(`${API_URL}/auth/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access) {
    clearTokens();
    return false;
  }
  if (data.refresh) saveTokens(data.access, data.refresh);
  else saveAccessToken(data.access);
  return true;
}

function buildHeaders(options: RequestInit) {
  const token = getAccessToken();
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return headers;
}

export async function api<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: buildHeaders(options),
    cache: "no-store",
  });

  if (response.status === 401 && retry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) return api<T>(path, options, false);
  }

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json().catch(() => ({})) : await response.text();
  if (!response.ok) {
    const message = errorMessage(data);
    throw new ApiError(message, response.status, data);
  }
  return data as T;
}

export async function apiAll<T>(path: string): Promise<T[]> {
  const rows: T[] = [];
  let next: string | null = path;

  while (next) {
    const page: { results: T[]; next: string | null } = await api(next);
    rows.push(...page.results);
    next = page.next ? page.next.replace(API_URL, "") : null;
  }

  return rows;
}

export async function downloadWithAuth(path: string, filename: string) {
  const response = await fetch(`${API_URL}${path}`, { headers: buildHeaders({}) });
  if (response.status === 401 && await refreshAccessToken()) return downloadWithAuth(path, filename);
  if (!response.ok) throw new ApiError("Yuklab olishda xatolik yuz berdi.", response.status, {});
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
