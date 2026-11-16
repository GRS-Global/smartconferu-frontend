import { DATA_SOURCE } from "@/lib/config";
import type { PaperCandidate, ProposalConference, ProposalForm, Publication, PublicationInput, Receipt, WatchedCfp } from "@/types/account";

/** The account pages that are not part of one conference. Everything here is the signed-in person's own (migration 0050). */
export interface AccountExtrasService {
  receipts(): Promise<Receipt[]>;
  deleteReceipt(id: number): Promise<void>;

  watchlist(): Promise<WatchedCfp[]>;
  /** Published or closed Calls for Papers whose acronym or name contains the text (up to 6, not yet on the list). */
  searchCfps(text: string, exclude: string[]): Promise<WatchedCfp[]>;
  addToWatchlist(slug: string): Promise<void>;
  removeFromWatchlist(slugs: string[]): Promise<void>;

  /** The person's own papers (any conference), newest first. */
  myPapers(): Promise<PaperCandidate[]>;
  publications(kind: "preprint" | "slides"): Promise<Publication[]>;
  createPublication(input: PublicationInput): Promise<void>;

  /** Conferences the person chairs (the proposal page keeps the ones that ended in the last two years or have not ended). */
  proposalConferences(): Promise<ProposalConference[]>;
  submitProposal(form: ProposalForm): Promise<void>;
}

export async function getAccountExtrasService(): Promise<AccountExtrasService> {
  if (DATA_SOURCE === "mock") return (await import("@/mocks/account-extras")).mockAccountExtrasService;
  return (await import("./supabase/account-extras")).supabaseAccountExtrasService;
}
