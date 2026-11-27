import { api } from "@/lib/api-client";
import type { AppNotification } from "@/types/notification";
import type { NotificationService, UnreadRow } from "../notifications";
import { ServiceError } from "../errors";

/* The bell and the Notifications page through the own backend (Backend/src/modules/notifications): GET /me/notifications (the backend names the
   conference and the paper), POST /me/notifications/read and /unread, and GET /me/emails (+ POST /me/emails/read and /unread) for the Emails
   tab. The backend's unread number counts both, so the bell includes unread emails. */

interface NotificationRow {
  id: string; kind: string; title: string; body: string | null; readAt: string | null; createdAt: string;
  conferenceSlug: string | null; conferenceAcronym: string | null; paperLabel: string | null;
}
interface NotificationPage { data: NotificationRow[]; nextCursor: string | null; unread: number }
interface EmailRow {
  id: string; createdAt: string; subject: string; body: string; templateLabel: string | null; recipientType: string | null;
  conferenceSlug: string | null; conferenceAcronym: string | null; conferenceContact: string | null; paperLabel: string | null;
  /** When I read it (null = unread). Absent from an older backend. */
  readAt?: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE = 100; // the most the backend sends at once
const EMAIL_READ_AFTER_MS = 2 * 24 * 60 * 60 * 1000;
const NO_REPLY = "noreply@smartconferu.com";
// The text inside <script> and <style> is not part of what a person reads.
const preview = (html: string) => html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);

const toNotification = (r: NotificationRow): AppNotification => ({
  id: r.id, kind: String(r.kind ?? ""), title: String(r.title ?? ""), body: r.body ?? "", read: r.readAt !== null, createdAt: r.createdAt,
  paperLabel: r.paperLabel,
  conference: r.conferenceSlug && r.conferenceAcronym ? { slug: r.conferenceSlug, acronym: r.conferenceAcronym } : null,
});

async function me(): Promise<string> {
  const p = await api<{ email: string }>("/me");
  return p.email ?? "";
}

/** A row of the page is a notification (its id) or an email ("email-<id>", see listEmails): each has its own read / unread routes. */
function target(id: string): { path: string; raw: string } {
  const email = id.startsWith("email-");
  const raw = email ? id.slice("email-".length) : id;
  if (!UUID.test(raw)) throw new ServiceError("Couldn't update this notification.");
  return { path: email ? "/me/emails" : "/me/notifications", raw };
}

export const apiNotificationService: NotificationService = {
  async list() {
    // The newest 500 (the page shows them 20 at a time), 100 per request.
    const out: AppNotification[] = [];
    let cursor: string | null = null;
    for (let i = 0; i < 5; i += 1) {
      const r: NotificationPage = await api<NotificationPage>("/me/notifications", { query: { limit: PAGE, cursor } });
      out.push(...r.data.map(toNotification));
      cursor = r.nextCursor;
      if (!cursor) break;
    }
    return out;
  },

  async listEmails() {
    const [rows, to] = await Promise.all([api<EmailRow[]>("/me/emails", { query: { limit: 100 } }), me()]);
    return rows.map((r): AppNotification => ({
      id: `email-${r.id}`, kind: "email", title: r.subject, body: preview(r.body),
      // Read / unread is kept by the backend (email_log.recipient_read_at). An older backend sends no readAt: then, like the prototype, one older
      // than two days counts as read.
      read: r.readAt !== undefined ? r.readAt !== null : Date.now() - new Date(r.createdAt).getTime() > EMAIL_READ_AFTER_MS,
      createdAt: r.createdAt, paperLabel: r.paperLabel,
      conference: r.conferenceSlug && r.conferenceAcronym ? { slug: r.conferenceSlug, acronym: r.conferenceAcronym } : null,
      email: {
        subject: r.subject, from: `${r.conferenceAcronym ?? "Smartconferu"} <${r.conferenceContact || NO_REPLY}>`, to, bodyHtml: r.body,
        template: r.templateLabel ?? "", audience: String(r.recipientType ?? "").toLowerCase() === "reviewer" ? "reviewer" : "author",
      },
    }));
  },

  async unreadCount() {
    const r = await api<NotificationPage>("/me/notifications", { query: { limit: 1, unread: true } });
    return r.unread;
  },

  async unreadList() {
    const out: UnreadRow[] = [];
    let cursor: string | null = null;
    // The newest 500 unread rows, 100 at a time.
    for (let i = 0; i < 5; i += 1) {
      const r: NotificationPage = await api<NotificationPage>("/me/notifications", { query: { limit: PAGE, unread: true, cursor } });
      for (const n of r.data) out.push({ id: n.id, kind: String(n.kind ?? ""), slug: n.conferenceSlug });
      cursor = r.nextCursor;
      if (!cursor) break;
    }
    return out;
  },

  async markRead(id) {
    const { path, raw } = target(id);
    await api(`${path}/read`, { method: "POST", body: { ids: [raw] } });
  },

  async markUnread(id) {
    const { path, raw } = target(id);
    await api(`${path}/unread`, { method: "POST", body: { ids: [raw] } });
  },

  async markAllRead() { await api("/me/notifications/read", { method: "POST" }); },
};
