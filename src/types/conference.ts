export type ConferenceRole = "author" | "chair" | "reviewer" | "committee";

export type ConferenceStatus = "active" | "archived";

export interface Conference {
  /** URL id (conferences.slug in Supabase). */
  id: string;
  /** Position in the user's list, shown in the ID column. */
  number: number;
  acronym: string;
  /** The conference logo (a public address), when it has one: shown instead of the monogram. */
  logoUrl?: string;
  name: string;
  status: ConferenceStatus;
  /** ISO dates (YYYY-MM-DD). */
  startDate: string;
  endDate: string;
  city: string;
  country: string;
  /** Review deadline (YYYY-MM-DD), when the conference has one. */
  reviewDeadline?: string;
  /** Submission (full paper) deadline (YYYY-MM-DD), when set in Conference Details. */
  submissionDeadline?: string;
  /** Abstract deadline (YYYY-MM-DD), when set in Conference Details. */
  abstractDeadline?: string;
  pinned?: boolean;
}

/** One conference the user holds at least one role in. */
export interface SourceConference {
  conference: Conference;
  roles: ConferenceRole[];
  /** Committee title, when the user is a committee member. */
  committeeRole?: string;
}

/** What the author is told about one of their papers. */
export type AuthorPaperResult = "draft" | "no_result" | "revise" | "waitlist" | "not_registered" | "registered" | "not_accepted";

export interface AuthorPaper {
  conferenceId: string;
  result: AuthorPaperResult;
}

/** A submitted paper as its chair sees it. */
export interface ChairPaper {
  conferenceId: string;
  decision: "accepted" | "rejected" | "undecided";
  withdrawn: boolean;
  registered: boolean;
}

/** One paper on the signed-in reviewer's list. */
export interface ReviewAssignment {
  conferenceId: string;
  /** Paper id as shown to people, e.g. "ICX-12". */
  paperLabel: string;
  reviewed: boolean;
  /** The reviewer handed the paper back. */
  declined: boolean;
  /** Per-paper deadline (YYYY-MM-DD), when the chair set one. */
  dueDate: string | null;
}

export type CertificateType = "presentation" | "author" | "publication" | "participation" | "appreciation";

export interface IssuedCertificate {
  conferenceId: string;
  type: CertificateType;
}

/** Everything the dashboard is built from. Services return this; nothing here is generated. */
export interface DashboardSource {
  conferences: SourceConference[];
  authorPapers: AuthorPaper[];
  chairPapers: ChairPaper[];
  reviewerAssignments: ReviewAssignment[];
  certificates: IssuedCertificate[];
}

export type InvitationStatus = "pending" | "accepted" | "declined";

/** A committee invitation addressed to the signed-in user. */
export interface ReviewInvitation {
  id: string;
  conferenceId: string;
  acronym: string;
  conferenceName: string;
  country: string;
  invitedBy: string;
  /** Display date, e.g. "Aug 19, 2026". */
  invitedAt: string;
  maxPapers: number | null;
  status: InvitationStatus;
  respondedAt: string;
  declineReason: string;
  /** Reply-by date as ISO (YYYY-MM-DD), when the invitation has one. */
  respondBy?: string;
}
