import type { ChairPaper, ConferenceSettings, PoolReviewer } from "@/types/chair";
import type { PrRow } from "./peer-review";

/* The reviewer-assignment rules the Peer Review list uses for its popover, "Assign same reviewers" and "Auto-assign", ported from the prototype
   (src/author-journey.jsx: reviewerConflicts / reviewerPaperConflict, rankReviewersFor, reviewerLoad, newAssignmentDueISO and AutoAssignModal's plan).
   Only what the data supports: there is no reviewer expertise and no declared-institution list in the database, so nothing here matches keywords. */

/** Who the conflict checks compare: a reviewer is blocked from a paper they authored, and from one by an author at the same institution.
 *  The same rule as the API (Backend/src/core/rbac/access-rules.ts institutionConflict): when the reviewer and an author both gave an
 *  institution, only those are compared — different institutions never clash, even on a shared email domain (a company or organiser
 *  domain is not an institution). Only when one of them gave none does the email domain decide (webmail ignored). */
const WEBMAIL = new Set(["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "proton.me", "protonmail.com", "live.com", "aol.com", "rediffmail.com"]);
const domainOf = (e: string) => {
  const d = e.trim().toLowerCase().split("@")[1] ?? "";
  return d && !WEBMAIL.has(d) ? d : "";
};
/** An institution name for comparing: case, accents, punctuation, "&" / "and" and a leading "The" do not matter. */
export const normalizeInstitution = (v: string | null | undefined) =>
  (v ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/^the /, "");

/** Whether two typed institutions are the same one (the API's sameInstitution): besides the whole text, the name before the first comma
 *  counts ("Delhi University" = "Delhi University, Delhi, India"), and the same name with the same last part (country) matches;
 *  "University of California, Berkeley" and "…, Los Angeles" do not. */
export function sameInstitution(a: string | null | undefined, b: string | null | undefined): boolean {
  const parts = (v: string | null | undefined) => (v ?? "").split(",").map(normalizeInstitution).filter(Boolean);
  const pa = parts(a);
  const pb = parts(b);
  if (!pa.length || !pb.length) return false;
  const fa = pa.join(" ");
  const fb = pb.join(" ");
  if (fa === fb || fa === pb[0] || fb === pa[0]) return true;
  return pa.length > 1 && pb.length > 1 && pa[0] === pb[0] && pa[pa.length - 1] === pb[pb.length - 1];
}

/** "" when there is no conflict, else the reason shown under the reviewer ("Author of this paper", "Same institution as <author>",
 *  "Same email domain as <author>"). */
export function reviewerConflict(rev: Pick<PoolReviewer, "name" | "email" | "affiliation">, paper: ChairPaper): string {
  const name = rev.name.trim().toLowerCase();
  const email = rev.email.trim().toLowerCase();
  const authors = paper.authors;
  if (authors.some((a) => (email && a.email.toLowerCase() === email) || a.name.trim().toLowerCase() === name)) return "Author of this paper";
  const mine = normalizeInstitution(rev.affiliation);
  const myDomain = domainOf(email);
  for (const a of authors) {
    const theirs = normalizeInstitution(a.affiliation);
    if (mine && theirs) {
      if (sameInstitution(rev.affiliation, a.affiliation)) return `Same institution as ${a.name}`;
      continue;
    }
    if (myDomain && domainOf(a.email) === myDomain) return `Same email domain as ${a.name}`;
  }
  return "";
}

/** Whether the reviewer is already on this paper (an assignment, or a queued one waiting on their committee invitation). */
export const isOnPaper = (rev: PoolReviewer, r: PrRow) => r.reviewers.some((x) => (x.r.awaitingInvite ? x.r.reviewerId === rev.memberId : rev.userId !== null && x.r.reviewerId === rev.userId));
/** Papers a reviewer has in this conference (withdrawn papers are not in `all`). */
export const loadOf = (rev: PoolReviewer, all: PrRow[]) => all.filter((r) => isOnPaper(rev, r)).length;

export interface Candidate { rev: PoolReviewer; load: number; conflict: string; full: boolean }

/** Candidates for one paper: not already on it, didn't decline it; conflict-free first, then not at the limit, then lightest workload (the pool's own
 *  order breaks ties). `extra` is the load already given in a plan being built. */
export function rankReviewersFor(row: PrRow, pool: PoolReviewer[], all: PrRow[], maxLoad: number | null, extra: Record<string, number> = {}): Candidate[] {
  const declined = new Set(row.declined.map((d) => d.name.trim().toLowerCase()));
  return pool
    .filter((rev) => rev.status !== "declined" && !isOnPaper(rev, row) && !declined.has(rev.name.trim().toLowerCase()))
    .map((rev) => {
      const load = loadOf(rev, all) + (extra[rev.memberId] ?? 0);
      return { rev, load, conflict: reviewerConflict(rev, row.paper), full: maxLoad !== null && load >= maxLoad };
    })
    .sort((a, b) => Number(Boolean(a.conflict)) - Number(Boolean(b.conflict)) || Number(a.full) - Number(b.full) || a.load - b.load);
}

export interface PlanItem { row: PrRow; need: number; reviewers: PoolReviewer[] }

/** Auto-assign: fills each paper up to the target, fewest-reviewers-first, with the lightest-loaded reviewer who has no conflict and is under the limit;
 *  every pick counts toward the next paper's load. */
export function planAutoAssign(rows: PrRow[], pool: PoolReviewer[], all: PrRow[], maxLoad: number | null): PlanItem[] {
  const extra: Record<string, number> = {};
  return [...rows].sort((a, b) => a.reviewers.length - b.reviewers.length).map((row) => {
    const need = Math.max(0, row.target - row.reviewers.length);
    const picks = rankReviewersFor(row, pool, all, maxLoad, extra).filter((x) => !x.conflict && !x.full).sort((a, b) => a.load - b.load).slice(0, need).map((x) => x.rev);
    picks.forEach((p) => { extra[p.memberId] = (extra[p.memberId] ?? 0) + 1; });
    return { row, need, reviewers: picks };
  });
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const plusDaysISO = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };

/** The review deadline for a reviewer being assigned now: the days a reviewer gets (Review timeline) from today, but never later than the end of the
 *  reviewing period; without those days, the conference's review deadline (the prototype's newAssignmentDueISO). */
export function newAssignmentDue(settings: ConferenceSettings | null, boardDeadline: string): string {
  const days = settings?.timeline.reviewDays ?? 0;
  if (!days) return boardDeadline;
  const due = plusDaysISO(days);
  const end = settings?.timeline.closesAt ? settings.timeline.closesAt.slice(0, 10) : "";
  return end && due > end ? end : due;
}
