/* The account pages that are not tied to one conference: My Receipts, My CFP Watchlist, My Preprints, My Slides, Publish with Us. */

export interface Receipt { id: number; description: string; amount: number; date: string }

/** A conference on the CFP watchlist (the conference's own details; the topics are the ones its CFP lists). */
export interface WatchedCfp { /** The CFP page address (/cfp/<page>), "" when it has none. */ cfpPage: string; slug: string; acronym: string; name: string; country: string; submissionDeadline: string; endDate: string; topics: string[] }

/** One of the signed-in person's own papers, offered as a starting point for a preprint or slides. */
export interface PaperCandidate {
  id: string; label: string; conferenceAcronym: string; conferenceName: string; title: string; abstract: string; keywords: string[];
  authors: Array<{ name: string; email: string }>; date: string;
}

export interface PublicationAuthor { firstName: string; lastName: string; email: string; presenter?: boolean }
export interface PublicationInput {
  kind: "preprint" | "slides";
  title: string; authors: PublicationAuthor[]; language: string; abstract: string; primaryArea: string; secondaryArea: string; keywords: string[];
  /** The paper it was made from (null = from scratch). */
  fromPaper: { id: string; acronym: string } | null;
  /** Slides only. */
  event?: string; city?: string; country?: string; presentDate?: string;
}
/** A saved preprint or slide deck as the list shows it. */
export interface Publication { id: string; title: string; authors: string; source: string | null; paperId: string | null }

/** A conference the person chairs that can carry a proposal for a volume. */
export interface ProposalConference { slug: string; acronym: string; name: string; endDate: string }
export type ProposalForm = Record<string, unknown> & { title: string };
