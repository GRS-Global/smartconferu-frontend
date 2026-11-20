/* Typed calls to the API's Super Admin endpoints (Swagger: /docs on the API, tags "admin",
   "auth", "master data"). Shapes mirror the API's response DTOs. */
import { ApiError, del, get, patch, post, put, qs, refreshSession, setAccessToken } from "./api";

// ---------- sign-in ----------

/** `devCode`: only while the API runs with DEV_SHOW_EMAIL_CODES (development, no real emails); never in production. */
export type SignInStep = { kind: "code"; message: string; devCode?: string } | { kind: "signed-in" };

/** Step 1: email + password. A super admin then gets a code by email (or uses their authenticator app).
    `remember`: "Keep me signed in on this device"; off, the session ends with the browser. A browser the
    admin trusted ("Trust this device") is signed straight in. */
export async function signInWithPassword(email: string, password: string, remember = true): Promise<SignInStep & { factor?: "email" | "totp" }> {
  const res = await post<{ accessToken?: string; mfaRequired?: true; factor?: "email" | "totp"; message?: string; devCode?: string }>("/auth/sign-in", { email, password, remember });
  if (res.mfaRequired) return { kind: "code", factor: res.factor, message: res.message ?? "", devCode: res.devCode };
  // A password alone never opens the console (super admins always get a second step); an
  // ordinary account lands here, and checkAdminAccess() turns it away.
  setAccessToken(res.accessToken ?? null);
  return { kind: "signed-in" };
}

/** Step 2: the emailed code (or a code from the authenticator app). `trustDevice`: skip the emailed
    code on this browser for 14 days. */
export async function verifyCode(code: string, trustDevice = false): Promise<void> {
  const res = await post<{ accessToken: string }>("/auth/mfa/verify", { code, trustDevice });
  setAccessToken(res.accessToken);
}

/** "Confirm it's you" before a high-risk action: emails a code (or says to use the authenticator app). */
export const requestStepUpCode = () => post<{ factor: "email" | "totp"; devCode?: string }>("/auth/step-up/code");
export const verifyStepUp = (code: string) => post<void>("/auth/step-up", { code });

/** "Forget this device": the emailed code is asked again at the next sign-in. */
export const forgetTrustedDevice = () => post<void>("/auth/trusted-device/forget");

/** Emails a new code; `devCode` comes back only in development (DEV_SHOW_EMAIL_CODES). */
export const resendCode = async (): Promise<{ devCode?: string }> => (await post<{ devCode?: string } | undefined>("/auth/mfa/email-code")) ?? {};

/** 200 for a super admin in a verified session; throws ApiError (403 FORBIDDEN / AUTH_MFA_REQUIRED) otherwise. */
export const checkAdminAccess = () => get<{ superAdmin: true }>("/admin/access");

export interface Me {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
}
export const loadMe = () => get<Me>("/me");

/** Restores the session after a reload; true when the stored session is a verified super admin's. */
export async function resumeAdminSession(): Promise<boolean> {
  if (!(await refreshSession())) return false;
  try {
    await checkAdminAccess();
    return true;
  } catch (e) {
    if (e instanceof ApiError && (e.status === 403 || e.status === 401)) return false;
    throw e;
  }
}

export async function signOut(): Promise<void> {
  try {
    await post<void>("/auth/sign-out");
  } finally {
    setAccessToken(null);
  }
}

/** "Log out of all devices": every session of this account ends, and every trusted device. */
export async function signOutEverywhere(): Promise<void> {
  try {
    await post<void>("/auth/sign-out/everywhere");
    await post<void>("/auth/sign-out").catch(() => undefined);
  } finally {
    setAccessToken(null);
  }
}

// ---------- dashboard ----------

export interface AdminStats {
  conferences: { pendingApproval: number; active: number; archived: number; rejected: number; deleted: number; pendingDeletion: number };
  papers: { submitted: number; withdrawn: number; drafts: number };
  users: { total: number; disabled: number; superAdmins: number; newThisWeek: number };
  reviewsSubmitted: number;
  emailsLastWeek: { sent: number; queued: number; failed: number };
}
/** The dashboard chart: papers submitted and reviews sent per month of a year. */
export const loadMonthlyActivity = (year: number) =>
  get<{ year: number; years: number[]; months: { month: string; submissions: number; reviews: number }[] }>(`/admin/stats/activity${qs({ year })}`);
