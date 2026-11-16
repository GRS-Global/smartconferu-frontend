import { DATA_SOURCE } from "@/lib/config";
import { getSupabase } from "@/lib/supabase";

/** What stands in the way of deleting an account: the records (conferences, papers, reviews) that belong to the conferences. */
export class AccountBlockedError extends Error {
  constructor(message: string, readonly blockers: string[]) { super(message); }
}

/** Deletes the signed-in person's own account through this app's server route (it holds the admin key). Throws an Error ready to show;
 *  an `AccountBlockedError` lists what is in the way. After a success the session is gone: the caller sends the person to sign in. */
export async function deleteMyAccount(confirm: string): Promise<void> {
  if (DATA_SOURCE === "mock") throw new Error("Mock mode has no accounts.");
  const db = getSupabase();
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
  const { data, error } = await getSupabase().auth.getUserIdentities();
  if (error) return [];
  return (data?.identities ?? []).map((i) => i.provider);
}
