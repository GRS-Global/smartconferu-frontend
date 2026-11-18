/** One Call for Papers as My CFP lists it: the conference it belongs to (a CFP is the conference's own `cfps` row) and where it stands. */
export interface CfpRow {
  /** The conference's slug (what its pages use in their address). */
  slug: string;
  acronym: string;
  name: string;
  /** "draft": not published yet (no submission link); "review": sent to the Super Admin, waiting for approval (own backend only); "published": takes submissions; "closed": stopped taking them. */
  status: "draft" | "review" | "published" | "closed";
  /** The CFP's text has been started (written, templated or copied): a draft the chair can continue. Until then the new-CFP wizard starts it. */
  hasDraft: boolean;
  /** Papers sent so far (drafts and withdrawn ones are not counted). */
  submissions: number;
  /** The conference's first and last day and its submission deadline (YYYY-MM-DD), or "". */
  startDate: string;
  endDate: string;
  deadline: string;
  country: string;
}

export type CfpStatus = CfpRow["status"];

/** Someone who helps manage a conference's Call for Papers (`conference_members`, role cfp_manager). */
/** What a CFP manager may do (migration 0045): edit the CFP, publish / close it, add and remove the other managers. */
export interface CfpPermissions { edit: boolean; publish: boolean; updateManagers: boolean }
export const DEFAULT_CFP_PERMISSIONS: CfpPermissions = { edit: true, publish: true, updateManagers: false };
export interface CfpManager { id: string; name: string; email: string; status: "invited" | "active" | "declined"; permissions: CfpPermissions }

/** What the CFP manager needs from the conference's `cfps` row besides the conference's own details (those come from Conference Details).
 *  The page's text is kept as HTML in `cfps.content.doc`, the page the authors visit in `cfps.content.publicSlug`, the look in `cfps.theme.id`. */
export interface CfpDetail {
  status: CfpStatus;
  /** Why the Super Admin did not approve the last version sent (a draft again, own backend only); "" or missing otherwise. */
  rejection?: string;
  /** The CFP page's text (HTML), "" while nothing is written. */
  doc: string;
  /** The theme's id ("classic", "easy", "blue", "sandy", "red"). */
  themeId: string;
  /** The address part the CFP page lives at (`/cfp/<publicSlug>`), "" until it is chosen at Publish. */
  publicSlug: string;
  /** Papers sent so far (drafts and withdrawn ones are not counted). */
  submissions: number;
  managers: CfpManager[];
}

/** The page authors visit (`/cfp/<page>`): a published CFP, or a closed one (its address then says it has closed). */
export interface PublicCfp {
  /** The conference's slug (the submission form is /submit/<slug>). */
  slug: string;
  acronym: string;
  name: string;
  status: "published" | "closed";
  venue: string;
  city: string;
  country: string;
  webPage: string;
  contactEmail: string;
  about: string;
  topics: string[];
  startDate: string;
  endDate: string;
  submissionDeadline: string;
  doc: string;
  themeId: string;
}
