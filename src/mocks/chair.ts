import type { ChairService } from "@/services/chair";
import { mockSlug, PARITY, PARITY_ALIAS_FROM, PARITY_ALIAS_TO } from "@/mocks/parity";
import { PEER_REVIEW_FORM } from "@/features/reviewer/form-schema";
import { DEFAULT_CRITERIA, DEFAULT_REVIEW_POLICY, DEFAULT_SUBMISSION_POLICY } from "@/types/chair";
import type { ChairAuthor, ChairPaper, ChairPaperDetail, ReviewBoard, ReviewerPool } from "@/types/chair";

/* Typed fixtures for NEXT_PUBLIC_DATA_SOURCE=mock (UI work only; no network, no accounts). Conference slug matches src/mocks/conferences.ts.
   They cover every stage of the chair's pipeline: initial check due / with author, plagiarism ready, needs reviewers, reviews in,
   ready to decide, decided, registration pending / registered, withdrawn. */

/** QA only (NEXT_PUBLIC_MOCK_SCREENING=parity): the Screening pages show the prototype's own 498 papers (generated into parity-screening.ts), so both apps can be compared on the same data. */
const SCREENING_PARITY = process.env.NEXT_PUBLIC_MOCK_SCREENING === "parity";
/** QA only: NEXT_PUBLIC_MOCK_CFP=draft shows a conference whose Call for Papers is not out yet (the menu lock and the setup checklist). */
const CFP_STATUS = process.env.NEXT_PUBLIC_MOCK_CFP === "draft" ? "draft" as const : "published" as const;

const au = (name: string, corresponding = false): ChairAuthor => ({ name, email: `${name.toLowerCase().replace(/\W+/g, ".")}@example.org`, affiliation: "Example University", country: "India", corresponding, hasAccount: true });
const paper = (n: number, title: string, over: Partial<ChairPaper>): ChairPaper => ({
  id: `DSAI-${n}`, dbId: `mock-cp-${n}`, conferenceId: "demo-dsai-2027", title, track: "General Track", presentationType: "Paper Presentation",
  authors: [au("Dr. Rahman", true), au("Priya Nair")], keywords: ["edge computing", "latency"], submittedAt: "Sep 14, 2026", lastUpdate: "Oct 02, 2026", withdrawn: false, withdrawnAt: "", withdrawnBy: "author",
  outcome: "no_decision", decisionTypeId: null, notifiedOutcome: null, reviewersAssigned: 0, reviewsReceived: 0, averageScore: null, versions: 1, screening: {}, ...over,
});

