/* The app's workspace addresses, all in one place: every page of a role inside a conference is /<role>/<conference>/…, e.g.
   /chair/ictis2027/initial-check, /chair/ictis2027/submissions/ICTIS-1, /author/ictis2027/submissions/ICTIS-1. The older addresses
   (/conference/<c>/chair, /cfp-manager/<c>, /submissions/<paper>/chair|author) still open and move to these (links in emails sent before). */

const e = encodeURIComponent;

/** The chair's page for one paper; `view` "review" is its peer review, "review/add" the chair's own review. */
export const chairPaperHref = (conference: string, paper: string, view?: "review" | "review/add") =>
  `/chair/${e(conference)}/submissions/${e(paper)}${view ? `/${view}` : ""}`;
export const authorPaperHref = (conference: string, paper: string) => `/author/${e(conference)}/submissions/${e(paper)}`;
export const chairDashboardHref = (conference: string) => `/chair/${e(conference)}/dashboard`;
export const authorDashboardHref = (conference: string) => `/author/${e(conference)}/dashboard`;
/** The Call for Papers manager; `tab` opens one of its tabs (publish, content, managers). */
export const cfpManagerHref = (conference: string, tab?: string) => `/chair/${e(conference)}/cfp${tab ? `?tab=${e(tab)}` : ""}`;
