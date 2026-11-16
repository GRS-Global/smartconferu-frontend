import type { ChairPaper, ScreeningRecord } from "@/types/chair";

/* Where a submitted paper stands in the chair's pipeline: Submitted → Initial check → Plagiarism check → Review → Decision →
   Registration. A port of the prototype's chairStageOf (src/author-journey.jsx) and of the screening stage logic it builds on
   (stageOf, checkDecisionOf, inPeerReview in src/chair-plagiarism/data.js), working on what the database stores
   (`submissions.screening`, one record per uploaded version, keyed "1", "2" …). The Submissions list, its stage cards and the
   dashboard's pipeline all read this, so they always agree. */

export type StageKey = "initial" | "plagiarism" | "review" | "decision" | "registration";
export const CHAIR_STAGES: Array<{ key: StageKey; label: string; color: string; bg: string }> = [
  { key: "initial", label: "Initial check", color: "var(--primary-hover)", bg: "var(--primary-soft)" },
  { key: "plagiarism", label: "Plagiarism check", color: "#0369A1", bg: "#E0F2FE" },
  { key: "review", label: "Review", color: "#B45309", bg: "var(--warning-soft)" },
  { key: "decision", label: "Decision", color: "#7C3AED", bg: "#F3E8FF" },
  { key: "registration", label: "Registration", color: "#15803D", bg: "var(--success-soft)" },
];

export type Tone = "success" | "warning" | "danger" | null;
export interface Stage { key: StageKey | "withdrawn"; label: string; status: string; tone: Tone }
export interface Screening { initialCheck: boolean; plagiarism: boolean }

/** The initial check's decision on a version's record: passed, revision, reject, hold or pending. */
export const checkDecisionOf = (rec: ScreeningRecord | undefined): string => rec?.check?.decision || (rec?.check?.passed ? "passed" : rec?.correction ? "revision" : "pending");

/** A paper with reviewers assigned, or a decision, is in peer review: its screening is final. */
export const inPeerReview = (p: Pick<ChairPaper, "reviewersAssigned" | "outcome">): boolean => p.reviewersAssigned > 0 || isDecision(p.outcome);

/** An outcome that is a decision (not just a stage the paper sits in). */
export const isDecision = (o: ChairPaper["outcome"]): boolean => !["upload_pending", "no_decision", "plagiarism_clear"].includes(o);

export type ScreeningStage = "check" | "correction" | "hold" | "ready" | "ithenticate" | "decide" | "revision" | "rejected" | "clear";

/** The screening stage of the newest uploaded version. */
export function screeningStageOf(p: ChairPaper, screening: Screening): ScreeningStage {
  const n = p.versions;
  const r: ScreeningRecord = p.screening[String(n)] ?? {};
  const decision = screening.initialCheck ? checkDecisionOf(r) : "passed";
  // Sent back at the initial check — even after a plagiarism report (the chair reopened it).
  if (decision === "revision") return "correction";
  if (decision === "reject" || r.outcome?.kind === "reject") return "rejected";
  if (decision === "hold" || r.outcome?.kind === "hold") return "hold";
  if (r.outcome?.kind === "clear") return "clear";
  if (r.outcome?.kind === "revision") return "revision";
  // Initial check passed — at iThenticate (or done, when this conference skips it).
  if (decision === "passed") {
    if (!screening.plagiarism) return "clear";
    if (r.report) return "decide";
    if (r.ithenticate) return "ithenticate";
    return "ready";
  }
  // Cleared by hand from Peer Review ("Mark plagiarism clear") without a report.
  if (p.outcome === "plagiarism_clear") return "clear";
  // A final (camera-ready) file uploaded after acceptance isn't screened again.
  if (n > 1 && (p.outcome === "accept" || p.outcome === "registered") && p.screening[String(n - 1)]?.outcome?.kind === "clear") return "clear";
  return "check";
}

const stageLabel = (key: StageKey) => CHAIR_STAGES.find((s) => s.key === key)!.label;
const at = (key: StageKey, status: string, tone: Tone = null): Stage => ({ key, label: stageLabel(key), status, tone });

/** Where one paper stands now: the stage, and its status inside it. */
export function chairStageOf(p: ChairPaper, screening: Screening): Stage {
  if (p.withdrawn) return { key: "withdrawn", label: "Withdrawn", status: "Withdrawn", tone: "danger" };
  if (p.outcome === "accept" || p.outcome === "registered") {
    const registered = p.outcome === "registered";
    return at("registration", registered ? "Registered" : "Registration pending", registered ? "success" : "warning");
  }
  if (p.outcome === "reject") return at("decision", "Rejected", "danger");
  if (p.outcome === "revise") return at("decision", "Changes requested", "warning");
  // Papers already with reviewers have been through screening.
  if (!inPeerReview(p)) {
    const stage = screeningStageOf(p, screening);
    const passedCheck = !screening.initialCheck || checkDecisionOf(p.screening[String(p.versions)]) === "passed";
    if (stage === "check") return at("initial", "Due");
    if (stage === "correction") return at("initial", "With author", "warning");
    if (stage === "hold") return passedCheck ? at("plagiarism", "On hold", "warning") : at("initial", "On hold", "warning");
    if (stage === "ready") return at("plagiarism", "Ready to send");
    if (stage === "ithenticate") return at("plagiarism", "In iThenticate");
    if (stage === "decide") return at("plagiarism", "Report added");
    if (stage === "revision") return at("plagiarism", "With author", "warning");
    if (stage === "rejected") return at("decision", "Rejected at screening", "danger");
  }
  const assigned = p.reviewersAssigned;
  const received = p.reviewsReceived;
  if (!assigned) return at("review", "Needs reviewers", "warning");
  if (received >= assigned) return at("review", "Ready to decide", "success");
  return at("review", `${received} of ${assigned} reviews in`);
}
