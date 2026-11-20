/* Review health of one conference (the prototype's reviewHealth.js), from the papers the API
   returns: how many papers sit at each stage, reviewer coverage, late reviews, and the warnings that
   mean the chair may need a hand. Counts only on the conference page; names only on a paper's page. */
import type { AdminPaper, AdminReviewer } from "./services";
import type { Tone } from "./components/ui";

// Stage order and labels match the chair's Peer Review list; keys are the API's.
export const REVIEW_STAGES: { key: string; label: string; tone: Tone }[] = [
  { key: "upload", label: "Upload pending", tone: "neutral" },
  { key: "screening", label: "Plagiarism check", tone: "accent" },
  { key: "needs_reviewers", label: "Needs reviewers", tone: "warning" },
  { key: "awaiting_response", label: "Awaiting acceptance", tone: "secondary" },
  { key: "in_review", label: "In review", tone: "primary" },
  { key: "overdue", label: "Overdue", tone: "danger" },
  { key: "ready", label: "Ready to decide", tone: "success" },
  { key: "decided", label: "Decided", tone: "neutral" },
];
export const STAGE_BY_KEY = Object.fromEntries(REVIEW_STAGES.map((s) => [s.key, s]));

export const STAGE_COLORS: Record<Tone, string> = {
  neutral: "var(--border-strong)",
  accent: "var(--accent)",
  warning: "var(--warning)",
  secondary: "var(--secondary)",
  primary: "var(--primary)",
  danger: "var(--danger)",
  success: "var(--success)",
};

export type ReviewerState = "done" | "active" | "waiting" | "overdue" | "declined";
export const REVIEWER_STATE: Record<ReviewerState, [string, Tone]> = {
  done: ["Review submitted", "success"],
  active: ["Reviewing", "primary"],
  waiting: ["Hasn't accepted the paper", "warning"],
  overdue: ["Overdue", "danger"],
  declined: ["Declined", "neutral"],
};

const today = () => new Date().toISOString().slice(0, 10);

export function reviewerState(r: AdminReviewer): ReviewerState {
  if (r.status === "declined" || r.status === "removed") return "declined";
  if (r.reviewStatus === "submitted" || r.status === "submitted") return "done";
  if (r.dueAt && r.dueAt.slice(0, 10) < today()) return "overdue";
  return r.status === "accepted" ? "active" : "waiting";
}

const activeReviewers = (p: AdminPaper) => (p.reviewers ?? []).filter((r) => r.status !== "declined" && r.status !== "removed");

export const RISK: Record<"high" | "medium" | "ok", [string, Tone]> = { high: ["Needs attention", "danger"], medium: ["Watch", "warning"], ok: ["On track", "success"] };

export function reviewHealth(all: AdminPaper[]) {
  const papers = all.filter((p) => p.stage);
  const drafts = all.filter((p) => p.status === "draft").length;
  const withdrawn = all.filter((p) => p.status === "withdrawn").length;
  const byStage = Object.fromEntries(REVIEW_STAGES.map((s) => [s.key, papers.filter((p) => p.stage === s.key).length])) as Record<string, number>;
  const open = papers.filter((p) => p.stage !== "decided");
  const reviewable = open.filter((p) => p.stage !== "upload" && p.stage !== "screening");
  const fullyAssigned = reviewable.filter((p) => activeReviewers(p).length >= p.reviewersWanted).length;
  const assignments = papers.flatMap(activeReviewers);
  const overdueReviews = assignments.filter((r) => reviewerState(r) === "overdue").length;
  const unanswered = assignments.filter((r) => reviewerState(r) === "waiting").length;
  const reviewsIn = papers.reduce((n, p) => n + p.reviewsIn, 0);
  const reviewsExpected = open.reduce((n, p) => n + Math.max(activeReviewers(p).length, p.reviewersWanted), 0) + papers.filter((p) => p.stage === "decided").reduce((n, p) => n + p.reviewsIn, 0);
  // The earliest due date among reviews still open.
  const dues = assignments.filter((r) => r.dueAt && reviewerState(r) !== "done").map((r) => r.dueAt!.slice(0, 10)).sort();
  const reviewDue = dues[0] ?? null;
  const daysToDue = reviewDue ? Math.round((new Date(reviewDue).getTime() - new Date(today()).getTime()) / 86_400_000) : null;

  const flags: { tone: Tone; text: string }[] = [];
  if (overdueReviews) flags.push({ tone: "danger", text: `${overdueReviews} review${overdueReviews === 1 ? " is" : "s are"} overdue` });
  if (byStage.needs_reviewers)
    flags.push({
      tone: daysToDue != null && daysToDue <= 14 ? "danger" : "warning",
      text: `${byStage.needs_reviewers} paper${byStage.needs_reviewers === 1 ? " has" : "s have"} no reviewer${daysToDue != null && daysToDue <= 14 ? ` · reviews due ${daysToDue < 0 ? `${-daysToDue} days ago` : `in ${daysToDue} days`}` : ""}`,
    });
  if (unanswered) flags.push({ tone: "warning", text: `${unanswered} assignment${unanswered === 1 ? "" : "s"} not yet accepted by the reviewer` });
  if (byStage.screening) flags.push({ tone: "warning", text: `${byStage.screening} paper${byStage.screening === 1 ? "" : "s"} held at the plagiarism check` });
  if (byStage.ready) flags.push({ tone: "primary", text: `${byStage.ready} paper${byStage.ready === 1 ? " is" : "s are"} ready for a decision` });
  const risk: keyof typeof RISK = flags.some((f) => f.tone === "danger") ? "high" : flags.some((f) => f.tone === "warning") ? "medium" : "ok";

  return {
    papers: papers.length,
    drafts,
    withdrawn,
    byStage,
    coverage: reviewable.length ? Math.round((fullyAssigned / reviewable.length) * 100) : null,
    fullyAssigned,
    reviewable: reviewable.length,
    target: papers[0]?.reviewersWanted ?? 0,
    overdueReviews,
    unanswered,
    reviewsIn,
    reviewsExpected,
    decided: byStage.decided,
    reviewDue,
    daysToDue,
    flags,
    risk,
  };
}

export const recommendationLabel = (r: AdminReviewer["recommendation"]) => (r === "accept" ? "Accept" : r === "reject" ? "Reject" : r === "revise" ? "Revise" : null);
