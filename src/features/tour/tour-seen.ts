import { api } from "@/lib/api-client";
import { DATA_SOURCE } from "@/lib/config";
import { readTourState, writeTourState } from "./tour-state";

/* "Take a tour" opens by itself only the first time a chair opens a conference; after that it only opens from the sidebar button.
   Own backend: "already shown" is kept with the chair's account (GET / POST /conferences/:id/tour), so it holds on every device.
   Other data sources: kept in this browser (tour-state.ts `welcomed`). */

/** True when the tour has not been shown to this person for this conference yet. A failed read counts as "already shown", so a hiccup never nags. */
export async function tourNotShownYet(slug: string): Promise<boolean> {
  if (DATA_SOURCE === "api") {
    try {
      const r = await api<{ seen: boolean }>(`/conferences/${encodeURIComponent(slug)}/tour`);
      return !r.seen;
    } catch { return false; }
  }
  return !readTourState(slug).welcomed;
}

/** Remembers that the tour has been shown (on the account in api mode; always in this browser too). Never throws. */
export async function rememberTourShown(slug: string): Promise<void> {
  writeTourState(slug, { welcomed: true });
  if (DATA_SOURCE !== "api") return;
  try { await api<void>(`/conferences/${encodeURIComponent(slug)}/tour/seen`, { method: "POST" }); } catch { /* the tour still runs; this browser remembers it */ }
}
