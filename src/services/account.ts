import { api, ApiError, setAccessToken } from "@/lib/api-client";
import { DATA_SOURCE } from "@/lib/config";
import { supabase } from "@/lib/supabase-lazy";

/** What stands in the way of deleting an account: the records (conferences, papers, reviews) that belong to the conferences. */
export class AccountBlockedError extends Error {
  constructor(message: string, readonly blockers: string[]) { super(message); }
}

/** Own backend: POST /auth/account/delete. A 409 carries `details.blockers`, the sentences naming what is in the way. */
async function deleteOwnAccount(confirm: string): Promise<void> {
  try {
    await api("/auth/account/delete", { method: "POST", body: { confirm } });
  } catch (e) {
    const details = e instanceof ApiError && e.status === 409 && typeof e.details === "object" && e.details !== null ? (e.details as { blockers?: unknown }) : null;
    if (details && Array.isArray(details.blockers) && details.blockers.length) {
      throw new AccountBlockedError(e instanceof Error ? e.message : "This account can't be deleted yet.", details.blockers.map(String));
    }
    throw e;
  }
  // The account and its sessions are gone: forget the token without the "session ended" redirect; the caller goes to sign in.
  setAccessToken(null, false);
}

/** Own backend: the connected providers (GET /auth/identities) plus "email" when the account has a password (GET /me).
 *  Names follow Supabase's, which the screen knows ("azure" = Microsoft). */
async function ownLinkedProviders(): Promise<string[]> {
  try {
    const [identities, me] = await Promise.all([api<{ provider: string }[]>("/auth/identities"), api<{ hasPassword?: boolean }>("/me")]);
    return [...(me.hasPassword ? ["email"] : []), ...identities.map((i) => (i.provider === "microsoft" ? "azure" : i.provider))];
  } catch {
    return [];
  }
}

/** Deletes the signed-in person's own account (own backend: POST /auth/account/delete; Supabase: this app's server route, which holds the
 *  admin key). Throws an Error ready to show; an `AccountBlockedError` lists what is in the way. After a success the session is gone: the
 *  caller sends the person to sign in. */
export async function deleteMyAccount(confirm: string): Promise<void> {
  if (DATA_SOURCE === "mock") throw new Error("Mock mode has no accounts.");
  if (DATA_SOURCE === "api") return deleteOwnAccount(confirm);
  const db = (await supabase());
  const { data: { session } } = await db.auth.getSession();
  if (!session) throw new Error("You're signed out — please sign in again.");
  const res = await fetch("/api/account/delete", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ confirm }) });
  const body = (await res.json().catch(() => ({}))) as { error?: string; blockers?: string[] };
  if (res.status === 409 && body.blockers?.length) throw new AccountBlockedError(body.error ?? "This account can't be deleted yet.", body.blockers);
  if (!res.ok) throw new Error(body.error || `Couldn't delete the account (error ${res.status}).`);
  await db.auth.signOut({ scope: "local" }).catch(() => undefined);
}

/** The sign-in methods linked to the account ("email", "google", "azure" …); [] when they can't be read. */
export async function linkedProviders(): Promise<string[]> {
  if (DATA_SOURCE === "mock") return [];
  if (DATA_SOURCE === "api") return ownLinkedProviders();
  const { data, error } = await (await supabase()).auth.getUserIdentities();
  if (error) return [];
  return (data?.identities ?? []).map((i) => i.provider);
}
