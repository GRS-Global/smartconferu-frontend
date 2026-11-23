/** One affiliation as the prototype keeps it inside profile_details.data.affiliations. */
export type Affiliation = {
  id: string;
  institution: string;
  institutionId: string | null;
  /** Typed by the user, not in the approved list yet. */
  pending: boolean;
  department: string;
  departmentPending?: boolean;
  location: string;
  startMonth: string;
  startYear: string;
  relationship: string;
  /** The relationship was typed under "Other" and waits for review. */
  relationshipOther?: boolean;
  relationshipPending?: boolean;
  relationshipRejectReason?: string;
  primary: boolean;
};

/** An Experience / Education / Membership entry of the profile timeline (profile_details.data.timeline). */
export type TimelineEntry = {
  id: string;
  type: "experience" | "education" | "membership";
  title: string;
  org: string;
  startMonth: string;
  startYear: string;
  endMonth: string;
  endYear: string;
  current: boolean;
  /** Older entries only carry their period as text ("Jul 2018 – Jun 2022"). */
  period: string;
  societyId: string;
  /** "pending" | "approved" | "rejected" for an "Other" society waiting on a Super Admin. */
  verification: string;
  gradePending: boolean;
  /** Membership extras: the grade was typed under "Other"; private number; links. */
  gradeOther?: boolean;
  memberNumber?: string;
  memberUrl?: string;
  societyUrl?: string;
  gradeRejectReason?: string;
};

/** A verification the member asked for on a scholar / professional link (profile_details.data.verificationRequests). */
export type VerificationRequest = { status: "pending" | "declined"; requestedAt: string; note?: string; reason?: string };

/** A past affiliation (profile_details.data.pastAffiliations). */
export type PastAffiliation = {
  id: string;
  institution: string;
  relationship: string;
  department: string;
  location: string;
  startMonth: string;
  startYear: string;
  endMonth: string;
  endYear: string;
};

export type EmailSlot = { value: string; status: string };

export const SCHOLAR_LINK_KEYS = ["researchGateUrl", "dblpUrl", "googleScholarUrl", "scopusId", "openAlexUrl"] as const;
export const PROFESSIONAL_LINK_KEYS = ["linkedinUrl", "youtubeUrl", "facebookUrl", "twitterUrl", "githubUrl"] as const;
export type LinkKey = "orcidId" | (typeof SCHOLAR_LINK_KEYS)[number] | (typeof PROFESSIONAL_LINK_KEYS)[number];

/** The signed-in user's profile: the `profiles` row plus the parts of `profile_details.data` this app edits.
 *  (A `type`, not an interface, so it can be read as a plain field bag by the completeness rules.) */
export type Profile = {
  userId: string;
  mainEmail: string;
  /** Own backend only: false when the account was created through Google/Microsoft/ORCID and has no password yet. Absent (= has one) with Supabase. */
  hasPassword?: boolean;
  /** Own backend only: this account is a Super Admin. Its place is the admin console, so the user app's pages send it there (see SuperAdminGate). */
  isSuperAdmin?: boolean;
  // profiles columns
  firstName: string;
  lastName: string;
  designation: string;
  affiliation: string;
  country: string;
  orcidId: string;
  /** File name of the stored photo ("" when none). */
  photo: string;
  /** Public URL of the stored photo ("" when none). */
  photoUrl: string;
  // profile_details.data
  gender: string;
  phone: string;
  webPage: string;
  notifyChannels: string[];
  affiliations: Affiliation[];
  affiliationInstitutionId: string | null;
  affiliationPending: boolean;
  affiliationDepartment: string;
  affiliationLocation: string;
  affiliationStartMonth: string;
  affiliationStartYear: string;
  bio: string;
  researchInterests: string[];
  addressLine1: string;
  addressLine2: string;
  city: string;
  postCode: string;
  state: string;
  researchGateUrl: string;
  dblpUrl: string;
  googleScholarUrl: string;
  scopusId: string;
  openAlexUrl: string;
  linkedinUrl: string;
  youtubeUrl: string;
  facebookUrl: string;
  twitterUrl: string;
  githubUrl: string;
  scholarNone: boolean;
  professionalNone: boolean;
  // Settings, also kept in profile_details.data as in the prototype
  /** "instant" | "daily" | "weekly" | "off" ("instant" until one is saved). */
  notifyFrequency: string;
  /** "India | GMT +05:30"; "" = use the browser's timezone. */
  timezone: string;
  colorBlindMode: boolean;
  // Shown on My Profile but not edited by this app yet (read from the same stored JSON)
  timeline: TimelineEntry[];
  pastAffiliations: PastAffiliation[];
  /** Year; the stored value, else the year the account was created. */
  memberSince: string;
  /** Two email slots as the prototype stores them; null when never saved (then the account email is the personal one). */
  emails: { personal: EmailSlot; professional: EmailSlot } | null;
  primaryEmail: string;
  phoneStatus: string;
  primaryArea: string;
  secondaryAreas: string[];
  avatarStyle: string;
  verifiedProfiles: Record<string, boolean>;
  confirmedProfiles: Record<string, boolean>;
  /** "Verification pending" requests on links the member confirmed (no verification service reads them yet). */
  verificationRequests: Record<string, VerificationRequest>;
  /** Research area typed under "Other" (waits for review). */
  primaryAreaPending: boolean;
  pendingSecondaryAreas: string[];
  /** The "Shareable public profile" switch; off until the member turns it on. */
  publicProfileEnabled: boolean;
  /** Privacy: show the reviewer level and badges ("Peer review recognition") on the profile. Only the setting is kept so far. */
  showReviewerAchievements: boolean;
};

/** Profile fields this app only displays; they are not part of any save. */
export type ReadOnlyProfileKey = "memberSince";

/** What can be saved. The photo is saved by its storage path. */
export type ProfilePatch = Partial<Omit<Profile, "userId" | "mainEmail" | "photo" | "photoUrl" | ReadOnlyProfileKey>> & { photoPath?: string | null };
