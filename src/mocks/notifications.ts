import type { AppNotification } from "@/types/notification";
import type { NotificationService } from "@/services/notifications";

/* Typed fixtures for NEXT_PUBLIC_DATA_SOURCE=mock (UI work only; no network, no accounts). They cover every kind the
   database and the server write, one kind the app doesn't know, one "announcement" (the database never writes that kind,
   so the Announcements tab would otherwise be empty here), a notification without a conference, and the three day groups.
   Times are relative to now so Today / This week / Earlier always have rows. Conference slugs match src/mocks/conferences.ts. */

const MIN = 60_000;
const DAY = 24 * 60 * MIN;
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
/** A time `minutes` ago, but never before today's midnight (so "today" rows stay in Today near midnight). */
const today = (minutes: number) => new Date(Math.max(startOfToday() + MIN, Date.now() - minutes * MIN)).toISOString();
const daysAgo = (days: number, hour = 10) => { const d = new Date(Date.now() - days * DAY); d.setHours(hour, 15, 0, 0); return d.toISOString(); };

const DSAI = { slug: "demo-dsai-2027", acronym: "DSAI 2027" };
const NETS = { slug: "demo-nets-2026", acronym: "NETS 2026" };
const EDTECH = { slug: "demo-edtech-2027", acronym: "EDTECH 2027" };
const HCI = { slug: "demo-hci-2025", acronym: "HCI-EU 2025" };

const n = (id: string, kind: string, title: string, body: string, createdAt: string, read: boolean, conference: AppNotification["conference"], paperLabel: string | null = null): AppNotification =>
  ({ id: `mock-n-${id}`, kind, title, body, createdAt, read, conference, paperLabel });

/** Newest first, as the service returns them. */
const FIXTURES: AppNotification[] = [
  n("01", "decision", "Decision: Accept", "Your paper \"Federated Learning for Privacy-Preserving IoT Analytics\" was accepted. Register to keep your slot.", today(25), false, DSAI),
  n("02", "review_assigned", "New paper to review", "\"Edge Caching under Intermittent Connectivity\" was assigned to you. Due 14 Nov.", today(70), false, NETS),
  n("03", "screening", "Correction needed: EDTECH-205", "The initial check found a missing abstract. Please upload a corrected version.", today(130), false, EDTECH, "EDTECH-205"),
  n("04", "assignment_declined", "Priya Nair declined a paper: Edge Caching under Intermittent Connectivity", "Conflict of interest.", daysAgo(1, 16), false, NETS),
  n("05", "coauthor_added", "You were added as a co-author", "Dr. Rahman listed you on \"Adaptive Curriculum Sequencing\".", daysAgo(2, 11), false, EDTECH, "EDTECH-205"),
  n("06", "review_reminder", "3 days left to review — NETS 2026", "2 reviews are still waiting. Due Fri 14 Nov.", daysAgo(2, 8), true, NETS),
  n("07", "member_invited", "You are invited as reviewer", "DSAI 2027 — International Conference on Data Systems and Applied Intelligence", daysAgo(3, 14), false, DSAI),
  n("08", "new_submission", "New submission", "Scenario-Based Forecasting of Media Supply and Demand", daysAgo(3, 9), true, DSAI),
  n("09", "announcement", "Venue update", "The welcome reception moves to the Garden Hall on Tuesday evening.", daysAgo(4, 12), false, DSAI),
  n("10", "invitation_answer", "Ben Whitfield accepted the reviewer invitation", "", daysAgo(5, 17), true, NETS),
  n("11", "review_edited", "The chair edited your review", "Paper NETS-118. Your scores were adjusted.", daysAgo(6, 13), true, NETS, "NETS-118"),
  n("12", "conference_decision", "Conference approved", "ICDS 2028 was approved by the Super Admin.", daysAgo(9, 10), true, null),
  n("13", "withdrawn", "Paper withdrawn: HCI-044", "\"Gaze-Aware Interfaces for Seminars\" was withdrawn.", daysAgo(12, 15), false, HCI),
  n("14", "new_version", "New version to check: DSAI-077", "The author uploaded a revised file.", daysAgo(15, 9), true, DSAI),
  n("15", "conference_request", "New conference request", "ICML-X 2028 — Machine Learning Experiments", daysAgo(18, 11), true, null),
  n("16", "something_new_we_do_not_know", "A notification kind this app has not met", "It still shows, with the generic icon and no Open button.", daysAgo(21, 10), false, DSAI),
];

// The list lives in memory for the session, like src/mocks/conferences.ts's invitation state.
const state = { items: FIXTURES.map((x) => ({ ...x, conference: x.conference && { ...x.conference } })) };

const mail = (id: string, subject: string, template: string, html: string, createdAt: string, conference: NonNullable<AppNotification["conference"]>, paperLabel: string | null, audience: "author" | "reviewer"): AppNotification => ({
  id: `mock-email-${id}`, kind: "email", title: subject, body: html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(), createdAt, read: Date.now() - new Date(createdAt).getTime() > 2 * DAY, conference, paperLabel,
  email: { subject, from: `${conference.acronym} <chair@example.org>`, to: "you@example.org", bodyHtml: html, template, audience },
});
const EMAILS: AppNotification[] = [
  mail("1", "[DSAI 2027] Decision on your paper", "Decision", "<p>Dear author,</p><p>We are pleased to tell you that your paper was <b>accepted</b>.</p><p>Best regards,<br/>The DSAI 2027 Team</p>", today(30), DSAI, "DSAI-077", "author"),
  mail("2", "[NETS 2026] Review invitation", "Reviewer invitation", "<p>Dear reviewer,</p><p>Please accept or decline the invitation.</p><p>Best regards,<br/>The NETS 2026 Team</p>", daysAgo(1, 9), NETS, "NETS-118", "reviewer"),
  mail("3", "[EDTECH 2027] Welcome", "Welcome", "<p>Welcome to the conference.</p>", daysAgo(5, 10), EDTECH, null, "author"),
];
const emailState = { items: EMAILS.map((x) => ({ ...x, conference: x.conference && { ...x.conference } })) };

export const mockNotificationService: NotificationService = {
  async listEmails() {
    return emailState.items.map((x) => ({ ...x, conference: x.conference && { ...x.conference } }));
  },
  async list() {
    // Newest first, as the real service returns them.
    return [...state.items].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((x) => ({ ...x, conference: x.conference && { ...x.conference } }));
  },
  async unreadCount() {
    return state.items.filter((x) => !x.read).length;
  },
  async unreadList() {
    return state.items.filter((x) => !x.read).map((x) => ({ id: x.id, kind: x.kind, slug: x.conference?.slug ?? null }));
  },
  async markRead(id) {
    state.items = state.items.map((x) => (x.id === id ? { ...x, read: true } : x));
  },
  async markUnread(id) {
    state.items = state.items.map((x) => (x.id === id ? { ...x, read: false } : x));
  },
  async markAllRead() {
    state.items = state.items.map((x) => ({ ...x, read: true }));
  },
};
