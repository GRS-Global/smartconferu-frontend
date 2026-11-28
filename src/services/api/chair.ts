import { api, apiBlob, ApiError, publicFileUrl, writeVersion } from "@/lib/api-client";
import type { ReviewValues } from "@/types/reviewer";
import { PEER_REVIEW_FORM, PROTECTED_FIELD_IDS, sectionsFromStored } from "@/features/reviewer/form-schema";
import { extrasFromStored } from "@/types/author-submission";
import {
  DEFAULT_CRITERIA, DEFAULT_PRESENTATION_TYPES, DEFAULT_REVIEW_LIMITS, DEFAULT_REVIEW_POLICY, DEFAULT_REVIEW_TIMELINE, DEFAULT_SUBMISSION_POLICY,
  type CfpFacts, type SubmissionPolicy, type ChairAuthor, type ChairConference, type ChairPaper, type ChairPaperDetail, type PaperRegistration, type ChairReviewer, type DeclinedReviewer, type ReviewBoard, type ScreeningFile, type ConferenceInfo, type ConferenceSettings, type DecisionType, type DeletionRequest,
  type ChairEmailLog, type LicenseRequest, type ConferenceTemplate, type EmailTemplates, type InviteResult, type Outcome, type PoolReviewer, type ReviewerPool, type ScreeningCriteria, type ScreeningRecord,
} from "@/types/chair";
import type { ChairService } from "../chair";
import { ServiceError } from "../errors";
import { EMPTY_HYBRID_DATES, hybridDetails, readHybridDates, type HybridDates } from "@/lib/hybrid-dates";
import { isValidEmail } from "@/lib/email";

/* The Chair workspace through the own backend: the conference (details, settings, reviewer pool, logo, archive and deletion, the overview the workspace frame reads)
   and its papers (the paper page, reviewers and reviews, screening, decisions, "Ask author to fix", tracks, deleting). Still answering "not available yet": the license requests. Every `:conferenceId` in a path may be the conference's slug. Backend/src/modules/conferences + reviews + submissions. */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const str = (v: unknown) => (typeof v === "string" ? v : "");
const isoDay = (ts: string | null | undefined) => (ts ? ts.slice(0, 10) : "");
const label = (ts: string | null | undefined) => (ts ? new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "");
const nul = (v: string) => (v.trim() === "" ? null : v.trim());
const rec = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/* ---------------------------------------------------------------- backend shapes (only what is read) */

interface ActivityRow { id: string; at: string; actorName: string; actorRole: "chair" | "author" | "reviewer" | "system"; action: string; module: string; description: string; status: "success" | "failed"; reviewerName: string | null; previousValue: string | null; newValue: string | null }
interface LicenseRow { id: string; requestedDate: string; reason: string | null; status: LicenseRequest["status"]; decisionReason: string | null; newExpiry: string | null; createdAt: string }
const toLicense = (r: LicenseRow): LicenseRequest => ({ id: r.id, requestedDate: r.requestedDate, reason: r.reason ?? "", status: r.status, decisionReason: r.decisionReason ?? "", newExpiry: r.newExpiry ?? "", createdAt: r.createdAt });

interface TemplatesResponse {
  templates: Array<{ key: string; module: string | null; role: string | null; label: string; sendType: string | null; triggerText: string | null; recipients: string | null; subject: string; body: string; enabled: boolean; customized: boolean; defaultSubject: string; defaultBody: string }>;
  customEmails: Array<{ key: string; name: string; enabled: boolean; subject: string; body: string }>;
}
interface EmailLogPage { data: Array<{ id: string; event: string; templateKey: string; templateLabel: string | null; submissionId: string | null; toEmail: string; toName: string | null; recipientType: string | null; subject: string; body: string | null; status: string; error: string | null; createdAt: string }>; nextCursor: string | null }

interface ConferenceResponse {
  id: string; slug: string; acronym: string; title: string; about: string | null; mode: string | null; venue: string | null; city: string | null; state: string | null; country: string | null;
  webPage: string | null; contactEmail: string | null; primaryArea: string | null; secondaryArea: string | null; startDate: string | null; endDate: string | null;
  submissionDeadline: string | null; reviewDeadline: string | null; reviewMode: string; details: Record<string, unknown> | null; status: string; logoPath: string | null; createdAt: string;
  settings: Record<string, unknown> | null; deletionRequest: { status: string; reason: string; adminNote: string | null } | null; cfpStatus: string;
}
interface MemberResponse { id: string; role: string; status: string; userId: string | null; name: string; email: string | null; affiliation?: string | null; expertise: string[]; invitedAt: string }
interface OverviewPaper {
  id: string; paperId: string; title: string; track: string | null; presentationType: string | null; keywords: string[]; status: string; outcome: string; decisionTypeId: string | null;
  notifiedOutcome: string | null; screening: Record<string, unknown> | null; files: Array<{ id: string; kind: string; version: number; fileName: string; uploadedAt: string; autoCheck: Record<string, unknown> | null }>; withdrawnAt: string | null; withdrawnBy: string | null; submittedAt: string; updatedAt: string;
  authors: Array<{ name: string; email: string | null; affiliation: string | null; country: string | null; otherAffiliations?: Array<{ affiliation: string | null }>; corresponding: boolean; hasAccount: boolean }> | null;
  registration: PaperRegistration | null;
  reviewersAssigned: number; reviewsReceived: number; averageScore: number | null;
}
interface BoardReview {
  id: string; status: string; score: number | null; confidence: string | null; commentsToAuthor: string | null; commentsToChair: string | null; answers: Record<string, unknown>;
  sharedWithAuthor: boolean; submittedAt: string | null;
}
interface BoardAssignment {
  id: string; reviewer: { userId: string; name: string; email: string | null }; status: string; byChair: boolean; dueAt: string | null; assignedAt: string;
  respondedAt: string | null; declineReason: string | null; review: BoardReview | null;
  extension: { id: string; date: string; reason: string | null; status: string; createdAt: string } | null;
}
interface BoardPending { id: string; memberId: string; name: string; email: string | null; dueAt: string | null; createdAt: string }
interface Board { conferenceId: string; papers: Array<{ submissionId: string; assignments: BoardAssignment[]; pending: BoardPending[] }> }
interface Overview {
  conferenceId: string; cfpStatus: string; papers: OverviewPaper[];
  decisionTypes: Array<{ id: string; label: string; color: string; outcome: Outcome; description: string | null; authorLabel?: string | null }>;
  screening: { settings: { initialCheck?: boolean; plagiarism?: boolean }; criteria: Partial<ScreeningCriteria> };
}