export const loadStats = () => get<AdminStats>("/admin/stats");

export interface ActivityEntry {
  id: number;
  occurredAt: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  actor: { id: string; name: string; email: string | null } | null;
  data: Record<string, unknown>;
}
export const loadActivity = (params: { limit?: number; before?: number | null; action?: string; actorId?: string; entityId?: string; from?: string; to?: string; q?: string } = {}) =>
  get<{ data: ActivityEntry[]; nextBefore: number | null }>(`/admin/activity${qs(params)}`);

// ---------- conferences ----------

export type ConferenceStatus = "pending_approval" | "active" | "archived" | "rejected" | "deleted";

export interface AdminConference {
  id: string;
  slug: string;
  acronym: string;
  title: string;
  status: ConferenceStatus;
  about: string | null;
  mode: string | null;
  venue: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  webPage: string | null;
  contactEmail: string | null;
  primaryArea: string | null;
  secondaryArea: string | null;
  startDate: string | null;
  endDate: string | null;
  submissionDeadline: string | null;
  cfpStatus: string;
  createdAt?: string;
  details: Record<string, unknown>;
  deletionRequest: { id: string; status: string; reason: string; adminNote: string | null; createdAt: string } | null;
  requester: { id: string; name: string; email: string | null; affiliation: string | null } | null;
  /** Submitted papers (drafts not counted). */
  papers: number;
  /** When the license ends (set by a Super Admin, else 30 days after creation). */
  licenseExpiry: string;
  /** No license date set yet: still on the 30-day trial. */
  onTrial: boolean;
  /** Suspended by a Super Admin: read-only for everyone else. */
  suspended: boolean;
}
export const loadConferences = (status?: ConferenceStatus) => get<AdminConference[]>(`/admin/conferences${qs({ status })}`);
export const decideConferenceRequest = (id: string, approve: boolean, note?: string) =>
  post<void>(`/admin/conferences/${id}/decision`, { approve, note: note || null });
/** "Extend license": the license runs until `expiry` (YYYY-MM-DD); the chairs are told. */
export const extendLicense = (id: string, expiry: string) => post<void>(`/admin/conferences/${id}/license`, { expiry });

// ---------- license extension requests ----------

export type LicenseRequestStatus = "pending" | "approved" | "declined" | "withdrawn";
export interface LicenseRequest {
  id: string;
  requestedDate: string;
  reason: string | null;
  status: LicenseRequestStatus;
  decisionReason: string | null;
  newExpiry: string | null;
  createdAt: string;
  conferenceId: string;
  conferenceSlug: string;
  conferenceAcronym: string;
  conferenceTitle: string;
  currentExpiry: string | null;
  requestedByName: string;
  requestedByEmail: string | null;
}
export const loadLicenseRequests = (status: LicenseRequestStatus = "pending") => get<LicenseRequest[]>(`/admin/license-requests${qs({ status })}`);
export const decideLicenseRequest = (id: string, approve: boolean, v: { newExpiry?: string; reason?: string | null } = {}) =>
  post<void>(`/admin/license-requests/${id}/decision`, { approve, ...v });

// ---------- Calls for Papers waiting for approval ----------

export type CfpState = "draft" | "in_review" | "published" | "rejected" | "closed";
export const loadCfps = (status: CfpState = "in_review") => get<AdminConference[]>(`/admin/cfps${qs({ status })}`);
export const decideCfp = (conferenceId: string, approve: boolean, note?: string | null) => post<void>(`/admin/conferences/${conferenceId}/cfp/decision`, { approve, note: note || null });

// ---------- queue working state (claims, notes, messages) ----------

