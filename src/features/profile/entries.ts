import { SOCIETIES, type Society } from "@/lib/societies";
import type { TimelineEntry } from "@/types/profile";
import { MEMBERSHIP_OTHER, membershipSociety } from "./showcase/helpers";

/* Rules behind the Experience / Education / Memberships and Affiliations editors, ported from the prototype
   (PROFILE_MONTHS, entryError, membershipEntryError, similarSocieties, shared/profileLists.js). The Super Admin's
   additions to the grade / relationship lists are not applied: that module is on hold. */

export const PROFILE_OTHER = "__other__";
export const PROFILE_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const PROFILE_MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const profileYears = (now = new Date()): string[] => Array.from({ length: now.getFullYear() - 1959 }, (_, i) => String(now.getFullYear() - i));

export const MEMBERSHIP_GRADES = [
  "Student Member", "Graduate Student Member", "Associate Member", "Affiliate Member", "Member",
  "Professional Member", "Senior Member", "Life Member", "Fellow", "Life Fellow", "Distinguished Member", "Honorary Member",
];
export const AFFILIATION_TYPES = ["Full-time", "Joint appointment", "Adjunct", "Visiting", "Honorary", "Emeritus"];

const normalizeListName = (s: string) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
/** A listed name that matches what was typed (case, spaces and punctuation ignored). */
export const findListName = (names: string[], typed: string): string | null => names.find((n) => normalizeListName(n) === normalizeListName(typed)) ?? null;

const monthIndex = (month: string, year: string) => Number(year) * 12 + (month ? PROFILE_MONTHS.indexOf(month) : 0);
export const entryMonthIndex = monthIndex;

export type EntryDraft = Omit<TimelineEntry, "id" | "type" | "period" | "societyId" | "verification" | "gradePending"> & Partial<Pick<TimelineEntry, "societyId" | "verification" | "gradePending" | "period">>;

export const blankEntry = (): EntryDraft => ({ title: "", org: "", startMonth: "", startYear: "", endMonth: "", endYear: "", current: false });

type DateFields = { title: string; org: string; startMonth: string; startYear: string; endMonth: string; endYear: string; current: boolean };

export function entryError(x: DateFields): string {
  if (!String(x.title || "").trim() || !String(x.org || "").trim()) return "Fill in both fields above.";
  if (!x.startYear) return "Pick a start year.";
  if (!x.current && !x.endYear) return "Pick an end year, or tick the box if it is ongoing.";
  if (!x.current && monthIndex(x.endMonth, x.endYear) < monthIndex(x.startMonth, x.startYear)) return "End date can't be before the start date.";
  return "";
}

const URL_RX = /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i;

export function membershipEntryError(x: DateFields & Pick<TimelineEntry, "societyId" | "memberUrl" | "societyUrl">): string {
  const other = x.societyId === MEMBERSHIP_OTHER;
  if (!other && !membershipSociety(x)) return "Choose your society, or pick “Other” if it isn't listed.";
  if (other && !String(x.org || "").trim()) return "Enter the society's name.";
  if (other && !URL_RX.test(String(x.societyUrl || "").trim())) return "Add the society's website so our team can verify it.";
  if (!String(x.title || "").trim()) return "Add your membership grade.";
  if (x.memberUrl && !URL_RX.test(String(x.memberUrl).trim())) return "Membership URL should be a web link, e.g. https://…";
  return entryError(x);
}

const societyKey = (s: string) => String(s || "").toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
/** Catalogue societies that look like what was typed under "Other" (same acronym, or one name contains the other). Up to 3. */
export function similarSocieties(typed: string): Society[] {
  const t = societyKey(typed);
  if (t.length < 3) return [];
  const compact = t.replace(/ /g, "");
  return SOCIETIES.filter((s) => {
    const name = societyKey(s.name);
    const acr = societyKey(s.acronym).replace(/ /g, "");
    return compact === acr || name.includes(t) || t.includes(name) || t.split(" ").includes(acr);
  }).slice(0, 3);
}

export const newEntryId = () => `e-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
