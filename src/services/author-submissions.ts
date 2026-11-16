import { DATA_SOURCE } from "@/lib/config";
import type { AuthorInput, AuthorPaper, AuthorSubmission, ConferenceDetails, NewPaperInput, PaperDetailsPatch, SubmitFormInfo } from "@/types/author-submission";

/** The contract My Submissions depends on. Failures throw: AuthRequiredError (no session), ServiceConfigError (Supabase
 *  not configured) or ServiceError (a request failed, with a message ready to show). */
export interface AuthorSubmissionService {
  /** The conference's submission form (its tracks and submission types) and the signed-in user's own details; null when the conference does not exist or is not visible to the user. */
  loadSubmitForm(conferenceSlug: string): Promise<SubmitFormInfo | null>;
  /** Whether a paper with this title was already sent to the conference, and whether the signed-in user is one of its authors. */
  checkDuplicate(conferenceSlug: string, title: string): Promise<{ found: boolean; mine: boolean }>;
  /** Sends a new paper: the paper, its authors in order, then the file. Returns the paper's database id and its label ("ISBM-680"). The database refuses it when submissions are closed. */
  submitPaper(conferenceSlug: string, paper: NewPaperInput): Promise<{ dbId: string; label: string }>;
  /** One of the signed-in user's own papers by its label ("ISBM-680"), or null when there is no such paper of theirs. */
  paperByLabel(label: string): Promise<AuthorPaper | null>;
  /** Changes a paper's title, abstract and keywords (its authors or submitter; the database refuses it once a decision is recorded). */
  updateDetails(paperDbId: string, patch: PaperDetailsPatch): Promise<void>;
  /** Replaces a paper's author list (its submitter). Authors whose email stays keep their account link. */
  saveAuthors(paperDbId: string, authors: AuthorInput[]): Promise<void>;
  /** Withdraws the paper. Final: it leaves review and can't be undone. */
  withdraw(paperDbId: string): Promise<void>;
  /** Uploads a file to the paper: a new version of the paper (it goes back to the organisers' initial check) or a supporting document.
   *  Only PDF or Word files up to 25 MB; the database and storage decide who may add files. */
  uploadFile(paperDbId: string, file: File, as: "version" | "supporting", autoCheck?: import("@/types/chair").AutoCheck | null): Promise<void>;
  /** A short-lived link to one of the user's own paper files. `downloadAs` makes the link save the file under that name. */
  fileUrl(storagePath: string, downloadAs?: string): Promise<string>;
  /** The conference's own details (place, website, contact), or null when it does not exist or is not visible to the user. */
  conferenceDetails(conferenceSlug: string): Promise<ConferenceDetails | null>;
  /** The signed-in user's own papers in one conference (by its slug), oldest paper number first. Empty when they have none
   *  there (or when the conference does not exist or is not visible to them). */
  listForConference(conferenceSlug: string): Promise<AuthorSubmission[]>;
}

/** The service for the configured data source. `mock` is only used when NEXT_PUBLIC_DATA_SOURCE=mock (no network);
 *  there is no fallback from one source to the other. */
export async function getAuthorSubmissionService(): Promise<AuthorSubmissionService> {
  if (DATA_SOURCE === "mock") return (await import("@/mocks/author-submissions")).mockAuthorSubmissionService;
  return (await import("./supabase/author-submissions")).supabaseAuthorSubmissionService;
}
