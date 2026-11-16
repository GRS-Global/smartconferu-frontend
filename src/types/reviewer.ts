/** A paper assigned to the signed-in reviewer, as that reviewer sees it. Authors are never part of it: the review is double-blind
 *  (the prototype's default, and the only mode its database setup uses), and nothing here ever needs them. */
export interface ReviewerPaper {
  /** The paper's label as people see it ("ISBM-680"). */
  id: string;
  /** The database id of the paper. */
  dbId: string;
  /** The database id of this reviewer's assignment to it. */
  assignmentId: string;
  /** The conference's slug. */
  conferenceId: string;
  title: string;
  abstract: string;
  track: string;
  presentationType: string;
  keywords: string[];
  /** "pending": the chair assigned it and the reviewer has not answered yet; "accepted": they are reviewing it. */
  response: "pending" | "accepted";
  /** When the chair assigned it ("Aug 19, 2026"). */
  assignedOn: string;
  /** When the review is due (YYYY-MM-DD): the chair's own date for this reviewer, else the conference's review deadline, else an estimate from its start date. */
  due: string;
  /** The review the reviewer has sent (null while it is a draft or not started). */
  review: { score: number | null; submittedAt: string } | null;
  /** A draft is saved. */
  draft: boolean;
  withdrawn: boolean;
  /** The reviewer's latest "Ask for more time" (migration 0043): the date asked for, why, when, and whether the chair has answered. Absent when none was made. */
  extension?: { date: string; reason: string; at: string; status: "pending" | "approved" | "declined" } | null;
}

/** What the reviewer's pages are built from: the papers they hold, and how many invitations they turned down. */
export interface ReviewerAssignments {
  papers: ReviewerPaper[];
  /** Assignments the reviewer declined (they are no longer on the list). */
  declined: number;
}

export const DECLINE_ASSIGNMENT_REASONS = ["Conflict of interest", "Outside my expertise", "Not enough time", "Other"] as const;

/** The answers on a review form, keyed by the form field's id (the prototype's own keys: "f-score", "f-to-author", …). */
export type ReviewValues = Record<string, string | number | string[] | boolean | null | undefined>;

/** A file of the paper the reviewer may open. `storagePath` is only ever used to ask for a short-lived link. */
export interface ReviewFile { name: string; uploadedAt: string; storagePath: string | null }

/** Everything the review form of one paper needs. */
export interface ReviewDetail {
  paper: ReviewerPaper;
  /** The review form this conference uses (the chair's own, else the default). */
  form: import("@/features/reviewer/form-schema").ReviewSection[];
  /** The chair's instructions for reviewers, or "" for the standard text. */
  instructions: string;
  /** Whether reviewers read the text or the attached PDF, and the PDF (migration 0038). */
  instructionsMode: "html" | "pdf";
  instructionsPdf: import("./chair").InstructionsPdf | null;
  /** The saved answers: the unsent draft if there is one (it is newer), else the sent review's. */
  values: ReviewValues;
  /** "submitted" once the reviewer has sent it; "draft" while only a draft is saved; "none" before. */
  state: "none" | "draft" | "submitted";
  /** The paper's files, oldest first (the last is the version reviewers read). */
  files: ReviewFile[];
  /** The decision the chair has sent to the authors (reviewers hear it when the authors do), or null. A decided paper's review is locked. */
  decision: { label: string; color?: string } | null;
}
