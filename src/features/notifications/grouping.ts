/* Day groups and the short time label, as the prototype's NotificationsPage does them. Times are shown in the
   browser's timezone (the timezone saved in Settings isn't applied anywhere in this app yet). */

export const GROUPS = ["Today", "This week", "Earlier"] as const;
export type Group = (typeof GROUPS)[number];

const DAY = 24 * 60 * 60 * 1000;

export function groupOf(iso: string, now: Date = new Date()): Group {
  const d = new Date(iso);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (d >= startOfToday) return "Today";
  if (now.getTime() - d.getTime() < 7 * DAY) return "This week";
  return "Earlier";
}

/** "Just now" / "12 min ago" / "3h ago" for today, the weekday for this week, "Oct 7" before that. (Whole hours were rounded up to at least "1h ago", so a
 *  notification that had just arrived read as an hour old.) */
export function whenLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const g = groupOf(iso, now);
  if (g === "Today") {
    const minutes = Math.floor((now.getTime() - d.getTime()) / 60_000);
    if (minutes < 1) return "Just now"; // also a clock that is a little ahead of the server
    if (minutes < 60) return `${minutes} min ago`;
    return `${Math.floor(minutes / 60)}h ago`;
  }
  if (g === "This week") return d.toLocaleDateString("en-US", { weekday: "short" });
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
}

/** The full date and time, for the tooltip. */
export function fullWhen(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("en-US", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}
