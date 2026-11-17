/* The Super Admin console talks to the Smartconferu API (NestJS), not to Supabase.
   The access token lives in memory only; the refresh token is the API's httpOnly cookie, so a
   reload calls POST /auth/refresh to get a new access token. Every request is plain JSON over
   HTTPS; errors arrive as { statusCode, code, message, details?, requestId }. */

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000").replace(/\/$/, "");
const BASE = `${API_URL}/api/v1`;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;
const listeners = new Set<() => void>();

/** Called when the session can't be renewed (signed out elsewhere, suspended, expired). */
export function onSessionEnded(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}

async function send(path: string, init: RequestInit & { json?: unknown } = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.json !== undefined) headers.set("content-type", "application/json");
  if (accessToken) headers.set("authorization", `Bearer ${accessToken}`);
  try {
    return await fetch(`${BASE}${path}`, {
      ...init,
      headers,
      body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
      credentials: "include",
    });
  } catch {
    throw new ApiError(0, "NETWORK", "Couldn't reach the Smartconferu API. Check your connection and that the API is running.");
  }
}

async function errorOf(res: Response): Promise<ApiError> {
  const body = (await res.json().catch(() => null)) as { code?: string; message?: string | string[]; details?: unknown } | null;
  const message = Array.isArray(body?.message) ? body.message.join(" ") : body?.message;
  return new ApiError(res.status, body?.code ?? "UNKNOWN", message || `Request failed (${res.status}).`, body?.details);
}

/** Swaps the refresh cookie for a new access token. False when there is no valid session. */
export function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const res = await send("/auth/refresh", { method: "POST" });
      if (!res.ok) {
        accessToken = null;
        return false;
      }
      accessToken = ((await res.json()) as { accessToken: string }).accessToken;
      return true;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

/** A JSON request; a 401 renews the access token once and retries. */
export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  let res = await send(path, init);
  if (res.status === 401 && accessToken && !path.startsWith("/auth/")) {
    if (await refreshSession()) {
      res = await send(path, init);
    } else {
      listeners.forEach((l) => l());
    }
  }
  if (!res.ok) throw await errorOf(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const get = <T>(path: string) => api<T>(path);
export const post = <T>(path: string, json?: unknown) => api<T>(path, { method: "POST", json: json ?? {} });
export const patch = <T>(path: string, json: unknown) => api<T>(path, { method: "PATCH", json });
export const put = <T>(path: string, json: unknown) => api<T>(path, { method: "PUT", json });

export const qs = (params: Record<string, string | number | undefined | null>) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") s.set(k, String(v));
  const out = s.toString();
  return out ? `?${out}` : "";
};
