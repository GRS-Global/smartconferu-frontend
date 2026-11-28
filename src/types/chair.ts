import { DEFAULT_SUBMISSION_GUIDELINES } from "@/lib/default-guidelines";
import type { HybridDates } from "@/lib/hybrid-dates";

/** One author of a paper, as the chair sees them (the chair is never blind to authors). */
export interface ChairAuthor { name: string; email: string; affiliation: string; country: string; corresponding: boolean; hasAccount: boolean }

/** The chair's screening record of one uploaded version (Initial Check / Plagiarism Check), as stored in `submissions.screening`.
 *  Only the parts the stage logic reads are typed; the rest is kept as it is. */
export interface ScreeningCheck {
  decision?: string; passed?: boolean; editable?: boolean; english?: boolean; column?: "single" | "double"; pages?: string | number | null;
  comment?: string; emailedAt?: string | null; /** Which values the chair set by hand (the rest are what the PDF showed). */ edited?: Record<string, boolean>;
  autoSet?: boolean; chairSet?: boolean; at?: string; by?: string; other?: Array<{ key?: string; label: string; problem: string }>;
}
export interface ScreeningRecord {
  check?: ScreeningCheck;
  correction?: { reasons?: string[]; note?: string; deadline?: string; at?: string; by?: string; emailedAt?: string | null };
  ithenticate?: unknown;
  /** The iThenticate scores and report files the chair attached (up to two PDFs, stored in the papers bucket; `paths` maps each name to its storage path). */
  report?: { similarity?: number | null; ai?: number | null; file?: string; files?: string[]; at?: string; by?: string };
  outcome?: { kind?: string; reasons?: string[]; note?: string; at?: string; by?: string; deadline?: string; shareReport?: boolean; emailedAt?: string | null };
  paths?: Record<string, string>;
}

/** What the chair's decision menu holds for a paper: where it stands, as the database stores it (`submissions.outcome`). */
export type Outcome = "upload_pending" | "no_decision" | "plagiarism_clear" | "revise" | "waitlist" | "accept" | "registered" | "reject";

/** A submitted paper as its conference's chair sees it. */
export interface ChairPaper {
  /** The paper's label as people see it ("ISBM-680"). */
  id: string;
  dbId: string;
  conferenceId: string;
  title: string;
  track: string;
  presentationType: string;
  authors: ChairAuthor[];
  /** The paper's keywords (Dashboard › Top topics). */
  keywords: string[];
  submittedAt: string | null;
  lastUpdate: string;
  withdrawn: boolean;
  withdrawnAt: string;
  withdrawnBy: "author" | "chair";
  /** The chair's own state of the paper (not what the authors were told). */
  outcome: Outcome;
  /** The decision type the chair picked (decision_types.id), when it is a decision. */
  decisionTypeId: string | null;
  /** The decision the authors have been sent, or null. */
  notifiedOutcome: Outcome | null;
  /** Active reviewers on the paper (not declined or removed), including the ones still waiting to join the committee. */
  reviewersAssigned: number;
  /** Reviews sent. */
  reviewsReceived: number;
  /** Average of the sent reviews' overall scores, or null. */
  averageScore: number | null;
  /** Paper versions uploaded. */
  versions: number;
  screening: Record<string, ScreeningRecord>;
  /** Payment and attendance the chair recorded by hand: set while the paper is accepted, else null. */
  registration?: PaperRegistration | null;
}

export type PaymentStatus = "not_paid" | "paid" | "waived";
export type AttendanceMode = "physical" | "virtual";
/** An accepted paper's registration (`PUT /submissions/{id}/registration`): a paper with nothing recorded is "not_paid", attendance null. */
export interface PaperRegistration {
  payment: PaymentStatus;
  /** null: not known yet. */
  attendance: AttendanceMode | null;
  presenterEmail: string | null;
  /** The presenter's name from the author list. */
  presenterName: string | null;
  /** The chair's own note (receipt number, amount…); never shown to authors. */
  note: string | null;
  updatedAt: string | null;
}
export const PAYMENT_LABELS: Record<PaymentStatus, string> = { not_paid: "Not paid", paid: "Paid", waived: "Waived" };
export const ATTENDANCE_LABELS: Record<AttendanceMode, string> = { physical: "Physical", virtual: "Virtual" };
export const attendanceLabel = (a: AttendanceMode | null) => (a ? ATTENDANCE_LABELS[a] : "Not known");

