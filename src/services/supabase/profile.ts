import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import type { Affiliation, EmailSlot, PastAffiliation, Profile, ProfilePatch, TimelineEntry, VerificationRequest } from "@/types/profile";
import { friendlyAuthError } from "../auth";
import { ServiceError } from "../errors";
import type { ProfileService } from "../profile";
import { currentUser, fail } from "./shared";

/* The profile, exactly as the prototype stores it (src/data/auth.js): a few columns on `profiles`
   (first_name, last_name, designation, affiliation, country, orcid_id, photo_path — the only ones the
   browser may write, see the column grants in 0001_core_schema.sql) and everything else as one JSON blob
   in `profile_details.data` (owner-only). The photo goes to the public `public` bucket under the user's
   own folder. Nothing here adds tables, columns or policies. */

const PHOTO_BUCKET = "public";

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

function photoUrl(db: SupabaseClient, path: string | null): string {
  return path ? db.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl : "";
}

function toProfile(db: SupabaseClient, row: ProfileRow, d: Data): Profile {
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
    photoUrl: photoUrl(db, row.photo_path),
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

async function fetchProfile(db: SupabaseClient, userId: string): Promise<Profile> {
  const [{ data: row, error }, { data: details, error: detailsError }] = await Promise.all([
    db.from("profiles").select("id, email, first_name, last_name, designation, affiliation, country, orcid_id, photo_path, created_at").eq("id", userId).single(),
    db.from("profile_details").select("data").eq("user_id", userId).maybeSingle(),
  ]);
  if (error) fail(error, "read your profile");
  if (detailsError) fail(detailsError, "read your profile");
  return toProfile(db, row as ProfileRow, ((details as { data?: Data } | null)?.data ?? {}) as Data);
}

/* ---------- sign-up details (the prototype's applySignupDetails) ---------- */

/** Details asked for on Register that aren't columns on `profiles`; they wait in the sign-up metadata. */
const SIGNUP_DETAIL_KEYS = [
  "gender", "phone", "webPage", "notifyChannels",
  "affiliations", "affiliationInstitutionId", "affiliationPending", "affiliationDepartment",
];

/* Register sends everything as sign-up metadata, because when "Confirm email" is on there is no session yet to
   write the profile with. The first time a session exists, this copies it onto the profile rows and clears the
   `signup_pending` flag. Same field mapping and semantics as the prototype; it runs only when that flag is set
   and a failure is logged, not thrown: it is retried at the next load (the flag stays set).

   "Exactly once" is kept three ways: (1) loads that overlap (React Strict Mode, a reload) share one run per account;
   (2) the flag is cleared only after the profile rows were written, and a failure to clear it is not ignored; and
   (3) a retry (flag still set after a partial failure) only fills what is still empty, so it can never undo what the
   person edited in the meantime. On a new account every value is empty, so the first run copies everything. */
const signupRuns = new Map<string, Promise<void>>();

function applySignupDetails(db: SupabaseClient, user: User): Promise<void> {
  const meta = (user.user_metadata ?? {}) as Data;
  if (!meta.signup_pending) return Promise.resolve();
  const running = signupRuns.get(user.id);
  if (running) return running;
  const run = copySignupDetails(db, user, meta).finally(() => { signupRuns.delete(user.id); });
  signupRuns.set(user.id, run);
  return run;
}

const isBlank = (v: unknown) => v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);

async function copySignupDetails(db: SupabaseClient, user: User, meta: Data): Promise<void> {
  try {
    const { data: row, error: readError } = await db.from("profiles").select("affiliation, designation, country").eq("id", user.id).single();
    if (readError) throw readError;
    const stored = row as Record<string, unknown>;
    const columns: Record<string, string> = {};
    for (const key of ["affiliation", "designation", "country"]) {
      if (isBlank(stored[key]) && str(meta[key])) columns[key] = str(meta[key]);
    }
    if (Object.keys(columns).length) {
      const { error: profileError } = await db.from("profiles").update(columns).eq("id", user.id);
      if (profileError) throw profileError;
    }
    const { data: detailRow, error: detailsReadError } = await db.from("profile_details").select("data").eq("user_id", user.id).maybeSingle();
    if (detailsReadError) throw detailsReadError;
    const current = ((detailRow as { data?: Data } | null)?.data ?? {}) as Data;
    const next: Data = { ...current };
    for (const key of SIGNUP_DETAIL_KEYS) {
      if (meta[key] !== undefined && isBlank(current[key])) next[key] = meta[key];
    }
    if (JSON.stringify(next) !== JSON.stringify(current)) {
      const { error: detailsError } = await db.from("profile_details").update({ data: next }).eq("user_id", user.id);
      if (detailsError) throw detailsError;
    }
    const { error: flagError } = await db.auth.updateUser({ data: { signup_pending: false } });
    if (flagError) throw flagError;
  } catch (e) {
    console.warn("Saving the sign-up details failed; they'll be retried at the next load", e);
  }
}