/** The review-side email templates of the platform (stand-ins for the database's), for trying the settings pages in mock mode. */
/** QA only (NEXT_PUBLIC_MOCK_ANALYTICS=rich): about 90 papers with different countries, affiliations, keywords, submission days and decisions, so every Analytics tab has something to draw. Deterministic (no randomness). */
const ANALYTICS_RICH = process.env.NEXT_PUBLIC_MOCK_ANALYTICS === "rich";
const RICH_PLACES: Array<[string, string]> = [["India", "Vishwakarma Institute of Technology"], ["India", "Amrita Vishwa Vidyapeetham"], ["India", "Anna University"], ["Indonesia", "Jakarta State University"], ["Indonesia", "Bina Nusantara University"], ["Philippines", "National University"], ["Vietnam", "Hanoi University of Science and Technology"], ["United States", "Stanford University"], ["Bangladesh", "Independent University"], ["Thailand", "University of Phayao"], ["Sri Lanka", "University of Moratuwa"], ["South Africa", "University of Cape Town"], ["China", "Tsinghua University"], ["Japan", "University of Tokyo"], ["Germany", "TU Munich"], ["United Kingdom", "University of Oxford"], ["Nigeria", "University of Lagos"], ["Brazil", "University of Sao Paulo"], ["Canada", "University of Toronto"], ["Australia", "University of Melbourne"]];
const RICH_WORDS = ["Machine Learning", "Artificial Intelligence", "Deep Learning", "Digital Transformation", "Supply Chain Analytics", "Explainable AI", "Cybersecurity", "Fintech", "Internet of Things", "Federated Learning", "Computer Vision", "Sustainability Reporting"];
const richPapers = (): ChairPaper[] => Array.from({ length: 90 }, (_, i) => {
  const [country, affiliation] = RICH_PLACES[(i * 7 + (i % 3)) % (i % 4 === 0 ? 3 : RICH_PLACES.length)];
  const [country2, affiliation2] = RICH_PLACES[(i * 5 + 2) % RICH_PLACES.length];
  const n = 1 + ((i * 3) % 5) % 4 + (i % 9 === 0 ? 4 : 0);
  const authors: ChairAuthor[] = Array.from({ length: n }, (_, k) => {
    const pool = k === 0 ? i % 14 : (i + k * 3) % 30; // a few authors come back on several papers
    const [c, a] = k === 0 ? [country, affiliation] : k % 2 ? [country2, affiliation2] : [country, affiliation];
    return { name: `Author ${pool}`, email: `author${pool}@example.org`, affiliation: a, country: c, corresponding: k === 0, hasAccount: false };
  });
  const day = new Date(2026, 4, 22 + Math.round(Math.sqrt(i) * 11));
  const outcome = i % 11 === 0 ? "no_decision" : i % 13 === 0 ? "revise" : i % 17 === 0 ? "waitlist" : i % 2 ? "accept" : "reject";
  return paper(1000 + i, `Analytics sample paper ${i + 1}`, {
    authors, keywords: [RICH_WORDS[i % 12], RICH_WORDS[(i * 5 + 1) % 12], RICH_WORDS[(i * 7 + 3) % 12]], submittedAt: day.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    outcome, decisionTypeId: null, screening: {},
  });
});

const REVIEW_STUBS = ([
  ["reviewerActivateReminder", "recruitment", "reviewer", "Activate your reviewer account", "Reminder: activate your {{conference_acronym}} reviewer account"],
  ["reviewersInactiveChair", "recruitment", "chair", "Reviewers not yet active", "Reviewers who have not activated their account"],
  ["reviewerProfileReminder", "recruitment", "reviewer", "Complete your reviewer profile", "Please complete your reviewer profile"],
  ["reviewDueSoon", "reviewing", "reviewer", "Review reminder 1 — days left", "Your review is due soon"],
  ["reviewLastDay", "reviewing", "reviewer", "Review reminder 2 — last day", "Last day to submit your review"],
  ["reviewOverdue", "reviewing", "reviewer", "Review overdue", "Your review is overdue"],
  ["overdueDigestChair", "reviewing", "chair", "Overdue reviews: daily list", "Overdue reviews today"],
  ["reviewFormLocked", "reviewing", "reviewer", "Grace period over: review form locked", "The review form is now locked"],
  ["missedReviewsChair", "reviewing", "chair", "Papers need action: missed reviews", "Papers with missed reviews"],
  ["reviewProgressDigest", "reviewing", "chair", "Review progress digest", "Review progress"],
  ["chairDecisionReady", "reviewing", "chair", "Paper ready for decision", "A paper is ready for your decision"],
  ["submissionsOpen", "setup", "chair", "Submissions open today", "Submissions are open for {{conference_acronym}}"],
  ["draftReminder", "submission", "author", "Your draft is not submitted yet", "Your draft is not submitted yet"],
  ["deadlineApproaching", "submission", "author", "Submission deadline approaching", "The submission deadline is approaching"],
  ["submissionsClosedSummary", "setup", "chair", "Submissions closed: summary", "Submissions closed for {{conference_acronym}}"],
  ["similarityFlag", "setup", "chair", "Possible duplicate or similarity flag", "A paper was flagged for similarity"],
] as const).map(([key, module, role, label, subject]) => ({ key, module, role, label, sendType: "scheduled", trigger: "Sent by the system on a timer", recipients: role === "chair" ? "Conference Chair" : "The reviewer", subject, body: "<p>Hi {{first_name}},</p><p>" + subject + " — {{conference_name}}.</p>" }));

