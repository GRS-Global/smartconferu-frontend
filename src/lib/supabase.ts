import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/config";
import { ServiceConfigError } from "@/services/errors";

let client: SupabaseClient | null = null;

/** The browser Supabase client. @supabase/ssr keeps the session in cookies (refreshed by src/proxy.ts),
 *  so there are no tokens in localStorage and the server can see whether someone is signed in.
 *  Anon key only; Row Level Security decides what the signed-in user may read. */
export function getSupabase(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new ServiceConfigError();
  client ??= createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}
