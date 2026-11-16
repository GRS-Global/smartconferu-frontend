import { PEER_REVIEW_FORM } from "@/features/reviewer/form-schema";
import { PARITY, mockSlug } from "@/mocks/parity";
import type { ReviewerService } from "@/services/reviewer";
import type { ReviewDetail, ReviewValues, ReviewerPaper } from "@/types/reviewer";

/* Typed fixtures for NEXT_PUBLIC_DATA_SOURCE=mock (UI work only; no network, no accounts). Conference slugs match
   src/mocks/conferences.ts. They cover every status of a reviewer's paper: waiting for an answer, not started, draft, overdue, sent. */

const day = (n: number) => { const d = new Date(Date.now() + n * 86400000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const p = (n: number, conferenceId: string, prefix: string, title: string, over: Partial<ReviewerPaper>): ReviewerPaper => ({
  id: `${prefix}-${n}`, dbId: `mock-rp-${prefix}-${n}`, assignmentId: `mock-ra-${prefix}-${n}`, conferenceId, title,
  abstract: "We study the problem and propose a method that keeps latency low. Experiments on three benchmarks confirm the gains.",
  track: "General Track", presentationType: "Paper Presentation", keywords: ["edge", "latency"], response: "accepted", assignedOn: "Oct 2, 2026",
  due: day(20), review: null, draft: false, withdrawn: false, ...over,
});

const NETS = "demo-nets-2026";
// Visual QA only: the prototype's headline conference answers with the demo conference, and this reviewer holds the prototype's papers there.
const ISBM = "demo-dsai-2027";
const parityPapers: ReviewerPaper[] = PARITY ? [
  p(680, ISBM, "ISBM", "AI Automation in Business Process Reengineering", { track: "Business Analytics", keywords: ["business process reengineering", "AI automation", "process mining", "SME productivity", "automation readiness"], abstract: "Business process reengineering (BPR) projects increasingly rely on AI-driven automation, yet mid-size enterprises struggle to tell which processes will actually benefit. This paper studies 42 BPR initiatives in Indian manufacturing and services firms with 2,501,000 employees, where machine-learning and robotic automation were introduced between 2019 and 2025. Using process-mining logs and structured interviews with 68 process owners, we measure cycle time, error rate and cost per transaction before and after automation." }),
  p(701, ISBM, "ISBM", "Usage-Based Pricing and Churn in B2B SaaS Subscriptions", { response: "pending", track: "Digital Business" }),
  p(732, ISBM, "ISBM", "Machine-Learning Maintenance Scheduling for Indian Railway Rolling Stock", { draft: true, track: "Operations & Supply Chain" }),
] : [];
const state: { papers: ReviewerPaper[]; declined: number } = {
  declined: 1,
  papers: [
    p(118, NETS, "NETS", "Edge Caching under Intermittent Connectivity", { response: "pending" }),
    p(119, NETS, "NETS", "Adaptive Routing for Mesh Networks", { due: day(-3) }),
    p(120, NETS, "NETS", "Lightweight Intrusion Detection on IoT Gateways", { draft: true, due: day(6) }),
    p(121, NETS, "NETS", "A Study of Congestion Control in LEO Constellations", {}),
    p(122, NETS, "NETS", "Zero-Trust Segmentation at Scale", { review: { score: 4, submittedAt: "Oct 20, 2026" } }),
    ...parityPapers,
  ],
};

const reviews = new Map<string, { values: ReviewValues; state: "draft" | "submitted" }>();

export const mockReviewerService: ReviewerService = {
  async loadReview(conferenceSlug, paperLabel) {
    const paper = state.papers.find((x) => x.conferenceId === mockSlug(conferenceSlug) && x.id === paperLabel);
    if (!paper) return null;
    const saved = reviews.get(paper.assignmentId);
    return { paper, form: PEER_REVIEW_FORM, instructions: "", instructionsMode: "html", instructionsPdf: null, values: saved?.values ?? {}, state: saved?.state ?? "none", files: [{ name: `${paper.id}_paper_v1.pdf`, uploadedAt: "Sep 14, 2026", storagePath: PARITY ? "qa/paper.pdf" : null }], decision: null } satisfies ReviewDetail;
  },
  async saveReview(assignmentId, _paperDbId, values, submit) {
    const had = reviews.get(assignmentId);
    if (had?.state === "submitted" && !submit) return { firstSubmit: false };
    reviews.set(assignmentId, { values, state: submit ? "submitted" : "draft" });
    const i = state.papers.findIndex((x) => x.assignmentId === assignmentId);
    if (i >= 0) state.papers[i] = { ...state.papers[i], draft: !submit, review: submit ? { score: Number(values["f-score"]) || null, submittedAt: "Oct 30, 2026" } : state.papers[i].review };
    return { firstSubmit: submit && had?.state !== "submitted" };
  },
  async listAssignments(conferenceSlug) {
    return { papers: state.papers.filter((x) => x.conferenceId === mockSlug(conferenceSlug)).map((x) => ({ ...x, keywords: [...x.keywords] })), declined: conferenceSlug === NETS ? state.declined : 0 };
  },
  async respond(assignmentId, accept) {
    const i = state.papers.findIndex((x) => x.assignmentId === assignmentId);
    if (i < 0) return;
    if (accept) state.papers[i] = { ...state.papers[i], response: "accepted" };
    else { state.papers.splice(i, 1); state.declined += 1; }
  },
  async requestExtension(assignmentId, dateISO, reason) {
    const i = state.papers.findIndex((x) => x.assignmentId === assignmentId);
    if (i < 0) return;
    state.papers[i] = { ...state.papers[i], extension: { date: dateISO, reason, at: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }), status: "pending" } };
  },
};
