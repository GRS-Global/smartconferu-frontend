/* Asking the backend for a new access token (POST /auth/refresh), shared by the app (lib/api-client.ts) and the Super Admin console
   (features/super-admin/api.ts). Only a real "no session" answer ends the session: a busy server (429), a server error (5xx) or a dropped
   connection is tried again after a short wait, and if it still fails the caller is told the server can't be reached — the person stays
   signed in and nothing they typed is lost. (BUG-003 in docs/qa/BUG_REPORT.md.) */

export type RefreshOutcome = { kind: "ok"; token: string } | { kind: "signed_out" } | { kind: "unreachable" };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Answers that mean the refresh cookie is missing, invalid, expired or not allowed here: the session is over. */
const SIGNED_OUT = new Set([400, 401, 403]);

/** Runs `doFetch` (the refresh request) up to 1 + delays.length times. A 429's Retry-After is honoured (at most 10 s). */
export async function refreshWithRetry(doFetch: () => Promise<Response>, delays: number[] = [1000, 3000]): Promise<RefreshOutcome> {
  for (let attempt = 0; ; attempt++) {
    let res: Response | null = null;
    try { res = await doFetch(); } catch { res = null; }
    if (res?.ok) {
      const body = (await res.json().catch(() => null)) as { accessToken?: string } | null;
      if (body?.accessToken) return { kind: "ok", token: body.accessToken };
    } else if (res && SIGNED_OUT.has(res.status)) {
      return { kind: "signed_out" };
    }
    if (attempt >= delays.length) return { kind: "unreachable" };
    const retryAfter = Number(res?.headers.get("retry-after"));
    await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 10_000) : delays[attempt]);
  }
}

export const UNREACHABLE_MESSAGE = "Can't reach the server right now — please try again in a moment. You're still signed in.";