/** The decision types a conference offers (`decision_types`), in the chair's order. */
export interface DecisionType { id: string; label: string; color: string; outcome: Outcome; description: string; /** The status text the author sees ("" = the agreed wording for the outcome; migration 0039). */ authorLabel?: string }

/** The conference's screening limits (Conference Settings › Submissions; the prototype's DEFAULT_CRITERIA when the chair set none). */
export interface ScreeningCriteria { column: "single" | "double" | "either"; minPages: number; maxPages: number; doubleMinPages: number; doubleMaxPages: number; similarityLimit: number; aiLimit: number; correctionDays: number; revisionDays: number }
export const DEFAULT_CRITERIA: ScreeningCriteria = { column: "single", minPages: 8, maxPages: 30, doubleMinPages: 4, doubleMaxPages: 15, similarityLimit: 20, aiLimit: 20, correctionDays: 7, revisionDays: 10 };

/** What the PDF itself showed when it was uploaded (`submission_files.auto_check`). */
export interface AutoCheck { status?: "running" | "done" | "failed"; pages?: number; editable?: boolean; english?: boolean; column?: "single" | "double"; confidence?: { column?: string; english?: string }; missing?: string[]; error?: string;
  /** When the check ran, where each value came from ("rules" or "ai"), the AI's one-line note, a failed AI step, and how long it took (ms). */
  at?: string; source?: { column?: string; english?: string }; aiNote?: string; aiError?: string; ms?: number }
/** One uploaded version of a paper (version n = the n-th paper file). */
export interface ScreeningFile { n: number; name: string; uploadedAt: string; auto: AutoCheck | null; storagePath: string | null }

export interface ChairConference {
  /** The conference's database id (the email server asks for it). */
  dbId: string;
  /** The Call for Papers' state (`cfps.status`), or null when the conference has none. */
  cfpStatus: "draft" | "review" | "published" | "closed" | null;
  papers: ChairPaper[];
  decisionTypes: DecisionType[];
  criteria: ScreeningCriteria;
  /** Which screening steps the conference runs (Conference Settings › Submissions); both are on unless the chair switched one off. */
  screening: { initialCheck: boolean; plagiarism: boolean };
}

/** One reviewer on a paper, with the review they sent (the chair reads reviews, confidential comments included). */
export interface ChairReview {
  id: string;
  score: number | null;
  confidence: string;
  commentsToAuthor: string;
  commentsToChair: string;
  /** The chair chose to send the comments to the authors with the decision (no name, no score). */
  shared: boolean;
  submittedAt: string;
  /** The review form's answers by field id. */
  answers: Record<string, unknown>;
}
export interface ChairReviewer {
  assignmentId: string;
  reviewerId: string;
  name: string;
  email: string;
  /** "pending": assigned, not accepted yet; "accepted": reviewing. */
  response: "pending" | "accepted";
  assignedAt: string;
  /** When the review is due (YYYY-MM-DD): the chair's date for this reviewer, else the conference's review deadline, else "". */
  due: string;
  /** The chair reviewing the paper themselves. */
  byChair: boolean;
  /** The reviewer has not accepted the committee invitation yet. */
  awaitingInvite: boolean;
  review: ChairReview | null;
  /** An open "Ask for more time" from this reviewer, for the chair to approve or decline (migration 0043). Absent when none. */
  extension?: { id: string; date: string; reason: string; at: string } | null;
}
export interface DeclinedReviewer { name: string; reason: string; at: string }
export interface ChairFile { name: string; uploadedAt: string; storagePath: string | null }

/** One paper with everything its chair pages need. */
export interface ChairPaperDetail {
  paper: ChairPaper;
  /** The review form this conference uses (the chair's own, else the default). */
  form: import("@/features/reviewer/form-schema").ReviewSection[];
  /** The paper's conference as its chair sees it (decision types, screening steps). */
  data: ChairConference;
  abstract: string;
  keywords: string[];
  files: ChairFile[];
  supporting: ChairFile[];
  reviewers: ChairReviewer[];
  declined: DeclinedReviewer[];
  /** The chair's note that went (or goes) with the decision. */
  /** An open "Ask author to fix" (migration 0044): what, by when, and when it was asked; null when none. */
  fixRequest?: { issue: string; fixBy: string; at: string } | null;
  decisionNote: string;
  /** When the authors were told ("Oct 20, 2026"), or "". */
  notifiedAt: string;
}

