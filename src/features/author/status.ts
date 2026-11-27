import type { Conference } from "@/types/conference";
import type { AuthorSubmission } from "@/types/author-submission";

/* What an author sees about one of their submissions: its status, in the agreed author labels, and the next step —
   a port of the prototype's src/author-module/authorStatus.js (the shared source of the Overview, My Submissions cards and
   table). Authors never see where a paper is inside review: "Under Review" covers everything before a released decision.

   Wording: the prototype takes a status's label from the chair's decision type ("Author sees"); here that is the `statusLabels` of the
   submission (decision_types.author_label, migration 0039), and every status without one keeps the agreed label. */

export type StatusKey = "withdrawn" | "draft" | "revise" | "waitlisted" | "waiting" | "registered" | "unregistered" | "pending" | "rejected";
export interface Status { key: StatusKey; label: string; color: string; bg: string; border: string; pulse?: boolean }
export interface NextStep { label: string; tone: string }
export interface SubmissionRow { sub: AuthorSubmission; status: Status; step: NextStep }

// Not sent yet: a solid amber, pulsing status so a paper that still needs its upload can't be missed.
const DRAFT: Status = { key: "draft", label: "Paper Upload Pending", color: "#FFFFFF", bg: "#B45309", border: "#92400E", pulse: true };
const REVISE: Status = { key: "revise", label: "Revision Required", color: "#B45309", bg: "#FFF4E5", border: "#FCD9A8" };

const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

/** The conference has ended (archived by its dates), not merely archived early — the prototype's `conferenceOver`. */
export const conferenceOver = (c: Pick<Conference, "status" | "endDate">) => c.status === "archived" && c.endDate < todayIso();

/** `finished`: the conference is archived (registration is closed). */
export function authorStatusOf(s: Pick<AuthorSubmission, "withdrawn" | "result" | "uploadPending" | "decision" | "statusLabels"> & { screeningRequest?: unknown }, finished: boolean): Status {
  const status = baseStatusOf(s, finished);
  // The chair's own wording ("Author sees" under Settings › Decision), when there is one for this status.
  const custom = s.statusLabels?.[status.key];
  return custom ? { ...status, label: custom } : status;
}

function baseStatusOf(s: Pick<AuthorSubmission, "withdrawn" | "result" | "uploadPending" | "decision"> & { screeningRequest?: unknown }, finished: boolean): Status {
  if (s.withdrawn) return { key: "withdrawn", label: "Withdrawn", color: "var(--danger-ink)", bg: "var(--danger-soft)", border: "#FECACA" };
  if (s.result === "draft") return DRAFT;
  // The chair moved it back to "Paper Upload Pending".
  if (s.result === "no_result" && s.uploadPending) return DRAFT;
  // Initial check / plagiarism check asked for a corrected / revised file.
  if (s.result === "no_result" && s.screeningRequest) return REVISE;
  if (s.result === "no_result" && s.decision === "revise") return REVISE;
  if (s.result === "no_result" && s.decision === "waitlist") return { key: "waitlisted", label: "Waitlisted", color: "var(--cat-virtual)", bg: "var(--cat-virtual-soft)", border: "var(--cat-virtual-soft)" };
  if (s.result === "no_result") return { key: "waiting", label: "Under Review", color: "var(--primary-hover)", bg: "var(--primary-soft)", border: "var(--primary-soft-border)" };
  if (s.result === "registered") return { key: "registered", label: "Registered", color: "#15803D", bg: "var(--success-soft)", border: "#BBF7D0" };
  if (s.result === "not_registered") {
    return finished
      ? { key: "unregistered", label: "Accepted – Not Registered", color: "var(--ink-soft)", bg: "var(--muted)", border: "var(--border)" }
      : { key: "pending", label: "Accepted – Registration Pending", color: "#92400E", bg: "var(--warning-soft)", border: "#FDE68A" };
  }
  return { key: "rejected", label: "Not Accepted", color: "var(--ink-soft)", bg: "var(--muted)", border: "var(--border)" };
}

/** The "Next step" on a submission, in the author's words; its colour is also the card's left edge.
 *  `closed`: the conference is archived. `over`: its dates have passed too. The presentation slot is not in the
 *  database yet (no programme data), so a registered paper never reads "You're all set". */