export interface AdminNote {
  id: string;
  itemId: string;
  kind: "note" | "message";
  text: string;
  createdAt: string;
  author: { id: string; name: string } | null;
}
export interface QueueState {
  claims: { itemId: string; admin: { id: string; name: string }; claimedAt: string }[];
  notes: AdminNote[];
}
export const loadQueueState = (queue: string) => get<QueueState>(`/admin/queues/${queue}`);
export const claimQueueItem = (queue: string, itemId: string) => put<void>(`/admin/queues/${queue}/${itemId}/claim`, {});
export const releaseQueueItem = (queue: string, itemId: string) => del<void>(`/admin/queues/${queue}/${itemId}/claim`);
export const addQueueNote = (queue: string, itemId: string, text: string) => post<AdminNote>(`/admin/queues/${queue}/${itemId}/notes`, { text });
/** "Ask for info" on a conference request: the chair gets the message; the request stays waiting. */
export const askForInfo = (conferenceId: string, message: string) => post<void>(`/admin/conferences/${conferenceId}/ask-info`, { message });

export const undeleteConference = (id: string) => post<void>(`/admin/conferences/${id}/undelete`);
export const archiveConference = (id: string) => post<void>(`/conferences/${id}/archive`);
export const restoreConference = (id: string) => post<void>(`/conferences/${id}/restore`);

export interface AdminPaper {
  id: string;
  paperId: string;
  title: string;
  status: string;
  outcome: string;
  decision: string | null;
  track: string | null;
  stage: string | null;
  reviewersWanted: number;
  reviewsIn: number;
  averageScore: number | null;
  /** Reviewers far apart (scores 2+ apart). */
  split?: boolean;
  authors?: { name: string; email: string | null; affiliation: string | null; corresponding: boolean }[];
  reviewers?: AdminReviewer[];
  submittedAt: string;
  updatedAt: string;
}
export interface AdminReviewer {
  userId: string;
  name: string;
  status: "assigned" | "accepted" | "declined" | "submitted" | "removed";
  byChair: boolean;
  dueAt: string | null;
  assignedAt: string;
  declineReason: string | null;
  reviewStatus: "draft" | "submitted" | null;
  score: number | null;
  recommendation: "accept" | "revise" | "reject" | null;
  submittedAt: string | null;
}
export const loadConferencePapers = (id: string) => get<AdminPaper[]>(`/admin/conferences/${id}/papers`);

export interface DeletionRequest {
  id: string;
  conferenceId: string;
  acronym: string;
  title: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  reason: string;
  adminNote: string | null;
  requestedBy: { id: string; name: string; email: string | null };
  createdAt: string;
  decidedAt: string | null;
}
export const loadDeletionRequests = (status?: DeletionRequest["status"]) =>
  get<DeletionRequest[]>(`/admin/deletion-requests${qs({ status })}`);
export const decideDeletionRequest = (id: string, approve: boolean, note?: string) =>
  post<void>(`/admin/deletion-requests/${id}/decision`, { approve, note: note || null });

// ---------- users ----------

export interface AdminUser {
  id: string;
  name: string;
  email: string | null;
  affiliation: string | null;
  country: string | null;
  roles: string[];
  status: "active" | "disabled";
  emailVerified: boolean;
  twoStepOn: boolean;
  createdAt: string;
  lastSignInAt: string | null;
}
export interface AdminUserDetail extends AdminUser {
  conferences: { id: string; slug: string; acronym: string; title: string; status: string; roles: string[]; papers: number }[];
  recentActivity: ActivityEntry[];
}
export const loadUsers = (params: { search?: string; cursor?: string; limit?: number } = {}) =>
  get<{ data: AdminUser[]; nextCursor: string | null }>(`/admin/users${qs(params)}`);
export const loadUser = (id: string) => get<AdminUserDetail>(`/admin/users/${id}`);

// Support actions on one account. The ones marked (step-up) ask for a fresh code first (api.ts handles it).
export interface AdminSession {
  id: string;
  signedInAt: string;
  lastActiveAt: string;
  userAgent: string | null;
  ipAddress: string | null;
}
export const loadUserSessions = (id: string) => get<AdminSession[]>(`/admin/users/${id}/sessions`);
export const revokeUserSession = (id: string, sessionId: string) => del<void>(`/admin/users/${id}/sessions/${sessionId}`);
/** (step-up) The authenticator app is removed; they set it up again at the next sign-in. */
export const resetUserMfa = (id: string) => post<void>(`/admin/users/${id}/reset-mfa`);
/** (step-up) Everything of `otherUserId` moves to `id`; the other account is closed. */
export const mergeUsers = (id: string, otherUserId: string) => post<void>(`/admin/users/${id}/merge`, { otherUserId });
/** (step-up) A read-only, 30-minute token for the user app as this person. */
export const viewAsUser = (id: string, reason: string) =>
  post<{ accessToken: string; expiresAt: string; user: { id: string; name: string; email: string | null } }>(`/admin/users/${id}/view-as`, { reason });
