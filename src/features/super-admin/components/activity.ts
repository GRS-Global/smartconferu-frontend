/* Activity-log entries (the API's audit_log) as one readable line each. Unknown actions fall back
   to the action name, so nothing is hidden. */
import type { ActivityEntry } from "../services";
import type { Tone } from "./ui";

const LABELS: Record<string, string> = {
  "auth.sign_in": "signed in",
  "auth.sign_in_failed": "failed to sign in",
  "auth.sign_out": "signed out",
  "auth.registered": "created an account",
  "auth.mfa_challenged": "was asked for a sign-in code",
  "auth.password_changed": "changed their password",
  "auth.password_reset": "reset their password",
  "conference.created": "asked for a new conference",
  "conference.approved": "approved a conference",
  "conference.declined": "declined a conference request",
  "conference.archived": "archived a conference",
  "conference.restored": "restored a conference",
  "conference.deletion_requested": "asked to delete a conference",
  "conference.deleted": "deleted a conference",
  "submission.created": "submitted a paper",
  "submission.withdrawn": "withdrew a paper",
  "review.submitted": "sent a review",
  "admin.user_suspended": "suspended a user",
  "admin.user_reactivated": "reactivated a user",
  "admin.society_created": "added a society",
  "admin.society_updated": "edited a society",
  "admin.institution_created": "added an institution",
  "admin.institution_updated": "edited an institution",
  "admin.institution_merged": "merged two institutions",
  "admin.research_area_created": "added a research area",
  "admin.research_area_updated": "edited a research area",
  "admin.email_template_updated": "edited an email template",
};

export function activityText(a: ActivityEntry): string {
  const who = a.actor?.name ?? "Someone";
  const what = LABELS[a.action] ?? a.action.replace(/[._]/g, " ");
  const subject = typeof a.data.acronym === "string" ? ` ${a.data.acronym}` : typeof a.data.name === "string" ? ` “${a.data.name}”` : "";
  return `${who} ${what}${subject}`;
}

export function activityTone(action: string): Tone {
  if (action.endsWith("_failed") || action.includes("suspend") || action.includes("deleted") || action.includes("declined")) return "danger";
  if (action.startsWith("admin.")) return "secondary";
  if (action.startsWith("auth.")) return "neutral";
  if (action.includes("approved") || action.includes("submitted")) return "success";
  return "primary";
}
