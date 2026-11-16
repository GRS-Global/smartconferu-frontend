/** Where My Conferences data comes from.
 *  `supabase` (default): the real database, through the signed-in user's session and Row Level Security.
 *  `mock`: typed fixtures in src/mocks, only when explicitly asked for, for UI work.
 *  There is no silent fallback: if Supabase isn't configured or the user isn't signed in, the
 *  screen says so instead of showing other data. */
export type DataSource = "supabase" | "mock";

export const DATA_SOURCE: DataSource = process.env.NEXT_PUBLIC_DATA_SOURCE === "mock" ? "mock" : "supabase";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
/** The public "anon" key; Row Level Security decides what each user may read. Never the service_role key. */
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Base URL of the original Vite prototype, for screens not yet ported to this app. */
export const PROTOTYPE_URL = (process.env.NEXT_PUBLIC_PROTOTYPE_URL ?? "http://localhost:5173").replace(/\/$/, "");
