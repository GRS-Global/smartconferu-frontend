import { api, publicFileUrl } from "@/lib/api-client";
import type { Affiliation, EmailSlot, PastAffiliation, Profile, ProfilePatch, TimelineEntry, VerificationRequest } from "@/types/profile";
import { ServiceError } from "../errors";
import type { ProfileService } from "../profile";

/* The profile through the own backend: `GET /me` and `PATCH /me` (Backend/src/modules/users). Same shape as the Supabase version —
   a few columns (firstName, lastName, designation, affiliation, country, orcidId, photoPath) plus one private JSON blob
   (`details`) that holds everything else, so the Profile type and every screen stay exactly as they are. The blob is replaced
   as a whole by the backend, so a save merges into what is stored first. */

/** `GET /me` / `PATCH /me`. */
interface MeResponse {
  id: string;
  email: string | null;
  hasPassword?: boolean;
  firstName: string;
  lastName: string;
  designation: string | null;
  affiliation: string | null;
  country: string | null;
  orcidId: string | null;
  photoPath: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

/** The row shape the shared mapping below was written for. */
interface ProfileRow {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  designation: string | null;
  affiliation: string | null;
  country: string | null;
  orcid_id: string | null;
  photo_path: string | null;
  created_at: string | null;
}

type Data = Record<string, unknown>;

const str = (v: unknown) => (typeof v === "string" ? v : "");
const bool = (v: unknown) => v === true;
const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const affiliations = (v: unknown): Affiliation[] => (Array.isArray(v) ? (v as Affiliation[]) : []);

const rec = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const flags = (v: unknown): Record<string, boolean> => Object.fromEntries(Object.entries(rec(v)).filter(([, x]) => x === true).map(([k]) => [k, true]));

function timeline(v: unknown): TimelineEntry[] {
  if (!Array.isArray(v)) return [];
  // Entries keep every key they were saved with (member numbers, links …), so saving never drops what this app doesn't edit.
  return v.map(rec).filter((x) => ["experience", "education", "membership"].includes(str(x.type))).map((x, i) => ({
    ...x, id: String(x.id ?? i), type: str(x.type) as TimelineEntry["type"], title: str(x.title), org: str(x.org),
    startMonth: str(x.startMonth), startYear: str(x.startYear), endMonth: str(x.endMonth), endYear: str(x.endYear),
    current: x.current === true, period: str(x.period), societyId: str(x.societyId), verification: str(x.verification), gradePending: x.gradePending === true,
  }));
}

function pastAffiliations(v: unknown): PastAffiliation[] {
  if (!Array.isArray(v)) return [];
  return v.map(rec).map((x, i) => ({
    ...x, id: String(x.id ?? i), institution: str(x.institution), relationship: str(x.relationship), department: str(x.department), location: str(x.location),
    startMonth: str(x.startMonth), startYear: str(x.startYear), endMonth: str(x.endMonth), endYear: str(x.endYear),
  }));
}

function emails(v: unknown): Profile["emails"] {
  const e = rec(v);
  if (!e.personal && !e.professional) return null;
  const slot = (x: unknown): EmailSlot => ({ value: str(rec(x).value), status: str(rec(x).status) });
  return { personal: slot(e.personal), professional: slot(e.professional) };
}

function requests(v: unknown): Record<string, VerificationRequest> {
  const out: Record<string, VerificationRequest> = {};
  for (const [k, raw] of Object.entries(rec(v))) {
    const r = rec(raw);
    if (r.status === "pending" || r.status === "declined") out[k] = { status: r.status, requestedAt: str(r.requestedAt), note: str(r.note), reason: str(r.reason) };
  }
  return out;
}

function toProfile(row: ProfileRow, d: Data): Profile {
  return {
    userId: row.id,
    mainEmail: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    designation: row.designation ?? "",
    affiliation: row.affiliation ?? "",
    country: row.country ?? "",
    orcidId: row.orcid_id ?? "",
    photo: row.photo_path ? (row.photo_path.split("/").pop() ?? "") : "",
    photoUrl: publicFileUrl(row.photo_path),
    gender: str(d.gender),
    phone: str(d.phone),
    webPage: str(d.webPage),
    notifyChannels: strs(d.notifyChannels),
    affiliations: affiliations(d.affiliations),
    affiliationInstitutionId: typeof d.affiliationInstitutionId === "string" ? d.affiliationInstitutionId : null,
    affiliationPending: bool(d.affiliationPending),
    affiliationDepartment: str(d.affiliationDepartment),
    affiliationLocation: str(d.affiliationLocation),
    affiliationStartMonth: str(d.affiliationStartMonth),
    affiliationStartYear: str(d.affiliationStartYear),
    bio: str(d.bio),
    researchInterests: strs(d.researchInterests),
    addressLine1: str(d.addressLine1),
    addressLine2: str(d.addressLine2),
    city: str(d.city),
    postCode: str(d.postCode),
    state: str(d.state),
    researchGateUrl: str(d.researchGateUrl),
    dblpUrl: str(d.dblpUrl),
    googleScholarUrl: str(d.googleScholarUrl),
    scopusId: str(d.scopusId),
    openAlexUrl: str(d.openAlexUrl),
    linkedinUrl: str(d.linkedinUrl),
    youtubeUrl: str(d.youtubeUrl),
    facebookUrl: str(d.facebookUrl),
    twitterUrl: str(d.twitterUrl),
    githubUrl: str(d.githubUrl),
    scholarNone: bool(d.scholarNone),
    professionalNone: bool(d.professionalNone),
    notifyFrequency: str(d.notifyFrequency) || "instant",
    timezone: str(d.timezone),
    colorBlindMode: bool(d.colorBlindMode),
    timeline: timeline(d.timeline),
    pastAffiliations: pastAffiliations(d.pastAffiliations),
    memberSince: str(d.memberSince) || (row.created_at ? String(new Date(row.created_at).getFullYear()) : ""),
    emails: emails(d.emails),
    primaryEmail: str(d.primaryEmail),
    phoneStatus: str(d.phoneStatus),
    primaryArea: str(d.primaryArea),
    secondaryAreas: strs(d.secondaryAreas),
    avatarStyle: str(d.avatarStyle),
    verifiedProfiles: flags(d.verifiedProfiles),
    confirmedProfiles: flags(d.confirmedProfiles),
    verificationRequests: requests(d.verificationRequests),
    primaryAreaPending: bool(d.primaryAreaPending),
    pendingSecondaryAreas: strs(d.pendingSecondaryAreas),
    publicProfileEnabled: bool(d.publicProfileEnabled),
    showReviewerAchievements: bool(d.showReviewerAchievements),
  };
}


const fromMe = (me: MeResponse): Profile => ({ ...toProfile({
  id: me.id, email: me.email ?? "", first_name: me.firstName, last_name: me.lastName, designation: me.designation,
  affiliation: me.affiliation, country: me.country, orcid_id: me.orcidId, photo_path: me.photoPath, created_at: me.createdAt,
}, me.details ?? {}), hasPassword: me.hasPassword });

const COLUMNS = ["firstName", "lastName", "designation", "affiliation", "country", "orcidId", "photoPath"] as const;

async function save(patch: ProfilePatch): Promise<Profile> {
  const body: Record<string, unknown> = {};
  const details: Data = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if ((COLUMNS as readonly string[]).includes(key)) body[key] = key === "photoPath" ? value : String(value ?? "").trim();
    else details[key] = value;
  }
  if (Object.keys(details).length) {
    // Merge into what is stored: the blob also holds data this app doesn't edit (experience, education, …).
    const current = await api<MeResponse>("/me");
    body.details = { ...(current.details ?? {}), ...details };
  }
  return fromMe(await api<MeResponse>("/me", { method: "PATCH", body }));
}

async function uploadPhoto(photo: Blob): Promise<string> {
  const type = photo.type || "image/jpeg";
  if (!/^image\/(png|jpeg|webp)$/.test(type)) throw new ServiceError("Only PNG, JPEG or WebP photos can be uploaded.");
  if (photo.size > 5 * 1024 * 1024) throw new ServiceError("That photo is too large — the limit is 5 MB.");
  const form = new FormData();
  form.append("file", photo, "photo");
  return (await api<{ path: string }>("/files", { method: "POST", query: { purpose: "profile_photo" }, body: form })).path;
}

export const apiProfileService: ProfileService = {
  async load() { return fromMe(await api<MeResponse>("/me")); },
  save,
  uploadPhoto,
  // Public profiles (/author/<slug>) have no backend endpoint yet: they read as "no public profile".
  async loadPublic() { return null; },
};
