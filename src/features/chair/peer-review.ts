import type { ChairPaper, ChairReviewer, DeclinedReviewer, ReviewBoard } from "@/types/chair";
import { inPeerReview, isDecision, screeningStageOf, type Screening } from "./stage";

/* What the Peer Review list shows for one paper, worked out once (the prototype's peerReviewRow, PR_STAGES, PR_FILTERS and
   PR_REVIEWER_STATE in src/author-journey.jsx), on what the database stores. */

export type ReviewerState = "done" | "active" | "waiting" | "invite" | "overdue";
export interface PrReviewer { r: ChairReviewer; state: ReviewerState; lateDays: number }
export type PrStage = "upload" | "plagiarism" | "needs" | "awaiting" | "review" | "overdue" | "ready" | "decided";

export interface PrRow {
  paper: ChairPaper;
  reviewers: PrReviewer[];
  declined: DeclinedReviewer[];
  stage: PrStage;
  decided: boolean;
  /** Decided, but the authors have not been told. */
  unsent: boolean;
  reviewsIn: number;
  overdue: number;
  /** Reviewers who have asked the chair for more time and are waiting for an answer (migration 0043). */
  extensions: number;
  nextDue: string;
  avg: number | null;
  /** The reviewers disagree: one accepts and one rejects, or scores two or more apart. */
  split: boolean;
  target: number;
  canAssign: boolean;
}

export const PR_STAGES: Record<PrStage, { label: string; color: string; bg: string }> = {
  upload: { label: "Upload pending", color: "var(--ink-faint)", bg: "var(--muted)" },
  plagiarism: { label: "Plagiarism Check", color: "#0369A1", bg: "#E0F2FE" },
  needs: { label: "Needs reviewers", color: "#B45309", bg: "var(--warning-soft)" },
  awaiting: { label: "Awaiting acceptance", color: "#7C3AED", bg: "#F3E8FF" },
  review: { label: "In review", color: "var(--primary)", bg: "var(--primary-soft)" },
  overdue: { label: "Overdue", color: "var(--danger-ink)", bg: "var(--danger-soft)" },
  ready: { label: "Ready to decide", color: "#15803D", bg: "var(--success-soft)" },
  decided: { label: "Decided", color: "var(--ink-soft)", bg: "var(--muted)" },
};
export const REVIEWER_STATE: Record<ReviewerState, { label: string; word: string; color: string }> = {
  done: { label: "Review submitted", word: "Submitted", color: "var(--success-ink)" },
  active: { label: "Accepted · reviewing", word: "In review", color: "var(--primary)" },
  waiting: { label: "Hasn't accepted the paper yet", word: "Not accepted yet", color: "var(--warning-ink)" },
  invite: { label: "Hasn't accepted the committee invitation", word: "Invite pending", color: "var(--warning-ink)" },
  overdue: { label: "Overdue", word: "Overdue", color: "var(--danger-ink)" },
};

/** Days to a date, as the prototype counts them (daysToISO): to the END of that day, rounded up. A review due today still has 1 day left, and a review is
 *  overdue (a negative count) only from the second day after its due date. */
const daysFrom = (iso: string) => Math.ceil((new Date(`${iso}T23:59:59.999`).getTime() - Date.now()) / 86400000);

