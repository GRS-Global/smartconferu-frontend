import type { AppNotification } from "@/types/notification";

/* Which category a stored notification belongs to, and which tab shows it — the prototype's own rules.

   The prototype (src/author-module/NotificationsPage.jsx + notificationsData.js) has four tabs: All, Paper updates,
   Announcements and Emails. Its items carry a category: "update", "action", "announcement" or "email". The tab test there is

     tab === "all" || item.category === tab || (tab === "update" && item.category === "action") || (tab === "email" && isEmail(item))

   so "action" items (invitations, assignments, "needs your action") sit under Paper updates. How a stored kind gets its
   category is the prototype's liveAlertOf (src/author-journey.jsx), written for the kinds the database and the server write:

     database triggers / functions: conference_request, new_submission, member_invited, review_assigned, decision,
       coauthor_added, invitation_answer, assignment_declined, conference_decision, withdrawn, review_edited
     server (src/shared/emailRequest.js, reviewReminders.js): screening, new_version, review_reminder

   A kind liveAlertOf does not map (conference_request, or one this app has not met) is a paper update there, and here.
   Nothing stored in `notifications` is an announcement today; the kind "announcement" is mapped so one would land in its tab.
   Email items (kind "email") are not stored there: they come from the database function my_emails() (see
   services/supabase/notifications.ts) and are put in the Emails tab, and in All, by this same test. */

export type ItemCategory = "update" | "action" | "announcement" | "email";
export type TabKey = "all" | "update" | "announcement" | "email";

export const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "update", label: "Paper updates" },
  { key: "announcement", label: "Announcements" },
  // Copies of the emails sent to the signed-in user.
  { key: "email", label: "Emails" },
];

const CATEGORY: Record<string, ItemCategory> = {
  decision: "update",
  review_assigned: "action",
  member_invited: "action",
  new_submission: "update",
  invitation_answer: "update",
  assignment_declined: "action",
  conference_decision: "update",
  coauthor_added: "update",
  screening: "action",
  review_reminder: "action",
  review_edited: "update",
  new_version: "action",
  // "Ask for more time" (migration 0043): the chair's request is an action, the reviewer's answer an update (the prototype's own categories).
  extension_request: "action",
  extension_answer: "update",
  withdrawn: "update",
  announcement: "announcement",
  email: "email",
};

/** The category of a kind. Unknown kinds (and conference_request, which the prototype does not map) are paper updates. */
export function categoryOf(kind: string): ItemCategory {
  return Object.prototype.hasOwnProperty.call(CATEGORY, kind) ? CATEGORY[kind] : "update";
}

/** An email copy (prototype: `category === "email" || !!email`). */
export function isEmail(n: Pick<AppNotification, "kind">): boolean {
  return categoryOf(n.kind) === "email";
}

/** Whether a tab shows a notification — the prototype's test, word for word. */
export function inTab(n: Pick<AppNotification, "kind">, tab: TabKey): boolean {
  const category = categoryOf(n.kind);
  return tab === "all" || category === tab || (tab === "update" && category === "action") || (tab === "email" && isEmail(n));
}
