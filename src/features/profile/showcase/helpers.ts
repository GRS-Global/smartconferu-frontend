import { SOCIETIES, type Society } from "@/lib/societies";
import type { PastAffiliation, Profile, TimelineEntry } from "@/types/profile";

/* Display helpers for the My Profile showcase, ported from the prototype (author-journey.jsx):
   withEntryDates, formatEntryPeriod, entryDuration, orgMonogram, membershipSociety, profileEmails … */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const PERIOD_RX = /^(?:([A-Z][a-z]{2}) )?(\d{4})\s*[–-]\s*(?:(Present)|(?:([A-Z][a-z]{2}) )?(\d{4}))$/;

/** Older entries only carry their period as text ("Jul 2018 – Jun 2022"): split it into month/year fields. */
export function withEntryDates(x: TimelineEntry): TimelineEntry {
  if (x.startYear) return x;
  const m = PERIOD_RX.exec(x.period.trim());
  return m ? { ...x, startMonth: m[1] || "", startYear: m[2], current: Boolean(m[3]), endMonth: m[4] || "", endYear: m[5] || "" } : x;
}

export function formatEntryPeriod(x: Pick<TimelineEntry, "startMonth" | "startYear" | "endMonth" | "endYear" | "current" | "period">): string {
  if (!x.startYear) return x.period || "";
  const start = [x.startMonth, x.startYear].filter(Boolean).join(" ");
  const end = x.current ? "Present" : [x.endMonth, x.endYear].filter(Boolean).join(" ");
  return end ? `${start} – ${end}` : start;
}

const monthIndex = (month: string, year: string) => Number(year) * 12 + (month ? MONTHS.indexOf(month) : 0);

/** How long something ran (to this month when current) as "3 yrs 4 mos" — both ends count; without months, whole years. */
export function entryDuration(x: { startMonth: string; startYear: string; endMonth: string; endYear: string; current?: boolean }, now = new Date()): string {
  if (!x.startYear) return "";
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const endYear = x.current ? now.getFullYear() : Number(x.endYear);
  if (!endYear) return "";
  const endMonth = x.current ? MONTHS[now.getMonth()] : x.endMonth;
  if (!x.startMonth || !endMonth) {
    const years = endYear - Number(x.startYear);
    return years > 0 ? plural(years, "yr") : "";
  }
  const months = monthIndex(endMonth, String(endYear)) - monthIndex(x.startMonth, x.startYear) + 1;
  if (months <= 0) return "";
  const y = Math.floor(months / 12);
  const m = months % 12;
  return [y ? plural(y, "yr") : "", m ? plural(m, "mo") : ""].filter(Boolean).join(" ");
}

export const pastAffiliationPeriod = (a: PastAffiliation): string =>
  [[a.startMonth, a.startYear].filter(Boolean).join(" "), [a.endMonth, a.endYear].filter(Boolean).join(" ")].filter(Boolean).join(" – ");

export const affiliationPeriod = (a: { startMonth: string; startYear: string }): string =>
  a.startYear ? `${[a.startMonth, a.startYear].filter(Boolean).join(" ")} – Present` : "";

/** "Visiting" / "Adjunct" read on their own; "Full-time" is the default and goes unsaid. */
export const affiliationRelationshipLabel = (a: { relationship: string }): string => (a.relationship && a.relationship !== "Full-time" ? a.relationship : "");

const MONOGRAM_SKIP = new Set(["of", "for", "the", "and", "in", "on", "&"]);
/** A short acronym is shown as-is; otherwise word initials. */
export function orgMonogram(org: string): string {
  const name = String(org || "").trim();
  if (/^[A-Z0-9]{2,4}$/.test(name)) return name;
  const words = name.split(/[\s\-–]+/).filter((w) => w && !MONOGRAM_SKIP.has(w.toLowerCase()));
  if (words.length === 1 && /^[A-Z0-9]{2,4}$/.test(words[0])) return words[0];
  return words.slice(0, 3).map((w) => w[0].toUpperCase()).join("") || "?";
}

export const MEMBERSHIP_OTHER = "other";

/** The catalogue society behind a membership: by id, or (older free-text entries) by its name or acronym. */
export function membershipSociety(entry: Pick<TimelineEntry, "societyId" | "org">): Society | null {
  if (entry.societyId === MEMBERSHIP_OTHER) return null;
  if (entry.societyId) return SOCIETIES.find((s) => s.id === entry.societyId) ?? null;
  const parts = entry.org.split(/[()]/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  return SOCIETIES.find((s) => parts.some((p) => p === s.name.toLowerCase() || p === s.acronym.toLowerCase())) ?? null;
}

/** An "Other" society still waiting for the Super Admin to verify it stays out of the header chips. */
export const membershipPending = (entry: Pick<TimelineEntry, "societyId" | "verification">): boolean =>
  entry.societyId === MEMBERSHIP_OTHER && entry.verification !== "approved" && entry.verification !== "rejected";

/** The two email slots; an account that never saved any has its account email as the verified personal one. */
export function profileEmails(p: Pick<Profile, "emails" | "primaryEmail" | "mainEmail">) {
  const emails = p.emails ?? { personal: { value: p.mainEmail, status: p.mainEmail ? "verified" : "" }, professional: { value: "", status: "" } };
  const primary: "personal" | "professional" = p.primaryEmail === "professional" && emails.professional.value ? "professional" : "personal";
  return { emails, primaryEmail: primary };
}

export const formatLocation = (p: Pick<Profile, "affiliationLocation" | "city" | "state" | "country">): string =>
  p.affiliationLocation || [p.city, p.state, p.country].filter(Boolean).join(", ");
