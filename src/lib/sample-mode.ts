import { DATA_SOURCE } from "@/lib/config";

/** True where the prototype shows its "clickable prototype" aids: the demo-logins box on Sign in and the "emails this action
 *  triggers" note. In the prototype both are hidden when it runs on the real database (`!USE_DATABASE` guards), so here they
 *  appear only in mock data mode — never in the production (Supabase) UI.
 *  `NEXT_PUBLIC_SAMPLE_MODE_UI=true` turns them on without mock data; it exists only so the visual-QA instance (qa/, a dummy
 *  unreachable Supabase URL) can compare those aids with the prototype's sample mode. Leave it unset everywhere else. */
export const SAMPLE_UI = DATA_SOURCE === "mock" || process.env.NEXT_PUBLIC_SAMPLE_MODE_UI === "true";
