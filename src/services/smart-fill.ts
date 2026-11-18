import { api } from "@/lib/api-client";
import { DATA_SOURCE } from "@/lib/config";
import { COUNTRIES } from "@/lib/country-codes";
import { RESEARCH_AREAS, RESEARCH_SUBAREAS } from "@/lib/research-areas";
import { TIMEZONE_OPTIONS } from "@/lib/timezones";
import { countryTimezone } from "@/components/ui/timezone-select";
import type { NewConferenceInput } from "@/types/conference-request";
import { ServiceError } from "./errors";

/* "Smart Fill" on Create Conference (the prototype's Smart Fill): the backend reads the conference's website and has an AI fill the form
   (`POST /ai/conference-from-website`, Backend/src/modules/ai/website). Nothing is saved there; this only turns what came back into form
   values the form can use. Anything the form could not show correctly (a country that is not in its list, an area that is not in its
   taxonomy, a date that is not a date) is dropped rather than guessed, so the person fills that one by hand. Only with the own backend. */

/** Whether this build can read a website for the form. */
export const SMART_FILL_AVAILABLE = DATA_SOURCE === "api";

const ABOUT_MAX_WORDS = 1200;
const ABOUT_MAX_CHARS = 12000;

interface FromWebsiteResponse { fields: Record<string, string | undefined>; source: string }

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const validDay = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));

/** "+05:30" -> the form's timezone label ("India | GMT +05:30"): the one in that country if there is one, else the only one with that offset. */
function timezoneOf(utcOffset: string, country: string): string {
  const m = /^([+-])(\d{2}):?(\d{2})$/.exec(utcOffset);
  if (m) {
    const minutes = (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
    const same = TIMEZONE_OPTIONS.filter((o) => o.offset === minutes);
    const inCountry = same.find((o) => o.country === country);
    if (inCountry) return inCountry.label;
    if (same.length === 1) return same[0].label;
  }
  return country ? countryTimezone(country) : "";
}

/** Cuts the write-up to the form's word limit (at a word boundary). */
function limitWords(s: string): string {
  const parts = s.split(/(\s+)/);
  let count = 0;
  let out = "";
  for (const p of parts) {
    if (/\S/.test(p)) { count += 1; if (count > ABOUT_MAX_WORDS) break; }
    out += p;
  }
  return out.trim().slice(0, ABOUT_MAX_CHARS);
}

export interface SmartFillResult {
  /** Only the fields the website told us about and the form can take. */
  values: Partial<NewConferenceInput>;
  /** The address that was read. */
  source: string;
}

export async function fillConferenceFromWebsite(url: string): Promise<SmartFillResult> {
  if (!SMART_FILL_AVAILABLE) throw new ServiceError("Reading a website isn't available here.");
  const { fields: f, source } = await api<FromWebsiteResponse>("/ai/conference-from-website", { method: "POST", body: { url: url.trim() } });
  const values: Partial<NewConferenceInput> = {};
  const put = <K extends keyof NewConferenceInput>(key: K, value: NewConferenceInput[K] | "") => { if (value !== "") values[key] = value as NewConferenceInput[K]; };

  put("title", text(f.title));
  put("acronym", text(f.acronym));
  const type = text(f.type);
  if (["conference", "book", "journal_special", "journal", "other"].includes(type)) put("type", type);
  if (type === "other") put("typeInfo", text(f.typeInfo));
  const eventType = text(f.eventType);
  if (eventType === "in-person" || eventType === "virtual" || eventType === "hybrid") put("eventType", eventType);
  const start = text(f.startDate), end = text(f.endDate);
  if (validDay(start)) put("startDate", start);
  if (validDay(end) && (!validDay(start) || end >= start)) put("endDate", end);
  put("venue", text(f.venue));
  put("address", text(f.address));
  put("city", text(f.city));
  put("state", text(f.state));
  put("postalCode", text(f.postalCode));
  const country = text(f.country);
  if (country && (COUNTRIES as readonly string[]).includes(country)) put("country", country);
  put("timezone", timezoneOf(text(f.utcOffset), values.country ?? ""));
  put("contactEmail", text(f.supportEmail));
  const about = text(f.about);
  if (about) put("about", limitWords(about));
  const primary = text(f.primaryArea);
  if (RESEARCH_AREAS.includes(primary)) {
    put("primaryArea", primary);
    const secondary = text(f.secondaryArea);
    if ((RESEARCH_SUBAREAS[primary] ?? []).includes(secondary)) put("secondaryArea", secondary);
  }
  return { values, source };
}
