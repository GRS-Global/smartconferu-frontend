export const LOGIN_PATH = "/login";
export const REGISTER_PATH = "/register";
export const RESET_PASSWORD_PATH = "/reset-password";
export const COMPLETE_PROFILE_PATH = "/complete-profile";
export const PROFILE_PATH = "/profile";
export const DEFAULT_AFTER_LOGIN = "/dashboard";

/** A return-to destination that is safe to follow: a path inside this app. Anything else (another
 *  origin, protocol-relative `//host`, backslashes, the sign-in / register / reset pages) falls back to the dashboard,
 *  so `?next=` can't be used as an open redirect or to loop. */
export function safeNext(raw: string | null | undefined): string {
  if (!raw || typeof raw !== "string") return DEFAULT_AFTER_LOGIN;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || /[\u0000-\u001f]/.test(raw)) return DEFAULT_AFTER_LOGIN;
  const path = raw.split(/[?#]/)[0];
  const AUTH_PATHS = [LOGIN_PATH, REGISTER_PATH, RESET_PASSWORD_PATH];
  if (AUTH_PATHS.some((p) => path === p || path.startsWith(`${p}/`)) || path === COMPLETE_PROFILE_PATH || path === "/") return DEFAULT_AFTER_LOGIN;
  return raw;
}

/** `/complete-profile?next=<where they were going>`; the dashboard is the default, so it isn't spelled out. */
export function completeProfileUrl(next?: string): string {
  const safe = safeNext(next);
  return safe === DEFAULT_AFTER_LOGIN ? COMPLETE_PROFILE_PATH : `${COMPLETE_PROFILE_PATH}?next=${encodeURIComponent(safe)}`;
}

/** `/login?next=<where they were going>`; the dashboard is the default, so it isn't spelled out. */
export function loginUrl(next?: string, reason?: "expired"): string {
  const params = new URLSearchParams();
  const safe = safeNext(next);
  if (safe !== DEFAULT_AFTER_LOGIN) params.set("next", safe);
  if (reason) params.set("reason", reason);
  const q = params.toString();
  return q ? `${LOGIN_PATH}?${q}` : LOGIN_PATH;
}
