import { PROTOTYPE_URL } from "@/lib/config";

/* Where the Author workspace sends people for screens that are not ported yet: the prototype's own pages (the same
   addresses the prototype's pageToPath gives), on PROTOTYPE_URL. Change a function here to an internal route when its
   screen is ported. Paper labels and slugs are checked before they go into an address. */

const PAPER = /^[A-Za-z0-9]{1,40}-\d{1,9}$/;
const SLUG = /^[a-z0-9][a-z0-9_-]{0,79}$/i;

/** A paper's page as its author sees it ("ISBM-680"), a page of this app; null when the label is not a paper label. */
export const paperPageHref = (paperId: string): string | null => (PAPER.test(paperId) ? `/submissions/${encodeURIComponent(paperId)}/author` : null);

/** The prototype's page of the same paper: where a paper is changed (edit details and authors, upload a version, withdraw) until those are ported. */
export const paperEditHref = (paperId: string): string | null => (PAPER.test(paperId) ? `${PROTOTYPE_URL}/prototype/submissions/${encodeURIComponent(paperId)}/author` : null);

/** The page to make a new submission to a conference. */
export const newSubmissionHref = (slug: string): string | null => (SLUG.test(slug) ? `/submit/${encodeURIComponent(slug)}` : null);

const slugOk = (slug: string) => SLUG.test(slug);
const proto = (path: string) => `${PROTOTYPE_URL}${path}`;

/** A page the Overview can send people to. `external` means it is the prototype's page (a full page load). */
export interface Dest { href: string; external: boolean }
const toProto = (path: string): Dest => ({ href: proto(path), external: true });

/** Pages of a conference, by its slug; null when the slug is not a plain slug. */
export const conferenceDest = {
  registration: (slug: string): Dest | null => (slugOk(slug) ? toProto(`/prototype/registration/${encodeURIComponent(slug)}`) : null),
  programme: (slug: string): Dest | null => (slugOk(slug) ? toProto(`/prototype/programme/${encodeURIComponent(slug)}`) : null),
  /** Feedback: a page of this app. */
  feedback: (slug: string): Dest | null => (slugOk(slug) ? { href: `/author/${encodeURIComponent(slug)}/feedback`, external: false } : null),
  /** Certificates: a page of this app. */
  certificates: (slug: string): Dest | null => (slugOk(slug) ? { href: `/author/${encodeURIComponent(slug)}/certificates`, external: false } : null),
  /** My flyer: a page of this app. */
  flyer: (slug: string): Dest | null => (slugOk(slug) ? { href: `/author/${encodeURIComponent(slug)}/flyer`, external: false } : null),
  /** The paper's page: a page of this app. */
  paper: (paperId: string): Dest | null => { const h = paperPageHref(paperId); return h ? { href: h, external: false } : null; },
  /** Where a paper is changed: the prototype's page of the paper, for now. */
  paperEdit: (paperId: string): Dest | null => { const h = paperEditHref(paperId); return h ? { href: h, external: true } : null; },
  /** My Submissions: a page of this app. */
  submissions: (slug: string): Dest | null => (slugOk(slug) ? { href: `/author/${encodeURIComponent(slug)}/submissions`, external: false } : null),
  /** The account's certificates: a page of this app. */
  myCertificates: (): Dest => ({ href: "/my-certificates", external: false }),
  /** The signed-in user's profile: a page of this app. */
  profile: (): Dest => ({ href: "/profile", external: false }),
};
