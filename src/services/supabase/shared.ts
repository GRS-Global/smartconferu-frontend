import type { SupabaseClient, User } from "@supabase/supabase-js";
import { AuthRequiredError, ServiceError } from "../errors";

/** Turns a failed query into a sentence for the user; permission errors read as such, not as SQL. */
export function fail(error: { message?: string } | null, what: string): never {
  const msg = error?.message ?? "";
  // An expired or rejected token is a sign-in problem (the screen sends the user to log in again), not a failed query.
  if (/jwt expired|invalid jwt|jwt.*(malformed|invalid)|invalid claim/i.test(msg)) throw new AuthRequiredError();
  if (/row-level security|permission denied|not allowed/i.test(msg)) throw new ServiceError(`You don't have permission to ${what}.`);
  throw new ServiceError(`Couldn't ${what}. ${msg}`.trim());
}

/** "ISBM 2026-27" → "ISBM": the prefix of a conference's paper ids (ISBM-680), as the prototype shows them. */
export const paperPrefix = (acronym: string) => ((acronym.split(/\s+/)[0] || "PAPER").replace(/[^A-Za-z0-9]/g, "").toUpperCase() || "PAPER");

/** The signed-in user, checked with the auth server (cookie-stored session data must not be trusted on its
 *  own). Only a missing or rejected session means "signed out"; a network failure is reported as such, like
 *  the prototype's signedInUser. */
export async function currentUser(db: SupabaseClient): Promise<User> {
  const { data, error } = await db.auth.getUser();
  if (data.user) return data.user;
  const unreachable = error && (error.name === "AuthRetryableFetchError" || !error.status || error.status >= 500);
  if (unreachable) throw new ServiceError("We couldn't reach the server — check your connection and try again.");
  throw new AuthRequiredError();
}
