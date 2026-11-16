import { AlarmClock, CircleDashed, FileCheck, Inbox, PenLine, TimerOff, type LucideIcon } from "lucide-react";
import type { ReviewerPaper } from "@/types/reviewer";

/* A reviewer's status on one assigned paper, and the next step it leads to — shared by the reviewer's Dashboard and My Reviews, so
   both show the same card for the same paper (the prototype's src/author-module/reviewerStatus.js). */

export type ReviewStatusKey = "respond" | "overdue" | "draft" | "todo" | "sent" | "closed";
export interface ReviewStatus { key: ReviewStatusKey; label: string; icon: LucideIcon; color: string; bg: string; border: string }
export interface ReviewStep { label: string; tone: string; cta: string }
export interface ReviewRow { paper: ReviewerPaper; status: ReviewStatus; step: ReviewStep; late: boolean }

export const REVIEW_STATUS: Record<ReviewStatusKey, Omit<ReviewStatus, "key">> = {
  respond: { label: "Awaiting your response", icon: Inbox, color: "#6D28D9", bg: "#F3E8FF", border: "#DDD6FE" },
  overdue: { label: "Overdue", icon: AlarmClock, color: "var(--danger)", bg: "var(--danger-soft)", border: "#FECACA" },
  draft: { label: "Draft saved", icon: PenLine, color: "var(--primary-hover)", bg: "var(--primary-soft)", border: "var(--primary-soft-border)" },
  todo: { label: "Not started", icon: CircleDashed, color: "#92400E", bg: "var(--warning-soft)", border: "#FDE68A" },
  sent: { label: "Review sent", icon: FileCheck, color: "#15803D", bg: "var(--success-soft)", border: "#BBF7D0" },
  closed: { label: "Not reviewed", icon: TimerOff, color: "var(--ink-soft)", bg: "var(--muted)", border: "var(--border)" },
};
/** What needs the reviewer first; finished ones last. */
export const REVIEW_STATUS_ORDER: ReviewStatusKey[] = ["respond", "overdue", "draft", "todo", "sent", "closed"];

/** One row per assigned paper: its status and next step. `finished`: the conference is over. Withdrawn papers go to the end. */
export function reviewRows(papers: ReviewerPaper[], finished: boolean): ReviewRow[] {
  const today = new Date();
  const rows = papers.map((paper): ReviewRow => {
    const pending = paper.response === "pending";
    const late = !finished && !paper.review && !pending && !!paper.due && new Date(`${paper.due}T23:59:59`) < today;
    const key: ReviewStatusKey = pending ? "respond" : paper.review ? "sent" : finished ? "closed" : late ? "overdue" : paper.draft ? "draft" : "todo";
    const base = REVIEW_STATUS[key];
    const score = paper.review?.score;
    const status: ReviewStatus = { ...base, key, label: key === "sent" && typeof score === "number" ? `Review sent · ${score}/5` : key === "overdue" && paper.draft ? "Draft · overdue" : base.label };
    const step: ReviewStep = {
      respond: { label: "Accept or decline this paper", tone: "#6D28D9", cta: "Respond" },
      overdue: { label: paper.draft ? "Overdue · finish your review" : "Overdue · review now", tone: "var(--danger)", cta: paper.draft ? "Continue review" : "Start review" },
      draft: { label: "Continue your review", tone: "var(--primary)", cta: "Continue review" },
      todo: { label: "Start your review", tone: "var(--primary)", cta: "Start review" },
      sent: { label: finished ? "Review sent" : "Review sent · you can still edit it", tone: "var(--success)", cta: finished ? "View review" : "Edit review" },
      closed: { label: "Review window closed", tone: "var(--ink-faint)", cta: "View paper" },
    }[key];
    return { paper, status, step, late };
  });
  return [...rows.filter((r) => !r.paper.withdrawn), ...rows.filter((r) => r.paper.withdrawn)];
}

export interface ReviewerNumbers { assigned: number; done: number; pending: number; declined: number; overdue: boolean }

/** The same figures as the conference's row on My Conferences (Papers Assigned, Reviewed, Pending, Invitation Rejected). */
export function reviewerNumbers(papers: ReviewerPaper[], declinedCount: number, archived: boolean): ReviewerNumbers {
  const assigned = papers.length + declinedCount;
  const done = papers.filter((p) => p.review).length;
  let declined = declinedCount;
  let pending = Math.max(0, assigned - done - declined);
  // Once a conference is archived, a review still pending counts as a rejected invitation.
  if (archived) { declined += pending; pending = 0; }
  const today = new Date();
  const overdue = pending > 0 && !archived && papers.some((p) => !p.review && p.response === "accepted" && p.due && new Date(`${p.due}T23:59:59`) < today);
  return { assigned, done, pending, declined, overdue };
}
