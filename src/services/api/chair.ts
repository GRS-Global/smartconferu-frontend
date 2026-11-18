import { api, ApiError, publicFileUrl } from "@/lib/api-client";
import { PEER_REVIEW_FORM, PROTECTED_FIELD_IDS, sectionsFromStored } from "@/features/reviewer/form-schema";
import { extrasFromStored } from "@/types/author-submission";
import {
  DEFAULT_CRITERIA, DEFAULT_PRESENTATION_TYPES, DEFAULT_REVIEW_LIMITS, DEFAULT_REVIEW_POLICY, DEFAULT_REVIEW_TIMELINE, DEFAULT_SUBMISSION_POLICY,
  type CfpFacts, type ChairActivityLog, type ChairAuthor, type ChairConference, type ChairPaper, type ChairReviewer, type DeclinedReviewer, type ReviewBoard, type ScreeningFile, type ConferenceInfo, type ConferenceSettings, type DecisionType, type DeletionRequest,
  type InviteResult, type Outcome, type PoolReviewer, type ReviewerPool, type ScreeningCriteria, type ScreeningRecord,
} from "@/types/chair";
import type { ChairService } from "../chair";
import { ServiceError } from "../errors";

/* The Chair workspace through the own backend. Only the conference-level part is here so far (details, settings, reviewer pool, logo, archive and
   deletion, the overview the workspace frame reads); everything about single papers (reviews, decisions, screening, assignments) and the email
   pages answer "not available yet" until they are connected, so a screen that needs them says so instead of showing something wrong.
   Every `:conferenceId` in a path may be the conference's slug. Backend/src/modules/conferences + reviews (chair-overview). */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const str = (v: unknown) => (typeof v === "string" ? v : "");
const isoDay = (ts: string | null | undefined) => (ts ? ts.slice(0, 10) : "");
const label = (ts: string | null | undefined) => (ts ? new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "");
const nul = (v: string) => (v.trim() === "" ? null : v.trim());
const rec = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/* ---------------------------------------------------------------- backend shapes (only what is read) */

interface ConferenceResponse {
  id: string; slug: string; acronym: string; title: string; about: string | null; mode: string | null; venue: string | null; city: string | null; state: string | null; country: string | null;
  webPage: string | null; contactEmail: string | null; primaryArea: string | null; secondaryArea: string | null; startDate: string | null; endDate: string | null;
  submissionDeadline: string | null; reviewDeadline: string | null; reviewMode: string; details: Record<string, unknown> | null; status: string; logoPath: string | null; createdAt: string;
  settings: Record<string, unknown> | null; deletionRequest: { status: string; reason: string; adminNote: string | null } | null; cfpStatus: string;
}
interface MemberResponse { id: string; role: string; status: string; userId: string | null; name: string; email: string | null; expertise: string[]; invitedAt: string }
interface OverviewPaper {
  id: string; paperId: string; title: string; track: string | null; presentationType: string | null; keywords: string[]; status: string; outcome: string; decisionTypeId: string | null;
  notifiedOutcome: string | null; screening: Record<string, unknown> | null; files: Array<{ id: string; kind: string; version: number; fileName: string; uploadedAt: string; autoCheck: Record<string, unknown> | null }>; withdrawnAt: string | null; withdrawnBy: string | null; submittedAt: string; updatedAt: string;
  authors: Array<{ name: string; email: string; affiliation: string | null; country: string | null; corresponding: boolean; hasAccount: boolean }> | null;
  reviewersAssigned: number; reviewsReceived: number; averageScore: number | null;
}
interface BoardReview {
  id: string; status: string; score: number | null; confidence: string | null; commentsToAuthor: string | null; commentsToChair: string | null; answers: Record<string, unknown>;
  sharedWithAuthor: boolean; submittedAt: string | null;
}
interface BoardAssignment {
  id: string; reviewer: { userId: string; name: string; email: string | null }; status: string; byChair: boolean; dueAt: string | null; assignedAt: string;
  respondedAt: string | null; declineReason: string | null; review: BoardReview | null;
}
interface BoardPending { id: string; memberId: string; name: string; email: string | null; dueAt: string | null; createdAt: string }
interface Board { conferenceId: string; papers: Array<{ submissionId: string; assignments: BoardAssignment[]; pending: BoardPending[] }> }
interface Overview {
  conferenceId: string; cfpStatus: string; papers: OverviewPaper[];
  decisionTypes: Array<{ id: string; label: string; color: string; outcome: Outcome; description: string | null }>;
  screening: { settings: { initialCheck?: boolean; plagiarism?: boolean }; criteria: Partial<ScreeningCriteria> };
}

