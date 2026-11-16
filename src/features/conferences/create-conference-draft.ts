import { normalizeResearchArea, RESEARCH_AREAS, RESEARCH_SUBAREAS } from "@/lib/research-areas";
import { EMPTY_NEW_CONFERENCE, type NewConferenceInput } from "@/types/conference-request";

/* The unfinished Create Conference form, kept in this browser only so a refresh or a stray click does not lose it. Same storage as the
   prototype (author-journey.jsx: CC_DRAFT_KEY, readCreateConferenceDraft, writeCreateConferenceDraft, clearCreateConferenceDraft, draftAge):
   one local-storage entry, `{ form, savedAt }`. Nothing is sent anywhere; there is no database table behind it. */

export const CC_DRAFT_KEY = "grs_create_conference_draft";

/** The form as saved: every field of the form plus the policy tick (the prototype keeps it inside the form as `confirmPolicy`).
 *  The prototype's form also holds street number / name and the map position (lat / lng); this app has no map picker yet, so those
 *  are not part of the form here (a prototype draft that carries them still restores: the extra keys are ignored). */
export type DraftForm = NewConferenceInput & { confirmPolicy: boolean };
export const BLANK_DRAFT_FORM: DraftForm = { ...EMPTY_NEW_CONFERENCE, confirmPolicy: false };

export interface SavedDraft { form: DraftForm; savedAt: number }

/** Only worth offering if something real was typed, not just a card clicked (the prototype's list). */
const MEANINGFUL_KEYS: Array<keyof NewConferenceInput> = ["title", "acronym", "city", "contactEmail", "startDate", "endDate", "venue", "webPage", "about", "primaryArea"];

/** The saved draft, or null when there is none worth offering (or storage is blocked / the entry is unreadable). */
export function readDraft(): SavedDraft | null {
  try {
    const d = JSON.parse(window.localStorage.getItem(CC_DRAFT_KEY) || "null") as { form?: Partial<DraftForm>; savedAt?: number } | null;
    if (!d?.form) return null;
    const saved = d.form as Record<string, unknown>;
    if (!MEANINGFUL_KEYS.some((k) => String(saved[k] ?? "").trim())) return null;
    // Only the fields this form has are taken; anything else in the entry is ignored. Every text field is a string, the tick a boolean.
    const form: DraftForm = { ...BLANK_DRAFT_FORM };
    for (const key of Object.keys(BLANK_DRAFT_FORM) as Array<keyof DraftForm>) {
      if (!(key in saved)) continue;
      const v = saved[key];
      if (key === "confirmPolicy") form.confirmPolicy = Boolean(v);
      else if (typeof v === "string") (form as unknown as Record<string, string>)[key] = v;
    }
    // Drafts saved before the research-area taxonomy changed: map old primary names across, and drop a secondary area that no longer
    // sits under that primary.
    if (form.primaryArea) {
      const primaryArea = normalizeResearchArea(form.primaryArea);
      const secondaryArea = (RESEARCH_SUBAREAS[primaryArea] || []).includes(form.secondaryArea) ? form.secondaryArea : "";
      form.primaryArea = RESEARCH_AREAS.includes(primaryArea) ? primaryArea : "";
      form.secondaryArea = form.primaryArea ? secondaryArea : "";
    }
    return { form, savedAt: typeof d.savedAt === "number" ? d.savedAt : 0 };
  } catch {
    return null;
  }
}

export function writeDraft(form: DraftForm): void {
  try { window.localStorage.setItem(CC_DRAFT_KEY, JSON.stringify({ form, savedAt: Date.now() })); } catch { /* storage blocked */ }
}

export function clearDraft(): void {
  try { window.localStorage.removeItem(CC_DRAFT_KEY); } catch { /* storage blocked */ }
}

/** "a moment ago" / "5 min ago" / "3 hours ago" / "2 days ago". */
export function draftAge(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60000);
  if (!ts || mins < 1) return "a moment ago";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? "s" : ""} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}