const PAPERS: ChairPaper[] = [
  paper(1, "Federated Learning for Privacy-Preserving IoT Analytics", { screening: {} }),
  paper(2, "Scenario-Based Forecasting of Media Supply and Demand", { screening: { "1": { check: { decision: "revision" }, correction: { reasons: ["x"] } } } }),
  paper(3, "Adaptive Curriculum Sequencing with Bandits", { screening: { "1": { check: { decision: "passed" } } } }),
  paper(4, "Edge Caching under Intermittent Connectivity", { screening: { "1": { check: { decision: "passed" }, outcome: { kind: "clear" } } } }),
  paper(5, "Lightweight Intrusion Detection on IoT Gateways", { screening: { "1": { check: { decision: "passed" }, outcome: { kind: "clear" } } }, reviewersAssigned: 3, reviewsReceived: 1, averageScore: 3.5 }),
  paper(6, "A Study of Congestion Control in LEO Constellations", { screening: { "1": { check: { decision: "passed" }, outcome: { kind: "clear" } } }, reviewersAssigned: 3, reviewsReceived: 3, averageScore: 4.2 }),
  paper(7, "Zero-Trust Segmentation at Scale", { outcome: "accept", notifiedOutcome: "accept", reviewersAssigned: 3, reviewsReceived: 3, averageScore: 4.5 }),
  paper(8, "Gaze-Aware Interfaces for Seminars", { outcome: "reject", notifiedOutcome: "reject", reviewersAssigned: 2, reviewsReceived: 2, averageScore: 2 }),
  paper(9, "Registered Paper", { outcome: "registered", notifiedOutcome: "registered", reviewersAssigned: 2, reviewsReceived: 2, averageScore: 4 }),
  paper(10, "Withdrawn Draft on Sparse Attention", { withdrawn: true, withdrawnAt: "Oct 10, 2026" }),
];