const getConference = (slug: string) => api<ConferenceResponse>(`/conferences/${slug}`);
const patchConference = (slug: string, body: Record<string, unknown>) => api<ConferenceResponse>(`/conferences/${slug}`, { method: "PATCH", body });
/** The backend merges these top-level keys into the conference's `settings` (null removes one). */
const mergeSetting = (slug: string, key: string, value: unknown) => api<ConferenceResponse>(`/conferences/${slug}/settings`, { method: "PATCH", body: { settings: { [key]: value } } });
const notAvailable = (what: string) => new ServiceError(`${what} isn't available with the own backend yet.`);

/* ---------------------------------------------------------------- mappers */

function toChairPaper(p: OverviewPaper, slug: string): ChairPaper {
  const authors: ChairAuthor[] = (p.authors ?? []).map((a) => ({ name: a.name, email: a.email, affiliation: a.affiliation ?? "", country: a.country ?? "", corresponding: a.corresponding, hasAccount: a.hasAccount }));
  return {
    id: p.paperId, dbId: p.id, conferenceId: slug, title: p.title, track: p.track ?? "", presentationType: p.presentationType ?? "", authors, keywords: p.keywords,
    submittedAt: label(p.submittedAt), lastUpdate: label(p.updatedAt), withdrawn: p.status === "withdrawn", withdrawnAt: label(p.withdrawnAt || p.updatedAt), withdrawnBy: p.withdrawnBy === "chair" ? "chair" : "author",
    outcome: p.outcome as Outcome, decisionTypeId: p.decisionTypeId, notifiedOutcome: (p.notifiedOutcome as Outcome | null) ?? null,
    reviewersAssigned: p.reviewersAssigned, reviewsReceived: p.reviewsReceived, averageScore: p.averageScore,
    versions: p.files.filter((f) => f.kind !== "supplementary").length, screening: (p.screening ?? {}) as Record<string, ScreeningRecord>,
  };
}

function toInfo(c: ConferenceResponse): ConferenceInfo {
  const d = rec(c.details);
  return {
    name: c.title, acronym: c.acronym, about: c.about ?? "", webPage: c.webPage ?? "", contactEmail: c.contactEmail ?? "", primaryArea: c.primaryArea ?? "", secondaryArea: c.secondaryArea ?? "",
    startDate: c.startDate ?? "", endDate: c.endDate ?? "", mode: c.mode === "in_person" || c.mode === "virtual" || c.mode === "hybrid" ? c.mode : "", venue: c.venue ?? "", city: c.city ?? "", state: c.state ?? "", country: c.country ?? "",
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
    submission: { ...DEFAULT_SUBMISSION_POLICY, ...rec(s.submissionPolicy) },
    review: { ...DEFAULT_REVIEW_POLICY, ...rec(s.reviewPolicy) },
  };
}

/* ---------------------------------------------------------------- the implemented part */