/* ---------- saving ---------- */

const COLUMN_OF = {
  firstName: "first_name", lastName: "last_name", designation: "designation",
  affiliation: "affiliation", country: "country", orcidId: "orcid_id", photoPath: "photo_path",
} as const;
const NOT_NULL = new Set<string>(["first_name", "last_name"]);

function splitPatch(patch: ProfilePatch): { columns: Record<string, string | null>; details: Data } {
  const columns: Record<string, string | null> = {};
  const details: Data = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    const column = (COLUMN_OF as Record<string, string>)[key];
    if (column) {
      const text = String(value ?? "").trim();
      columns[column] = text || (NOT_NULL.has(column) ? "" : null);
    } else {
      details[key] = value;
    }
  }
  return { columns, details };
}

async function save(patch: ProfilePatch): Promise<Profile> {
  const db = getSupabase();
  const user = await currentUser(db);
  const { columns, details } = splitPatch(patch);
  try {
    if (Object.keys(columns).length) {
      const { error } = await db.from("profiles").update(columns).eq("id", user.id);
      if (error) throw error;
    }
    if (Object.keys(details).length) {
      // Merge into what is stored: the blob also holds profile data the prototype edits (experience, education, …) that this app doesn't touch.
      const { data: current, error: readError } = await db.from("profile_details").select("data").eq("user_id", user.id).maybeSingle();
      if (readError) throw readError;
      const merged = { ...(((current as { data?: Data } | null)?.data) ?? {}), ...details };
      const { error } = await db.from("profile_details").upsert({ user_id: user.id, data: merged }, { onConflict: "user_id" });
      if (error) throw error;
    }
  } catch (e) {
    const message = (e as { message?: string } | null)?.message ?? "";
    if (/row-level security|permission denied/i.test(message)) fail(e as { message?: string }, "save your profile");
    throw new ServiceError(friendlyAuthError(e));
  }
  return fetchProfile(db, user.id);
}

async function uploadPhoto(photo: Blob): Promise<string> {
  const db = getSupabase();
  const user = await currentUser(db);
  const type = photo.type || "image/jpeg";
  if (!/^image\/(png|jpeg|webp)$/.test(type)) throw new ServiceError("Only PNG, JPEG or WebP photos can be uploaded.");
  if (photo.size > 5 * 1024 * 1024) throw new ServiceError("That photo is too large — the limit is 5 MB.");
  const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
  // A new file name for every photo: the bucket allows uploading into your own folder but not overwriting or deleting.
  const path = `${user.id}/photo-${Date.now().toString(36)}.${ext}`;
  const { error } = await db.storage.from(PHOTO_BUCKET).upload(path, photo, { contentType: type, upsert: false });
  if (error) {
    if (/size|large/i.test(error.message)) throw new ServiceError("That photo is too large — the limit is 5 MB.");
    if (/mime|type/i.test(error.message)) throw new ServiceError("Only PNG, JPEG or WebP photos can be uploaded.");
    throw new ServiceError(friendlyAuthError(error));
  }
  return path;
}

export const supabaseProfileService: ProfileService = {
  async load() {
    const db = getSupabase();
    const user = await currentUser(db);
    await applySignupDetails(db, user);
    return fetchProfile(db, user.id);
  },
  save,
  uploadPhoto,
  async loadPublic(slug) {
    if (!/^[a-z0-9-]{1,200}$/.test(slug)) return null;
    const db = getSupabase();
    await currentUser(db);
    const { data, error } = await db.rpc("public_profile", { p_slug: slug });
    // Until migration 0027 is run the function does not exist: that reads as “no public profile”, as it always has.
    if (error) { if (/does not exist|schema cache|could not find the function/i.test(error.message)) return null; fail(error, "read this profile"); }
    if (!data) return null;
    const p = data as { id: string; first_name: string; last_name: string; designation: string | null; affiliation: string | null; country: string | null; orcid_id: string | null; photo_path: string | null; created_at: string | null; data?: Data };
    // The function never returns an address, so `email` is blank; the profile is shown read-only.
    return toProfile(db, { id: p.id, email: "", first_name: p.first_name, last_name: p.last_name, designation: p.designation, affiliation: p.affiliation, country: p.country, orcid_id: p.orcid_id, photo_path: p.photo_path, created_at: p.created_at }, p.data ?? {});
  },
};
