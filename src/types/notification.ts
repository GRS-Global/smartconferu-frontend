/** One row of the signed-in user's bell, as the screens use it. The stored `link` column is deliberately not part of
 *  this: where "Open" goes is decided from `kind` and the conference (see features/notifications/destinations.ts). */
export interface AppNotification {
  id: string;
  /** The database's `notifications.kind` (e.g. "decision", "review_assigned"); unknown kinds are handled, not rejected. */
  kind: string;
  title: string;
  body: string;
  read: boolean;
  /** ISO timestamp. */
  createdAt: string;
  /** The paper it is about as people see it ("ISBM-680"), when it is about one the user can still read. */
  paperLabel: string | null;
  /** The conference it is about, when it is about one the user can still see. */
  conference: { slug: string; acronym: string } | null;
  /** Set on an email copy (kind "email"): the email as it was sent. `title` is its subject and `body` a short preview. */
  email?: AppEmail;
}

/** An email the platform sent to the signed-in user (the database's `my_emails()`), as the Emails tab shows it. */
export interface AppEmail {
  subject: string;
  /** "DSAI 2027 <chair@dsai.org>" */
  from: string;
  /** The signed-in user's address. */
  to: string;
  /** The HTML that was sent (stored text: it is only ever shown inside a sandboxed frame). */
  bodyHtml: string;
  template: string;
  /** Whose email it is: reviewers get their review page, everyone else their paper. */
  audience: "author" | "reviewer";
}