/** What the Peer Review list needs besides the papers: each paper's reviewers (with the reviews they sent) and the ones who declined. */
export interface ReviewBoard {
  /** Reviewers wanted per paper (the conference's Review setting; the database does not keep it, so the prototype's default of 2). */
  target: number;
  /** The conference's review deadline (YYYY-MM-DD), or "". */
  deadline: string;
  /** By the paper's database id. */
  papers: Record<string, { reviewers: ChairReviewer[]; declined: DeclinedReviewer[] }>;
}

/** Someone on the conference's reviewer committee (`conference_members`, role reviewer). */
export interface PoolReviewer {
  memberId: string;
  /** Their account, once they have one (the invitation links to it when they sign up). */
  userId: string | null;
  name: string;
  email: string;
  /** The institution on their profile ("" when unknown, e.g. invited without an account): the conflict check compares it with the authors'. */
  affiliation?: string;
  /** The tracks the chair scoped them to (empty: all tracks). */
  tracks: string[];
  /** "invited": has not accepted the committee invitation yet. */
  status: "invited" | "active" | "declined";
  invitedAt: string;
}
export interface ReviewerPool { reviewers: PoolReviewer[]; /** The conference's tracks, for scoping a reviewer. */ tracks: string[] }
export interface InviteResult { memberId: string; userId: string | null; created: boolean }

/** One thing somebody did in a conference (Settings › Activity Logs). The database keeps no activity log yet, so this is empty outside mock mode. */
export interface ChairActivityLog {
  id: string; datetime: string; actorName: string; actorRole: "chair" | "author" | "reviewer" | "system";
  action: string; module: string; description: string; status: "success" | "failed";
  /** Shown only to the chair: who the reviewer was (kept out of `description`, as reviews are blind). */
  reviewerName?: string; previousValue?: string; newValue?: string;
}

/** One email the platform sent for a conference (`email_log`), as its chairs read it in Email Logs. */
export interface ChairEmailLog {
  /** Bcc recipients: the email log keeps one recipient per row and no Bcc, so this is empty (the prototype's Bcc column shows "—"). */
  bcc?: Array<{ name: string; email: string }>;
  id: string;
  createdAt: string;
  event: string;
  template: string;
  toEmail: string;
  toName: string;
  recipientType: string;
  /** The template's key ("screeningCorrection") and the paper the email was about (its database id), when it had one. */
  templateKey?: string;
  submissionId?: string;
  subject: string;
  /** The HTML that was sent. */
  body: string;
  /** "queued": waiting to go out (or being sent) right now. */
  status: "sent" | "failed" | "queued";
  /** Why a failed email failed. */
  error: string;
}

/** One of the platform's emails (`email_templates`): what it is, when it goes out and its default text. */
export interface PlatformTemplate { key: string; module: string; role: string; label: string; sendType: string; trigger: string; recipients: string; subject: string; body: string }
/** The conference's own copy of an email (`conference_email_templates`); a custom email has a key like "custom:<id>". */
export interface ConferenceTemplate { key: string; label: string; enabled: boolean; subject: string; body: string; custom: boolean }
export interface EmailTemplates { platform: PlatformTemplate[]; mine: Record<string, ConferenceTemplate> }