// Reads of the same conference that start within a moment of each other (the shell, the page and the tour all ask for it when a page opens) share one request.
// An entry is kept for 1.5 s and only while nothing was written since (writeVersion), so a read after a change is never served stale.
const RECENT_MS = 1500;
const recent = new Map<string, { p: Promise<unknown>; at: number; v: number }>();
function shared<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = recent.get(key);
  if (hit && hit.v === writeVersion() && Date.now() - hit.at < RECENT_MS) return hit.p as Promise<T>;
  const p = load();
  recent.set(key, { p, at: Date.now(), v: writeVersion() });
  p.catch(() => { if (recent.get(key)?.p === p) recent.delete(key); });
  return p;
}
const getConference = (slug: string) => shared(`conference:${slug}`, () => api<ConferenceResponse>(`/conferences/${slug}`));
const getOverview = (slug: string) => shared(`overview:${slug}`, () => api<Overview>(`/conferences/${slug}/chair-overview`));
const patchConference = (slug: string, body: Record<string, unknown>) => { return api<ConferenceResponse>(`/conferences/${slug}`, { method: "PATCH", body }); };
/** The backend merges these top-level keys into the conference's `settings` (null removes one). */
const mergeSetting = (slug: string, key: string, value: unknown) => { return api<ConferenceResponse>(`/conferences/${slug}/settings`, { method: "PATCH", body: { settings: { [key]: value } } }); };
const notAvailable = (what: string) => new ServiceError(`${what} isn't available with the own backend yet.`);

/* ---------------------------------------------------------------- mappers */

function toChairPaper(p: OverviewPaper, slug: string): ChairPaper {
  const authors: ChairAuthor[] = (p.authors ?? []).map((a) => ({ name: a.name, email: a.email ?? "", affiliation: a.affiliation ?? "", country: a.country ?? "", otherAffiliations: (a.otherAffiliations ?? []).map((p) => p.affiliation ?? "").filter(Boolean), corresponding: a.corresponding, hasAccount: a.hasAccount }));
  return {
    id: p.paperId, dbId: p.id, conferenceId: slug, title: p.title, track: p.track ?? "", presentationType: p.presentationType ?? "", authors, keywords: p.keywords,
    submittedAt: label(p.submittedAt), lastUpdate: label(p.updatedAt), withdrawn: p.status === "withdrawn", withdrawnAt: label(p.withdrawnAt || p.updatedAt), withdrawnBy: p.withdrawnBy === "chair" ? "chair" : "author",
    outcome: p.outcome as Outcome, decisionTypeId: p.decisionTypeId, notifiedOutcome: (p.notifiedOutcome as Outcome | null) ?? null,
    reviewersAssigned: p.reviewersAssigned, reviewsReceived: p.reviewsReceived, averageScore: p.averageScore,
    versions: p.files.filter((f) => f.kind !== "supplementary").length, screening: (p.screening ?? {}) as Record<string, ScreeningRecord>,
    registration: p.registration ?? null,
  };
}

/** A hybrid conference saved before the events had their own dates: both start out on the conference dates. */
function hybridDatesOf(mode: string | null, h: HybridDates, start: string, end: string): HybridDates {
  if (mode !== "hybrid" || h.physicalStart || h.physicalEnd || h.virtualStart || h.virtualEnd) return h;
  return { physicalStart: start, physicalEnd: end, virtualStart: start, virtualEnd: end };
}

function toInfo(c: ConferenceResponse): ConferenceInfo {
  const d = rec(c.details);
  return {
    name: c.title, acronym: c.acronym, about: c.about ?? "", webPage: c.webPage ?? "", contactEmail: c.contactEmail ?? "", primaryArea: c.primaryArea ?? "", secondaryArea: c.secondaryArea ?? "",
    startDate: c.startDate ?? "", endDate: c.endDate ?? "", hybridDates: hybridDatesOf(c.mode, readHybridDates(d), c.startDate ?? "", c.endDate ?? ""), mode: c.mode === "in_person" || c.mode === "virtual" || c.mode === "hybrid" ? c.mode : "", venue: c.venue ?? "", city: c.city ?? "", state: c.state ?? "", country: c.country ?? "",
    submissionDeadline: isoDay(c.submissionDeadline), reviewDeadline: isoDay(c.reviewDeadline), status: c.status,
    timezone: str(d.timezone), abstractDeadline: str(d.abstractDeadline), summary: str(d.summary), language: str(d.language), replyEmail: str(d.replyForwardingEmail), smartConfEmail: str(d.smartConfEmail),
    address: str(d.address), postalCode: str(d.postalCode), lat: typeof d.lat === "number" ? d.lat : null, lng: typeof d.lng === "number" ? d.lng : null,
    logoPath: c.logoPath ?? "", logoUrl: publicFileUrl(c.logoPath), createdAt: isoDay(c.createdAt), licenseExpiry: str(d.licenseExpiry),
    topics: Array.isArray(d.topics) ? (d.topics as unknown[]).filter((t): t is string => typeof t === "string") : [],
  };
}

