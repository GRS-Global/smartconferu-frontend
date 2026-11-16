import type { Conference } from "@/types/conference";

/* Small helpers for the Overview — ports of the prototype's src/author-module/conferenceFormat.js and the date helpers
   it uses (shiftIsoDate, daysToISO), the capital-city fallback (author-dashboard/data.js › cityOf) and the one-event
   .ics download (authorPapers.js › downloadIcs). */

export const toDate = (iso: string): Date => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); };
export const fmtDay = (iso: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) => toDate(iso).toLocaleDateString("en-GB", opts);
export const monogram = (acronym: string) => acronym.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase();

/** "17–19 Feb 2027" / "28 Feb – 2 Mar 2027". */
export function rangeLabel(c: Pick<Conference, "startDate" | "endDate">): string {
  if (!c.startDate) return "";
  const s = toDate(c.startDate);
  const e = toDate(c.endDate || c.startDate);
  const mon = (d: Date) => d.toLocaleDateString("en-GB", { month: "short" });
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) return `${s.getDate()}–${e.getDate()} ${mon(e)} ${e.getFullYear()}`;
  return `${s.getDate()} ${mon(s)} – ${e.getDate()} ${mon(e)} ${e.getFullYear()}`;
}

const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function shiftIsoDate(iso: string, days: number): string {
  if (!iso) return "";
  const date = toDate(iso);
  date.setDate(date.getDate() + days);
  return isoOf(date);
}

/** Whole days from now to the end of that day (negative once it has passed); null without a date. */
export function daysToISO(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  const target = new Date(y, m - 1, d);
  target.setHours(23, 59, 59, 999);
  return Math.ceil((target.getTime() - Date.now()) / 86400000);
}

// The capitals the prototype falls back to when a conference lists a country but no city.
const CAPITALS: Record<string, string> = {
  Afghanistan: "Kabul", Albania: "Tirana", Algeria: "Algiers", Andorra: "Andorra la Vella", Angola: "Luanda",
  "Antigua and Barbuda": "St. John's", Argentina: "Buenos Aires", Armenia: "Yerevan", Australia: "Canberra", Austria: "Vienna",
  Azerbaijan: "Baku", Bahamas: "Nassau", Bahrain: "Manama", Bangladesh: "Dhaka", Barbados: "Bridgetown",
  Belarus: "Minsk", Belgium: "Brussels", Belize: "Belmopan", Benin: "Porto-Novo", Bhutan: "Thimphu",
  Bolivia: "Sucre", "Bosnia and Herzegovina": "Sarajevo", Botswana: "Gaborone", Brazil: "Brasília", Brunei: "Bandar Seri Begawan",
  Bulgaria: "Sofia", "Burkina Faso": "Ouagadougou", Burundi: "Gitega", "Cabo Verde": "Praia", Cambodia: "Phnom Penh",
  Cameroon: "Yaoundé", Canada: "Ottawa", "Central African Republic": "Bangui", Chad: "N'Djamena", Chile: "Santiago",
  China: "Beijing", Colombia: "Bogotá", Comoros: "Moroni", "Congo (Republic of the)": "Brazzaville", "Congo (DR)": "Kinshasa",
  "Costa Rica": "San José", Croatia: "Zagreb", Cuba: "Havana", Cyprus: "Nicosia", Czechia: "Prague",
  India: "New Delhi", "United States": "Washington, D.C.", "United Kingdom": "London", Singapore: "Singapore",
};
export const cityOf = (c: { city: string; country: string }) => c.city || CAPITALS[c.country] || "";

/** "Submissions close 31 Oct · 26 days left" while open, "Submissions closed 31 Oct" after; null without a date. */
export function deadlineFrom(date: string, finished: boolean, label = "Submissions close", closedLabel = "Submissions closed"): { open: boolean; text: string } | null {
  const d = new Date(date);
  if (!date || Number.isNaN(d.getTime())) return null;
  const left = Math.ceil((new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59).getTime() - Date.now()) / 86400000);
  const day = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return left >= 0 && !finished ? { open: true, text: `${label} ${day} · ${left} day${left === 1 ? "" : "s"} left` } : { open: false, text: `${closedLabel} ${day}` };
}

/* "Add to calendar": a one-event .ics file. Times are local wall-clock (no time zone), which is what a conference date
   means. `remindDays` adds a calendar reminder that many days before (at 9:00 for an all-day event). */
export interface IcsEvent { title: string; date: string; endDate?: string; location: string; description: string; remindDays?: number }

export function downloadIcs(events: IcsEvent | IcsEvent[], filename: string): void {
  const stamp = (iso: string) => iso.replaceAll("-", "");
  const esc = (s: string) => String(s || "").replace(/[\\,;]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
  const list = Array.isArray(events) ? events : [events];
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//SmartConferU//Author//EN"];
  list.forEach(({ title, date, endDate, location, description, remindDays }, i) => {
    lines.push(
      "BEGIN:VEVENT", `UID:${Date.now()}-${i}@smartconferu`,
      `DTSTART;VALUE=DATE:${stamp(date)}`, `DTEND;VALUE=DATE:${stamp(shiftIsoDate(endDate || date, 1))}`,
      `SUMMARY:${esc(title)}`, `LOCATION:${esc(location)}`, `DESCRIPTION:${esc(description)}`,
    );
    if (remindDays) {
      // All-day events start at midnight, so step back to 9:00 that morning (−2 days → −1 day 15 h).
      lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `TRIGGER:-P${remindDays - 1}DT15H`, `DESCRIPTION:${esc(`${title} — in ${remindDays} day${remindDays === 1 ? "" : "s"}`)}`, "END:VALARM");
    }
    lines.push("END:VEVENT");
  });
  lines.push("END:VCALENDAR");
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