/** The review period and what reviewers are promised (`conferences.settings.reviewTimeline`; the prototype's reviewTimelineOf). */
export interface ReviewTimeline { opensAt: string; closesAt: string; reviewDays: number; reminder1Enabled: boolean; reminder1Days: number; reminder2Enabled: boolean; reminder2Days: number }
export const DEFAULT_REVIEW_TIMELINE: ReviewTimeline = { opensAt: "", closesAt: "", reviewDays: 14, reminder1Enabled: true, reminder1Days: 3, reminder2Enabled: true, reminder2Days: 0 };
export type ReviewMode = "double_blind" | "single_blind" | "open";
/** A reviewer's load limits (`conference_settings`, migration 0028) and the review mode (`conferences.review_mode`, which the database already enforces: in double-blind reviewers never see the authors). */
export interface ReviewLimits { reviewersPerPaper: number; maxPapersPerReviewer: number | null; reviewMode: ReviewMode }
export const DEFAULT_REVIEW_LIMITS: ReviewLimits = { reviewersPerPaper: 2, maxPapersPerReviewer: null, reviewMode: "double_blind" };
/** Paper Presentation is always on; Workshop and Poster Presentation are off until the chair switches them on. */
export const PRESENTATION_OPTIONS = ["Paper Presentation", "Workshop", "Poster Presentation"] as const;
export const DEFAULT_PRESENTATION_TYPES: string[] = ["Paper Presentation"];
export interface ConferenceTrack { id: string; name: string; description: string }
/** Everything the Conference Settings pages edit that lives outside the papers. `stored` is false until migration 0028_conference_settings.sql is run (limits and presentation types then show their defaults and cannot be saved). */
/** The Submissions settings the prototype has beyond tracks and types (`conferences.settings.submissionPolicy`). The server enforces the deadline and the published CFP; these are recorded for the conference and read by the screens that use them. */
export interface SubmissionPolicy {
  accepting: boolean; opensAt: string; allowUpdates: boolean; allowMultiple: boolean; editAfterAccept: boolean;
  idFormat: "numeric" | "prefixed"; startNumber: number | null; maxSubmissions: number | null; maxPerAuthor: number | null;
  guidelines: string; tracksOn: boolean; typesOn: boolean;
}
export const DEFAULT_SUBMISSION_POLICY: SubmissionPolicy = { accepting: true, opensAt: "", allowUpdates: true, allowMultiple: true, editAfterAccept: false, idFormat: "numeric", startNumber: null, maxSubmissions: null, maxPerAuthor: null, guidelines: DEFAULT_SUBMISSION_GUIDELINES, tracksOn: true, typesOn: true };
/** The Review settings toggles beyond the limits and the review mode (`conferences.settings.reviewPolicy`). `hiddenFields` are review-form field ids reviewers do not see. */
export interface ReviewPolicy { unassignedAccess: boolean; abstractFirst: boolean; presenterRequired: boolean; shareResults: boolean; hiddenFields: string[] }
export const DEFAULT_REVIEW_POLICY: ReviewPolicy = { unassignedAccess: false, abstractFirst: true, presenterRequired: true, shareResults: false, hiddenFields: [] };
export interface ConferenceSettings { timeline: ReviewTimeline; limits: ReviewLimits; presentationTypes: string[]; tracks: ConferenceTrack[]; stored: boolean; submission: SubmissionPolicy; review: ReviewPolicy }

/** The conference's own details a chair edits in Conference Settings (`conferences`; dates are YYYY-MM-DD, "" when not set). */
/** A chair's request to move the license date, and what the Super Admin answered (`license_requests`, migration 0035). */
export interface LicenseRequest { id: string; requestedDate: string; reason: string; status: "pending" | "approved" | "declined" | "withdrawn"; decisionReason: string; newExpiry: string; createdAt: string }
/** A chair's request to have an archived conference deleted, and what the Super Admin answered (`conference_deletion_requests`, migration 0013). */
export interface DeletionRequest { status: "pending" | "approved" | "rejected" | "cancelled"; reason: string; adminNote: string }
/** What the Call for Papers already has, for the Conference Details rail: how many CFP managers, and whether the publishing intent is written. */
export interface CfpFacts { managers: number; publishing: boolean; description: boolean; /** The CFP waits for the Super Admin: what it shows is locked (own backend). */ inReview?: boolean }

export interface ConferenceInfo {
  name: string; acronym: string; about: string; webPage: string; contactEmail: string; primaryArea: string; secondaryArea: string;
  startDate: string; endDate: string; mode: "in_person" | "virtual" | "hybrid" | ""; venue: string; city: string; state: string; country: string;
  /** Hybrid only (`conferences.details`): the in-person and the virtual event's own dates; startDate / endDate then cover both. */
  hybridDates?: HybridDates;
  submissionDeadline: string; reviewDeadline: string;
  /** Kept in `conferences.details` (the prototype's DETAIL_KEYS). `status` is read-only here. */
  timezone: string; abstractDeadline: string; summary: string; language: string; replyEmail: string; smartConfEmail: string; topics: string[]; status: string;
  /** The venue's address, postal code and the pin's coordinates (in `conferences.details`; the map picker fills them). */
  address: string; postalCode: string; lat: number | null; lng: number | null;
  /** The conference logo: its public address and its path in the `public` storage bucket ("" = none, the monogram is used). */
  logoUrl: string; logoPath: string;
  /** The day the conference was created, and the day its license ends when Smartconferu has set one ("" = 30 days from creation). */
  createdAt: string; licenseExpiry: string;
}

/** The review form and the reviewers' instructions of a conference (`conference_forms` and `conference_settings`, migration 0028). `custom` is false while the standard form is used. */
export interface ReviewSetup { form: import("@/features/reviewer/form-schema").ReviewSection[]; custom: boolean; instructions: string; /** What reviewers read: the written text or the attached PDF (migration 0038). */ instructionsMode: "html" | "pdf"; instructionsPdf: InstructionsPdf | null }
/** A reviewer-instructions PDF: its own file name and its address. */
export interface InstructionsPdf { name: string; url: string }