function toSettings(c: ConferenceResponse): ConferenceSettings {
  const s = rec(c.settings);
  const limits = rec(s.reviewLimits);
  const types = Array.isArray(s.presentationTypes) ? (s.presentationTypes as unknown[]).filter((t): t is string => typeof t === "string") : [];
  const tracks = Array.isArray(s.tracks) ? (s.tracks as unknown[]).map(rec).map((t, i) => ({ id: str(t.id) || `track-${i}`, name: str(t.name), description: str(t.description) })).filter((t) => t.name) : [];
  const mode = c.reviewMode === "single_blind" || c.reviewMode === "open" ? c.reviewMode : "double_blind";
  return {
    timeline: { ...DEFAULT_REVIEW_TIMELINE, ...rec(s.reviewTimeline) },
    limits: { reviewersPerPaper: typeof limits.reviewersPerPaper === "number" ? limits.reviewersPerPaper : DEFAULT_REVIEW_LIMITS.reviewersPerPaper, maxPapersPerReviewer: typeof limits.maxPapersPerReviewer === "number" ? limits.maxPapersPerReviewer : null, reviewMode: mode },
    presentationTypes: types.length ? types : DEFAULT_PRESENTATION_TYPES,
    tracks, stored: true,
    // Guidelines never saved (or saved empty, as older saves of this card did): the general default.
    submission: (() => { const p = { ...DEFAULT_SUBMISSION_POLICY, ...rec(s.submissionPolicy) } as SubmissionPolicy; return typeof p.guidelines === "string" && p.guidelines.trim() ? p : { ...p, guidelines: DEFAULT_SUBMISSION_POLICY.guidelines }; })(),
    review: { ...DEFAULT_REVIEW_POLICY, ...rec(s.reviewPolicy) },
  };
}

/* ---------------------------------------------------------------- the implemented part */

/** A paper's reviewers as the Peer Review pages show them: the ones on the paper, and the invited ones the paper waits for. */
function toReviewers(assignments: BoardAssignment[], pending: BoardPending[], deadline: string): ChairReviewer[] {
  const reviewers: ChairReviewer[] = assignments.filter((a) => a.status !== "declined" && a.status !== "removed").map((a) => {
    const r = a.review && a.review.status === "submitted" ? a.review : null;
    return {
      assignmentId: a.id, reviewerId: a.reviewer.userId, name: a.reviewer.name, email: a.reviewer.email ?? "", response: a.status === "assigned" ? "pending" : "accepted",
      assignedAt: label(a.assignedAt), due: isoDay(a.dueAt) || deadline, byChair: a.byChair, awaitingInvite: false,
      // An open "Ask for more time", for the chair to approve or decline.
      extension: a.extension?.status === "pending" ? { id: a.extension.id, date: a.extension.date, reason: a.extension.reason ?? "", at: label(a.extension.createdAt) } : null,
      review: r ? {
        id: r.id, score: r.score, confidence: r.confidence ? r.confidence[0].toUpperCase() + r.confidence.slice(1) : "", commentsToAuthor: r.commentsToAuthor ?? "",
        commentsToChair: r.commentsToChair ?? "", shared: r.sharedWithAuthor, submittedAt: label(r.submittedAt), answers: r.answers ?? {},
      } : null,
    };
  });
  // Someone invited who has not joined the committee yet: the paper waits for them.
  for (const w of pending) {
    reviewers.push({ assignmentId: `pending-${w.memberId}`, reviewerId: w.memberId, name: w.name || w.email || "New reviewer", email: w.email ?? "", response: "pending", assignedAt: label(w.createdAt), due: isoDay(w.dueAt) || deadline, byChair: false, awaitingInvite: true, review: null });
  }
  return reviewers;
}

/** The review form's answers -> the review's fields (the prototype's reviewFields); the whole form is kept in `answers`. */
const RECOMMENDATION: Record<string, string> = { accept: "accept", "re-review": "revise", revise: "revise", revision: "revise", reject: "reject" };
function reviewFields(values: ReviewValues) {
  const score = Number(values["f-score"]);
  const confidence = String(values["f-confidence"] ?? "").toLowerCase();
  return {
    score: score >= 1 && score <= 5 ? Math.round(score) : null,
    confidence: ["low", "medium", "high"].includes(confidence) ? confidence : null,
    recommendation: RECOMMENDATION[String(values["f-decision"] ?? "").toLowerCase()] ?? null,
    commentsToAuthor: (values["f-to-author"] as string) || null,
    commentsToChair: (values["f-to-chair"] as string) || null,
    answers: values,
  };
}

interface PaperDto {
  id: string; paperId: string; conferenceId: string; conferenceSlug: string; view: "chair" | "author" | "reviewer"; abstract: string; keywords: string[];
  files: Array<{ id: string; kind: string; version: number; fileName: string; uploadedAt: string }>;
  decisionNote: string | null; notifiedAt: string | null; fixRequest: { issue: string; fixBy: string; at: string } | null;
}
interface PaperReviews { assignments: BoardAssignment[]; pending: BoardPending[] }
/** The conference (slug) a paper belongs to: the bulk routes are per conference. */
const slugOfPaper = async (paperDbId: string) => (await api<PaperDto>(`/submissions/${paperDbId}`)).conferenceSlug;
const needUuid = (...ids: string[]) => { if (ids.some((id) => !UUID.test(id))) throw new ServiceError("Couldn't do that. Reload the page and try again."); };

