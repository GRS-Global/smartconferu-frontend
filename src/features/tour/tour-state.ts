// Guided-tour progress for one chair on one conference (the prototype's setup-tour/tourState.js): whether they saw the welcome, skipped the tour or chose
// "finish later", which step they reached, and which recommended pages they skipped or looked at. Presentation state only, kept in this browser
// (localStorage can be unavailable: then it just is not remembered). Nothing here marks any setup item as done.
export interface TourState { welcomed: boolean; dismissed: boolean; finishLater: boolean; tourDone: boolean; tourStep: number; skipped: Record<string, true>; reviewed: Record<string, true> }

const EMPTY: TourState = { welcomed: false, dismissed: false, finishLater: false, tourDone: false, tourStep: 0, skipped: {}, reviewed: {} };
const storageKey = (conference: string) => `grs_setup_tour_chair_${conference}`;
const flags = (o: unknown): Record<string, true> => Object.fromEntries(Object.entries(o && typeof o === "object" ? (o as Record<string, unknown>) : {}).filter(([, v]) => v === true)) as Record<string, true>;
function normalise(raw: unknown): TourState {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return { welcomed: r.welcomed === true, dismissed: r.dismissed === true, finishLater: r.finishLater === true, tourDone: r.tourDone === true, tourStep: Number.isInteger(r.tourStep) && (r.tourStep as number) > 0 ? (r.tourStep as number) : 0, skipped: flags(r.skipped), reviewed: flags(r.reviewed) };
}

export function readTourState(conference: string): TourState {
  try { const raw = window.localStorage.getItem(storageKey(conference)); if (raw) return normalise(JSON.parse(raw)); } catch { /* unreadable: start fresh */ }
  return { ...EMPTY };
}

/** Merges `patch` into the saved state and returns the new state (`skipped` / `reviewed` merge key by key). */
export function writeTourState(conference: string, patch: Partial<Omit<TourState, "skipped" | "reviewed">> & { skipped?: Record<string, boolean>; reviewed?: Record<string, boolean> }): TourState {
  const cur = readTourState(conference);
  const next = normalise({ ...cur, ...patch, skipped: { ...cur.skipped, ...(patch.skipped ?? {}) }, reviewed: { ...cur.reviewed, ...(patch.reviewed ?? {}) } });
  try { window.localStorage.setItem(storageKey(conference), JSON.stringify(next)); } catch { /* storage off: the tour still works this session */ }
  return next;
}
