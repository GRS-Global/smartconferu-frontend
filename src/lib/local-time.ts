/* When something happened, shown in the viewer's own time zone (the device's), with the zone named so a screenshot shared between people in
   different countries is still clear. The database keeps UTC; only the display changes. Used by the logs (Email Logs, Activity Logs,
   Super Admin Audit Log). Not for deadlines: a conference's dates belong to the conference, not to whoever is looking.
   The log screens render after their data loads in the browser, so this always runs with the device's zone. */

const DATE: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
const TIME: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit", hour12: true };

/** The device's zone as a short name, e.g. "GMT+5:30", "GMT", "EST" (as the browser names it). */
export function localZoneName(at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-US", { timeZoneName: "short" }).formatToParts(at).find((p) => p.type === "timeZoneName")?.value ?? "local time";
}

export interface LocalTime {
  /** "Nov 27, 2026" in the viewer's zone. */
  date: string;
  /** "4:30 PM" in the viewer's zone. */
  time: string;
  /** The zone at that moment, e.g. "GMT+5:30" (daylight saving included). */
  zone: string;
  /** "Nov 27, 2026 · 4:30 PM GMT+5:30" */
  full: string;
  /** The same moment in UTC, for a tooltip: "Nov 27, 2026 · 11:00 AM UTC". */
  utc: string;
}

export function localTime(iso: string): LocalTime {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "—", time: "", zone: "", full: "—", utc: "" };
  const date = d.toLocaleDateString("en-US", DATE);
  const time = d.toLocaleTimeString("en-US", TIME);
  const zone = localZoneName(d);
  const utc = `${d.toLocaleDateString("en-US", { ...DATE, timeZone: "UTC" })} · ${d.toLocaleTimeString("en-US", { ...TIME, timeZone: "UTC" })} UTC`;
  return { date, time, zone, full: `${date} · ${time} ${zone}`, utc };
}
