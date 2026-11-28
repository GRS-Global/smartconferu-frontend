/**
 * Hybrid conferences: the in-person and the virtual event can run on different days.
 * Both ranges live in `conferences.details` (no columns of their own); the conference's own
 * start / end date is the earliest start and the latest end, so lists, deadlines and the
 * status keep working as before.
 */
export interface HybridDates { physicalStart: string; physicalEnd: string; virtualStart: string; virtualEnd: string }

export const EMPTY_HYBRID_DATES: HybridDates = { physicalStart: "", physicalEnd: "", virtualStart: "", virtualEnd: "" };

/** The `details` keys the backend stores them under. */
const KEYS = { physicalStart: "physicalStartDate", physicalEnd: "physicalEndDate", virtualStart: "virtualStartDate", virtualEnd: "virtualEndDate" } as const;

const day = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : "");

/** Reads them from a conference's `details`. */
export function readHybridDates(details: Record<string, unknown> | null | undefined): HybridDates {
  const d = details ?? {};
  return { physicalStart: day(d[KEYS.physicalStart]), physicalEnd: day(d[KEYS.physicalEnd]), virtualStart: day(d[KEYS.virtualStart]), virtualEnd: day(d[KEYS.virtualEnd]) };
}

/** For `details` when saving: the four dates when the event is hybrid, otherwise null (clears old ones). */
export function hybridDetails(hybrid: boolean, h: HybridDates): Record<string, string | null> {
  return Object.fromEntries((Object.keys(KEYS) as Array<keyof HybridDates>).map((k) => [KEYS[k], hybrid && h[k] ? h[k] : null]));
}

/** The whole conference: from the earliest start to the latest end ("" where nothing is set). */
export function overallRange(h: HybridDates): { start: string; end: string } {
  const starts = [h.physicalStart, h.virtualStart].filter(Boolean).sort();
  const ends = [h.physicalEnd, h.virtualEnd].filter(Boolean).sort();
  return { start: starts[0] ?? "", end: ends[ends.length - 1] ?? "" };
}

/** What is wrong with them, for the form ("" = fine). `required` asks for all four. */
export function hybridProblem(h: HybridDates, required: boolean): string {
  if (h.physicalStart && h.physicalEnd && h.physicalEnd < h.physicalStart) return "The in-person event can't end before it starts.";
  if (h.virtualStart && h.virtualEnd && h.virtualEnd < h.virtualStart) return "The virtual event can't end before it starts.";
  if (required && (!h.physicalStart || !h.physicalEnd || !h.virtualStart || !h.virtualEnd)) return "Pick the start and end dates of both the in-person and the virtual event.";
  return "";
}

/** A changed start fills an empty (or earlier) end, so a one-day event takes one click. */
export function setHybridDate(h: HybridDates, key: keyof HybridDates, value: string): HybridDates {
  const next = { ...h, [key]: value };
  if (key === "physicalStart" && value && (!h.physicalEnd || h.physicalEnd < value)) next.physicalEnd = value;
  if (key === "virtualStart" && value && (!h.virtualEnd || h.virtualEnd < value)) next.virtualEnd = value;
  return next;
}
