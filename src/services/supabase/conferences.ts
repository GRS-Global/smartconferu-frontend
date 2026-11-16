import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import type {
  AuthorPaper, AuthorPaperResult, ChairPaper, Conference, ConferenceRole, ConferenceStatus, ReviewAssignment,
  IssuedCertificate, ReviewInvitation, SourceConference,
} from "@/types/conference";
import type { ConferenceService, DashboardData } from "../conferences";
import { currentUser, fail, paperPrefix } from "./shared";

/* Reads the signed-in user's conferences straight from Supabase, exactly as the prototype does
   (src/data/workspace.js › loadWorkspace) but only the parts My Conferences needs. Nothing here
   widens access: Row Level Security (supabase/migrations) decides which rows come back — a chair
   gets their conference's papers, a reviewer only the papers assigned to them, an author their own.
   Row shapes below mirror 0001_core_schema.sql + 0002/0007 (columns used only). */

interface ConferenceRow {
  id: string;
  slug: string;
  acronym: string;
  logo_path?: string | null;
  title: string;
  city: string | null;
  country: string | null;
  start_date: string | null;
  end_date: string | null;
  review_deadline: string | null;
  status: "pending_approval" | "active" | "rejected" | "archived";
  created_at: string;
}
interface MemberRow {
  id: string;
  conference_id: string;
  role: "chair" | "track_chair" | "cfp_manager" | "reviewer";
  status: "invited" | "active" | "declined" | "removed";
  max_papers: number | null;
  invited_at: string | null;
  responded_at: string | null;
  decline_reason: string | null;
}
type Outcome = "upload_pending" | "no_decision" | "plagiarism_clear" | "revise" | "waitlist" | "accept" | "registered" | "reject";
interface SubmissionRow {
  id: string;
  conference_id: string;
  paper_no: number;
  status: "draft" | "submitted" | "withdrawn";
  outcome: Outcome;
  notified_outcome: Outcome | null;
}
interface AssignmentRow {
  id: string;
  submission_id: string;
  status: "assigned" | "accepted" | "declined" | "submitted" | "removed";
  due_at: string | null;
}
interface ReviewRow {
  submission_id: string;
  status: "draft" | "submitted";
}

