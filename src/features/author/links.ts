import { comingSoonHref } from "@/lib/navigation";

/* Where the Author workspace sends people. Screens that are not built yet open the internal "Coming soon" page.
   Paper labels and slugs are checked before they go into an address. */

const PAPER = /^[A-Za-z0-9]{1,40}-\d{1,9}$/;
const SLUG = /^[a-z0-9][a-z0-9_-]{0,79}$/i;

/** A paper's page as its author sees it ("ISBM-680"), a page of this app; null when the label is not a paper label. */
/** The author's page of a paper: /author/<conference>/submissions/<paper> (the older /submissions/<paper>/author when the conference is not known). */
export const paperPageHref = (paperId: string, conference?: string): string | null => (!PAPER.test(paperId) ? null : conference && slugOk(conference) ? `/author/${encodeURIComponent(conference)}/submissions/${encodeURIComponent(paperId)}` : `/submissions/${encodeURIComponent(paperId)}/author`);

/** Where a paper is changed (edit details and authors, upload a version, withdraw): not built yet, so the "Coming soon" page. */
export const paperEditHref = (paperId: string): string | null => (PAPER.test(paperId) ? comingSoonHref("paper-edit") : null);

/** The page to make a new submission to a conference. */
export const newSubmissionHref = (slug: string): string | null => (SLUG.test(slug) ? `/submit/${encodeURIComponent(slug)}` : null);

const slugOk = (slug: string) => SLUG.test(slug);

/** A page the Overview can send people to. `external` means a full page load instead of a client-side navigation. */
export interface Dest { href: string; external: boolean }
const soon = (key: "registration" | "programme"): Dest => ({ href: comingSoonHref(key), external: false });

/** Pages of a conference, by its slug; null when the slug is not a plain slug. */
export const conferenceDest = {
  registration: (slug: string): Dest | null => (slugOk(slug) ? soon("registration") : null),
  programme: (slug: string): Dest | null => (slugOk(slug) ? soon("programme") : null),
  /** Feedback: a page of this app. */
  feedback: (slug: string): Dest | null => (slugOk(slug) ? { href: `/author/${encodeURIComponent(slug)}/feedback`, external: false } : null),
  /** Certificates: a page of this app. */
  certificates: (slug: string): Dest | null => (slugOk(slug) ? { href: `/author/${encodeURIComponent(slug)}/certificates`, external: false } : null),
  /** My flyer: a page of this app. */
  flyer: (slug: string): Dest | null => (slugOk(slug) ? { href: `/author/${encodeURIComponent(slug)}/flyer`, external: false } : null),
  /** The paper's page: a page of this app. */
  paper: (paperId: string, conference?: string): Dest | null => { const h = paperPageHref(paperId, conference); return h ? { href: h, external: false } : null; },
  /** Where a paper is changed: not built yet. */
  paperEdit: (paperId: string): Dest | null => { const h = paperEditHref(paperId); return h ? { href: h, external: false } : null; },
  /** My Submissions: a page of this app. */
  submissions: (slug: string): Dest | null => (slugOk(slug) ? { href: `/author/${encodeURIComponent(slug)}/submissions`, external: false } : null),
  /** The account's certificates: a page of this app. */
  myCertificates: (): Dest => ({ href: "/my-certificates", external: false }),
  /** The signed-in user's profile: a page of this app. */
  profile: (): Dest => ({ href: "/profile", external: false }),
};
