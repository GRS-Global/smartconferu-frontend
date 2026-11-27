/* The Supabase client, loaded when it is first needed. Pages that only might use it (the header menu, the sign-in form, a few shared services) import this
   instead of ./supabase, so the client library (about 60 KB compressed) is not part of every page when the own backend is the data source. */
import type { SupabaseClient } from "@supabase/supabase-js";

export async function supabase(): Promise<SupabaseClient> {
  return (await import("./supabase")).getSupabase();
}
