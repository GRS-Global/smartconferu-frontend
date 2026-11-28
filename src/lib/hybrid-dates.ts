/**
 * Hybrid conferences: the in-person and the virtual event can run on different days, and each can run on separate stretches
 * (for example 15–16 and 18 only). Everything lives in `conferences.details` (no columns of their own); the conference's own
 * start / end date is the earliest start and the latest end, so lists, deadlines and the status keep working as before.
 *
 * In the form an event is its first range (`physicalStart` / `physicalEnd`) plus `physicalMore` for any further ranges.
 * In `details` an event has `physicalStartDate` / `physicalEndDate` (its earliest start and latest end) and, when it has
 * more than one range, `physicalDates` (all of them, as `[{ start, end }]`).
 */
export interface DateRange { start: string; end: string }
export interface HybridDates {
  physicalStart: string; physicalEnd: string; virtualStart: string; virtualEnd: string;
  /** Further in-person / virtual ranges after the first one. */
  physicalMore?: DateRange[]; virtualMore?: DateRange[];
}

export const EMPTY_HYBRID_DATES: HybridDates = { physicalStart: "", physicalEnd: "", virtualStart: "", virtualEnd: "", physicalMore: [], virtualMore: [] };

/** The most ranges one event can have. */
export const MAX_RANGES = 6;

type Event = "physical" | "virtual";

const day = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : "");
const byStart = (a: DateRange, b: DateRange) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0);

/** Every range of one event, in the form's order (first, then the more), empty ones left out. */
export function rangesOf(h: HybridDates, ev: Event): DateRange[] {
  const first = { start: h[`${ev}Start`], end: h[`${ev}End`] };
  return [first, ...(h[`${ev}More`] ?? [])].filter((r) => r.start || r.end);
}

/** Reads them from a conference's `details`. */
export function readHybridDates(details: Record<string, unknown> | null | undefined): HybridDates {
  const d = details ?? {};
  const read = (ev: Event): DateRange[] => {
    const list = Array.isArray(d[`${ev}Dates`])
      ? (d[`${ev}Dates`] as unknown[]).map((r) => ({ start: day((r as { start?: unknown })?.start), end: day((r as { end?: unknown })?.end) })).filter((r) => r.start && r.end)
      : [];
    if (list.length) return list.sort(byStart);
    const start = day(d[`${ev}StartDate`]), end = day(d[`${ev}EndDate`]);
    return start || end ? [{ start, end }] : [];
  };
  const p = read("physical"), v = read("virtual");
  return {
    physicalStart: p[0]?.start ?? "", physicalEnd: p[0]?.end ?? "", virtualStart: v[0]?.start ?? "", virtualEnd: v[0]?.end ?? "",
    physicalMore: p.slice(1), virtualMore: v.slice(1),
  };
}

/** For `details` when saving: the dates when the event is hybrid, otherwise nulls (clears old ones). */
export function hybridDetails(hybrid: boolean, h: HybridDates): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  (["physical", "virtual"] as const).forEach((ev) => {
    const all = hybrid ? rangesOf(h, ev).filter((r) => r.start && r.end).sort(byStart) : [];
    out[`${ev}StartDate`] = all.length ? all[0].start : null;
    out[`${ev}EndDate`] = all.length ? all.map((r) => r.end).sort().at(-1) : null;
    out[`${ev}Dates`] = all.length > 1 ? all : null;
  });
  return out;
}

/** The whole conference: from the earliest start to the latest end ("" where nothing is set). */
export function overallRange(h: HybridDates): { start: string; end: string } {
  const all = [...rangesOf(h, "physical"), ...rangesOf(h, "virtual")];
  const starts = all.map((r) => r.start).filter(Boolean).sort();
  const ends = all.map((r) => r.end).filter(Boolean).sort();
  return { start: starts[0] ?? "", end: ends[ends.length - 1] ?? "" };
}

/** Days an event runs on, counting every range. */
export function eventDays(h: HybridDates, ev: Event): number {
  return rangesOf(h, ev).reduce((n, r) => n + (r.start && r.end && r.end >= r.start ? Math.round((new Date(r.end).getTime() - new Date(r.start).getTime()) / 86400000) + 1 : 0), 0);
}

const NAME: Record<Event, string> = { physical: "in-person", virtual: "virtual" };

/** What is wrong with them, for the form ("" = fine). `required` asks for the first range of both events. */
export function hybridProblem(h: HybridDates, required: boolean): string {
  for (const ev of ["physical", "virtual"] as const) {
    const ranges = rangesOf(h, ev);
    if (ranges.some((r) => r.start && r.end && r.end < r.start)) return `A date range of the ${NAME[ev]} event ends before it starts.`;
    if (ranges.slice(1).some((r) => !r.start || !r.end)) return `Fill in both dates of each extra ${NAME[ev]} range, or remove it.`;
    const done = ranges.filter((r) => r.start && r.end).sort(byStart);
    if (done.some((r, i) => i > 0 && r.start <= done[i - 1].end)) return `The ${NAME[ev]} date ranges overlap. Join them into one range.`;
  }
  if (required && (!h.physicalStart || !h.physicalEnd || !h.virtualStart || !h.virtualEnd)) return "Pick the start and end dates of both the in-person and the virtual event.";
  return "";
}

/** A changed start fills an empty (or earlier) end, so a one-day event takes one click. */
export function setHybridDate(h: HybridDates, key: "physicalStart" | "physicalEnd" | "virtualStart" | "virtualEnd", value: string): HybridDates {
  const next = { ...h, [key]: value };
  if (key === "physicalStart" && value && (!h.physicalEnd || h.physicalEnd < value)) next.physicalEnd = value;
  if (key === "virtualStart" && value && (!h.virtualEnd || h.virtualEnd < value)) next.virtualEnd = value;
  return next;
}

/** Changes one of the further ranges (the same one-click rule as the first). */
export function setMoreRange(h: HybridDates, ev: Event, index: number, part: "start" | "end", value: string): HybridDates {
  const key = `${ev}More` as const;
  const list = [...(h[key] ?? [])];
  const cur = list[index] ?? { start: "", end: "" };
  const next = { ...cur, [part]: value };
  if (part === "start" && value && (!cur.end || cur.end < value)) next.end = value;
  list[index] = next;
  return { ...h, [key]: list };
}

export function addMoreRange(h: HybridDates, ev: Event): HybridDates {
  const key = `${ev}More` as const;
  return { ...h, [key]: [...(h[key] ?? []), { start: "", end: "" }] };
}

export function removeMoreRange(h: HybridDates, ev: Event, index: number): HybridDates {
  const key = `${ev}More` as const;
  return { ...h, [key]: (h[key] ?? []).filter((_, i) => i !== index) };
}
