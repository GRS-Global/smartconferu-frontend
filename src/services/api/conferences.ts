import { api, publicFileUrl } from "@/lib/api-client";
import type {
  AuthorPaper, AuthorPaperResult, ChairPaper, Conference, ConferenceRole, ConferenceStatus, ReviewAssignment, ReviewInvitation, SourceConference,
} from "@/types/conference";
import type { ConferenceService, DashboardData } from "../conferences";

/* My Conferences through the own backend: one call, `GET /me/dashboard` (Backend/src/modules/users), instead of the six
   table reads the Supabase version makes. The backend only sends what the signed-in person may see; this file turns it into
   the shapes the dashboard already uses (src/types/conference.ts), so the screens don't change. */

interface DashboardResponse {
  conferences: Array<{
    conferenceId: string; slug: string; acronym: string; title: string; status: string; logoPath: string | null;
    city: string | null; country: string | null; startDate: string | null; endDate: string | null; reviewDeadline: string | null;
    /** Older backends don't send these two; the screens then show the date as not set. */
    submissionDeadline?: string | null; abstractDeadline?: string | null; roles: string[];
  }>;
  authorPapers: Array<{ submissionId: string; conferenceId: string; paperNo: number; status: string; notifiedOutcome: string | null }>;
  chairPapers: Array<{ submissionId: string; conferenceId: string; status: string; outcome: string }>;
  reviewerAssignments: Array<{ assignmentId: string; conferenceId: string; paperNo: number; status: string; reviewed: boolean; dueAt: string | null }>;
  invitations: Array<{
    memberId: string; conferenceId: string; slug: string; acronym: string; title: string; country: string | null; role: string;
    status: string; maxPapers: number | null; invitedAt: string | null; respondedAt: string | null; declineReason: string | null;
  }>;
}

const isoDay = (ts: string | null) => (ts ? ts.slice(0, 10) : "");
const label = (ts: string | null) => (ts ? new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "");
const todayIso = () => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
};
/** "ISBM 2026-27" → "ISBM": the prefix of a conference's paper ids (ISBM-680), as the backend builds them. */
const paperPrefix = (acronym: string) => ((acronym.split(/\s+/)[0] || "PAPER").replace(/[^A-Za-z0-9]/g, "").toUpperCase() || "PAPER");

/** What an author has been told: only the notified decision counts, so an unsent one reads as "No Decision". */
function authorResult(status: string, notified: string | null): AuthorPaperResult {
  if (status === "draft") return "draft";
  switch (notified) {
    case "accept": return "not_registered";
    case "registered": return "registered";
    case "reject": return "not_accepted";
    case "revise": return "revise";
    case "waitlist": return "waitlist";
    default: return "no_result";
  }
}

async function loadDashboard(): Promise<DashboardData> {
  const d = await api<DashboardResponse>("/me/dashboard");
  const slugOf = Object.fromEntries(d.conferences.map((c) => [c.conferenceId, c.slug]));
  const acronymOf = Object.fromEntries(d.conferences.map((c) => [c.conferenceId, c.acronym]));
  const today = todayIso();

  const conferences: SourceConference[] = d.conferences.map((c, i) => {
    const roles: ConferenceRole[] = [];
    if (c.roles.includes("chair") || c.roles.includes("track_chair")) roles.push("chair");
    if (c.roles.includes("author")) roles.push("author");
    if (c.roles.includes("reviewer")) roles.push("reviewer");
    const endDate = isoDay(c.endDate) || "9999-12-31";
    // Active until its last day has passed, then Archived (or archived by the Super Admin).
    const status: ConferenceStatus = c.status === "archived" || endDate < today ? "archived" : "active";
    const conference: Conference = {
      id: c.slug, number: i + 1, acronym: c.acronym, name: c.title, status,
      startDate: isoDay(c.startDate) || endDate, endDate, city: c.city ?? "", country: c.country ?? "",
      ...(c.reviewDeadline ? { reviewDeadline: isoDay(c.reviewDeadline) } : {}),
      ...(c.submissionDeadline ? { submissionDeadline: isoDay(c.submissionDeadline) } : {}),
      ...(c.abstractDeadline ? { abstractDeadline: isoDay(c.abstractDeadline) } : {}),
      ...(c.logoPath ? { logoUrl: publicFileUrl(c.logoPath) } : {}),
    };
    return { conference, roles };
  }).filter((x) => x.roles.length);

  const authorPapers: AuthorPaper[] = d.authorPapers.map((p) => ({ conferenceId: slugOf[p.conferenceId] ?? "", result: authorResult(p.status, p.notifiedOutcome) }));
  const chairPapers: ChairPaper[] = d.chairPapers.filter((p) => p.status !== "draft").map((p) => ({
    conferenceId: slugOf[p.conferenceId] ?? "",
    decision: p.outcome === "accept" || p.outcome === "registered" ? "accepted" : p.outcome === "reject" ? "rejected" : "undecided",
    withdrawn: p.status === "withdrawn",
    registered: p.outcome === "registered",
  }));
  const reviewerAssignments: ReviewAssignment[] = d.reviewerAssignments.map((a) => ({
    conferenceId: slugOf[a.conferenceId] ?? "",
    paperLabel: `${paperPrefix(acronymOf[a.conferenceId] ?? "")}-${a.paperNo}`,
    reviewed: a.status === "submitted" || a.reviewed,
    declined: a.status === "declined",
    dueDate: a.dueAt ? isoDay(a.dueAt) : null,
  }));
  const invitations: ReviewInvitation[] = d.invitations.filter((m) => m.role === "reviewer").map((m) => ({
    id: m.memberId, conferenceId: m.slug, acronym: m.acronym, conferenceName: m.title, country: m.country ?? "",
    invitedBy: `Program Chair, ${m.acronym}`, invitedAt: label(m.invitedAt), maxPapers: m.maxPapers,
    status: m.status === "invited" ? "pending" : m.status === "active" ? "accepted" : "declined",
    respondedAt: label(m.respondedAt), declineReason: m.declineReason ?? "",
  }));

  // Certificates have no backend endpoint yet (see GAP-REPORT.md): none are shown as issued.
  return { source: { conferences, authorPapers, chairPapers, reviewerAssignments, certificates: [] }, invitations };
}

async function respondToInvitation(memberId: string, accept: boolean, reason?: string): Promise<void> {
  await api(`/invitations/${memberId}/${accept ? "accept" : "decline"}`, { method: "POST", body: accept ? {} : { reason: reason || null } });
}

export const apiConferenceService: ConferenceService = { loadDashboard, respondToInvitation };
