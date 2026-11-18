/* Typed calls to the API's Super Admin endpoints (Swagger: /docs on the API, tags "admin",
   "auth", "master data"). Shapes mirror the API's response DTOs. */
import { ApiError, get, patch, post, put, qs, refreshSession, setAccessToken } from "./api";

// ---------- sign-in ----------

export type SignInStep = { kind: "code"; message: string } | { kind: "signed-in" };

/** Step 1: email + password. A super admin then gets a code by email (or uses their authenticator app). */
export async function signInWithPassword(email: string, password: string): Promise<SignInStep & { factor?: "email" | "totp" }> {
  const res = await post<{ accessToken?: string; mfaRequired?: true; factor?: "email" | "totp"; message?: string }>("/auth/sign-in", { email, password });
  if (res.mfaRequired) return { kind: "code", factor: res.factor, message: res.message ?? "" };
  // A password alone never opens the console (super admins always get a second step); an
  // ordinary account lands here, and checkAdminAccess() turns it away.
  setAccessToken(res.accessToken ?? null);
  return { kind: "signed-in" };
}

/** Step 2: the emailed code (or a code from the authenticator app). */
export async function verifyCode(code: string): Promise<void> {
  const res = await post<{ accessToken: string }>("/auth/mfa/verify", { code });
  setAccessToken(res.accessToken);
}

export const resendCode = () => post<void>("/auth/mfa/email-code");

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

// ---------- dashboard ----------

export interface AdminStats {
  conferences: { pendingApproval: number; active: number; archived: number; rejected: number; deleted: number; pendingDeletion: number };
  papers: { submitted: number; withdrawn: number; drafts: number };
  users: { total: number; disabled: number; superAdmins: number; newThisWeek: number };
  reviewsSubmitted: number;
  emailsLastWeek: { sent: number; queued: number; failed: number };
}
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
export const loadActivity = (params: { limit?: number; before?: number; action?: string; actorId?: string } = {}) =>
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
}
export const loadConferences = (status?: ConferenceStatus) => get<AdminConference[]>(`/admin/conferences${qs({ status })}`);
export const decideConferenceRequest = (id: string, approve: boolean, note?: string) =>
  post<void>(`/admin/conferences/${id}/decision`, { approve, note: note || null });
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
  submittedAt: string;
  updatedAt: string;
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
