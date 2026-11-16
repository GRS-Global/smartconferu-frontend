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

/** "3h ago" for today, the weekday for this week, "Oct 7" before that. */
export function whenLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const g = groupOf(iso, now);
  if (g === "Today") return `${Math.max(1, Math.round((now.getTime() - d.getTime()) / 3_600_000))}h ago`;
  if (g === "This week") return d.toLocaleDateString("en-US", { weekday: "short" });
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
}

/** The full date and time, for the tooltip. */
export function fullWhen(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("en-US", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}