export function prRowOf(paper: ChairPaper, board: ReviewBoard, screening: Screening): PrRow {
  const entry = board.papers[paper.dbId] ?? { reviewers: [], declined: [] };
  const reviewers: PrReviewer[] = entry.reviewers.map((r) => {
    const late = r.due ? -daysFrom(r.due) : 0;
    const state: ReviewerState = r.review ? "done" : r.awaitingInvite ? "invite" : r.response === "pending" ? "waiting" : late > 0 ? "overdue" : "active";
    return { r, state, lateDays: state === "overdue" ? late : 0 };
  });
  const reviews = reviewers.flatMap((x) => (x.r.review ? [x.r.review] : []));
  const scores = reviews.flatMap((v) => (v.score != null && v.score > 0 ? [v.score] : []));
  const recs = reviews.map((v) => String(v.answers["f-decision"] ?? ""));
  const split = (recs.includes("Accept") && recs.includes("Reject")) || (scores.length > 1 && Math.max(...scores) - Math.min(...scores) >= 2);
  const decided = isDecision(paper.outcome);
  const cleared = inPeerReview(paper) || paper.outcome === "plagiarism_clear" || screeningStageOf(paper, screening) === "clear";
  const overdue = reviewers.filter((x) => x.state === "overdue").length;
  const stage: PrStage = decided ? "decided"
    : paper.outcome === "upload_pending" ? "upload"
      : !cleared ? "plagiarism"
        : reviewers.length === 0 ? "needs"
          : reviews.length >= reviewers.length ? "ready"
            : overdue ? "overdue"
              : reviews.length === 0 && reviewers.every((x) => x.state === "waiting" || x.state === "invite") ? "awaiting" : "review";
  const nextDue = reviewers.filter((x) => x.state === "active" || x.state === "overdue").map((x) => x.r.due).filter(Boolean).sort()[0] ?? "";
  return {
    paper, reviewers, declined: entry.declined, stage, decided, unsent: decided && !paper.withdrawn && paper.notifiedOutcome !== paper.outcome,
    reviewsIn: reviews.length, overdue, extensions: reviewers.filter((x) => x.r.extension).length, nextDue, split, target: board.target,
    avg: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null,
    canAssign: !decided && cleared && paper.outcome !== "upload_pending" && !paper.withdrawn,
  };
}

const inScreening = (r: PrRow) => !r.decided && (r.stage === "plagiarism" || r.stage === "upload");
const short = (r: PrRow) => r.canAssign && r.reviewers.length < r.target;
const declinedShort = (r: PrRow) => short(r) && r.declined.length > 0;
const overdueNow = (r: PrRow) => !r.decided && r.overdue > 0;
const askingForTime = (r: PrRow) => !r.decided && r.extensions > 0;

export interface PrFilter { key: string; label: string; match: (r: PrRow) => boolean; parent?: string; hidden?: boolean; chips?: Array<{ text: string; tone: "danger" | "warning" | "info"; filter: string; test: (r: PrRow) => boolean }> }
// The four review buckets never overlap — a paper is in at most one, checked in this order (as in the prototype):
// decided → all reviews in (my decision) → short of reviewers → reviews being written.
// Papers still in screening (plagiarism check / upload) are not in review yet: they show only under "All papers".
const isReady = (r: PrRow) => !r.decided && !inScreening(r) && r.stage === "ready";
const needsReviewers = (r: PrRow) => !r.decided && !inScreening(r) && !isReady(r) && short(r);
const inReview = (r: PrRow) => !r.decided && !inScreening(r) && !isReady(r) && !short(r);
/** The list's buckets (one per job the chair has to do) and the chips' own filters (hidden). */
export const PR_FILTERS: PrFilter[] = [
  { key: "all", label: "All papers", match: () => true },
  { key: "needs", label: "Needs reviewers", match: needsReviewers, chips: [{ text: "declined", tone: "warning", filter: "declined", test: (r) => needsReviewers(r) && declinedShort(r) }] },
  { key: "waiting", label: "Reviews in progress", match: inReview, chips: [{ text: "overdue", tone: "danger", filter: "overdue", test: (r) => inReview(r) && overdueNow(r) }, { text: "asking for time", tone: "warning", filter: "extensions", test: (r) => inReview(r) && askingForTime(r) }] },
  { key: "ready", label: "Needs my decision", match: isReady },
  { key: "decided", label: "Decided", match: (r) => r.decided, chips: [{ text: "not sent to authors", tone: "warning", filter: "unsent", test: (r) => r.unsent }] },
  { key: "declined", parent: "needs", label: "A reviewer declined", hidden: true, match: (r) => needsReviewers(r) && declinedShort(r) },
  { key: "overdue", parent: "waiting", label: "Overdue reviews", hidden: true, match: (r) => inReview(r) && overdueNow(r) },
  { key: "extensions", parent: "waiting", label: "Asking for more time", hidden: true, match: (r) => inReview(r) && askingForTime(r) },
  { key: "unsent", parent: "decided", label: "Not sent to authors", hidden: true, match: (r) => r.unsent },
];
/** Declined reviewers are shown beside the current ones only while the paper is still short of its target. */
export const declinedShown = (r: PrRow): DeclinedReviewer[] => (declinedShort(r) ? r.declined : []);
export const isShort = short;
export const daysUntil = (iso: string) => daysFrom(iso);
