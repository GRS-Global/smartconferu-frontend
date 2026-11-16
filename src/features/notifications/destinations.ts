import { PROTOTYPE_URL } from "@/lib/config";
import type { AppNotification } from "@/types/notification";

/* What a notification's action button says and where it goes, and which role's notification it is — from the prototype's
   liveAlertOf (src/author-journey.jsx), which gives every database notification one primary action and an audience.

   Nothing stored is ever used as an address: the `link` column is not even read (see services/supabase/notifications.ts).
   The action is looked up by `kind`; the address is built here from this app's own routes or the prototype's page paths,
   with a conference slug that has been checked to be a plain slug and a paper label ("ISBM-680") that has been checked
   to be one, both URL-encoded.

   WHERE EACH ACTION GOES. A page that is ported to this app is `{ app: "/route" }`; a page that is still the prototype's is
   `{ prototype: "/prototype/…" }` and opens on PROTOTYPE_URL (like the navigation menu's not-yet-ported screens).
   When one of these pages is ported, change its \`prototype\` target to \`app\` below — nothing else has to change.

     kind                    label                        prototype page (pageToPath)                         target here
     member_invited          "See the invitation"         dashboard                                            app  /dashboard
     conference_decision     "Open My Conferences"        dashboard                                            app  /dashboard
     decision                "Open my submissions"        /prototype/author/<conference>/submissions           app  /author/<conference>/submissions  (ported)
     withdrawn               "Open my submissions"        /prototype/author/<conference>/submissions           app  /author/<conference>/submissions  (as an author)
                             "Open submissions"           /prototype/chair/<conference>                        app  /chair/<conference>  (as the conference's chair)
     review_assigned         "Open my review queue"       /prototype/reviewer/<conference>                     app  /reviewer/<conference>
     review_reminder         "Open my review queue"       /prototype/reviewer/<conference>                     app  /reviewer/<conference>
     review_edited           "Open my review"             /prototype/reviewer/<conference>/review/<paper>      app  /reviewer/<conference>/review/<paper>  (without its paper: the review queue)
     new_submission          "Open submissions"           /prototype/chair/<conference>                        app  /chair/<conference>
     invitation_answer       "Open reviewers"             /prototype/chair/<conference>/peer-review/reviewers  prototype
     assignment_declined     "Find a replacement"         /prototype/chair/<conference>/peer-review            prototype
     new_version             "Open Initial Check"         /prototype/chair/<conference>/initial-check          app  /chair/<conference>/initial-check[?search=<paper>]  (ported; the paper, when known, sets the ID filter once)
     extension_request       "Review request"             (chair)                                              app  /submissions/<paper>/chair/review  (only when its paper is known)
     extension_answer        "Open my review"             (reviewer)                                           app  /reviewer/<conference>/review/<paper>  (without its paper: the review queue)
     coauthor_added          "Open my paper"              /prototype/submissions/<paper>/author                app  /submissions/<paper>/author  (only when its paper is known)
     screening               "Open my paper"              /prototype/submissions/<paper>/author                app  /submissions/<paper>/author  (only when its paper is known)
     email (Emails tab)      "Open paper"                 /prototype/submissions/<paper>/author                app  /submissions/<paper>/author  (author's email; only when its paper is known)
                             "Open paper"                 /prototype/reviewer/<conference>/review/<paper>      prototype  (reviewer's email)

   As in the prototype, an action that needs a conference (or a paper) is left out when there is none. */

export type ActionTarget = { app: string } | { prototype: string };
export interface NotificationAction { label: string; href: string; /** True when it leaves this app for the prototype. */ external: boolean }

// A plain conference slug, as the dashboard uses it in its own links; a paper label such as ISBM-680.
const SLUG = /^[a-z0-9][a-z0-9_-]{0,79}$/i;
const PAPER = /^[A-Za-z0-9]{1,40}-\d{1,9}$/;

type Chairs = ReadonlySet<string>;
type Maker = (n: Pick<AppNotification, "conference" | "paperLabel" | "email">, chairOf: Chairs) => { label: string; target: ActionTarget } | null;

const conf = (n: Pick<AppNotification, "conference">): string | null => (n.conference && SLUG.test(n.conference.slug) ? encodeURIComponent(n.conference.slug) : null);
const paper = (n: Pick<AppNotification, "paperLabel">): string | null => (n.paperLabel && PAPER.test(n.paperLabel) ? encodeURIComponent(n.paperLabel) : null);

const inConference = (label: string, path: (c: string) => string): Maker => (n) => {
  const c = conf(n);
  return c ? { label, target: { prototype: path(c) } } : null;
};
/** Like inConference, for a page that is ported: an internal route of this app. */
const inConferenceApp = (label: string, path: (c: string) => string): Maker => (n) => {
  const c = conf(n);
  return c ? { label, target: { app: path(c) } } : null;
};
const myPaper: Maker = (n) => {
  const p = paper(n);
  return p ? { label: "Open my paper", target: { app: `/submissions/${p}/author` } } : null;
};

