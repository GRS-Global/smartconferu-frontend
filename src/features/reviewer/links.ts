
/* Where the Reviewer pages send people for screens that are not ported yet: the prototype's own pages (the same addresses its
   pageToPath gives). Every destination is a page of this app. */

const SLUG = /^[a-z0-9][a-z0-9_-]{0,79}$/i;
const PAPER = /^[A-Za-z0-9]{1,40}-\d{1,9}$/;
const e = encodeURIComponent;

export interface Dest { href: string; external: boolean }

/** A paper's review page: a page of this app. */
export const reviewDest = (slug: string, paperId: string): Dest | null => (SLUG.test(slug) && PAPER.test(paperId) ? { href: `/reviewer/${e(slug)}/review/${e(paperId)}`, external: false } : null);
/** Certificates: a page of this app. */
export const reviewerCertificatesDest = (slug: string): Dest | null => (SLUG.test(slug) ? { href: `/reviewer/${e(slug)}/certificates`, external: false } : null);
/** Activity Log: a page of this app. */
export const reviewerActivityDest = (slug: string): Dest | null => (SLUG.test(slug) ? { href: `/reviewer/${e(slug)}/activity-logs`, external: false } : null);
/** My Reviews: a page of this app. */
export const myReviewsDest = (slug: string): Dest | null => (SLUG.test(slug) ? { href: `/reviewer/${e(slug)}/reviews`, external: false } : null);
