import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import type { AppNotification } from "@/types/notification";
import { NOTIFICATIONS_LIMIT, type NotificationService, type UnreadRow } from "../notifications";
import { ServiceError } from "../errors";
import { currentUser, fail, paperPrefix } from "./shared";

/* Reads and updates the signed-in user's own `notifications` rows with the anon key and their session, exactly as the
   prototype's loadWorkspace / markNotificationsRead do (src/data/workspace.js). Row Level Security ("notifications: own",
   "notifications: mark read") and the column grant (only `read_at` is writable) decide what is allowed; every query below
   also names the user, so a policy mistake could not widen what this screen reads or changes.

   Not selected on purpose: the `link` column. Its values (`/submissions/<uuid>`, `/submissions/<paper id>/author`) point
   at paper routes that neither this app nor the prototype's link helper can resolve, and they are stored text: "Open" is
   worked out from `kind` and the conference instead (features/notifications/destinations.ts). */

interface ConferenceRef { slug: string; acronym: string }
interface NotificationRow {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
  // Embedded through notifications.conference_id → conferences. null when the conference is gone or not visible to the user.
  conferences: ConferenceRef | ConferenceRef[] | null;
  // Embedded through notifications.submission_id → submissions: the paper's number, null when the paper is gone or Row Level Security hides it.
  submissions: { paper_no: number } | Array<{ paper_no: number }> | null;
}

const COLUMNS = "id, kind, title, body, read_at, created_at, conferences(slug, acronym), submissions(paper_no)";
// Notification ids are uuids; anything else never reaches the database.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toNotification(r: NotificationRow): AppNotification {
  const conf = Array.isArray(r.conferences) ? r.conferences[0] : r.conferences;
  const paper = Array.isArray(r.submissions) ? r.submissions[0] : r.submissions;
  const conference = conf && typeof conf.slug === "string" && typeof conf.acronym === "string" ? { slug: conf.slug, acronym: conf.acronym } : null;
  return {
    id: r.id,
    kind: String(r.kind ?? ""),
    title: String(r.title ?? ""),
    body: r.body ?? "",
    read: r.read_at !== null,
    createdAt: r.created_at,
    // "ISBM-680", the prototype's label for a paper (its prefix from the conference acronym + the paper number).
    paperLabel: conference && paper && Number.isInteger(paper.paper_no) && paper.paper_no > 0 ? `${paperPrefix(conference.acronym)}-${paper.paper_no}` : null,
    conference,
  };
}

async function me(db: SupabaseClient): Promise<string> {
  return (await currentUser(db)).id;
}

/* The Emails tab. `my_emails()` (migration 0026) returns only the rows of email_log whose recipient is the signed-in
   user's own profile address and that were sent; email_log itself stays readable by chairs and admins only. An email is
   not a `notifications` row, so it has no read_at: like the prototype (which treats anything older than two days as
   already read) it starts read when it is old, and what the person toggles afterwards is kept by the page for the visit. */
interface EmailRow {
  id: string;
  created_at: string;
  subject: string | null;
  body: string | null;
  template_label: string | null;
  recipient_type: string | null;
  conference_slug: string | null;
  conference_acronym: string | null;
  conference_contact: string | null;
  paper_no: number | null;
}
const EMAILS_LIMIT = 100;
const EMAIL_READ_AFTER_MS = 2 * 24 * 60 * 60 * 1000;
const NO_REPLY = "noreply@smartconferu.com";

// The prototype's bodyPreview, except that the text inside <script> and <style> is not part of what a person reads.
const preview = (html: string) => html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);

function toEmail(r: EmailRow, to: string): AppNotification {
  const acronym = typeof r.conference_acronym === "string" && r.conference_acronym ? r.conference_acronym : null;
  const slug = typeof r.conference_slug === "string" && r.conference_slug ? r.conference_slug : null;
  const html = String(r.body ?? "");
  const subject = String(r.subject ?? "");
  const paper = acronym && Number.isInteger(r.paper_no) && (r.paper_no ?? 0) > 0 ? `${paperPrefix(acronym)}-${r.paper_no}` : null;
  return {
    id: `email-${r.id}`,
    kind: "email",
    title: subject,
    body: preview(html),
    read: Date.now() - new Date(r.created_at).getTime() > EMAIL_READ_AFTER_MS,
    createdAt: r.created_at,
    paperLabel: paper,
    conference: acronym && slug ? { slug, acronym } : null,
    email: {
      subject,
      from: `${acronym ?? "Smartconferu"} <${r.conference_contact || NO_REPLY}>`,
      to,
      bodyHtml: html,
      template: String(r.template_label ?? ""),
      audience: String(r.recipient_type ?? "").toLowerCase() === "reviewer" ? "reviewer" : "author",
    },
  };
}

export const supabaseNotificationService: NotificationService = {
  async list() {
    const db = getSupabase();
    const userId = await me(db);
    const { data, error } = await db
      .from("notifications")
      .select(COLUMNS)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false }) // ties (rows written in one statement) keep a stable order
      .limit(NOTIFICATIONS_LIMIT);
    if (error) fail(error, "read your notifications");
    return ((data ?? []) as unknown as NotificationRow[]).map(toNotification);
  },

  async listEmails() {
    const db = getSupabase();
    const user = await currentUser(db);
    const { data, error } = await db.rpc("my_emails", { p_limit: EMAILS_LIMIT });
    if (error) fail(error, "read your emails");
    return ((data ?? []) as EmailRow[]).map((r) => toEmail(r, user.email ?? ""));
  },

  async unreadCount() {
    const db = getSupabase();
    const userId = await me(db);
    const { count, error } = await db.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null);
    if (error) fail(error, "count your notifications");
    return count ?? 0;
  },

  async unreadList() {
    const db = getSupabase();
    const userId = await me(db);
    const { data, error } = await db.from("notifications").select("id, kind, conferences(slug)").eq("user_id", userId).is("read_at", null).order("created_at", { ascending: false }).limit(500);
    if (error) fail(error, "count your notifications");
    return ((data ?? []) as unknown as Array<{ id: string; kind: string; conferences: { slug: string } | Array<{ slug: string }> | null }>).map((r): UnreadRow => {
      const c = Array.isArray(r.conferences) ? r.conferences[0] : r.conferences;
      return { id: r.id, kind: String(r.kind ?? ""), slug: c && typeof c.slug === "string" ? c.slug : null };
    });
  },

  async markRead(id) {
    if (!UUID.test(id)) throw new ServiceError("Couldn't update this notification.");
    const db = getSupabase();
    const userId = await me(db);
    // Only read_at, only this user's row, only while unread (a second tab that already read it makes this a no-op).
    const { error } = await db.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).eq("user_id", userId).is("read_at", null);
    if (error) fail(error, "mark this notification as read");
  },

  async markUnread(id) {
    if (!UUID.test(id)) throw new ServiceError("Couldn't update this notification.");
    const db = getSupabase();
    const userId = await me(db);
    // Same rule as markRead, the other way round: only read_at (the one writable column), only this user's row, only while read.
    const { error } = await db.from("notifications").update({ read_at: null }).eq("id", id).eq("user_id", userId).not("read_at", "is", null);
    if (error) fail(error, "mark this notification as unread");
  },

  async markAllRead() {
    const db = getSupabase();
    const userId = await me(db);
    const { error } = await db.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", userId).is("read_at", null);
    if (error) fail(error, "mark your notifications as read");
  },
};
