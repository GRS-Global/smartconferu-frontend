import { API_URL } from "@/lib/config";
import { AuthRequiredError, ServiceError } from "@/services/errors";
import { endSupportView, hadSupportView, readSupportView } from "@/lib/support-view";
import { refreshWithRetry, UNREACHABLE_MESSAGE } from "@/lib/session-refresh";

/* One place for every call to the own backend (Backend/, NestJS): plain JSON over HTTPS, routes in ../API.md.
   - Base path /api/v1.
   - Access token (Bearer) lives in memory only; the refresh token is an httpOnly cookie the browser sends itself
     (`credentials: "include"`), so a page reload gets a new access token from POST /auth/refresh.
   - A 401 triggers one refresh (shared between parallel calls) and one retry; if that fails, AuthRequiredError. */

const BASE = `${API_URL}/api/v1`;

/** A failed backend call: `code` is the stable ErrorCode (e.g. AUTH_INVALID_CREDENTIALS), `message` is ready to show. */
export class ApiError extends ServiceError {
  constructor(message: string, readonly status: number, readonly code?: string, readonly details?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

let accessToken: string | null = null;
/* A Super Admin's read-only "View as" in this tab: its token is used as is and never refreshed (the
   browser's refresh cookie is the admin's own). See lib/support-view.ts. */
function supportToken(): string | null {
  const view = readSupportView();
  if (view) {
    accessToken = view.token;
    return view.token;
  }
  if (hadSupportView()) endSupportView();
  return null;
}
export const hasAccessToken = () => accessToken !== null || supportToken() !== null;

/* ---- who is listening to the session (the header menu watches it to send people back to sign-in) ---- */
export type SessionEvent = "signed_in" | "signed_out";
type Listener = (event: SessionEvent) => void;
const listeners = new Set<Listener>();
export function onSessionChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
const emit = (e: SessionEvent) => listeners.forEach((fn) => fn(e));

/** Stores (or, with null, forgets) the access token and tells the listeners (`notify` false: the caller sends the person on itself). */
export function setAccessToken(token: string | null, notify = true): void {
  // Signing out of a support view ends the view; nothing else may replace its token.
  if (hadSupportView()) {
    if (token === null) endSupportView();
    return;
  }
  const had = accessToken !== null;
  accessToken = token;
  if (!notify) return;
  if (token && !had) emit("signed_in");
  if (!token && had) emit("signed_out");
}

let refreshing: Promise<boolean> | null = null;

/** Gets a new access token from the refresh cookie. Resolves false only when the backend says there is no valid session; a busy or
 *  unreachable server is retried, then throws a ServiceError (the person stays signed in — see lib/session-refresh.ts). */
export function refreshSession(): Promise<boolean> {
  if (hadSupportView()) {
    // The view's token can't be renewed: it is still good, or the view is over.
    return Promise.resolve(supportToken() !== null);
  }
  refreshing ??= (async () => {
    try {
      const r = await refreshWithRetry(() => fetch(`${BASE}/auth/refresh`, { method: "POST", credentials: "include" }));
      if (r.kind === "ok") { setAccessToken(r.token); return true; }
      if (r.kind === "signed_out") { setAccessToken(null); return false; }
      throw new ServiceError(UNREACHABLE_MESSAGE);
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export interface ApiOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** false for public routes (sign-in, register, ...): no Bearer header, no refresh-and-retry on 401. Default true. */
  auth?: boolean;
  /** Cancels the request (a call that was running when the person moved on). */
  signal?: AbortSignal;
}

function url(path: string, query?: ApiOptions["query"]): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined && v !== null) qs.set(k, String(v));
  const s = qs.toString();
  return `${BASE}${path}${s ? `?${s}` : ""}`;
}

async function send(path: string, o: ApiOptions): Promise<Response> {
  const headers: Record<string, string> = {};
  const isForm = typeof FormData !== "undefined" && o.body instanceof FormData;
  if (o.body !== undefined && !isForm) headers["content-type"] = "application/json";
  if (o.auth !== false && accessToken) headers.authorization = `Bearer ${accessToken}`;
  try {
    return await fetch(url(path, o.query), {
      method: o.method ?? (o.body !== undefined ? "POST" : "GET"),
      headers,
      body: o.body === undefined ? undefined : isForm ? (o.body as FormData) : JSON.stringify(o.body),
      credentials: "include",
      signal: o.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ServiceError("Can't reach the server — check your internet connection.");
  }
}

async function toError(res: Response): Promise<Error> {
  const b = (await res.json().catch(() => null)) as { code?: string; message?: string; details?: unknown } | null;
  // Validation errors come with details: [{ field, errors[] }]; show the first message when there is one.
  const first = Array.isArray(b?.details) ? (b.details[0] as { errors?: string[] } | undefined)?.errors?.[0] : undefined;
  return new ApiError(first ?? b?.message ?? "Something went wrong — please try again.", res.status, b?.code, b?.details);
}

/** A 401 can mean "your session is over" (no / bad / expired token) or "that code or password is wrong" (AUTH_INVALID_CODE, ...): only the first
 *  sends the person back to sign in. A 401 without a readable body counts as the first. */
const SESSION_CODES = new Set(["AUTH_REQUIRED", "AUTH_INVALID_TOKEN", "AUTH_SESSION_EXPIRED"]);
async function isSessionProblem(res: Response): Promise<boolean> {
  const b = (await res.clone().json().catch(() => null)) as { code?: string } | null;
  return !b?.code || SESSION_CODES.has(b.code);
}

/** Calls the backend and returns the parsed JSON (undefined for 204). Throws AuthRequiredError / ApiError / ServiceError. */
async function request(path: string, o: ApiOptions): Promise<Response> {
  const authed = o.auth !== false;
  if (authed && !accessToken) supportToken();
  if (authed && !accessToken && !(await refreshSession())) throw new AuthRequiredError();
  let res = await send(path, o);
  if (res.status === 401 && authed && (await isSessionProblem(res))) {
    if (!(await refreshSession())) throw new AuthRequiredError();
    res = await send(path, o);
    if (res.status === 401 && (await isSessionProblem(res))) throw new AuthRequiredError();
  }
  if (!res.ok) throw await toError(res);
  return res;
}

export async function api<T = void>(path: string, o: ApiOptions = {}): Promise<T> {
  const res = await request(path, o);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Like `api`, for a file: the bytes with their type (the backend wants the Bearer header, so a plain link would not work). */
export async function apiBlob(path: string, o: ApiOptions = {}): Promise<Blob> {
  return (await request(path, o)).blob();
}

/** A link token that is not even the right shape (cut off, mistyped) is refused as invalid input; for the person it is simply a link that doesn't work. */
export function asBrokenLink(e: unknown, message: string): unknown {
  return e instanceof ApiError && e.code === "VALIDATION_FAILED" ? new ServiceError(message) : e;
}

/** Address of a stored file (profile photo, conference logo) that anyone may read, for `<img src>`. */
export const publicFileUrl = (path: string | null | undefined): string => (path ? `${BASE}/files/public?path=${encodeURIComponent(path)}` : "");