export const mockChairService: ChairService = {
  async loadPaper(paperLabel) {
    const paper = PAPERS.find((p) => p.id === paperLabel);
    if (!paper) return null;
    // Visual QA (parity mode): the demo conference is listed on the dashboard under the prototype's id, so the paper belongs to that one.
    return {
      paper: PARITY && paper.conferenceId === PARITY_ALIAS_TO ? { ...paper, conferenceId: PARITY_ALIAS_FROM } : paper, data: await this.loadConference(paper.conferenceId), form: PEER_REVIEW_FORM, abstract: "We study the problem and propose a method that keeps latency low.", keywords: ["edge", "latency"], files: [{ name: `${paper.id}_paper_v1.pdf`, uploadedAt: "Sep 14, 2026", storagePath: PARITY ? "qa/paper.pdf" : null }], supporting: [],
      reviewers: Array.from({ length: paper.reviewersAssigned }, (_, i): ChairPaperDetail["reviewers"][number] => ({
        assignmentId: `mock-a-${paper.id}-${i}`, reviewerId: `mock-r-${i}`, name: ["Elena Petrova", "Ben Whitfield", "Aisha Khan"][i % 3], email: "", response: "accepted", assignedAt: "Oct 01, 2026", due: "2026-12-01", byChair: false, awaitingInvite: false,
        review: i < paper.reviewsReceived ? { id: `mock-rv-${paper.id}-${i}`, score: paper.averageScore ? Math.round(paper.averageScore) : 3, confidence: "Medium", commentsToAuthor: "A clear paper.", commentsToChair: "Accept if space allows.", shared: i === 0, submittedAt: "Oct 20, 2026", answers: {} } : null,
      })),
      declined: [], decisionNote: "", notifiedAt: paper.notifiedOutcome ? "Oct 25, 2026" : "",
    };
  },
  async loadReviewBoard(conferenceSlug) {
    if (SCREENING_PARITY && mockSlug(conferenceSlug) === "demo-dsai-2027") return (await import("@/mocks/parity-peerreview")).PEER_BOARD;
    const board: ReviewBoard = { target: 2, deadline: "2026-12-01", papers: {} };
    if (mockSlug(conferenceSlug) !== "demo-dsai-2027") return board;
    for (const p of PAPERS) {
      board.papers[p.dbId] = { reviewers: (await this.loadPaper(p.id))?.reviewers ?? [], declined: p.id === "DSAI-5" ? [{ name: "Ben Whitfield", reason: "Conflict of interest", at: "Oct 05, 2026" }] : [] };
    }
    return board;
  },
  async loadReviewerPool(conferenceSlug) {
    if (SCREENING_PARITY && mockSlug(conferenceSlug) === "demo-dsai-2027") return (await import("@/mocks/parity-peerreview")).PEER_POOL;
    const pool: ReviewerPool = { reviewers: [], tracks: [] };
    if (mockSlug(conferenceSlug) !== "demo-dsai-2027") return pool;
    pool.tracks = ["General Track"];
    pool.reviewers = [
      { memberId: "mock-m-0", userId: "mock-r-0", name: "Elena Petrova", email: "elena@example.org", tracks: ["General Track"], status: "active", invitedAt: "Sep 01, 2026" },
      { memberId: "mock-m-1", userId: "mock-r-1", name: "Ben Whitfield", email: "ben@example.org", tracks: [], status: "active", invitedAt: "Sep 01, 2026" },
      { memberId: "mock-m-9", userId: null, name: "New Reviewer", email: "new@example.org", tracks: [], status: "invited", invitedAt: "Oct 20, 2026" },
    ];
    return pool;
  },
  async inviteReviewer() { return { memberId: "mock-new", userId: null, created: true }; },
  async renameReviewer() { /* mock mode keeps nothing */ },
  async setReviewerTracks() { /* mock mode keeps nothing */ },
  async removeReviewer() { /* mock mode keeps nothing */ },
  async assignPapers(_r, ids) { return ids; },
  async loadScreeningFiles(conferenceSlug) {
    const out: Record<string, import("@/types/chair").ScreeningFile[]> = {};
    if (mockSlug(conferenceSlug) !== "demo-dsai-2027") return out;
    if (SCREENING_PARITY) return (await import("@/mocks/parity-screening")).SCREENING_FILES;
    for (const p of PAPERS) out[p.dbId] = Array.from({ length: p.versions }, (_, i) => ({ n: i + 1, name: `${p.id}_paper_v${i + 1}.pdf`, uploadedAt: "Sep 14, 2026", auto: { status: "done" as const, pages: 12, editable: true, english: true, column: "single" as const }, storagePath: null }));
    return out;
  },
  // QA only (parity fixtures): four sample sends, as the prototype's sample data has, so the table can be compared.
  async loadEmailLogs() {
    if (!PARITY) return [];
    const mk = (id: string, createdAt: string, subject: string, template: string): import("@/types/chair").ChairEmailLog => ({ id, createdAt, event: "sample", template, toName: "Mihir Chauhan", toEmail: "gauravgjind@gmail.com", recipientType: "Author", subject, body: "<p>Sample email.</p>", status: "sent", error: "" });
    return [mk("l1", "2026-11-03T07:00:00Z", "Revision Required – ISBM-680", "Revision Request"), mk("l2", "2026-11-02T07:00:00Z", "Acceptance Notification – ISBM-717", "Acceptance Notification"), mk("l3", "2026-10-31T08:00:00Z", "Book your presentation slot – ISBM 2026-27", "Slot Booking"), mk("l4", "2026-10-25T10:00:00Z", "Submission Confirmation – ISBM-693", "Submission Confirmation")];
  },
  // QA only: the prototype's sample log, in parity mode; otherwise empty like the real service.
  async archiveConference() { /* mock mode keeps nothing */ },
  async restoreConference() { /* mock mode keeps nothing */ },
  async loadDeletionRequest() { return null; },
  async requestDeletion() { /* mock mode keeps nothing */ },
  async cancelDeletion() { /* mock mode keeps nothing */ },
  async saveLogo(_slug, file) { return file ? URL.createObjectURL(file) : ""; },
  async loadLicenseRequest() { return null; },
  async requestLicenseExtension() { /* mock mode keeps nothing */ },
  async withdrawLicenseRequest() { /* mock mode keeps nothing */ },
  async loadCfpFacts() { return PARITY ? { managers: 1, publishing: true, description: true } : { managers: 0, publishing: false, description: false }; },
  async loadActivityLogs() { return PARITY ? (await import("@/mocks/parity-activity")).PARITY_ACTIVITY_LOGS : []; },
  async loadSubmissionForm() { return []; },
  async saveSubmissionForm() { /* mock mode keeps nothing */ },
  async loadReviewSetup() { return { form: PEER_REVIEW_FORM, custom: false, instructions: "", instructionsMode: "html", instructionsPdf: null }; },
  async saveReviewForm() { /* mock mode keeps nothing */ },
  async saveReviewInstructions() { /* mock mode keeps nothing */ },
  async saveReviewInstructionsMode() { /* mock mode keeps nothing */ },
  async saveReviewInstructionsPdf(_slug, file) { return { name: file.name, url: URL.createObjectURL(file) }; },
  async loadInfo() { return { name: "Demo conference", acronym: "DSAI 2027", about: "", webPage: "", contactEmail: "", primaryArea: "", secondaryArea: "", startDate: "2027-02-07", endDate: "2027-02-09", mode: "in_person" as const, venue: "", city: "Pune", state: "", country: "India", submissionDeadline: "", reviewDeadline: "" , timezone: "", abstractDeadline: "", summary: "", language: "", replyEmail: "", smartConfEmail: "", topics: [], status: "active", address: "", postalCode: "", lat: null, lng: null, logoUrl: "", logoPath: "", createdAt: "2026-11-03", licenseExpiry: "" }; },
  async saveInfo() { /* mock mode keeps nothing */ },
  async loadSettings() { return { timeline: { opensAt: "", closesAt: "", reviewDays: 14, reminder1Enabled: true, reminder1Days: 3, reminder2Enabled: true, reminder2Days: 0 }, limits: { reviewersPerPaper: 2, maxPapersPerReviewer: null, reviewMode: "double_blind" as const }, presentationTypes: ["Paper Presentation", "Poster Presentation", "Workshop"], tracks: [], stored: true, submission: DEFAULT_SUBMISSION_POLICY, review: DEFAULT_REVIEW_POLICY }; },
  async saveReviewTimeline() { /* mock mode keeps nothing */ },
  async saveSubmissionPolicy() { /* mock mode keeps nothing */ },
  async saveReviewPolicy() { /* mock mode keeps nothing */ },
  async saveReviewLimits() { /* mock mode keeps nothing */ },
  async savePresentationTypes() { /* mock mode keeps nothing */ },
  async saveTracks() { /* mock mode keeps nothing */ },
  async saveScreeningSetup() { /* mock mode keeps nothing */ },
  async loadEmailTemplates() { return { platform: [
    { key: "submission_received", module: "submission", role: "author", label: "Submission received", sendType: "auto", trigger: "Author clicks Submit", recipients: "Author (submitting) · All co-authors", subject: "Submission received: {{paper_title}}", body: "<p>Hi {{first_name}},</p>" },
    { key: "submission_edited", module: "submission", role: "author", label: "Submission edited", sendType: "auto", trigger: "Author edits before deadline", recipients: "Author (submitting) · All co-authors", subject: "Your submission {{submission_id}} was updated", body: "<p>Hi {{first_name}},</p>" },
    { key: "co_author_added", module: "account", role: "author", label: "You were added as a co-author", sendType: "auto", trigger: "Author submits a paper listing other people as authors", recipients: "Co-author", subject: "{{submitter_name}} added you", body: "<p>Hi {{first_name}},</p>" },
    { key: "paper_accepted", module: "decision", role: "author", label: "Paper accepted", sendType: "chair", trigger: "Chair releases an Accept decision", recipients: "Author (submitting) · All co-authors", subject: "Accepted: {{paper_title}}", body: "<p>Hi {{first_name}},</p>" },
    { key: "deadline_soon", module: "submission", role: "author", label: "Submission deadline approaching", sendType: "scheduled", trigger: "Deadline in 7 days", recipients: "Author (submitting)", subject: "{{conference_acronym}} submissions close soon", body: "<p>Hi {{first_name}},</p>" },
    ...REVIEW_STUBS,
  ], mine: {} }; },
  async saveEmailTemplate() { /* mock mode keeps nothing */ },
  async deleteEmailTemplate() { /* mock mode keeps nothing */ },
  async saveDecisionTypes() { /* mock mode keeps nothing */ },
  async editReview() { /* mock mode keeps nothing */ },
  async submitOwnReview() { return "mock-review"; },
  async uploadScreeningReport(_id, file) { return { name: file.name, path: `mock/${file.name}` }; },
  async fileUrl() { return PARITY ? "/__qa-paper.pdf" : "about:blank"; }, // visual QA serves a small PDF at this address
  async saveScreening() { /* mock mode keeps nothing */ },
  async recordDecision() { /* mock mode keeps nothing */ },
  async notifyDecision() { /* mock mode keeps nothing */ },
  async deleteSubmissions(ids) { return ids.length; },
  async setSubmissionTrack(ids) { return ids.length; },
  async setReviewShared() { /* mock mode keeps nothing */ },
  async decideExtension() { /* mock mode keeps nothing */ },
  async setReviewDue() { /* mock mode keeps nothing */ },
  async removeReviewerFromPaper() { /* mock mode keeps nothing */ },
  async requestFix() { /* mock mode keeps nothing */ },
  async loadConference(conferenceSlug) {
    if (SCREENING_PARITY && mockSlug(conferenceSlug) === "demo-dsai-2027") { const { PEER_PATCH, PEER_DECISION_TYPES, PEER_SIMILARITY } = await import("@/mocks/parity-peerreview"); return { dbId: "mock-conference", cfpStatus: CFP_STATUS, papers: (await import("@/mocks/parity-screening")).SCREENING_PAPERS.map((p) => { let v = String(p.versions); while (Number(v) > 1 && !p.screening[v]?.report) v = String(Number(v) - 1); const rec = p.screening[v]; const sim = PEER_SIMILARITY[p.dbId]; return { ...p, ...(PEER_PATCH[p.dbId] ?? {}), ...(rec?.report && sim !== undefined ? { screening: { ...p.screening, [v]: { ...rec, report: { ...rec.report, similarity: sim } } } } : {}) }; }), decisionTypes: PEER_DECISION_TYPES, criteria: DEFAULT_CRITERIA, screening: { initialCheck: true, plagiarism: true } }; }
    if (ANALYTICS_RICH && mockSlug(conferenceSlug) === "demo-dsai-2027") return { dbId: "mock-conference", cfpStatus: CFP_STATUS, papers: richPapers(), decisionTypes: [], criteria: DEFAULT_CRITERIA, screening: { initialCheck: true, plagiarism: true } };
    const papers = mockSlug(conferenceSlug) === "demo-dsai-2027" ? PAPERS.map((p) => ({ ...p, authors: p.authors.map((a) => ({ ...a })) })) : [];
    return { dbId: "mock-conference", cfpStatus: CFP_STATUS, papers, decisionTypes: [], criteria: DEFAULT_CRITERIA, screening: { initialCheck: true, plagiarism: true } };
  },
};
