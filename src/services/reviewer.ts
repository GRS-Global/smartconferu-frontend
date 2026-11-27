import { DATA_SOURCE } from "@/lib/config";
import type { ReviewDetail, ReviewValues, ReviewerAssignments } from "@/types/reviewer";
// The own backend is the data source: loaded with the page, not as a separate request when first used (it sits on every page's first data read).
import { apiReviewerService } from "./api/reviewer";

/** The contract the Reviewer workspace depends on. Failures throw: AuthRequiredError (no session), ServiceConfigError (Supabase
 *  not configured) or ServiceError (a request failed, with a message ready to show). */
export interface ReviewerService {
  /** The papers assigned to the signed-in user in one conference (by its slug), and how many they declined. Row Level Security
   *  returns only the papers the chair assigned to them. */
  listAssignments(conferenceSlug: string): Promise<ReviewerAssignments>;
  /** One assigned paper with the reviewer's saved answers, its files and whether it has been decided; null when it is not theirs. */
  loadReview(conferenceSlug: string, paperLabel: string): Promise<ReviewDetail | null>;
  /** Saves the form: `submit` false keeps it as the reviewer's draft (a sent review is never taken back by a draft); true sends it.
   *  Resolves `firstSubmit` when this is the first time it was sent. The database refuses once the paper has a decision. */
  saveReview(assignmentId: string, paperDbId: string, values: ReviewValues, submit: boolean): Promise<{ firstSubmit: boolean }>;
  /** Answers an assignment: accepts it, or declines it with a reason (the chair is told). */
  respond(assignmentId: string, accept: boolean, reason?: string): Promise<void>;
  /** "Ask for more time": asks the chair to move this review's deadline to `dateISO` (YYYY-MM-DD); the chairs are told. One open request per paper. */
  requestExtension(assignmentId: string, dateISO: string, reason: string): Promise<void>;
}

/** The service for the configured data source. `mock` is only used when NEXT_PUBLIC_DATA_SOURCE=mock (no network);
 *  there is no fallback from one source to the other. */
export async function getReviewerService(): Promise<ReviewerService> {
  if (DATA_SOURCE === "mock") return (await import("@/mocks/reviewer")).mockReviewerService;
  if (DATA_SOURCE === "api") return apiReviewerService;
  return (await import("./supabase/reviewer")).supabaseReviewerService;
}