const implemented: Partial<ChairService> = {
  async loadConference(slug) {
    const o = await getOverview(slug);
    const decisionTypes: DecisionType[] = o.decisionTypes.map((t) => ({ id: t.id, label: t.label, color: t.color, outcome: t.outcome, description: t.description ?? "", authorLabel: t.authorLabel ?? "" }));
    const criteria: ScreeningCriteria = { ...DEFAULT_CRITERIA, ...o.screening.criteria };
    return {
      dbId: o.conferenceId,
      cfpStatus: o.cfpStatus === "published" || o.cfpStatus === "closed" || o.cfpStatus === "draft" ? o.cfpStatus : o.cfpStatus === "in_review" ? "review" : o.cfpStatus === "rejected" ? "draft" : null,
      papers: o.papers.map((p) => toChairPaper(p, slug)).filter((p) => p.outcome !== undefined),
      decisionTypes, criteria,
      screening: { initialCheck: o.screening.settings.initialCheck !== false, plagiarism: o.screening.settings.plagiarism !== false },
    } satisfies ChairConference;
  },

  async loadInfo(slug) {
    try { return toInfo(await getConference(slug)); }
    catch (e) { if (e instanceof ApiError && (e.status === 403 || e.status === 404)) return null; throw e; }
  },

  async saveInfo(slug, i) {
    const url = (v: string) => !v.trim() || /^https?:\/\/\S+$/i.test(v.trim());
    if (!i.name.trim() || i.name.length > 300 || i.about.length > 20000 || !url(i.webPage) || (i.contactEmail.trim() && !isValidEmail(i.contactEmail.trim())) || (i.startDate && i.endDate && i.endDate < i.startDate)) {
      throw new ServiceError("Couldn't save that. Please check the conference details and try again.");
    }
    // Only the keys this form owns: the server merges `details` into the stored ones, so the conference is not read first.
    const details = {
      timezone: i.timezone, abstractDeadline: i.abstractDeadline, summary: i.summary, language: i.language, replyForwardingEmail: i.replyEmail, smartConfEmail: i.smartConfEmail,
      topics: i.topics, address: i.address, postalCode: i.postalCode, lat: i.lat, lng: i.lng,
      ...hybridDetails(i.mode === "hybrid", i.hybridDates ?? EMPTY_HYBRID_DATES),
    };
    await patchConference(slug, {
      title: i.name.trim(), about: nul(i.about), webPage: nul(i.webPage), contactEmail: nul(i.contactEmail), primaryArea: nul(i.primaryArea), secondaryArea: nul(i.secondaryArea),
      startDate: nul(i.startDate), endDate: nul(i.endDate), mode: i.mode || null, venue: nul(i.venue), city: nul(i.city), state: nul(i.state), country: nul(i.country),
      submissionDeadline: i.submissionDeadline ? `${i.submissionDeadline}T23:59:59Z` : null, reviewDeadline: i.reviewDeadline ? `${i.reviewDeadline}T23:59:59Z` : null, details,
    });
  },

  async loadSettings(slug) { return toSettings(await getConference(slug)); },

  async saveReviewTimeline(slug, t) {
    const ints = [t.reviewDays, t.reminder1Days, t.reminder2Days];
    if (ints.some((n) => !Number.isInteger(n) || n < 0 || n > 90) || t.reviewDays < 1) throw new ServiceError("Couldn't save that. Please check the timeline and try again.");
    await mergeSetting(slug, "reviewTimeline", t);
  },
  async saveSubmissionPolicy(slug, p) {
    const counts = [p.startNumber, p.maxSubmissions, p.maxPerAuthor];
    if (counts.some((n) => n !== null && (!Number.isInteger(n) || n < 1))) throw new ServiceError("Couldn't save that. The numbers must be whole numbers of 1 or more.");
    await mergeSetting(slug, "submissionPolicy", p);
  },
  async saveReviewPolicy(slug, p) { await mergeSetting(slug, "reviewPolicy", p); },
  async saveReviewLimits(slug, l) {
    if (!Number.isInteger(l.reviewersPerPaper) || l.reviewersPerPaper < 1 || l.reviewersPerPaper > 20 || (l.maxPapersPerReviewer !== null && (!Number.isInteger(l.maxPapersPerReviewer) || l.maxPapersPerReviewer < 1 || l.maxPapersPerReviewer > 500))) {
      throw new ServiceError("Couldn't save that. Please check the review limits and try again.");
    }
    if (!["double_blind", "single_blind", "open"].includes(l.reviewMode)) throw new ServiceError("Couldn't save that. Please check the review mode and try again.");
    await patchConference(slug, { reviewMode: l.reviewMode });
    await mergeSetting(slug, "reviewLimits", { reviewersPerPaper: l.reviewersPerPaper, maxPapersPerReviewer: l.maxPapersPerReviewer });
  },
  async savePresentationTypes(slug, types) {
    const clean = types.map((t) => t.trim());
    if (!clean.length || clean.length > 20 || clean.some((t) => !t || t.length > 80) || new Set(clean.map((t) => t.toLowerCase())).size !== clean.length) throw new ServiceError("Couldn't save that. Please check the submission types and try again.");
    await mergeSetting(slug, "presentationTypes", clean);
  },
  // The backend has a `tracks` table but no routes for it yet, so the tracks are kept in the conference's settings (see GAP-REPORT.md).
  async saveTracks(slug, tracks) {
    const names = tracks.map((t) => t.name.trim().toLowerCase());
    if (tracks.some((t) => !t.name.trim() || t.name.length > 80 || t.description.length > 500) || new Set(names).size !== names.length) throw new ServiceError("Couldn't save that. Please check the tracks and try again.");
    await mergeSetting(slug, "tracks", tracks.map((t) => ({ id: UUID.test(t.id) ? t.id : crypto.randomUUID(), name: t.name.trim(), description: t.description.trim() })));
  },

  async archiveConference(slug) { await api(`/conferences/${slug}/archive`, { method: "POST" }); },
  async restoreConference(slug) { await api(`/conferences/${slug}/restore`, { method: "POST" }); },
  async requestDeletion(slug, reason) { await api(`/conferences/${slug}/deletion-request`, { method: "POST", body: { reason } }); },
  async cancelDeletion(slug) { await api(`/conferences/${slug}/deletion-request`, { method: "DELETE" }); },
  async loadDeletionRequest(slug) {
    const r = (await getConference(slug)).deletionRequest;
    if (!r) return null;
    return { status: (["pending", "approved", "rejected", "cancelled"].includes(r.status) ? r.status : "pending") as DeletionRequest["status"], reason: r.reason, adminNote: r.adminNote ?? "" };
  },

  async saveLogo(slug, file) {
    // No file: the logo is removed (the conference shows its initials again).
    if (!file) { await api("/files/conference-logo", { method: "DELETE", query: { conferenceId: slug } }); return ""; }
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new ServiceError("Use a PNG, JPEG or WebP image.");
    if (file.size > 5 * 1024 * 1024) throw new ServiceError("The logo is over 5 MB. Choose a smaller file.");
    const form = new FormData();
    form.append("file", file, file.name);
    // The backend stores the file and sets the conference's logo in one step.
    const up = await api<{ path: string }>("/files", { method: "POST", query: { purpose: "conference_logo", conferenceId: slug }, body: form });
    return publicFileUrl(up.path);
  },

  /* The review form, the reviewers' instructions and the submission form are kept in the conference's settings (keys reviewForm, reviewInstructions,
     submissionForm): the backend has no routes of its own for them yet (see GAP-REPORT.md). Settings are only readable by the chairs. */
  async loadReviewSetup(slug) {
    const s = rec((await getConference(slug)).settings);
    const custom = sectionsFromStored(s.reviewForm);
    const ins = rec(s.reviewInstructions);
    const pdf = rec(ins.pdf);
    return {
      form: custom ?? PEER_REVIEW_FORM, custom: custom !== null, instructions: str(ins.text), instructionsMode: ins.mode === "pdf" ? "pdf" : "html",
      instructionsPdf: str(pdf.path) ? { name: str(pdf.name) || "Reviewer instructions.pdf", url: publicFileUrl(str(pdf.path)) } : null,
    };
  },
  async saveReviewForm(slug, sections) {
    if (sections === null) { await mergeSetting(slug, "reviewForm", null); return; }
    const all = sections.flatMap((s) => s.fields);
    const ids = all.map((f) => f.id);
    if (!sections.length || sections.some((s) => !s.name.trim() || s.name.length > 80) || all.some((f) => !f.label.trim() || f.label.length > 200 || (f.type === "single_choice" && (f.options ?? []).filter((o) => o.trim()).length < 2)) || new Set(ids).size !== ids.length || PROTECTED_FIELD_IDS.some((p) => !ids.includes(p))) {
      throw new ServiceError("Couldn't save that. Please check the form (every field needs a name, a choice field needs two options, and the standard fields stay).");
    }
    await mergeSetting(slug, "reviewForm", { sections });
  },
  async saveReviewInstructions(slug, text) {
    if (text.length > 20000) throw new ServiceError("Couldn't save that. The instructions are too long.");
    const ins = rec(rec((await getConference(slug)).settings).reviewInstructions);
    await mergeSetting(slug, "reviewInstructions", { ...ins, text: text.trim() });
  },
  async saveReviewInstructionsMode(slug, mode) {
    const ins = rec(rec((await getConference(slug)).settings).reviewInstructions);
    await mergeSetting(slug, "reviewInstructions", { ...ins, mode });
  },
  async saveReviewInstructionsPdf(slug, file) {
    if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) throw new ServiceError("Choose a PDF file.");
    if (file.size > 5 * 1024 * 1024) throw new ServiceError("The PDF is over 5 MB. Choose a smaller file.");
    const form = new FormData();
    form.append("file", file, file.name);
    const up = await api<{ path: string }>("/files", { method: "POST", query: { purpose: "review_instructions_pdf", conferenceId: slug }, body: form });
    const ins = rec(rec((await getConference(slug)).settings).reviewInstructions);
    const name = file.name.slice(0, 200);
    await mergeSetting(slug, "reviewInstructions", { ...ins, pdf: { path: up.path, name } });
    return { name, url: publicFileUrl(up.path) };
  },
  async loadSubmissionForm(slug) { return extrasFromStored(rec(rec((await getConference(slug)).settings).submissionForm)); },
  async saveSubmissionForm(slug, extras) {
    const ids = extras.map((f) => f.id);
    if (extras.length > 30 || extras.some((f) => !f.label.trim() || f.label.length > 300 || (f.type === "single_choice" && (f.options ?? []).filter((o) => o.trim()).length < 2)) || new Set(ids).size !== ids.length) {
      throw new ServiceError("Couldn't save that. Please check the questions (each needs a label; a choice question needs two options).");
    }
    await mergeSetting(slug, "submissionForm", extras.length ? { extras } : null);
  },

  /** Every submitted paper's reviewers and reviews: one read of `GET /conferences/:id/review-board` (chairs) plus the conference for the target and deadline. */
  async loadReviewBoard(slug): Promise<ReviewBoard> {
    const [conf, b] = await Promise.all([getConference(slug), api<Board>(`/conferences/${slug}/review-board`)]);
    const board: ReviewBoard = { target: toSettings(conf).limits.reviewersPerPaper, deadline: isoDay(conf.reviewDeadline), papers: {} };
    for (const p of b.papers) {
      const reviewers = toReviewers(p.assignments, p.pending, board.deadline);
      const declined: DeclinedReviewer[] = p.assignments.filter((a) => a.status === "declined").map((a) => ({ name: a.reviewer.name, reason: a.declineReason ?? "", at: label(a.respondedAt) }));
      board.papers[p.submissionId] = { reviewers, declined };
    }
    return board;
  },

  /** The versions of every paper (supporting material left out), from the same read as the overview. `storagePath` carries "<paper>/<file>" for the file routes. */
  async loadScreeningFiles(slug) {
    const o = await getOverview(slug);
    const out: Record<string, ScreeningFile[]> = {};
    for (const p of o.papers) {
      if (p.status === "draft") continue;
      out[p.id] = p.files.filter((f) => f.kind !== "supplementary").sort((a, b) => a.version - b.version)
        .map((f, i) => ({ n: i + 1, name: f.fileName, uploadedAt: label(f.uploadedAt), auto: (f.autoCheck ?? null) as ScreeningFile["auto"], storagePath: `${p.id}/${f.id}` }));
    }
    return out;
  },

  async loadCfpFacts(slug): Promise<CfpFacts> {
    const [members, cfp] = await Promise.all([
      api<MemberResponse[]>(`/conferences/${slug}/members`, { query: { role: "cfp_manager" } }).catch(() => [] as MemberResponse[]),
      api<{ content: Record<string, unknown>; status: string }>(`/conferences/${slug}/cfp`),
    ]);
    return { managers: members.filter((m) => m.status !== "removed").length, publishing: str(cfp.content.publication).trim() !== "", description: str(cfp.content.description).trim() !== "", inReview: cfp.status === "in_review" };
  },

  async loadReviewerPool(slug): Promise<ReviewerPool> {
    const [members, conf] = await Promise.all([api<MemberResponse[]>(`/conferences/${slug}/members`, { query: { role: "reviewer" } }), getConference(slug)]);
    const reviewers: PoolReviewer[] = members.filter((m) => m.status !== "removed").map((m) => ({
      memberId: m.id, userId: m.userId, name: m.name || m.email || "Reviewer", email: m.email ?? "", affiliation: m.affiliation ?? "", tracks: m.expertise ?? [],
      status: m.status === "active" ? "active" : m.status === "declined" ? "declined" : "invited", invitedAt: label(m.invitedAt),
    }));
    return { reviewers, tracks: toSettings(conf).tracks.map((t) => t.name) };
  },

  async inviteReviewer(slug, person): Promise<InviteResult> {
    const email = person.email.trim().toLowerCase();
    if (!isValidEmail(email) || !person.name.trim()) throw new ServiceError("Enter the reviewer's name and a valid email address.");
    const r = await api<{ created: boolean; member: { id: string; userId: string | null } }>(`/conferences/${slug}/members`, { method: "POST", body: { email, role: "reviewer", displayName: person.name.trim(), expertise: person.tracks } });
    return { memberId: r.member.id, userId: r.member.userId, created: r.created };
  },
  /** One paper as its chair sees it: `GET /submissions/by-label/:label` (chair view), its reviewers and reviews (`GET /submissions/:id/reviews`), the conference's overview and review form. */
  async loadPaper(paperLabel) {
    if (!/^([A-Za-z0-9]{1,40})-(\d{1,9})$/.test(paperLabel)) return null;
    let sub: PaperDto;
    try { sub = await api<PaperDto>(`/submissions/by-label/${encodeURIComponent(paperLabel)}`); }
    catch (e) { if (e instanceof ApiError && (e.status === 403 || e.status === 404)) return null; throw e; }
    if (sub.view !== "chair") return null; // an author or reviewer has their own page for it
    const slug = sub.conferenceSlug;
    const [data, conf, rv, setup] = await Promise.all([
      implemented.loadConference!(slug), getConference(slug), api<PaperReviews>(`/submissions/${sub.id}/reviews`), implemented.loadReviewSetup!(slug),
    ]);
    const found = data.papers.find((p) => p.dbId === sub.id);
    if (!found) return null;
    const deadline = isoDay(conf.reviewDeadline);
    const toFile = (f: PaperDto["files"][number]) => ({ name: f.fileName, uploadedAt: label(f.uploadedAt), storagePath: `${sub.id}/${f.id}` });
    const files = [...sub.files].sort((a, b) => a.version - b.version);
    return {
      paper: found, data, form: setup.form, abstract: sub.abstract, keywords: sub.keywords,
      files: files.filter((f) => f.kind !== "supplementary").map(toFile), supporting: files.filter((f) => f.kind === "supplementary").map(toFile),
      reviewers: toReviewers(rv.assignments, rv.pending, deadline),
      declined: rv.assignments.filter((a) => a.status === "declined").map((a) => ({ name: a.reviewer.name, reason: a.declineReason || "No reason given", at: label(a.respondedAt) })),
      fixRequest: sub.fixRequest ? { issue: sub.fixRequest.issue, fixBy: sub.fixRequest.fixBy, at: label(sub.fixRequest.at) } : null,
      decisionNote: sub.decisionNote ?? "", notifiedAt: label(sub.notifiedAt),
    } satisfies ChairPaperDetail;
  },

  async recordDecision(paperDbId, decisionTypeId, note) {
    needUuid(paperDbId, decisionTypeId);
    await api(`/submissions/${paperDbId}/decision`, { method: "POST", body: { decisionTypeId, note: (note ?? "").trim().slice(0, 5000) || null } });
  },
  /** Sends the recorded decision; the reviews the chair marked as shared go with it. */
  async saveRegistration(paperDbId, r) {
    needUuid(paperDbId);
    await api(`/submissions/${paperDbId}/registration`, { method: "PUT", body: { payment: r.payment, attendance: r.attendance, presenterEmail: r.presenterEmail, note: r.note?.trim() ? r.note.trim() : null } });
  },
  async notifyDecision(paperDbId, note) {
    needUuid(paperDbId);
    const rv = await api<{ assignments: BoardAssignment[] }>(`/submissions/${paperDbId}/reviews`);
    const shareReviewIds = rv.assignments.filter((a) => a.review?.status === "submitted" && a.review.sharedWithAuthor).map((a) => a.review!.id);
    const text = (note ?? "").trim().slice(0, 5000);
    await api(`/submissions/${paperDbId}/decision/notify`, { method: "POST", body: { ...(text ? { note: text } : {}), shareReviewIds } });
  },
  async setReviewShared(reviewId, shared) { needUuid(reviewId); await api(`/reviews/${reviewId}/shared`, { method: "PATCH", body: { shared } }); },
  async editReview(reviewId, values) { needUuid(reviewId); await api(`/reviews/${reviewId}`, { method: "PUT", body: reviewFields(values) }); },
  async submitOwnReview(paperDbId, values) {
    needUuid(paperDbId);
    const r = await api<{ review: { id: string } | null }>(`/submissions/${paperDbId}/chair-review`, { method: "PUT", body: reviewFields(values) });
    if (!r.review) throw new ServiceError("Couldn't save this review.");
    return r.review.id;
  },
  async setReviewDue(assignmentId, dateISO) {
    needUuid(assignmentId);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) throw new ServiceError("Couldn't change this deadline.");
    await api(`/assignments/${assignmentId}/due-date`, { method: "PATCH", body: { date: dateISO } });
  },
  /** Takes a reviewer off one paper: their assignment, or the paper waiting for an invited reviewer. */
  async removeReviewerFromPaper(paperDbId, reviewerUserId) {
    needUuid(paperDbId, reviewerUserId);
    const rv = await api<PaperReviews>(`/submissions/${paperDbId}/reviews`);
    const a = rv.assignments.find((x) => x.reviewer.userId === reviewerUserId);
    if (a) { await api(`/assignments/${a.id}`, { method: "DELETE" }); return; }
    const w = rv.pending.find((x) => x.memberId === reviewerUserId);
    if (w) { await api(`/pending-assignments/${w.id}`, { method: "DELETE" }); return; }
    throw new ServiceError("We couldn't find that any more — reload the page.");
  },
  async requestFix(paperDbId, issue, fixByISO) {
    needUuid(paperDbId);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fixByISO) || !issue.trim()) throw new ServiceError("Say what needs fixing and by when.");
    await api(`/submissions/${paperDbId}/fix-request`, { method: "POST", body: { issue: issue.trim().slice(0, 2000), fixBy: fixByISO } });
  },
  async setSubmissionTrack(paperDbIds, track) {
    const ids = paperDbIds.filter((id) => UUID.test(id));
    if (!ids.length) return 0;
    const slug = await slugOfPaper(ids[0]);
    return (await api<{ count: number }>(`/conferences/${slug}/submissions/track`, { method: "PATCH", body: { ids, track } })).count;
  },
  async deleteSubmissions(paperDbIds) {
    const ids = paperDbIds.filter((id) => UUID.test(id));
    if (!ids.length) return 0;
    const slug = await slugOfPaper(ids[0]);
    return (await api<{ count: number }>(`/conferences/${slug}/submissions/delete`, { method: "POST", body: { ids } })).count;
  },

  /** Gives papers to a reviewer (an invited one gets them queued on the invitation). Returns the papers given. */
  async assignPapers(reviewer, paperDbIds, dueISO) {
    const given: string[] = [];
    let last: unknown = null;
    for (const id of paperDbIds) {
      try { await api(`/submissions/${id}/assignments`, { method: "POST", body: { memberIds: [reviewer.memberId], dueDate: dueISO || null } }); given.push(id); }
      catch (e) { last = e; }
    }
    if (!given.length && last) throw last;
    return given;
  },
  /** Takes someone off the committee: the backend also takes them off their papers. */
  async removeReviewer(slug, reviewer) { await api(`/conferences/${slug}/members/${reviewer.memberId}`, { method: "DELETE" }); },

  async saveScreening(paperDbId, version, record) {
    needUuid(paperDbId);
    await api(`/submissions/${paperDbId}/screening/${version}`, { method: "PUT", body: { record } });
  },
  async uploadScreeningReport(paperDbId, file) {
    needUuid(paperDbId);
    const form = new FormData();
    form.append("file", file);
    const conferenceId = await slugOfPaper(paperDbId);
    const up = await api<{ path: string }>("/files", { method: "POST", query: { purpose: "screening_report", conferenceId, submissionId: paperDbId }, body: form });
    return { name: file.name, path: up.path };
  },
  /** Opens a stored file: a paper file ("<paperId>/<fileId>") or a screening report; the routes need the Bearer header, so the bytes are fetched. */
  async fileUrl(storagePath, download) {
    const m = /^([0-9a-f-]{36})\/([0-9a-f-]{36})$/i.exec(storagePath);
    const blob = m ? await apiBlob(`/submissions/${m[1]}/files/${m[2]}`) : await apiBlob("/files", { query: { path: storagePath } });
    // Opening (not downloading): a PDF must carry the PDF type, or the new tab saves it instead of showing it. The bytes decide, whatever the response said.
    const isPdf = !download && (await blob.slice(0, 5).text()).startsWith("%PDF");
    const url = URL.createObjectURL(download ? new Blob([blob], { type: "application/octet-stream" }) : isPdf && blob.type !== "application/pdf" ? new Blob([blob], { type: "application/pdf" }) : blob);
    setTimeout(() => URL.revokeObjectURL(url), 10 * 60 * 1000);
    return url;
  },
  async saveDecisionTypes(slug, types) {
    const bad = types.some((t) => !t.label.trim() || t.label.length > 100);
    if (!types.length || types.length > 50 || bad) throw new ServiceError("Couldn't save that. Every decision needs a name (up to 100 characters).");
    await api(`/conferences/${slug}/decision-types`, { method: "PUT", body: { types: types.map((t) => ({ ...(UUID.test(t.id) ? { id: t.id } : {}), label: t.label.trim(), color: t.color, outcome: t.outcome, description: t.description.trim() || null, authorLabel: (t.authorLabel ?? "").trim() || null })) } });
  },

  /* ---- emails: the conference's templates, its Email Logs (Backend/src/modules/communications) */
  async loadEmailTemplates(slug) {
    const r = await api<TemplatesResponse>(`/conferences/${slug}/email-templates`);
    const platform = r.templates.map((t) => ({ key: t.key, module: t.module ?? "", role: t.role ?? "", label: t.label, sendType: t.sendType ?? "", trigger: t.triggerText ?? "", recipients: t.recipients ?? "", subject: t.defaultSubject, body: t.defaultBody }));
    const mine: Record<string, ConferenceTemplate> = {};
    // A copy exists once the chair changed the text or switched the email off; the backend answers every email with its effective text.
    for (const t of r.templates) if (t.customized || !t.enabled) mine[t.key] = { key: t.key, label: t.label, enabled: t.enabled, subject: t.subject, body: t.body, custom: false };
    for (const c of r.customEmails) mine[c.key] = { key: c.key, label: c.name, enabled: c.enabled, subject: c.subject, body: c.body, custom: true };
    return { platform, mine } satisfies EmailTemplates;
  },
  async saveEmailTemplate(slug, t) {
    if (!t.subject.trim() || t.subject.length > 300 || t.body.length > 50000 || t.key.length > 80 || (t.custom && !t.key.startsWith("custom:"))) throw new ServiceError("Couldn't save that. Please check the email and try again.");
    await api(`/conferences/${slug}/email-templates/${encodeURIComponent(t.key)}`, { method: "PUT", body: { enabled: t.enabled, subject: t.subject, body: t.body, ...(t.custom ? { label: t.label } : {}) } });
  },
  async deleteEmailTemplate(slug, key) { await api(`/conferences/${slug}/email-templates/${encodeURIComponent(key)}`, { method: "DELETE" }); },
  async loadEmailLogs(slug) {
    const out: ChairEmailLog[] = [];
    let cursor: string | null = null;
    // The page reads the last 300; the backend sends 100 at a time.
    for (let i = 0; i < 3; i += 1) {
      const page: EmailLogPage = await api<EmailLogPage>(`/conferences/${slug}/email-log`, { query: { limit: 100, cursor } });
      for (const l of page.data) out.push({ id: l.id, createdAt: l.createdAt, event: l.event, template: l.templateLabel || l.templateKey, templateKey: l.templateKey, ...(l.submissionId ? { submissionId: l.submissionId } : {}), toEmail: l.toEmail, toName: l.toName ?? "", recipientType: l.recipientType ?? "", subject: l.subject, body: l.body ?? "", status: l.status === "failed" ? "failed" : l.status === "sent" ? "sent" : "queued", error: l.error ?? "" });
      cursor = page.nextCursor;
      if (!cursor) break;
    }
    return out;
  },

  /* ---- the activity log (read from the backend's audit log) and the license extension requests */
  async loadActivityLogs(slug) {
    const rows = await api<ActivityRow[]>(`/conferences/${slug}/activity`, { query: { limit: 1000 } });
    return rows.map((r) => ({ id: r.id, datetime: r.at, actorName: r.actorName, actorRole: r.actorRole, action: r.action, module: r.module, description: r.description, status: r.status, ...(r.reviewerName ? { reviewerName: r.reviewerName } : {}), ...(r.previousValue ? { previousValue: r.previousValue } : {}), ...(r.newValue ? { newValue: r.newValue } : {}) }));
  },
  async loadLicenseRequest(slug) {
    const r = await api<Partial<LicenseRow>>(`/conferences/${slug}/license-request`);
    return r.id ? toLicense(r as LicenseRow) : null;
  },
  async requestLicenseExtension(slug, requestedDate, reason) { await api(`/conferences/${slug}/license-request`, { method: "POST", body: { requestedDate, ...(reason.trim() ? { reason: reason.trim() } : {}) } }); },
  async withdrawLicenseRequest(slug) { await api(`/conferences/${slug}/license-request`, { method: "DELETE" }); },

  // Conference Settings › Submissions › Paper Screening: the two steps and the criteria (the auto initial check has its own switch and is left as it is).
  async saveScreeningSetup(slug, setup) {
    const c = setup.criteria;
    const nums = [c.minPages, c.maxPages, c.doubleMinPages, c.doubleMaxPages, c.similarityLimit, c.aiLimit, c.correctionDays, c.revisionDays];
    if (nums.some((n) => !Number.isFinite(n) || n < 0 || n > 1000) || !["single", "double", "either"].includes(c.column) || c.minPages > c.maxPages || c.doubleMinPages > c.doubleMaxPages) {
      throw new ServiceError("Couldn't save that. Check the page limits: each minimum must be at or below its maximum.");
    }
    await api(`/conferences/${slug}/screening-settings`, { method: "PUT", body: { settings: { initialCheck: setup.initialCheck, plagiarism: setup.plagiarism }, criteria: c } });
  },

  async decideExtension(requestId, approve) { await api(`/extension-requests/${requestId}/decision`, { method: "POST", body: { approve } }); },
  async renameReviewer(slug, memberId, name) { await api(`/conferences/${slug}/members/${memberId}`, { method: "PATCH", body: { displayName: nul(name) } }); },
  async setReviewerTracks(slug, memberId, tracks) { await api(`/conferences/${slug}/members/${memberId}`, { method: "PATCH", body: { expertise: tracks } }); },
};

/** Everything not connected yet answers with a clear message instead of failing in some other way. */
export const apiChairService = new Proxy(implemented, {
  get(target, prop: string) {
    const fn = (target as Record<string, unknown>)[prop];
    if (fn) return fn;
    if (prop === "then") return undefined; // so `await getChairService()` does not treat the proxy as a promise
    return () => Promise.reject(notAvailable("This part of the Chair workspace"));
  },
}) as ChairService;
