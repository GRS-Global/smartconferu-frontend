import { DATA_SOURCE } from "@/lib/config";
import type { ReviewValues } from "@/types/reviewer";
import type { DeletionRequest, CfpFacts, LicenseRequest, ChairActivityLog, ChairConference, ChairEmailLog, ChairPaperDetail, ReviewSetup, ConferenceInfo, ConferenceSettings, ConferenceTrack, ReviewLimits, ReviewTimeline, SubmissionPolicy, ReviewPolicy, ScreeningCriteria, ConferenceTemplate, EmailTemplates, DecisionType, InviteResult, ScreeningFile, PoolReviewer, ReviewBoard, ReviewerPool } from "@/types/chair";

/** The contract the Chair workspace depends on. Failures throw: AuthRequiredError (no session), ServiceConfigError (Supabase not
 *  configured) or ServiceError (a request failed, with a message ready to show). */
export interface ChairService {
  /** Every submitted paper of a conference (by its slug) as its chair sees it, the conference's decision types and its screening
   *  steps. Row Level Security returns them only to the conference's chairs. */
  loadConference(conferenceSlug: string): Promise<ChairConference>;
  /** One paper (by its label, "ISBM-680") with its reviewers, their reviews, files and the decision note; null when there is no such paper
   *  the user can read. The conference is found from the paper (`paper.conferenceId` is its slug). */
  loadPaper(paperLabel: string): Promise<ChairPaperDetail | null>;
  /** The reviewers of every paper of a conference, with their reviews, for the Peer Review list. */
  loadReviewBoard(conferenceSlug: string): Promise<ReviewBoard>;
  /** The conference's reviewer committee (everyone invited, accepted or declined). */
  loadReviewerPool(conferenceSlug: string): Promise<ReviewerPool>;
  /** Invites someone to the committee (nothing changes when they are already on it). The invitation email is a separate step. */
  inviteReviewer(conferenceSlug: string, person: { name: string; email: string; tracks: string[] }): Promise<InviteResult>;
  renameReviewer(conferenceSlug: string, memberId: string, name: string): Promise<void>;
  /** Sets the tracks a committee member is scoped to (`conference_members.expertise`, the column the invitation fills in). */
  setReviewerTracks(conferenceSlug: string, memberId: string, tracks: string[]): Promise<void>;
  /** Takes someone off the committee, with their assignments in this conference. */
  removeReviewer(conferenceSlug: string, reviewer: PoolReviewer, paperDbIds: string[]): Promise<void>;
  /** Gives papers to a reviewer. Someone without an account yet gets them queued on their committee invitation. Returns the papers given. */
  assignPapers(reviewer: PoolReviewer, paperDbIds: string[], dueISO: string | null): Promise<string[]>;
  /** Every paper's uploaded versions (newest last) with what the PDF check found, for the Initial Check and Plagiarism Check pages. By the paper's database id. */
  loadScreeningFiles(conferenceSlug: string): Promise<Record<string, ScreeningFile[]>>;
  /** Saves the chair's screening record of one version (`save_screening`; the database refuses anyone who is not a chair of the conference). */
  saveScreening(paperDbId: string, version: number, record: unknown): Promise<void>;
  /** Stores an iThenticate report PDF next to the paper (`<conference id>/<paper id>/<file>` in the papers bucket; only the conference's chairs may) and returns its name and storage path. */
  uploadScreeningReport(paperDbId: string, file: File): Promise<{ name: string; path: string }>;
  /** A short-lived link to open a stored file. */
  fileUrl(storagePath: string, download?: string): Promise<string>;
  /** The chair corrects a review the reviewer has sent (`chair_edit_review`; the reviewer gets a bell notification from the database). */
  editReview(reviewId: string, values: ReviewValues): Promise<void>;
  /** The chair reviews the paper themselves (`chair_submit_review`: the first save adds the review, later ones change it). Returns the review's id. */
  submitOwnReview(paperDbId: string, values: ReviewValues): Promise<string>;
  /** Moves papers to another track (`set_submission_track`, migration 0030; only a chair of the conference may). Returns how many changed. */
  setSubmissionTrack(paperDbIds: string[], track: string): Promise<number>;
  /** Deletes submissions for good (`delete_submissions`, migration 0030; only a chair of the conference may). Returns how many were deleted. */
  deleteSubmissions(paperDbIds: string[]): Promise<number>;
  /** Writes the conference's decision types back as a whole, in the given order (Settings › Decision): new ones (an id that is not a database id) are added, kept ones updated, missing ones deleted. The database refuses anyone who is not a chair of the conference. */
  saveDecisionTypes(conferenceSlug: string, types: DecisionType[]): Promise<void>;
  /** The emails sent for a conference, newest first (the last 300). Row Level Security returns them to the conference's chairs only; empty until migration 0003_email_log.sql is run. */
  loadEmailLogs(conferenceSlug: string): Promise<ChairEmailLog[]>;
  /** What was done in the conference (Activity Logs). The database keeps no such log yet, so the real service answers an empty list. */
  loadActivityLogs(conferenceSlug: string): Promise<ChairActivityLog[]>;
  /** The platform's emails and this conference's own copies. Empty until migration 0005_email_templates.sql is run. */
  loadEmailTemplates(conferenceSlug: string): Promise<EmailTemplates>;
  /** Saves the conference's copy of one email (or a custom email); only its chairs may. */
  saveEmailTemplate(conferenceSlug: string, template: ConferenceTemplate): Promise<void>;
  /** Removes the conference's copy: for a custom email it is gone, for a platform email it goes back to the default text. */
  deleteEmailTemplate(conferenceSlug: string, key: string): Promise<void>;
  /** The conference's review timeline, reviewer limits, presentation types and tracks. */
  loadSettings(conferenceSlug: string): Promise<ConferenceSettings>;
  /** Saves the review period and timeline (`conferences.settings.reviewTimeline`). */
  saveReviewTimeline(conferenceSlug: string, timeline: ReviewTimeline): Promise<void>;
  saveSubmissionPolicy(conferenceSlug: string, policy: SubmissionPolicy): Promise<void>;
  saveReviewPolicy(conferenceSlug: string, policy: ReviewPolicy): Promise<void>;
  /** Saves the reviewer limits and review mode (`conference_settings`; needs migration 0028). */
  saveReviewLimits(conferenceSlug: string, limits: ReviewLimits): Promise<void>;
  /** Saves the submission types authors choose from (`conference_settings`; needs migration 0028). */
  savePresentationTypes(conferenceSlug: string, types: string[]): Promise<void>;
  /** Writes the tracks back as a whole, in the given order (`tracks`): an id that is not a database id is new. */
  saveTracks(conferenceSlug: string, tracks: ConferenceTrack[]): Promise<void>;
  /** Saves which screening steps run and their limits (`conferences.settings.screening`). */
  saveScreeningSetup(conferenceSlug: string, setup: { initialCheck: boolean; plagiarism: boolean; criteria: ScreeningCriteria }): Promise<void>;
  /** The conference's details as its chairs edit them (Conference Settings › Conference Details). */
  loadInfo(conferenceSlug: string): Promise<ConferenceInfo | null>;
  /** Saves those details (`conferences`; the acronym, which is the paper-ID prefix, is not changed here). The database refuses anyone who is not a chair. */
  saveInfo(conferenceSlug: string, info: ConferenceInfo): Promise<void>;
  /** Archives the conference by hand (new submissions stop; everything stays) or puts it back to active. */
  archiveConference(conferenceSlug: string): Promise<void>;
  restoreConference(conferenceSlug: string): Promise<void>;
  /** The latest deletion request for an archived conference, if any. */
  loadDeletionRequest(conferenceSlug: string): Promise<DeletionRequest | null>;
  requestDeletion(conferenceSlug: string, reason: string): Promise<void>;
  cancelDeletion(conferenceSlug: string): Promise<void>;
  /** Uploads the logo (null removes it) and returns its public address ("" once removed). */
  saveLogo(conferenceSlug: string, file: File | null): Promise<string>;
  /** The conference's latest license-extension request, if any. */
  loadLicenseRequest(conferenceSlug: string): Promise<LicenseRequest | null>;
  requestLicenseExtension(conferenceSlug: string, requestedDate: string, reason: string): Promise<void>;
  withdrawLicenseRequest(conferenceSlug: string): Promise<void>;
  loadCfpFacts(conferenceSlug: string): Promise<CfpFacts>;
  /** The review form and instructions reviewers get (the standard ones until the chair changes them). */
  loadReviewSetup(conferenceSlug: string): Promise<ReviewSetup>;
  /** Saves the chair's review form; null puts the standard form back (`conference_forms`, migration 0028). */
  saveReviewForm(conferenceSlug: string, sections: import("@/features/reviewer/form-schema").ReviewSection[] | null): Promise<void>;
  /** Saves the instructions reviewers read before they start; "" puts the standard text back (`conference_settings`, migration 0028). */
  saveReviewInstructions(conferenceSlug: string, text: string): Promise<void>;
  /** Whether reviewers read the written text or the attached PDF (migration 0038). */
  saveReviewInstructionsMode(conferenceSlug: string, mode: "html" | "pdf"): Promise<void>;
  /** Attaches the PDF reviewers read (stored in the `public` bucket, migration 0038). */
  saveReviewInstructionsPdf(conferenceSlug: string, file: File): Promise<import("@/types/chair").InstructionsPdf>;
  /** The extra questions on the submission form (`conference_forms`, kind "submission"; none until the chair adds some, and until migration 0028 is run). */
  loadSubmissionForm(conferenceSlug: string): Promise<import("@/types/author-submission").SubmissionExtra[]>;
  /** Saves the extra questions; an empty list removes the chair's form. */
  saveSubmissionForm(conferenceSlug: string, extras: import("@/types/author-submission").SubmissionExtra[]): Promise<void>;
  /** Records the chair's decision on a paper (the authors are not told yet). The database refuses it for a paper that is not the caller's to decide. */
  recordDecision(paperDbId: string, decisionTypeId: string, note?: string): Promise<void>;
  /** Sends the recorded decision to the authors, with the chair's note and the reviewer comments marked as shared. */
  notifyDecision(paperDbId: string, note?: string): Promise<void>;
  /** Shares (or stops sharing) one review's comments to the author with the decision. */
  setReviewShared(reviewId: string, shared: boolean): Promise<void>;
  /** Answers a reviewer's "Ask for more time": approving moves their deadline to the date they asked for; either way they are told. */
  decideExtension(requestId: string, approve: boolean): Promise<void>;
  /** Moves one reviewer's due date (YYYY-MM-DD, after today) on one paper (migration 0044). */
  setReviewDue(assignmentId: string, dateISO: string): Promise<void>;
  /** Takes a reviewer off one paper (their review, if sent, goes with it). */
  removeReviewerFromPaper(paperDbId: string, reviewerUserId: string): Promise<void>;
  /** Flags a fixable problem to the paper's authors, due by `fixByISO` (migration 0044); the email is sent separately (`fix_requested`). */
  requestFix(paperDbId: string, issue: string, fixByISO: string): Promise<void>;
}

/** The service for the configured data source. `mock` is only used when NEXT_PUBLIC_DATA_SOURCE=mock (no network);
 *  there is no fallback from one source to the other. */
export async function getChairService(): Promise<ChairService> {
  if (DATA_SOURCE === "mock") return (await import("@/mocks/chair")).mockChairService;
  if (DATA_SOURCE === "api") return (await import("./api/chair")).apiChairService;
  return (await import("./supabase/chair")).supabaseChairService;
}