export function nextStepOf(status: Status, closed: boolean, over: boolean): NextStep {
  switch (status.key) {
    case "withdrawn": return { label: "Withdrawn", tone: "var(--danger-ink)" };
    case "draft": return closed ? { label: "Never sent", tone: "var(--ink-faint)" } : { label: "Upload your paper and submit", tone: "#B45309" };
    case "revise": return { label: "Upload your revised paper", tone: "var(--warning-ink)" };
    case "waitlisted": return { label: "Final answer on the date given", tone: "var(--cat-virtual)" };
    case "waiting": return { label: "Awaiting decision", tone: "var(--ink-faint)" };
    case "pending": return { label: "Register to confirm your slot", tone: "var(--primary)" };
    case "registered": return over ? { label: "Presented", tone: "var(--success-ink)" } : { label: "Book your presentation slot", tone: "var(--primary)" };
    case "unregistered": return { label: "Not registered", tone: "var(--ink-faint)" };
    default: return { label: "Decision released", tone: "var(--danger-ink)" };
  }
}

/* The My Submissions filters: the same groups, in the same words and order, as the numbers strip on the dashboard
   (Submitted · Accepted · Rejected · No Decision · Registered · Not Registered · Registration Pending), plus the two
   states the strip leaves out (not sent yet, withdrawn). Each test reads a row. */
const sent = (r: SubmissionRow) => r.sub.result !== "draft" && !r.sub.withdrawn;
/** Status sort order: the ones that need the author first, finished ones last. */
export const STATUS_ORDER: StatusKey[] = ["draft", "revise", "pending", "waiting", "waitlisted", "registered", "unregistered", "rejected", "withdrawn"];

export type FilterKey = "all" | "submitted" | "accepted" | "rejected" | "nodecision" | "registered" | "notregistered" | "regpending" | "draft" | "withdrawn";
export const STATUS_FILTERS: Array<{ key: FilterKey; label: string; test: (r: SubmissionRow, finished: boolean) => boolean }> = [
  { key: "all", label: "All", test: () => true },
  { key: "submitted", label: "Submitted", test: sent },
  { key: "accepted", label: "Accepted", test: (r) => sent(r) && (r.sub.result === "registered" || r.sub.result === "not_registered") },
  { key: "rejected", label: "Rejected", test: (r) => sent(r) && r.sub.result === "not_accepted" },
  { key: "nodecision", label: "No Decision", test: (r) => sent(r) && r.sub.result === "no_result" },
  { key: "registered", label: "Registered", test: (r) => sent(r) && r.sub.result === "registered" },
  { key: "notregistered", label: "Not Registered", test: (r, finished) => sent(r) && r.sub.result === "not_registered" && finished },
  { key: "regpending", label: "Registration Pending", test: (r, finished) => sent(r) && r.sub.result === "not_registered" && !finished },
  { key: "draft", label: "Upload Pending", test: (r) => !r.sub.withdrawn && r.status.key === "draft" },
  { key: "withdrawn", label: "Withdrawn", test: (r) => r.sub.withdrawn },
];

/** One row per submission: the paper, its status and its next step. Withdrawn papers go to the end. */
export function submissionRows(conference: Pick<Conference, "status" | "endDate">, submissions: AuthorSubmission[]): SubmissionRow[] {
  const closed = conference.status === "archived";
  const over = conferenceOver(conference);
  const rows = submissions.map((sub) => {
    const status = authorStatusOf(sub, closed);
    return { sub, status, step: nextStepOf(status, closed, over) };
  });
  return [...rows.filter((r) => !r.sub.withdrawn), ...rows.filter((r) => r.sub.withdrawn)];
}

/** This conference's own numbers, in the same words as the "As Author" strip on My Conferences. */
export function conferenceNumbers(papers: AuthorSubmission[], finished: boolean) {
  const sentPapers = papers.filter((p) => p.result !== "draft" && !p.withdrawn);
  const unregistered = sentPapers.filter((p) => p.result === "not_registered").length;
  const registered = sentPapers.filter((p) => p.result === "registered").length;
  const rejected = sentPapers.filter((p) => p.result === "not_accepted").length;
  return {
    submitted: sentPapers.length,
    accepted: registered + unregistered,
    registered,
    notRegistered: finished ? unregistered : 0,
    pending: finished ? 0 : unregistered,
    rejected,
    // Sent, but neither accepted nor rejected yet — the same "No decision" as My Conferences.
    noDecision: sentPapers.length - registered - unregistered - rejected,
  };
}
