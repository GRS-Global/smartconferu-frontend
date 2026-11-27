/** One author of a paper, as listed on it. */
export interface PaperAuthor {
  name: string;
  email: string;
  affiliation: string;
  country: string;
  corresponding: boolean;
}

/** What the paper's author has been told (the prototype's `paperResultFor`): only a decision the chair has *sent* counts. */
/** What an author sees of their accepted paper's registration (the chair's note stays private). */
export interface AuthorRegistration { payment: import("./chair").PaymentStatus; attendance: import("./chair").AttendanceMode | null; presenterName: string | null }

export type PaperResult = "draft" | "no_result" | "not_registered" | "registered" | "not_accepted";

/** A correction or revision the chair asked for after screening (initial check / plagiarism check). */
export interface ScreeningRequest {
  kind: "correction" | "revision";
  /** The version the request is about (the newest upload); the author is asked for the next one. */
  version: number;
  /** When the chair wants the new version, as the chair wrote it; "" when no deadline was set. */
  deadline: string;
}

/** What the Overview shows about one conference, beyond what My Conferences carries. */
export interface ConferenceDetails {
  acronym: string;
  name: string;
  city: string;
  state: string;
  country: string;
  webPage: string;
  contactEmail: string;
}

/** A paper of the signed-in user (submitted by them, or listed with them as an author), as that author sees it. */
export interface AuthorSubmission {
  /** The paper's label as people see it ("ISBM-680"). */
  id: string;
  /** The database id: only used to key lists. */
  dbId: string;
  /** The conference's slug (the URL id). */
  conferenceId: string;
  title: string;
  /** The paper's keywords (the speaker flyer suggests hashtags from them). */
  keywords?: string[];
  authors: PaperAuthor[];
  /** Display dates ("Aug 19, 2026"); `submittedAt` is null while the paper is still a draft. */
  submittedAt: string | null;
  lastUpdate: string;
  track: string;
  presentationType: string;
  withdrawn: boolean;
  /** The signed-in user submitted it (false: they are a co-author). */
  mySubmission: boolean;
  /** The signed-in user submitted it or is a corresponding author of it. */
  myCorresponding: boolean;
  result: PaperResult;
  /** Payment and attendance as the chair recorded them, once the author was told the paper is accepted (own backend only; else absent). */
  registration?: AuthorRegistration | null;
  /** The decision the author was told, when it is not accepted / rejected: a revision or the waitlist. */
  decision: "revise" | "waitlist" | null;
  /** The chair moved it back to "Paper Upload Pending". */
  uploadPending: boolean;
  /** The chair's own wording of the statuses (Settings › Decision › "Author sees"), by status key; missing = the agreed label. */
  statusLabels?: Record<string, string>;
  /** Set while the newest uploaded version still has an open correction / revision request. */
  screeningRequest: ScreeningRequest | null;
}

/** What an author may change about a paper's text. */
export interface PaperDetailsPatch { title: string; abstract: string; keywords: string[] }

/** One author as saved: the first is the main author; at least one is corresponding. */
export interface AuthorInput { name: string; email: string; affiliation: string; country: string; corresponding: boolean }

/** One author on a paper's own page; `isMe` marks the signed-in user's row ("You"). */
export interface PaperPageAuthor extends PaperAuthor { isMe: boolean }

/** An uploaded file of a paper. `storagePath` is where it lives in storage (only ever used to ask for a short-lived link). */
export interface PaperFile { name: string; uploadedAt: string; storagePath: string | null; type?: string }

/** A reviewer's comment the chair chose to share, without the reviewer's name or scores. */
export interface SharedComment { n: number; text: string; submittedAt: string }

/** One version's plagiarism report as the author sees it. */
export interface PlagiarismReport {
  version: number;
  decision: "clear" | "revision" | "reject";
  /** The similarity score, when the chair entered one. */
  similarity: number | null;
  /** The report PDFs (`storagePath` opens through the author service's fileUrl). */
  files: PaperFile[];
}

