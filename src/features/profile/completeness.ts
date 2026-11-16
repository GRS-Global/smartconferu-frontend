import { PROFESSIONAL_LINK_KEYS, SCHOLAR_LINK_KEYS, type Profile } from "@/types/profile";

/* Profile completeness: one score used by the header pill, the Complete Profile step and My Profile.
   Ported from the prototype's getProfileCompleteness (author-journey.jsx). It is built per tab: each tab's
   items give that tab its own %, and the overall score weights the tabs. SIGNUP_REQUIRED are the details
   sign-up / Complete Profile insist on; OPTIONAL are the rest. */

export type ProfileTab = "general" | "scholar" | "professional" | "contact";

const SECTION_WEIGHTS: Record<ProfileTab, number> = { general: 50, scholar: 15, professional: 15, contact: 20 };

interface Item {
  key: string;
  label: string;
  tab: ProfileTab;
  /** Any one of these fields counts (the link tabs). */
  anyOf?: readonly string[];
  /** Ticking "I don't have any … profile for now" counts too. */
  optOut?: string;
}

export const REQUIRED_ITEMS: Item[] = [
  { key: "firstName", label: "first name", tab: "general" },
  { key: "lastName", label: "last name", tab: "general" },
  { key: "mainEmail", label: "email", tab: "contact" },
  { key: "affiliation", label: "affiliation", tab: "general" },
  { key: "designation", label: "designation", tab: "general" },
  { key: "country", label: "country", tab: "general" },
  { key: "gender", label: "gender", tab: "general" },
];

export const OPTIONAL_ITEMS: Item[] = [
  { key: "photo", label: "profile photo", tab: "general" },
  { key: "webPage", label: "web page", tab: "general" },
  { key: "phone", label: "phone number", tab: "general" },
  { key: "addressLine1", label: "address", tab: "contact" },
  { key: "city", label: "city", tab: "contact" },
  { key: "postCode", label: "post code", tab: "contact" },
  // One answer each for the two link tabs: any single link, or ticking the opt-out, counts, so ten URL fields don't swamp the score.
  { key: "scholarProfiles", label: "scholar profile", tab: "scholar", anyOf: ["orcidId", ...SCHOLAR_LINK_KEYS], optOut: "scholarNone" },
  { key: "professionalProfiles", label: "professional profile", tab: "professional", anyOf: PROFESSIONAL_LINK_KEYS, optOut: "professionalNone" },
];

export interface Completeness {
  percent: number;
  sections: Record<ProfileTab, { done: number; total: number; percent: number }>;
  missingRequired: Item[];
  missingOptional: Item[];
}

type Bag = Readonly<Record<string, unknown>>;

export function getProfileCompleteness(profile: Bag): Completeness {
  const filled = (key: string) => String(profile[key] ?? "").trim() !== "";
  const done = (f: Item) => Boolean(f.optOut && profile[f.optOut]) || (f.anyOf ? f.anyOf.some(filled) : filled(f.key));
  const all = [...REQUIRED_ITEMS, ...OPTIONAL_ITEMS];

  const sections = {} as Completeness["sections"];
  let percent = 0;
  (Object.entries(SECTION_WEIGHTS) as Array<[ProfileTab, number]>).forEach(([id, weight]) => {
    const items = all.filter((f) => f.tab === id);
    const doneCount = items.filter(done).length;
    sections[id] = { done: doneCount, total: items.length, percent: Math.round((doneCount / items.length) * 100) };
    percent += (weight * doneCount) / items.length;
  });

  return {
    percent: Math.round(percent),
    sections,
    missingRequired: REQUIRED_ITEMS.filter((f) => !done(f)),
    missingOptional: OPTIONAL_ITEMS.filter((f) => !done(f)),
  };
}

/** True when every sign-up-required detail is present. */
export const isProfileComplete = (profile: Profile): boolean => getProfileCompleteness(profile).missingRequired.length === 0;