const isoDay = (ts: string | null) => (ts ? ts.slice(0, 10) : "");
const label = (ts: string | null) => (ts ? new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "");
const todayIso = () => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
};
// An id list that is never empty, so `in.()` is always valid.
const inList = (ids: string[]) => (ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

async function rows<T>(query: PromiseLike<{ data: unknown; error: { message?: string } | null }>, what: string): Promise<T[]> {
  const { data, error } = await query;
  if (error) fail(error, what);
  return (data ?? []) as T[];
}

const currentUserId = async (db: SupabaseClient): Promise<string> => (await currentUser(db)).id;

/** What an author has been told. `notified_outcome` is the only source for author-facing results, so an
 *  unsent decision (outcome set, nothing notified) reads as "No Decision" and can never leak early. */
function authorResult(s: SubmissionRow): AuthorPaperResult {
  if (s.status === "draft") return "draft";
  switch (s.notified_outcome) {
    case "accept": return "not_registered";
    case "registered": return "registered";
    case "reject": return "not_accepted";
    case "revise": return "revise";
    case "waitlist": return "waitlist";
    default: return "no_result";
  }
}

/* Chair-facing figures read `outcome` (the chair's own decision, notified or not).
   Limitation: there is no registration table or record yet, so `registered` below is only the chair
   having marked the paper's outcome as "registered" — not a verified registration or payment. The
   dashboard therefore words it "Marked registered". */
function chairPaper(s: SubmissionRow, slugOf: (id: string) => string): ChairPaper {
  return {
    conferenceId: slugOf(s.conference_id),
    decision: s.outcome === "accept" || s.outcome === "registered" ? "accepted" : s.outcome === "reject" ? "rejected" : "undecided",
    withdrawn: s.status === "withdrawn",
    registered: s.outcome === "registered",
  };
}

async function loadDashboard(): Promise<DashboardData> {
  const db = getSupabase();
  const me = await currentUserId(db);
  // Links papers that list this account's email but aren't linked yet (a co-author added before they
  // registered). Existing RPC the prototype calls on load; skipped quietly if it isn't installed.
  await db.rpc("claim_my_papers").then(() => null, () => null);

  const [memberships, authorLinks, mySubmitted] = await Promise.all([
    rows<MemberRow>(db.from("conference_members").select("id, conference_id, role, status, max_papers, invited_at, responded_at, decline_reason").eq("user_id", me), "read your conferences"),
    rows<{ submission_id: string }>(db.from("submission_authors").select("submission_id").eq("user_id", me), "read your papers"),
    rows<{ id: string }>(db.from("submissions").select("id").eq("submitter_id", me), "read your papers"),
  ]);
  const authoredIds = [...new Set([...authorLinks.map((a) => a.submission_id), ...mySubmitted.map((s) => s.id)])];
  const authoredSubs = authoredIds.length
    ? await rows<SubmissionRow>(db.from("submissions").select("id, conference_id, paper_no, status, outcome, notified_outcome").in("id", authoredIds), "read your papers")
    : [];

  const confIds = [...new Set([
    ...memberships.filter((m) => m.status !== "removed").map((m) => m.conference_id),
    ...authoredSubs.map((s) => s.conference_id),
  ])];
  const confRows = await rows<ConferenceRow>(
    db.from("conferences")
      .select("id, slug, acronym, title, city, country, start_date, end_date, review_deadline, status, created_at, logo_path")
      .or(`created_by.eq.${me},id.in.(${inList(confIds).join(",")})`)
      // `id` breaks ties so conferences created at the same instant always get the same numbers.
      .order("created_at")
      .order("id"),
    "read your conferences",
  );

  const activeRole = (cid: string, roles: MemberRow["role"][]) => memberships.some((m) => m.conference_id === cid && m.status === "active" && roles.includes(m.role));
  const authoredConfIds = new Set(authoredSubs.map((s) => s.conference_id));
  const visible = confRows.filter((c) => c.status === "active" || c.status === "archived");
  const rolesOf = (c: ConferenceRow): ConferenceRole[] => {
    const roles: ConferenceRole[] = [];
    if (activeRole(c.id, ["chair", "track_chair"])) roles.push("chair");
    if (authoredConfIds.has(c.id)) roles.push("author");
    if (activeRole(c.id, ["reviewer"])) roles.push("reviewer");
    return roles;
  };

  const today = todayIso();
  const slugOfId: Record<string, string> = Object.fromEntries(confRows.map((c) => [c.id, c.slug]));
  const acronymOfId: Record<string, string> = Object.fromEntries(confRows.map((c) => [c.id, c.acronym]));
  const conferences: SourceConference[] = visible
    .map((c) => ({ c, roles: rolesOf(c) }))
    .filter((x) => x.roles.length)
    .map(({ c, roles }, i) => {
      const endDate = isoDay(c.end_date) || "9999-12-31";
      // Active until its last day has passed, then Archived (or archived by the Super Admin).
      const status: ConferenceStatus = c.status === "archived" || endDate < today ? "archived" : "active";
      const conference: Conference = {
        id: c.slug,
        number: i + 1,
        acronym: c.acronym,
        name: c.title,
        status,
        startDate: isoDay(c.start_date) || endDate,
        endDate,
        city: c.city ?? "",
        country: c.country ?? "",
        ...(c.review_deadline ? { reviewDeadline: isoDay(c.review_deadline) } : {}),
        ...(c.logo_path ? { logoUrl: db.storage.from("public").getPublicUrl(c.logo_path).data.publicUrl } : {}),
      };
      return { conference, roles };
    });

  const chairedIds = visible.filter((c) => activeRole(c.id, ["chair", "track_chair"])).map((c) => c.id);
  const chairSubs = chairedIds.length
    ? await rows<SubmissionRow>(db.from("submissions").select("id, conference_id, paper_no, status, outcome, notified_outcome").in("conference_id", chairedIds), "read the papers")
    : [];

  const [assignments, myReviews] = await Promise.all([
    rows<AssignmentRow>(db.from("review_assignments").select("id, submission_id, status, due_at").eq("reviewer_id", me), "read your reviews"),
    rows<ReviewRow>(db.from("reviews").select("submission_id, status").eq("reviewer_id", me), "read your reviews"),
  ]);
  const liveAssignments = assignments.filter((a) => a.status !== "removed");
  const assignedSubs = liveAssignments.length
    ? await rows<SubmissionRow>(db.from("submissions").select("id, conference_id, paper_no, status, outcome, notified_outcome").in("id", inList(liveAssignments.map((a) => a.submission_id))), "read your reviews")
    : [];
  const subById = Object.fromEntries(assignedSubs.map((s) => [s.id, s]));
  const reviewed = new Set(myReviews.filter((r) => r.status === "submitted").map((r) => r.submission_id));
  const reviewerAssignments: ReviewAssignment[] = liveAssignments.flatMap((a) => {
    const s = subById[a.submission_id];
    if (!s) return [];
    return [{
      conferenceId: slugOfId[s.conference_id] ?? "",
      paperLabel: `${paperPrefix(acronymOfId[s.conference_id] ?? "")}-${s.paper_no}`,
      reviewed: a.status === "submitted" || reviewed.has(a.submission_id),
      declined: a.status === "declined",
      dueDate: a.due_at ? isoDay(a.due_at) : null,
    }];
  });

  const authorPapers: AuthorPaper[] = authoredSubs.map((s) => ({ conferenceId: slugOfId[s.conference_id] ?? "", result: authorResult(s) }));
  const chairPapers: ChairPaper[] = chairSubs
    .filter((s) => s.status !== "draft")
    .map((s) => chairPaper(s, (id) => slugOfId[id] ?? ""));

  const invitations: ReviewInvitation[] = memberships
    .filter((m) => m.role === "reviewer" && slugOfId[m.conference_id])
    .map((m) => ({
      id: m.id,
      conferenceId: slugOfId[m.conference_id],
      acronym: acronymOfId[m.conference_id],
      conferenceName: confRows.find((c) => c.id === m.conference_id)?.title ?? "",
      country: confRows.find((c) => c.id === m.conference_id)?.country ?? "",
      invitedBy: `Program Chair, ${acronymOfId[m.conference_id]}`,
      invitedAt: label(m.invited_at),
      maxPapers: m.max_papers,
      status: m.status === "invited" ? "pending" : m.status === "active" ? "accepted" : "declined",
      respondedAt: label(m.responded_at),
      declineReason: m.decline_reason ?? "",
    }));

  return {
    source: {
      conferences,
      authorPapers,
      chairPapers,
      reviewerAssignments,
      // The certificates issued to this person (my_certificates, migration 0047): each one makes its conference's "certificate ready" mark real.
      certificates: await myCertificates(db),
    },
    invitations,
  };
}

/** The conference and type of every certificate issued to the signed-in person. Empty (never an error) until migration 0047 is run: the dashboard must not depend on it. */
async function myCertificates(db: SupabaseClient): Promise<IssuedCertificate[]> {
  try {
    const { data, error } = await db.rpc("my_certificates");
    if (error || !Array.isArray(data)) return [];
    return (data as Array<{ typeKey: IssuedCertificate["type"]; conference: { id: string } }>).map((c) => ({ conferenceId: c.conference.id, type: c.typeKey }));
  } catch {
    return [];
  }
}

async function respondToInvitation(memberId: string, accept: boolean, reason?: string): Promise<void> {
  const db = getSupabase();
  await currentUserId(db);
  const { error } = await db.rpc("respond_to_invitation", { p_member: memberId, p_accept: accept, p_reason: reason || null });
  if (error) fail(error, "answer this invitation");
}

export const supabaseConferenceService: ConferenceService = { loadDashboard, respondToInvitation };