const implemented: Partial<ChairService> = {
  async loadConference(slug) {
    const o = await api<Overview>(`/conferences/${slug}/chair-overview`);
    const decisionTypes: DecisionType[] = o.decisionTypes.map((t) => ({ id: t.id, label: t.label, color: t.color, outcome: t.outcome, description: t.description ?? "" }));
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
    if (!i.name.trim() || i.name.length > 300 || i.about.length > 20000 || !url(i.webPage) || (i.contactEmail.trim() && !/^\S+@\S+\.\S+$/.test(i.contactEmail.trim())) || (i.startDate && i.endDate && i.endDate < i.startDate)) {
      throw new ServiceError("Couldn't save that. Please check the conference details and try again.");
    }
    const cur = await getConference(slug);
    const details = {
      ...rec(cur.details), timezone: i.timezone, abstractDeadline: i.abstractDeadline, summary: i.summary, language: i.language, replyForwardingEmail: i.replyEmail, smartConfEmail: i.smartConfEmail,
      topics: i.topics, address: i.address, postalCode: i.postalCode, lat: i.lat, lng: i.lng,
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
    if (!file) throw notAvailable("Removing the logo");
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
      const reviewers: ChairReviewer[] = p.assignments.filter((a) => a.status !== "declined" && a.status !== "removed").map((a) => {
        const r = a.review && a.review.status === "submitted" ? a.review : null;
        return {
          assignmentId: a.id, reviewerId: a.reviewer.userId, name: a.reviewer.name, email: a.reviewer.email ?? "", response: a.status === "assigned" ? "pending" : "accepted",
          assignedAt: label(a.assignedAt), due: isoDay(a.dueAt) || board.deadline, byChair: a.byChair, awaitingInvite: false, extension: null,
          review: r ? {
            id: r.id, score: r.score, confidence: r.confidence ? r.confidence[0].toUpperCase() + r.confidence.slice(1) : "", commentsToAuthor: r.commentsToAuthor ?? "",
            commentsToChair: r.commentsToChair ?? "", shared: r.sharedWithAuthor, submittedAt: label(r.submittedAt), answers: r.answers ?? {},
          } : null,
        };
      });
      // Someone invited who has not joined the committee yet: the paper waits for them.
      for (const w of p.pending) {
        reviewers.push({ assignmentId: `pending-${w.memberId}`, reviewerId: w.memberId, name: w.name || w.email || "New reviewer", email: w.email ?? "", response: "pending", assignedAt: label(w.createdAt), due: isoDay(w.dueAt) || board.deadline, byChair: false, awaitingInvite: true, review: null });
      }
      const declined: DeclinedReviewer[] = p.assignments.filter((a) => a.status === "declined").map((a) => ({ name: a.reviewer.name, reason: a.declineReason ?? "", at: label(a.respondedAt) }));
      board.papers[p.submissionId] = { reviewers, declined };
    }
    return board;
  },

  /** The versions of every paper (supporting material left out), from the same read as the overview. `storagePath` carries "<paper>/<file>" for the file routes. */
  async loadScreeningFiles(slug) {
    const o = await api<Overview>(`/conferences/${slug}/chair-overview`);
    const out: Record<string, ScreeningFile[]> = {};
    for (const p of o.papers) {
      if (p.status === "draft") continue;
      out[p.id] = p.files.filter((f) => f.kind !== "supplementary").sort((a, b) => a.version - b.version)
        .map((f, i) => ({ n: i + 1, name: f.fileName, uploadedAt: label(f.uploadedAt), auto: (f.autoCheck ?? null) as ScreeningFile["auto"], storagePath: `${p.id}/${f.id}` }));
    }
    return out;
  },

  // The backend keeps no activity log a chair can read yet (the audit log is for admins), so the list is empty (see GAP-REPORT.md).
  async loadActivityLogs(): Promise<ChairActivityLog[]> { return []; },

  async loadCfpFacts(slug): Promise<CfpFacts> {
    const [members, cfp] = await Promise.all([
      api<MemberResponse[]>(`/conferences/${slug}/members`, { query: { role: "cfp_manager" } }).catch(() => [] as MemberResponse[]),
      api<{ content: Record<string, unknown> }>(`/conferences/${slug}/cfp`),
    ]);
    return { managers: members.filter((m) => m.status !== "removed").length, publishing: str(cfp.content.publication).trim() !== "", description: str(cfp.content.description).trim() !== "" };
  },

  async loadReviewerPool(slug): Promise<ReviewerPool> {
    const [members, conf] = await Promise.all([api<MemberResponse[]>(`/conferences/${slug}/members`, { query: { role: "reviewer" } }), getConference(slug)]);
    const reviewers: PoolReviewer[] = members.filter((m) => m.status !== "removed").map((m) => ({
      memberId: m.id, userId: m.userId, name: m.name || m.email || "Reviewer", email: m.email ?? "", tracks: m.expertise ?? [],
      status: m.status === "active" ? "active" : m.status === "declined" ? "declined" : "invited", invitedAt: label(m.invitedAt),
    }));
    return { reviewers, tracks: toSettings(conf).tracks.map((t) => t.name) };
  },

  async inviteReviewer(slug, person): Promise<InviteResult> {
    const email = person.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !person.name.trim()) throw new ServiceError("Enter the reviewer's name and a valid email address.");
    const r = await api<{ created: boolean; member: { id: string; userId: string | null } }>(`/conferences/${slug}/members`, { method: "POST", body: { email, role: "reviewer", displayName: person.name.trim(), expertise: person.tracks } });
    return { memberId: r.member.id, userId: r.member.userId, created: r.created };
  },
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