const ACTIONS: Record<string, Maker> = {
  member_invited: () => ({ label: "See the invitation", target: { app: "/dashboard" } }),
  conference_decision: () => ({ label: "Open My Conferences", target: { app: "/dashboard" } }),
  decision: inConferenceApp("Open my submissions", (c) => `/author/${c}/submissions`),
  withdrawn: (n, chairOf) => (n.conference && chairOf.has(n.conference.slug)
    ? inConferenceApp("Open submissions", (c) => `/chair/${c}`)(n, chairOf)
    : inConferenceApp("Open my submissions", (c) => `/author/${c}/submissions`)(n, chairOf)),
  review_assigned: inConferenceApp("Open my review queue", (c) => `/reviewer/${c}`),
  review_reminder: inConferenceApp("Open my review queue", (c) => `/reviewer/${c}`),
  review_edited: (n, chairOf) => {
    const p = paper(n);
    const c = conf(n);
    if (!c) return null;
    return p
      ? { label: "Open my review", target: { app: `/reviewer/${c}/review/${p}` } }
      : inConferenceApp("Open my review", (cc) => `/reviewer/${cc}`)(n, chairOf);
  },
  new_submission: inConferenceApp("Open submissions", (c) => `/chair/${c}`),
  invitation_answer: inConference("Open reviewers", (c) => `/prototype/chair/${c}/peer-review/reviewers`),
  assignment_declined: inConference("Find a replacement", (c) => `/prototype/chair/${c}/peer-review`),
  // Initial Check is ported. As the prototype's chair notification about a new version (`notifyChairNewVersion`, ctx.screeningSearch = the paper's
  // ID) it opens with the ID filter set to that paper; without a paper it opens the plain table (as the database notification does there).
  new_version: (n) => {
    const c = conf(n);
    if (!c) return null;
    const p = paper(n);
    return { label: "Open Initial Check", target: { app: `/chair/${c}/initial-check${p ? `?search=${p}` : ""}` } };
  },
  // "Ask for more time": the chair opens the paper's review page to approve or decline; the reviewer opens the review.
  extension_request: (n) => {
    const p = paper(n);
    return p ? { label: "Review request", target: { app: `/submissions/${p}/chair/review` } } : null;
  },
  extension_answer: (n) => {
    const p = paper(n);
    const c = conf(n);
    if (!c) return null;
    return p ? { label: "Open my review", target: { app: `/reviewer/${c}/review/${p}` } } : { label: "Open my review queue", target: { app: `/reviewer/${c}` } };
  },
  coauthor_added: myPaper,
  screening: myPaper,
  // An email copy: "Open paper" (a reviewer's email goes to the review page, anyone else's to the paper), only when its paper is known.
  email: (n) => {
    const p = paper(n);
    const c = conf(n);
    if (!p) return null;
    if (n.email?.audience === "reviewer") return c ? { label: "Open paper", target: { app: `/reviewer/${c}/review/${p}` } } : null;
    return { label: "Open paper", target: { app: `/submissions/${p}/author` } };
  },
};

/** The action button of a notification, or null when the prototype gives it none (or what it needs is missing). */
export function actionOf(n: Pick<AppNotification, "kind" | "conference" | "paperLabel" | "email">, chairOf: Chairs = new Set()): NotificationAction | null {
  if (!Object.prototype.hasOwnProperty.call(ACTIONS, n.kind)) return null;
  const made = ACTIONS[n.kind](n, chairOf);
  if (!made) return null;
  return "app" in made.target
    ? { label: made.label, href: made.target.app, external: false }
    : { label: made.label, href: `${PROTOTYPE_URL}${made.target.prototype}`, external: true };
}

export type Audience = "author" | "reviewer" | "chair";
export const AUDIENCE_LABEL: Record<Audience, string> = { author: "Author", reviewer: "Reviewer", chair: "Chair" };

const AUDIENCE: Record<string, Audience> = {
  decision: "author",
  review_assigned: "reviewer",
  member_invited: "reviewer",
  new_submission: "chair",
  invitation_answer: "chair",
  assignment_declined: "chair",
  conference_decision: "chair",
  coauthor_added: "author",
  screening: "author",
  review_reminder: "reviewer",
  review_edited: "reviewer",
  new_version: "chair",
  extension_request: "chair",
  extension_answer: "reviewer",
};

/** Whose notification it is — the role on its conference chip. A withdrawal goes to the conference's chairs and to the
 *  authors: the chair's copy when this account chairs that conference. Anything unmapped is an author's. */
export function audienceOf(n: Pick<AppNotification, "kind" | "conference" | "email">, chairOf: ReadonlySet<string>): Audience {
  if (n.kind === "email") return n.email?.audience ?? "author";
  if (n.kind === "withdrawn") return n.conference && chairOf.has(n.conference.slug) ? "chair" : "author";
  return Object.prototype.hasOwnProperty.call(AUDIENCE, n.kind) ? AUDIENCE[n.kind] : "author";
}
