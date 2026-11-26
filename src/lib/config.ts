/** Where My Conferences data comes from.
 *  `supabase` (default): the real database, through the signed-in user's session and Row Level Security.
 *  `mock`: typed fixtures in src/mocks, only when explicitly asked for, for UI work.
 *  There is no silent fallback: if Supabase isn't configured or the user isn't signed in, the
 *  screen says so instead of showing other data. */
export type DataSource = "supabase" | "mock" | "api";

/** `api`: the own NestJS backend (plain JSON REST over HTTPS, see ../API.md). Services opt in one by one via services/api/*. */
const rawSource = process.env.NEXT_PUBLIC_DATA_SOURCE;
export const DATA_SOURCE: DataSource = rawSource === "mock" ? "mock" : rawSource === "supabase" ? "supabase" : "api";

/** Own backend, e.g. http://localhost:3000 (no trailing slash, no /api/v1). Only used when DATA_SOURCE is `api`. */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000").replace(/\/$/, "");
/** Version name of the Terms of Service shown at sign-up; the backend records it with the time (pattern: [\w.-]{1,40}). */
export const TERMS_VERSION = process.env.NEXT_PUBLIC_TERMS_VERSION ?? "2026-10-01";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
/** The public "anon" key; Row Level Security decides what each user may read. Never the service_role key. */
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** The public marketing website (home, Terms, Privacy), when it is hosted apart from this app: no trailing slash; empty = use this app's own pages. */
export const WEBSITE_URL = (process.env.NEXT_PUBLIC_WEBSITE_URL ?? "").replace(/\/$/, "");

/** Sign-in goes through the own backend (NEXT_PUBLIC_DATA_SOURCE=api) instead of Supabase Auth. */
export const AUTH_API = DATA_SOURCE === "api";
/** Whether sign-in can work at all: the backend is the auth server in `api` mode, otherwise Supabase must be configured. */
export const AUTH_CONFIGURED = AUTH_API || Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