/** What the author is told about where the paper stands. Authors never see where a paper is inside review. */
export type PaperStatus = "draft" | "submitted" | "under_review" | "accepted" | "rejected";

/** The newest version's open correction / revision request, with what the author may read of it. */
export interface PaperScreeningNotice {
  kind: "correction" | "revision";
  version: number;
  deadline: string;
  reasons: string[];
  note: string;
  by: string;
  /** The similarity score, only when the chair shared the report with the author. */
  similarity: number | null;
}

/** A paper as its author sees it on its own page. */
export interface AuthorPaper extends Omit<AuthorSubmission, "authors" | "screeningRequest"> {
  authors: PaperPageAuthor[];
  /** The signed-in account's own addresses, lower case (the paper must keep one of them while they edit its authors). */
  myEmails: string[];
  status: PaperStatus;
  abstract: string;
  keywords: string[];
  /** Every uploaded paper version, oldest first. */
  versions: PaperFile[];
  supporting: PaperFile[];
  /** The decision the chair has sent. */
  decisionTold: "accept" | "reject" | "revise" | "waitlist" | null;
  decisionNote: string;
  comments: SharedComment[];
  withdrawnAt: string;
  withdrawnBy: "author" | "chair";
  screeningNotice: PaperScreeningNotice | null;
  /** The plagiarism reports the chair added, per version, once the author was told the Plagiarism Check decision (cleared, or an emailed
   *  revision / rejection). Newest version first. Absent where the data source has none. */
  plagiarismReports?: PlagiarismReport[];
  conference: { id: string; acronym: string; name: string; status: "active" | "archived"; startDate: string; endDate: string };
}

/** What the New Submission page needs about a conference and the person submitting. */
export interface SubmitFormInfo {
  slug: string;
  acronym: string;
  name: string;
  /** Not open for new papers (archived, or not approved yet). */
  closed: boolean;
  /** The submission deadline (YYYY-MM-DD, "" when none) and the chair's guidelines text (Conference Settings › Submissions). */
  deadline: string;
  guidelines: string;
  tracks: string[];
  presentationTypes: string[];
  /** The chair's extra questions on the form. */
  extras: SubmissionExtra[];
  /** The signed-in user, for the first author row. */
  me: { name: string; email: string; affiliation: string; country: string };
}
export interface NewPaperInput { responses?: Record<string, string | boolean>; title: string; abstract: string; keywords: string[]; authors: AuthorInput[]; track: string; presentationType: string; file: File;
  /** The automatic check of the PDF (lib/auto-check.ts), saved with the file for the chair's Initial Check. */
  autoCheck?: import("./chair").AutoCheck | null }

/** An extra question a chair added to the submission form (`conference_forms`, kind "submission"); the answers are kept with the paper in `details.responses`. */
export interface SubmissionExtra { id: string; type: "short_text" | "long_text" | "single_choice" | "consent"; label: string; description?: string; required: boolean; options?: string[] }
/** Checks a stored submission form and returns its extra questions ([] when there are none or it is not usable). */
export function extrasFromStored(schema: unknown): SubmissionExtra[] {
  const raw = (schema as { extras?: unknown } | null)?.extras;
  if (!Array.isArray(raw)) return [];
  const types = new Set(["short_text", "long_text", "single_choice", "consent"]);
  return (raw as Array<Record<string, unknown>>).flatMap((f) => (f && typeof f.id === "string" && typeof f.label === "string" && typeof f.type === "string" && types.has(f.type)
    ? [{ id: f.id, type: f.type as SubmissionExtra["type"], label: f.label, required: f.required === true, ...(typeof f.description === "string" && f.description ? { description: f.description } : {}), ...(f.type === "single_choice" ? { options: Array.isArray(f.options) ? (f.options as unknown[]).filter((o): o is string => typeof o === "string" && o.trim() !== "") : [] } : {}) }]
    : []));
}