/** (step-up) Suspend: read-only for its chairs, authors and reviewers. */
export const suspendConference = (id: string, reason?: string) => post<void>(`/admin/conferences/${id}/suspend`, { reason: reason || null });
/** (step-up) Lift a suspension. */
export const reactivateConference = (id: string) => post<void>(`/admin/conferences/${id}/reactivate`);
export const suspendUser = (id: string, reason?: string) => post<AdminUser>(`/admin/users/${id}/suspend`, { reason: reason || undefined });
export const reactivateUser = (id: string) => post<AdminUser>(`/admin/users/${id}/reactivate`);

// ---------- master data ----------

export interface Society {
  id: string;
  key: string;
  name: string;
  acronym: string;
  url: string | null;
  status: "active" | "inactive";
  updatedAt: string;
}
export const loadSocieties = () => get<Society[]>("/admin/master-data/societies");
export const createSociety = (v: { name: string; acronym: string; url: string | null }) => post<Society>("/admin/master-data/societies", v);
export const updateSociety = (id: string, v: Partial<Pick<Society, "name" | "acronym" | "url" | "status">>) =>
  patch<Society>(`/admin/master-data/societies/${id}`, v);

export interface Institution {
  id: string;
  key: string;
  name: string;
  aliases: string[];
  country: string | null;
  departments: string[];
  status: "active" | "retired";
  mergedInto: { id: string; name: string } | null;
  people: number;
  updatedAt: string;
}
export const loadInstitutions = () => get<Institution[]>("/admin/master-data/institutions");
export const createInstitution = (v: { name: string; aliases: string[]; country: string | null; departments: string[] }) =>
  post<Institution>("/admin/master-data/institutions", v);
export const updateInstitution = (
  id: string,
  v: Partial<{ name: string; aliases: string[]; country: string | null; departments: string[]; status: "active" | "retired" }>,
) => patch<Institution>(`/admin/master-data/institutions/${id}`, v);
export const mergeInstitution = (id: string, intoId: string) => post<Institution>(`/admin/master-data/institutions/${id}/merge`, { intoId });

export interface SecondaryArea {
  id: string;
  name: string;
  status: "active" | "retired";
  conferences: number;
}
export interface PrimaryArea extends SecondaryArea {
  subareas: SecondaryArea[];
}
export interface ResearchAreaGroup {
  label: string;
  areas: PrimaryArea[];
}
export const loadResearchAreas = () => get<ResearchAreaGroup[]>("/admin/master-data/research-areas");
export const createResearchArea = (v: { name: string; parentId?: string; groupLabel?: string }) =>
  post<{ id: string }>("/admin/master-data/research-areas", v);
export const updateResearchArea = (id: string, v: { name?: string; status?: "active" | "retired" }) =>
  patch<{ id: string; conferencesRenamed: number }>(`/admin/master-data/research-areas/${id}`, v);

// ---------- email templates ----------

export interface EmailTemplate {
  key: string;
  module: string | null;
  role: string | null;
  label: string;
  sendType: string | null;
  triggerText: string | null;
  recipients: string | null;
  subject: string;
  body: string;
  updatedAt: string | null;
}
export const loadEmailTemplates = () => get<EmailTemplate[]>("/admin/email-templates");
export const saveEmailTemplate = (key: string, v: { subject: string; body: string }) => put<EmailTemplate>(`/admin/email-templates/${encodeURIComponent(key)}`, v);
export const testEmailTemplate = (key: string, v: { subject?: string; body?: string }) =>
  post<void>(`/admin/email-templates/${encodeURIComponent(key)}/test`, v);
