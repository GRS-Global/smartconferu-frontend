/* "Trust this device" (the prototype's adminAuth.js trust helpers). The API decides: it keeps the
   trust in an httpOnly cookie this code can't read. This only remembers, for the screens, which
   admin trusted this browser and until when ("Trusted device · password only until …", the
   profile menu's "This device"). Losing it (cleared storage) changes nothing but those labels. */

export const TRUST_DAYS = 14;
const KEY = "sa.trustedDevice";

interface Hint {
  email: string;
  until: string;
}

function read(): Hint | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    const hint = raw ? (JSON.parse(raw) as Hint) : null;
    return hint && new Date(hint.until).getTime() > Date.now() ? hint : null;
  } catch {
    return null;
  }
}

/** When this browser's trust for `email` ends, or null when it isn't trusted for them. */
export function trustedUntil(email: string): Date | null {
  const hint = read();
  return hint && email.trim() && hint.email.toLowerCase() === email.trim().toLowerCase() ? new Date(hint.until) : null;
}

export function rememberTrust(email: string): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ email: email.trim(), until: new Date(Date.now() + TRUST_DAYS * 86_400_000).toISOString() }));
  } catch {
    /* storage off: only the labels are lost */
  }
}

export function forgetTrustHint(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* storage off */
  }
}

export const fmtTrustDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/* "Welcome back, <name>": the login page asks the console to say it once it has loaded. */
const WELCOME_KEY = "sa.welcome";
export function queueWelcome(): void {
  try {
    window.sessionStorage.setItem(WELCOME_KEY, "1");
  } catch {
    /* storage off */
  }
}
export function peekWelcome(): boolean {
  try {
    return window.sessionStorage.getItem(WELCOME_KEY) === "1";
  } catch {
    return false;
  }
}
export function clearWelcome(): void {
  try {
    window.sessionStorage.removeItem(WELCOME_KEY);
  } catch {
    /* storage off */
  }
}
