import type { LinkKey, Profile } from "@/types/profile";

export const GENDER_OPTIONS = ["Male", "Female", "Non-binary", "Prefer not to say"];

export const NOTIFY_CHANNELS = [
  { key: "sms", label: "SMS" },
  { key: "whatsapp", label: "WhatsApp" },
];

export const PROFILE_BIO_MAX = 1000;
export const PROFILE_INTERESTS_MAX = 10;

export interface LinkField {
  key: LinkKey;
  label: string;
  placeholder: string;
  /** Turns a bare ID into a link; everything else is entered as a full URL. */
  hrefFor?: (v: string) => string;
  /** The platform has a sign-in the prototype's "Connect" simulates; this app can't verify through it (see ConnectDialog). */
  signIn?: string;
}

/* The Scholar / Professional profile links (the prototype's SCHOLAR_PROFILE_FIELDS / PROFESSIONAL_PROFILE_FIELDS).
   Find searches ORCID and OpenAlex for real; Connect (sign-in) is simulated in the prototype and not available here. */
export const SCHOLAR_FIELDS: LinkField[] = [
  { key: "orcidId", label: "ORCID iD", placeholder: "0000-0000-0000-0000", hrefFor: (v) => `https://orcid.org/${v}` },
  { key: "researchGateUrl", label: "ResearchGate", placeholder: "Paste your ResearchGate profile link" },
  { key: "dblpUrl", label: "DBLP", placeholder: "https://dblp.org/pid/…" },
  { key: "googleScholarUrl", label: "Google Scholar", placeholder: "Paste your Google Scholar profile link" },
  { key: "scopusId", label: "Scopus Author ID", placeholder: "Paste your Scopus Author ID, e.g. 57193456789", hrefFor: (v) => `https://www.scopus.com/authid/detail.uri?authorId=${v}` },
  { key: "openAlexUrl", label: "OpenAlex", placeholder: "https://openalex.org/authors/A5023888391" },
];

export const PROFESSIONAL_FIELDS: LinkField[] = [
  { key: "linkedinUrl", label: "LinkedIn", placeholder: "https://www.linkedin.com/in/…", signIn: "LinkedIn" },
  { key: "youtubeUrl", label: "YouTube Channel", placeholder: "https://www.youtube.com/@…", signIn: "Google (YouTube)" },
  { key: "facebookUrl", label: "Facebook", placeholder: "https://www.facebook.com/…", signIn: "Facebook" },
  { key: "twitterUrl", label: "X (Twitter)", placeholder: "https://x.com/…", signIn: "X" },
  { key: "githubUrl", label: "GitHub", placeholder: "https://github.com/…", signIn: "GitHub" },
];

/** A pasted link or ID → what the field stores (ORCID iD / Scopus author ID out of a full address). */
export function normalizePastedProfile(key: LinkKey, raw: string): string {
  const v = String(raw ?? "").trim();
  if (key === "orcidId") return (v.match(/\d{4}-\d{4}-\d{4}-\d{3}[\dX]/i) ?? [v])[0].toUpperCase();
  if (key === "scopusId") return (v.match(/authorId=(\d+)/i)?.[1] ?? v.match(/^(\d{6,})$/)?.[1] ?? v);
  return v;
}

export function profileLinkHref(field: LinkField, value: string): string {
  const v = String(value || "").trim();
  if (/^https?:\/\//i.test(v)) return v;
  if (field.hrefFor) return field.hrefFor(encodeURIComponent(v));
  return `https://${v.replace(/^[a-z]+:/i, "")}`;
}

/** A link that's removed or changed loses every trust marker: Verified, Confirmed by you, and any open verification request. */
export function clearLinkTrust(p: Pick<Profile, "verifiedProfiles" | "confirmedProfiles" | "verificationRequests">, keys: string[]): Pick<Profile, "verifiedProfiles" | "confirmedProfiles" | "verificationRequests"> {
  const verifiedProfiles = { ...p.verifiedProfiles };
  const confirmedProfiles = { ...p.confirmedProfiles };
  const verificationRequests = { ...p.verificationRequests };
  keys.forEach((k) => { delete verifiedProfiles[k]; delete confirmedProfiles[k]; delete verificationRequests[k]; });
  return { verifiedProfiles, confirmedProfiles, verificationRequests };
}
