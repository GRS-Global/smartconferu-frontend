import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import { PEER_REVIEW_FORM, PROTECTED_FIELD_IDS, sectionsFromStored } from "@/features/reviewer/form-schema";
import { extrasFromStored } from "@/types/author-submission";
import { DEFAULT_CRITERIA, DEFAULT_PRESENTATION_TYPES, DEFAULT_REVIEW_LIMITS, DEFAULT_REVIEW_TIMELINE, DEFAULT_REVIEW_POLICY, DEFAULT_SUBMISSION_POLICY, type ScreeningCriteria } from "@/types/chair";
import type { ReviewValues } from "@/types/reviewer";
import type { DeletionRequest, LicenseRequest, ChairActivityLog, ChairAuthor, ChairConference, ChairPaper, ChairEmailLog, ChairPaperDetail, ReviewSetup, ConferenceSettings, ConferenceTrack, ReviewMode, ReviewTimeline, SubmissionPolicy, ReviewPolicy, ConferenceTemplate, EmailTemplates, ChairReviewer, DecisionType, DeclinedReviewer, InviteResult, ScreeningFile, Outcome, PoolReviewer, ReviewBoard, ReviewerPool, ScreeningRecord } from "@/types/chair";
import type { ChairService } from "../chair";
import { ServiceError } from "../errors";
import { readInstructions } from "./instructions";
import { currentUser, fail, paperPrefix } from "./shared";
import { isValidEmail } from "@/lib/email";

/* A conference's papers as its chair sees them, read as the prototype does (src/data/workspace.js › loadWorkspace, chair view) with the
   anon key and the user's session. Row Level Security returns a conference's papers, authors, files, assignments and reviews to its
   chairs only; the chair is not blind to authors. */

interface SubRow {
  id: string; conference_id: string; paper_no: number; title: string; keywords: string[] | null; status: "draft" | "submitted" | "withdrawn"; outcome: Outcome | null;
  notified_outcome: Outcome | null; decision_type_id: string | null; submitted_at: string | null; updated_at: string | null;
  withdrawn_at: string | null; withdrawn_by: string | null; details: { track?: string; presentationType?: string } | null; screening: Record<string, ScreeningRecord> | null;
}
const label = (ts: string | null) => (ts ? new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "");
const inList = (ids: string[]) => (ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

async function rows<T>(query: PromiseLike<{ data: unknown; error: { message?: string } | null }>, what: string): Promise<T[]> {
  const { data, error } = await query;
  if (error) fail(error, what);
  return (data ?? []) as T[];
}

const RECOMMENDATION: Record<string, string> = { accept: "accept", "re-review": "revise", revise: "revise", revision: "revise", reject: "reject" };
/** The review form's answers as the database's columns (the prototype's reviewFields); the whole form is kept in `answers`. */
function reviewFields(values: ReviewValues) {
  const score = Number(values["f-score"]);
  const confidence = String(values["f-confidence"] ?? "").toLowerCase();
  return {
    p_score: score >= 1 && score <= 5 ? Math.round(score) : null,
    p_confidence: ["low", "medium", "high"].includes(confidence) ? confidence : null,
    p_recommendation: RECOMMENDATION[String(values["f-decision"] ?? "").toLowerCase()] ?? null,
    p_to_author: (values["f-to-author"] as string) || null,
    p_to_chair: (values["f-to-chair"] as string) || null,
    p_answers: values,
  };
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const isoDay = (ts: string | null) => (ts ? ts.slice(0, 10) : "");
const shiftDay = (iso: string, days: number) => { const [y, m, d] = iso.split("-").map(Number); const t = new Date(Date.UTC(y, m - 1, d + days)); return t.toISOString().slice(0, 10); };
/** When reviews are due, as the prototype works it out (reviewDueISO without an assignment): the end of the review period the chair set, else the review
 *  deadline in Conference info, else four weeks after submissions close (or, with no submission deadline, 75 days before the conference starts, plus 28). */
const reviewDeadlineOf = (c: { review_deadline: string | null; settings: { reviewTimeline?: { closesAt?: string } } | null; submission_deadline: string | null; start_date: string | null } | undefined): string => {
  if (!c) return "";
  const closes = c.settings?.reviewTimeline?.closesAt;
  if (closes) return closes.slice(0, 10);
  if (c.review_deadline) return isoDay(c.review_deadline);
  const close = c.submission_deadline ? isoDay(c.submission_deadline) : c.start_date ? shiftDay(isoDay(c.start_date), -75) : "";
  return close ? shiftDay(close, 28) : "";
};
const REVIEW_DEADLINE_COLS = "review_deadline, settings, submission_deadline, start_date";
type ReviewDeadlineRow = { review_deadline: string | null; settings: { reviewTimeline?: { closesAt?: string } } | null; submission_deadline: string | null; start_date: string | null };
const fullName = (p?: { first_name: string | null; last_name: string | null }) => [p?.first_name, p?.last_name].filter(Boolean).join(" ");

/** Writes one key of `conferences.settings`, leaving the other keys as they are (the prototype's saveConferenceSetting). */
async function mergeSetting(conferenceSlug: string, key: string, value: unknown, what: string): Promise<void> {
  const db: SupabaseClient = getSupabase();
  await currentUser(db);
  const { data, error } = await db.from("conferences").select("id, settings").eq("slug", conferenceSlug).limit(1);
  if (error) fail(error, what);
  const conf = (data ?? [])[0] as { id: string; settings: Record<string, unknown> | null } | undefined;
  if (!conf) throw new ServiceError("We couldn't find that conference.");
  const { error: upError } = await db.from("conferences").update({ settings: { ...(conf.settings ?? {}), [key]: value } }).eq("id", conf.id);
  if (upError) fail(upError, what);
}

/** Writes some columns of the conference's `conference_settings` row (made on the first save). */
async function upsertSettings(conferenceSlug: string, cols: Record<string, unknown>, migration = "0028_conference_settings.sql"): Promise<void> {
  const db: SupabaseClient = getSupabase();
  await currentUser(db);
  const conf = await rows<{ id: string }>(db.from("conferences").select("id").eq("slug", conferenceSlug).limit(1), "read this conference");
  if (!conf[0]) throw new ServiceError("We couldn't find that conference.");
  const { error } = await db.from("conference_settings").upsert({ conference_id: conf[0].id, ...cols }, { onConflict: "conference_id" });
  if (error) {
    if (/does not exist|schema cache/i.test(error.message ?? "")) throw new ServiceError(`Run supabase/migrations/${migration} to save this setting.`);
    fail(error, "change the conference settings");
  }
}

/** The conference's review form and instructions; the standard ones until the chair changes them, or while migration 0028 is not run. */
async function reviewSetupOf(db: SupabaseClient, conferenceId: string): Promise<ReviewSetup> {
  const [formRow, ins] = await Promise.all([
    db.from("conference_forms").select("schema").eq("conference_id", conferenceId).eq("kind", "peer_review").maybeSingle(),
    readInstructions(db, conferenceId),
  ]);
  const custom = formRow.error ? null : sectionsFromStored((formRow.data as { schema: unknown } | null)?.schema);
  return { form: custom ?? PEER_REVIEW_FORM, custom: custom !== null, instructions: ins.text, instructionsMode: ins.mode, instructionsPdf: ins.pdf };
}

/** The conference's decision types; the "Author sees" text (migration 0039) is read when its column exists. */
async function decisionTypeRows(db: SupabaseClient, conferenceId: string): Promise<Array<{ id: string; label: string; color: string; outcome: Outcome; description: string | null; author_label: string | null }>> {
  const full = await db.from("decision_types").select("id, label, color, outcome, description, author_label").eq("conference_id", conferenceId).order("position");
  if (!full.error) return (full.data ?? []) as Array<{ id: string; label: string; color: string; outcome: Outcome; description: string | null; author_label: string | null }>;
  const old = await rows<{ id: string; label: string; color: string; outcome: Outcome; description: string | null }>(db.from("decision_types").select("id, label, color, outcome, description").eq("conference_id", conferenceId).order("position"), "read the decision types");
  return old.map((t) => ({ ...t, author_label: null }));
}

/** Calls a conference function of the database ("archive_conference" …) for the conference with this slug. */
async function confRpc(slug: string, fn: string, args: Record<string, unknown>, doing: string): Promise<void> {
  const db: SupabaseClient = getSupabase();
  await currentUser(db);
  const conf = await rows<{ id: string }>(db.from("conferences").select("id").eq("slug", slug).limit(1), "read this conference");
  if (!conf[0]) throw new ServiceError("We couldn't find that conference.");
  const { error } = await db.rpc(fn, { p_conference: conf[0].id, ...args });
  if (error) fail(error, doing);
}

export const supabaseChairService: ChairService = {
  async loadPaper(paperLabel) {
    const m = /^([A-Za-z0-9]{1,40})-(\d{1,9})$/.exec(paperLabel);
    if (!m) return null;
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    // The label is the conference's prefix plus the paper number; two conferences can share a number, so the prefix decides.
    const cands = await rows<{ conference_id: string }>(db.from("submissions").select("conference_id").eq("paper_no", Number(m[2])).neq("status", "draft"), "read the paper");
    const confs = cands.length ? await rows<{ id: string; slug: string; acronym: string }>(db.from("conferences").select("id, slug, acronym").in("id", inList(cands.map((c) => c.conference_id))), "read this conference") : [];
    const chosen = confs.find((c) => paperPrefix(c.acronym) === m[1].toUpperCase());
    if (!chosen) return null;
    const conferenceSlug = chosen.slug;
    const data = await this.loadConference(conferenceSlug);
    const found = data.papers.find((p) => p.id === `${paperPrefix(chosen.acronym)}-${Number(m[2])}`);
    if (!found) return null;
    const me = (await currentUser(db)).id;
    const [sub, files, assignments, reviews, conf] = await Promise.all([
      rows<{ abstract: string | null; keywords: string[] | null; notified_note: string | null; notified_at: string | null; details: { fixRequest?: { issue?: string; fixBy?: string; at?: string } } | null }>(db.from("submissions").select("abstract, keywords, notified_note, notified_at, details").eq("id", found.dbId).limit(1), "read the paper"),
      rows<{ kind: string | null; file_name: string; uploaded_at: string | null; storage_path: string | null }>(db.from("submission_files").select("kind, file_name, uploaded_at, storage_path").eq("submission_id", found.dbId).order("uploaded_at"), "read the files"),
      rows<{ id: string; reviewer_id: string; status: string; due_at: string | null; assigned_at: string | null; decline_reason: string | null; responded_at: string | null }>(db.from("review_assignments").select("id, reviewer_id, status, due_at, assigned_at, decline_reason, responded_at").eq("submission_id", found.dbId), "read the assignments"),
      rows<{ id: string; assignment_id: string; status: string; score: number | null; confidence: string | null; comments_to_author: string | null; comments_to_chair: string | null; shared_with_author: boolean | null; submitted_at: string | null; answers: Record<string, unknown> | null }>(
        db.from("reviews").select("id, assignment_id, status, score, confidence, comments_to_author, comments_to_chair, shared_with_author, submitted_at, answers").eq("submission_id", found.dbId), "read the reviews"),
      rows<ReviewDeadlineRow>(db.from("conferences").select(REVIEW_DEADLINE_COLS).eq("slug", conferenceSlug).limit(1), "read this conference"),
    ]);
    const people = [...new Set(assignments.map((a) => a.reviewer_id))];
    const profiles = people.length ? await rows<{ id: string; email: string | null; first_name: string | null; last_name: string | null }>(db.from("profiles").select("id, email, first_name, last_name").in("id", people), "read the reviewers") : [];
    const fallbackDue = reviewDeadlineOf(conf[0]);
    const nameOf = (id: string) => fullName(profiles.find((p) => p.id === id)) || profiles.find((p) => p.id === id)?.email || "Reviewer";
    // Open "Ask for more time" requests (migration 0043). Until it is run the table is missing: none show, nothing fails.
    const asks = assignments.length
      ? await db.from("review_extension_requests").select("id, assignment_id, requested_date, reason, created_at").eq("status", "pending").in("assignment_id", assignments.map((a) => a.id))
        .then(({ data, error }) => (error ? [] : ((data ?? []) as Array<{ id: string; assignment_id: string; requested_date: string; reason: string | null; created_at: string }>)))
      : [];
    const reviewers: ChairReviewer[] = assignments.filter((a) => a.status !== "declined" && a.status !== "removed").map((a) => {
      const r = reviews.find((x) => x.assignment_id === a.id && x.status === "submitted");
      const ask = asks.find((x) => x.assignment_id === a.id);
      return {
        extension: ask ? { id: ask.id, date: ask.requested_date, reason: ask.reason ?? "", at: label(ask.created_at) } : null,
        assignmentId: a.id, reviewerId: a.reviewer_id, name: nameOf(a.reviewer_id), email: profiles.find((p) => p.id === a.reviewer_id)?.email ?? "",
        response: a.status === "assigned" ? "pending" : "accepted", assignedAt: label(a.assigned_at), due: isoDay(a.due_at) || fallbackDue, byChair: a.reviewer_id === me, awaitingInvite: false,
        review: r ? { id: r.id, score: r.score, confidence: r.confidence ? r.confidence[0].toUpperCase() + r.confidence.slice(1) : "", commentsToAuthor: r.comments_to_author ?? "", commentsToChair: r.comments_to_chair ?? "", shared: Boolean(r.shared_with_author), submittedAt: label(r.submitted_at), answers: r.answers ?? {} } : null,
      };
    });
    const toFile = (f: (typeof files)[number]) => ({ name: f.file_name, uploadedAt: label(f.uploaded_at), storagePath: f.storage_path });
    return {
      paper: found, data, form: (await reviewSetupOf(db, chosen.id)).form, abstract: sub[0]?.abstract ?? "", keywords: sub[0]?.keywords ?? [],
      files: files.filter((f) => f.kind !== "supplementary").map(toFile), supporting: files.filter((f) => f.kind === "supplementary").map(toFile),
      reviewers,
      declined: assignments.filter((a) => a.status === "declined").map((a) => ({ name: nameOf(a.reviewer_id), reason: a.decline_reason || "No reason given", at: label(a.responded_at) })),
      fixRequest: sub[0]?.details?.fixRequest?.issue ? { issue: sub[0].details.fixRequest.issue, fixBy: sub[0].details.fixRequest.fixBy ?? "", at: label(sub[0].details.fixRequest.at ?? null) } : null,
      decisionNote: sub[0]?.notified_note ?? "", notifiedAt: label(sub[0]?.notified_at ?? null),
    } satisfies ChairPaperDetail;
  },

  async recordDecision(paperDbId, decisionTypeId, note) {
    if (!UUID.test(paperDbId) || !UUID.test(decisionTypeId)) throw new ServiceError("Couldn't record this decision.");
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    const { error } = await db.rpc("record_decision", { p_submission: paperDbId, p_decision_type: decisionTypeId, p_note: (note ?? "").trim().slice(0, 5000) || null });
    if (error) fail(error, "record decisions");
  },

  async setSubmissionTrack(paperDbIds, track) {
    const ids = paperDbIds.filter((id) => UUID.test(id));
    if (!ids.length) return 0;
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    const { data, error } = await db.rpc("set_submission_track", { p_ids: ids, p_track: track });
    if (error) {
      if (/does not exist|schema cache/i.test(error.message)) throw new ServiceError("Run supabase/migrations/0030_chair_delete_submissions.sql so tracks can be changed.");
      fail(error, "change tracks");
    }
    return typeof data === "number" ? data : ids.length;
  },

  async deleteSubmissions(paperDbIds) {
    const ids = paperDbIds.filter((id) => UUID.test(id));
    if (!ids.length) return 0;
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    const { data, error } = await db.rpc("delete_submissions", { p_ids: ids });
    if (error) {
      if (/does not exist|schema cache/i.test(error.message)) throw new ServiceError("Run supabase/migrations/0030_chair_delete_submissions.sql so submissions can be deleted.");
      fail(error, "delete submissions");
    }
    return typeof data === "number" ? data : ids.length;
  },

  async notifyDecision(paperDbId, note) {
    if (!UUID.test(paperDbId)) throw new ServiceError("Couldn't notify the authors.");
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    const { error } = await db.rpc("notify_decision", { p_submission: paperDbId, p_note: (note ?? "").trim().slice(0, 5000) || null });
    if (error) fail(error, "notify authors");
  },

  async setReviewDue(assignmentId, dateISO) {
    if (!UUID.test(assignmentId) || !/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) throw new ServiceError("Couldn't change this deadline.");
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    const { error } = await db.rpc("set_review_due", { p_assignment: assignmentId, p_date: dateISO });
    if (error) {
      if (/does not exist|schema cache|Could not find the function/i.test(error.message)) throw new ServiceError("This isn't switched on yet — the owner needs to run migration 0044.");
      if (/P0002|not found/i.test(error.message)) throw new ServiceError("We couldn't find that any more — reload the page.");
      if (!/row-level security|permission denied|jwt/i.test(error.message) && !/42501/.test(error.message)) throw new ServiceError(error.message);
      fail(error, "change deadlines");
    }
  },

  async removeReviewerFromPaper(paperDbId, reviewerUserId) {
    if (!UUID.test(paperDbId) || !UUID.test(reviewerUserId)) throw new ServiceError("Couldn't remove this reviewer.");
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    // A chair may delete the assignments of their own conference (Row Level Security); a sent review goes with the assignment.
    const { error } = await db.from("review_assignments").delete().eq("reviewer_id", reviewerUserId).eq("submission_id", paperDbId);
    if (error) fail(error, "remove reviewers");
  },

  async saveRegistration() {
    throw new ServiceError("Payment and attendance can only be recorded with the own backend.");
  },
  async requestFix(paperDbId, issue, fixByISO) {
    if (!UUID.test(paperDbId) || !/^\d{4}-\d{2}-\d{2}$/.test(fixByISO) || !issue.trim()) throw new ServiceError("Say what needs fixing and by when.");
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    const { error } = await db.rpc("request_paper_fix", { p_submission: paperDbId, p_issue: issue.trim().slice(0, 2000), p_fix_by: fixByISO });
    if (error) {
      if (/does not exist|schema cache|Could not find the function/i.test(error.message)) throw new ServiceError("This isn't switched on yet — the owner needs to run migration 0044.");
      if (/P0002|not found/i.test(error.message)) throw new ServiceError("We couldn't find that any more — reload the page.");
      if (!/row-level security|permission denied|jwt/i.test(error.message) && !/42501/.test(error.message)) throw new ServiceError(error.message);
      fail(error, "ask authors to fix a paper");
    }
  },

  async setReviewShared(reviewId, shared) {
    if (!UUID.test(reviewId)) throw new ServiceError("Couldn't change this review.");
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    const { error } = await db.rpc("set_review_shared", { p_review: reviewId, p_shared: shared });
    if (error) fail(error, "share reviews");
  },

  async decideExtension(requestId, approve) {
    if (!UUID.test(requestId)) throw new ServiceError("Couldn't answer this request.");
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    // decide_review_extension (migration 0043): a chair of the conference only; approving moves the reviewer's deadline, and they are told.
    const { error } = await db.rpc("decide_review_extension", { p_request: requestId, p_approve: approve });
    if (error) {
      if (/P0002|Request not found/i.test(error.message)) throw new ServiceError("This request was already answered or taken back.");
      fail(error, "answer this request");
    }
  },

  async loadReviewBoard(conferenceSlug): Promise<ReviewBoard> {
    const db: SupabaseClient = getSupabase();
    const me = (await currentUser(db)).id;
    const conf = await rows<ReviewDeadlineRow & { id: string }>(db.from("conferences").select(`id, ${REVIEW_DEADLINE_COLS}`).eq("slug", conferenceSlug).limit(1), "read this conference");
    const board: ReviewBoard = { target: 2, deadline: reviewDeadlineOf(conf[0]), papers: {} };
    if (!conf[0]) return board;
    // The reviewers-per-paper target is the chair’s setting (migration 0028); without it the prototype’s default of 2 stays.
    const limits = await db.from("conference_settings").select("reviewers_per_paper").eq("conference_id", conf[0].id).maybeSingle();
    if (!limits.error && limits.data) board.target = (limits.data as { reviewers_per_paper: number }).reviewers_per_paper;
    const subs = await rows<{ id: string }>(db.from("submissions").select("id").eq("conference_id", conf[0].id).neq("status", "draft"), "read the papers");
    const ids = inList(subs.map((s) => s.id));
    const [assignments, reviews, waiting] = await Promise.all([
      rows<{ id: string; submission_id: string; reviewer_id: string; status: string; due_at: string | null; assigned_at: string | null; decline_reason: string | null; responded_at: string | null }>(db.from("review_assignments").select("id, submission_id, reviewer_id, status, due_at, assigned_at, decline_reason, responded_at").in("submission_id", ids), "read the assignments"),
      rows<{ id: string; assignment_id: string; status: string; score: number | null; confidence: string | null; comments_to_author: string | null; comments_to_chair: string | null; shared_with_author: boolean | null; submitted_at: string | null; answers: Record<string, unknown> | null }>(
        db.from("reviews").select("id, assignment_id, status, score, confidence, comments_to_author, comments_to_chair, shared_with_author, submitted_at, answers").in("submission_id", ids), "read the reviews"),
      // Papers waiting for a new reviewer to join the committee. Empty until 0019_pending_review_assignments.sql is run.
      db.from("pending_review_assignments").select("submission_id, member_id, due_at, created_at").in("submission_id", ids).then(({ data, error }) => (error ? [] : ((data ?? []) as Array<{ submission_id: string; member_id: string; due_at: string | null; created_at: string | null }>))),
    ]);
    const people = [...new Set(assignments.map((a) => a.reviewer_id))];
    const memberIds = [...new Set(waiting.map((w) => w.member_id))];
    const [profiles, members] = await Promise.all([
      people.length ? rows<{ id: string; email: string | null; first_name: string | null; last_name: string | null }>(db.from("profiles").select("id, email, first_name, last_name").in("id", people), "read the reviewers") : Promise.resolve([]),
      memberIds.length ? rows<{ id: string; invited_email: string | null; display_name: string | null }>(db.from("conference_members").select("id, invited_email, display_name").in("id", memberIds), "read the reviewers") : Promise.resolve([]),
    ]);
    const nameOf = (id: string) => fullName(profiles.find((p) => p.id === id)) || profiles.find((p) => p.id === id)?.email || "Reviewer";
    // Open "Ask for more time" requests (migration 0043). Until it is run the table is missing: none show, nothing fails.
    const asks = assignments.length
      ? await db.from("review_extension_requests").select("id, assignment_id, requested_date, reason, created_at").eq("status", "pending").in("assignment_id", assignments.map((a) => a.id))
        .then(({ data, error }) => (error ? [] : ((data ?? []) as Array<{ id: string; assignment_id: string; requested_date: string; reason: string | null; created_at: string }>)))
      : [];
    for (const s of subs) {
      const mine = assignments.filter((a) => a.submission_id === s.id);
      const reviewers: ChairReviewer[] = mine.filter((a) => a.status !== "declined" && a.status !== "removed").map((a) => {
        const r = reviews.find((x) => x.assignment_id === a.id && x.status === "submitted");
        const ask = asks.find((x) => x.assignment_id === a.id);
        return {
          extension: ask ? { id: ask.id, date: ask.requested_date, reason: ask.reason ?? "", at: label(ask.created_at) } : null,
          assignmentId: a.id, reviewerId: a.reviewer_id, name: nameOf(a.reviewer_id), email: profiles.find((p) => p.id === a.reviewer_id)?.email ?? "",
          response: a.status === "assigned" ? "pending" : "accepted", assignedAt: label(a.assigned_at), due: isoDay(a.due_at) || board.deadline, byChair: a.reviewer_id === me, awaitingInvite: false,
          review: r ? { id: r.id, score: r.score, confidence: r.confidence ? r.confidence[0].toUpperCase() + r.confidence.slice(1) : "", commentsToAuthor: r.comments_to_author ?? "", commentsToChair: r.comments_to_chair ?? "", shared: Boolean(r.shared_with_author), submittedAt: label(r.submitted_at), answers: r.answers ?? {} } : null,
        };
      });
      for (const w of waiting.filter((x) => x.submission_id === s.id)) {
        const m = members.find((x) => x.id === w.member_id);
        const email = m?.invited_email ?? "";
        reviewers.push({ assignmentId: `pending-${w.member_id}`, reviewerId: w.member_id, name: m?.display_name || email || "New reviewer", email, response: "pending", assignedAt: label(w.created_at), due: isoDay(w.due_at) || board.deadline, byChair: false, awaitingInvite: true, review: null });
      }
      const declined: DeclinedReviewer[] = mine.filter((a) => a.status === "declined").map((a) => ({ name: nameOf(a.reviewer_id), reason: a.decline_reason || "", at: label(a.responded_at) }));
      board.papers[s.id] = { reviewers, declined };
    }
    return board;
  },

  async loadReviewerPool(conferenceSlug): Promise<ReviewerPool> {
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    const conf = await rows<{ id: string }>(db.from("conferences").select("id").eq("slug", conferenceSlug).limit(1), "read this conference");
    if (!conf[0]) return { reviewers: [], tracks: [] };
    const [members, tracks] = await Promise.all([
      rows<{ id: string; user_id: string | null; invited_email: string | null; display_name: string | null; status: string; expertise: string[] | null; invited_at: string | null }>(
        db.from("conference_members").select("id, user_id, invited_email, display_name, status, expertise, invited_at").eq("conference_id", conf[0].id).eq("role", "reviewer"), "read the reviewers"),
      rows<{ name: string }>(db.from("tracks").select("name").eq("conference_id", conf[0].id), "read the tracks"),
    ]);
    const ids = members.flatMap((m) => (m.user_id ? [m.user_id] : []));
    const profiles = ids.length ? await rows<{ id: string; email: string | null; first_name: string | null; last_name: string | null }>(db.from("profiles").select("id, email, first_name, last_name").in("id", ids), "read the reviewers") : [];
    const reviewers: PoolReviewer[] = members.filter((m) => m.status !== "removed").map((m) => {
      const p = profiles.find((x) => x.id === m.user_id);
      const email = p?.email || m.invited_email || "";
      return { memberId: m.id, userId: m.user_id, name: fullName(p) || m.display_name || email || "Reviewer", email, tracks: m.expertise ?? [], status: m.status === "active" ? "active" : m.status === "declined" ? "declined" : "invited", invitedAt: label(m.invited_at) };
    });
    return { reviewers, tracks: tracks.map((t) => t.name) };
  },

  async inviteReviewer(conferenceSlug, person): Promise<InviteResult> {
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    const email = person.email.trim().toLowerCase();
    if (!isValidEmail(email) || !person.name.trim()) throw new ServiceError("Enter the reviewer's name and a valid email address.");
    const conf = await rows<{ id: string }>(db.from("conferences").select("id").eq("slug", conferenceSlug).limit(1), "read this conference");
    if (!conf[0]) throw new ServiceError("That conference doesn't exist.");
    const existing = await rows<{ id: string; status: string; user_id: string | null }>(db.from("conference_members").select("id, status, user_id").eq("conference_id", conf[0].id).eq("role", "reviewer").eq("invited_email", email).limit(1), "invite reviewers");
    if (existing[0] && existing[0].status !== "removed" && existing[0].status !== "declined") return { memberId: existing[0].id, userId: existing[0].user_id, created: false };
    if (existing[0]) { const { error } = await db.from("conference_members").delete().eq("id", existing[0].id); if (error) fail(error, "invite reviewers"); }
    const { data, error } = await db.from("conference_members").insert({ conference_id: conf[0].id, invited_email: email, role: "reviewer", display_name: person.name.trim(), expertise: person.tracks }).select("id, user_id").single();
    if (error) fail(error, "invite reviewers");
    const row = data as { id: string; user_id: string | null };
    return { memberId: row.id, userId: row.user_id, created: true };
  },

  async setReviewerTracks(_slug, memberId, tracks) {
    if (!UUID.test(memberId)) throw new ServiceError("Couldn't edit this reviewer.");
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    const { error } = await db.from("conference_members").update({ expertise: tracks }).eq("id", memberId);
    if (error) fail(error, "edit reviewers");
  },
  async renameReviewer(_slug, memberId, name) {
    if (!UUID.test(memberId)) throw new ServiceError("Couldn't edit this reviewer.");
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    const { error } = await db.from("conference_members").update({ display_name: name.trim() || null }).eq("id", memberId);
    if (error) fail(error, "edit reviewers");
  },

  async removeReviewer(_slug, reviewer, paperDbIds) {
    if (!UUID.test(reviewer.memberId)) throw new ServiceError("Couldn't remove this reviewer.");
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    if (reviewer.userId && paperDbIds.length) {
      const { error } = await db.from("review_assignments").delete().eq("reviewer_id", reviewer.userId).in("submission_id", paperDbIds);
      if (error) fail(error, "remove reviewers");
    }
    const { error } = await db.from("conference_members").delete().eq("id", reviewer.memberId);
    if (error) fail(error, "remove reviewers");
  },

  async assignPapers(reviewer, paperDbIds, dueISO) {
    const ids = paperDbIds.filter((id) => UUID.test(id));
    if (!ids.length || !UUID.test(reviewer.memberId)) return [];
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    const due = dueISO && /^\d{4}-\d{2}-\d{2}$/.test(dueISO) ? { due_at: `${dueISO}T23:59:59Z` } : {};
    if (reviewer.userId) {
      const { error } = await db.from("review_assignments").upsert(ids.map((id) => ({ submission_id: id, reviewer_id: reviewer.userId, ...due })), { onConflict: "submission_id,reviewer_id", ignoreDuplicates: true });
      if (error) {
        if (/row-level security/i.test(error.message)) throw new ServiceError("A reviewer can only be given papers once they're on the committee (invited or accepted).");
        fail(error, "assign reviewers");
      }
      // Someone who declined this paper before (or was taken off it) gets it again.
      const { error: again } = await db.from("review_assignments").update({ status: "assigned", ...due }).eq("reviewer_id", reviewer.userId).in("submission_id", ids).in("status", ["declined", "removed"]);
      if (again) fail(again, "assign reviewers");
    } else {
      const { error } = await db.from("pending_review_assignments").upsert(ids.map((id) => ({ submission_id: id, member_id: reviewer.memberId, ...due })), { onConflict: "submission_id,member_id", ignoreDuplicates: true });
      if (error) {
        if (/does not exist|schema cache/i.test(error.message)) throw new ServiceError("Run supabase/migrations/0019_pending_review_assignments.sql so a paper can wait for a reviewer who hasn't joined yet.");
        fail(error, "assign reviewers");
      }
    }
    return ids;
  },

  async loadScreeningFiles(conferenceSlug) {
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    const conf = await rows<{ id: string }>(db.from("conferences").select("id").eq("slug", conferenceSlug).limit(1), "read this conference");
    if (!conf[0]) return {};
    const subs = await rows<{ id: string }>(db.from("submissions").select("id").eq("conference_id", conf[0].id).neq("status", "draft"), "read the papers");
    const files = await rows<{ submission_id: string; kind: string | null; file_name: string; uploaded_at: string | null; storage_path: string | null; auto_check: ScreeningFile["auto"] }>(
      db.from("submission_files").select("submission_id, kind, file_name, uploaded_at, storage_path, auto_check").in("submission_id", inList(subs.map((s) => s.id))).order("uploaded_at"), "read the files");
    const out: Record<string, ScreeningFile[]> = {};
    for (const s of subs) {
      out[s.id] = files.filter((f) => f.submission_id === s.id && f.kind !== "supplementary").map((f, i) => ({ n: i + 1, name: f.file_name, uploadedAt: label(f.uploaded_at), auto: f.auto_check ?? null, storagePath: f.storage_path }));
    }
    return out;
  },

  async editReview(reviewId, values) {
    if (!UUID.test(reviewId)) throw new ServiceError("Couldn't edit this review.");
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    const { error } = await db.rpc("chair_edit_review", { p_review: reviewId, ...reviewFields(values) });
    if (error) fail(error, "edit this review");
  },

  async submitOwnReview(paperDbId, values) {
    if (!UUID.test(paperDbId)) throw new ServiceError("Couldn't save this review.");
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    const { data, error } = await db.rpc("chair_submit_review", { p_submission: paperDbId, ...reviewFields(values) });
    if (error) fail(error, "review this paper");
    return String(data ?? "");
  },

  async loadInfo(conferenceSlug) {
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    const c = await rows<{ title: string; acronym: string; about: string | null; web_page: string | null; contact_email: string | null; primary_area: string | null; secondary_area: string | null; start_date: string | null; end_date: string | null; mode: string | null; venue: string | null; city: string | null; state: string | null; country: string | null; submission_deadline: string | null; review_deadline: string | null; status: string; details: Record<string, unknown> | null; logo_path: string | null; created_at: string }>(
      db.from("conferences").select("title, acronym, about, web_page, contact_email, primary_area, secondary_area, start_date, end_date, mode, venue, city, state, country, submission_deadline, review_deadline, status, details, logo_path, created_at").eq("slug", conferenceSlug).limit(1), "read this conference");
    if (!c[0]) return null;
    const x = c[0];
    return {
      name: x.title, acronym: x.acronym, about: x.about ?? "", webPage: x.web_page ?? "", contactEmail: x.contact_email ?? "", primaryArea: x.primary_area ?? "", secondaryArea: x.secondary_area ?? "",
      startDate: x.start_date ?? "", endDate: x.end_date ?? "", mode: x.mode === "in_person" || x.mode === "virtual" || x.mode === "hybrid" ? x.mode : "", venue: x.venue ?? "", city: x.city ?? "", state: x.state ?? "", country: x.country ?? "",
      submissionDeadline: isoDay(x.submission_deadline), reviewDeadline: isoDay(x.review_deadline), status: x.status,
      timezone: str(x.details?.timezone), abstractDeadline: str(x.details?.abstractDeadline), summary: str(x.details?.summary), language: str(x.details?.language), replyEmail: str(x.details?.replyForwardingEmail), smartConfEmail: str(x.details?.smartConfEmail),
      address: str(x.details?.address), postalCode: str(x.details?.postalCode), lat: typeof x.details?.lat === "number" ? x.details.lat : null, lng: typeof x.details?.lng === "number" ? x.details.lng : null,
      logoPath: x.logo_path ?? "", logoUrl: x.logo_path ? db.storage.from("public").getPublicUrl(x.logo_path).data.publicUrl : "", createdAt: isoDay(x.created_at), licenseExpiry: str(x.details?.licenseExpiry),
      topics: Array.isArray(x.details?.topics) ? (x.details.topics as unknown[]).filter((t): t is string => typeof t === "string") : [],
    };
  },

  async saveInfo(conferenceSlug, i) {
    const url = (v: string) => !v.trim() || /^https?:\/\/\S+$/i.test(v.trim());
    if (!i.name.trim() || i.name.length > 300 || i.about.length > 20000 || !url(i.webPage) || (i.contactEmail.trim() && !isValidEmail(i.contactEmail.trim())) || (i.startDate && i.endDate && i.endDate < i.startDate)) throw new ServiceError("Couldn't save that. Please check the details and try again.");
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    const nul = (v: string) => (v.trim() === "" ? null : v.trim());
    const cur = await rows<{ details: Record<string, unknown> | null }>(db.from("conferences").select("details").eq("slug", conferenceSlug).limit(1), "read this conference");
    const details = { ...(cur[0]?.details ?? {}), timezone: i.timezone, abstractDeadline: i.abstractDeadline, summary: i.summary, language: i.language, replyForwardingEmail: i.replyEmail, smartConfEmail: i.smartConfEmail, topics: i.topics, address: i.address, postalCode: i.postalCode, lat: i.lat, lng: i.lng };
    const { error } = await db.from("conferences").update({
      details, title: i.name.trim(), about: nul(i.about), web_page: nul(i.webPage), contact_email: nul(i.contactEmail), primary_area: nul(i.primaryArea), secondary_area: nul(i.secondaryArea),
      start_date: nul(i.startDate), end_date: nul(i.endDate), mode: i.mode || null, venue: nul(i.venue), city: nul(i.city), state: nul(i.state), country: nul(i.country),
      submission_deadline: i.submissionDeadline ? `${i.submissionDeadline}T23:59:59Z` : null, review_deadline: i.reviewDeadline ? `${i.reviewDeadline}T23:59:59Z` : null,
    }).eq("slug", conferenceSlug);
    if (error) fail(error, "change this conference");
  },

  // Archive / restore / the deletion request: the functions of migrations 0012 and 0013.
  async archiveConference(conferenceSlug) { await confRpc(conferenceSlug, "archive_conference", {}, "archive this conference"); },
  async restoreConference(conferenceSlug) { await confRpc(conferenceSlug, "restore_conference", {}, "restore this conference"); },
  async requestDeletion(conferenceSlug, reason) { await confRpc(conferenceSlug, "request_conference_deletion", { p_reason: reason }, "ask for this conference to be deleted"); },
  async cancelDeletion(conferenceSlug) { await confRpc(conferenceSlug, "cancel_conference_deletion", {}, "take back the deletion request"); },
  async loadDeletionRequest(conferenceSlug) {
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    const conf = await rows<{ id: string }>(db.from("conferences").select("id").eq("slug", conferenceSlug).limit(1), "read this conference");
    if (!conf[0]) return null;
    const { data, error } = await db.from("conference_deletion_requests").select("status, reason, admin_note").eq("conference_id", conf[0].id).order("created_at", { ascending: false }).limit(1);
    if (error) { if (/does not exist|schema cache/i.test(error.message ?? "")) return null; fail(error, "read the deletion request"); }
    const r = (data ?? [])[0] as { status: string; reason: string | null; admin_note: string | null } | undefined;
    return r ? { status: (["pending", "approved", "rejected", "cancelled"].includes(r.status) ? r.status : "pending") as DeletionRequest["status"], reason: r.reason ?? "", adminNote: r.admin_note ?? "" } : null;
  },

  // The logo lives in the public bucket under the conference's own folder; the column points at it. A new file each time, so a changed logo is never served from a cache.
  async saveLogo(conferenceSlug, file) {
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    const conf = await rows<{ id: string; logo_path: string | null }>(db.from("conferences").select("id, logo_path").eq("slug", conferenceSlug).limit(1), "read this conference");
    if (!conf[0]) throw new ServiceError("We couldn't find that conference.");
    if (!file) {
      const { error } = await db.from("conferences").update({ logo_path: null }).eq("id", conf[0].id);
      if (error) fail(error, "remove the logo");
      return "";
    }
    if (!/^image\/(png|jpeg|gif|svg\+xml|webp)$/.test(file.type)) throw new ServiceError("Use a PNG, JPEG, GIF or SVG image.");
    if (file.size > 2 * 1024 * 1024) throw new ServiceError("The logo is over 2 MB. Choose a smaller file.");
    const ext = file.type === "image/svg+xml" ? "svg" : file.type === "image/jpeg" ? "jpg" : file.type === "image/webp" ? "webp" : file.type === "image/gif" ? "gif" : "png";
    const path = `${conf[0].id}/logo-${Date.now()}.${ext}`;
    const { error: putError } = await db.storage.from("public").upload(path, file, { contentType: file.type, upsert: false });
    if (putError) throw new ServiceError(putError.message || "Couldn't upload the logo.");
    const { error } = await db.from("conferences").update({ logo_path: path }).eq("id", conf[0].id);
    if (error) fail(error, "save the logo");
    return db.storage.from("public").getPublicUrl(path).data.publicUrl;
  },

  // `license_requests` and its functions are migration 0035; until it is run there is simply no request.
  async loadLicenseRequest(conferenceSlug) {
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    const conf = await rows<{ id: string }>(db.from("conferences").select("id").eq("slug", conferenceSlug).limit(1), "read this conference");
    if (!conf[0]) return null;
    const { data, error } = await db.from("license_requests").select("id, requested_date, reason, status, decision_reason, new_expiry, created_at").eq("conference_id", conf[0].id).order("created_at", { ascending: false }).limit(1);
    if (error) { if (/does not exist|schema cache/i.test(error.message ?? "")) return null; fail(error, "read the license request"); }
    const r = (data ?? [])[0] as { id: string; requested_date: string; reason: string | null; status: string; decision_reason: string | null; new_expiry: string | null; created_at: string } | undefined;
    if (!r) return null;
    return { id: r.id, requestedDate: r.requested_date, reason: r.reason ?? "", status: (["pending", "approved", "declined", "withdrawn"].includes(r.status) ? r.status : "pending") as LicenseRequest["status"], decisionReason: r.decision_reason ?? "", newExpiry: r.new_expiry ?? "", createdAt: r.created_at };
  },
  async requestLicenseExtension(conferenceSlug, requestedDate, reason) {
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    const conf = await rows<{ id: string }>(db.from("conferences").select("id").eq("slug", conferenceSlug).limit(1), "read this conference");
    if (!conf[0]) throw new ServiceError("We couldn't find that conference.");
    const { error } = await db.rpc("request_license_extension", { p_conference: conf[0].id, p_date: requestedDate, p_reason: reason });
    if (error) { if (/does not exist|schema cache|Could not find the function/i.test(error.message ?? "")) throw new ServiceError("Run supabase/migrations/0035_license_requests.sql to send license requests."); fail(error, "send the request"); }
  },
  async withdrawLicenseRequest(conferenceSlug) {
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    const conf = await rows<{ id: string }>(db.from("conferences").select("id").eq("slug", conferenceSlug).limit(1), "read this conference");
    if (!conf[0]) return;
    const { error } = await db.rpc("withdraw_license_request", { p_conference: conf[0].id });
    if (error) fail(error, "withdraw the request");
  },

  // The Call for Papers' own facts the Conference Details rail shows: who else manages it, and whether the publishing intent is written.
  async loadCfpFacts(conferenceSlug) {
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    const conf = await rows<{ id: string }>(db.from("conferences").select("id").eq("slug", conferenceSlug).limit(1), "read this conference");
    if (!conf[0]) return { managers: 0, publishing: false, description: false };
    const [managers, cfp] = await Promise.all([
      db.from("conference_members").select("id", { count: "exact", head: true }).eq("conference_id", conf[0].id).eq("role", "cfp_manager").neq("status", "removed"),
      db.from("cfps").select("content").eq("conference_id", conf[0].id).limit(1),
    ]);
    const content = ((cfp.data ?? [])[0] as { content: Record<string, unknown> | null } | undefined)?.content;
    return { managers: managers.count ?? 0, publishing: typeof content?.publication === "string" && content.publication.trim() !== "", description: typeof content?.description === "string" && content.description.trim() !== "" };
  },

  async loadReviewSetup(conferenceSlug) {
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    const conf = await rows<{ id: string }>(db.from("conferences").select("id").eq("slug", conferenceSlug).limit(1), "read this conference");
    if (!conf[0]) return { form: PEER_REVIEW_FORM, custom: false, instructions: "", instructionsMode: "html", instructionsPdf: null };
    return reviewSetupOf(db, conf[0].id);
  },

  async saveReviewForm(conferenceSlug, sections) {
    const db: SupabaseClient = getSupabase();
    const me = (await currentUser(db)).id;
    const conf = await rows<{ id: string }>(db.from("conferences").select("id").eq("slug", conferenceSlug).limit(1), "read this conference");
    if (!conf[0]) throw new ServiceError("We couldn't find that conference.");
    if (sections === null) {
      const { error } = await db.from("conference_forms").delete().eq("conference_id", conf[0].id).eq("kind", "peer_review");
      if (error) { if (/does not exist|schema cache/i.test(error.message ?? "")) throw new ServiceError("Run supabase/migrations/0028_conference_settings.sql to save the review form."); fail(error, "change the review form"); }
      return;
    }
    const all = sections.flatMap((s) => s.fields);
    const ids = all.map((f) => f.id);
    if (!sections.length || sections.some((s) => !s.name.trim() || s.name.length > 80) || all.some((f) => !f.label.trim() || f.label.length > 200 || (f.type === "single_choice" && (f.options ?? []).filter((o) => o.trim()).length < 2)) || new Set(ids).size !== ids.length || PROTECTED_FIELD_IDS.some((p) => !ids.includes(p))) throw new ServiceError("Couldn't save that. Please check the form (every field needs a name, a choice needs two options, and the overall score, confidence and comments stay).");
    const { error } = await db.from("conference_forms").upsert({ conference_id: conf[0].id, kind: "peer_review", schema: { sections }, updated_by: me }, { onConflict: "conference_id,kind" });
    if (error) { if (/does not exist|schema cache/i.test(error.message ?? "")) throw new ServiceError("Run supabase/migrations/0028_conference_settings.sql to save the review form."); fail(error, "change the review form"); }
  },

  async saveReviewInstructions(conferenceSlug, text) {
    if (text.length > 20000) throw new ServiceError("Couldn't save that. The instructions are too long.");
    await upsertSettings(conferenceSlug, { review_instructions: text.trim() || null });
  },

  async saveReviewInstructionsMode(conferenceSlug, mode) {
    await upsertSettings(conferenceSlug, { review_instructions_mode: mode }, "0038_review_instructions_pdf.sql");
  },

  async saveReviewInstructionsPdf(conferenceSlug, file) {
    if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) throw new ServiceError("Choose a PDF file.");
    if (file.size > 5 * 1024 * 1024) throw new ServiceError("The PDF is over 5 MB. Choose a smaller file.");
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    const conf = await rows<{ id: string }>(db.from("conferences").select("id").eq("slug", conferenceSlug).limit(1), "read this conference");
    if (!conf[0]) throw new ServiceError("We couldn't find that conference.");
    const path = `${conf[0].id}/review-instructions-${Date.now()}.pdf`;
    const { error: putError } = await db.storage.from("public").upload(path, file, { contentType: "application/pdf", upsert: false });
    if (putError) throw new ServiceError(/mime|not supported|allowed/i.test(putError.message ?? "") ? "Run supabase/migrations/0038_review_instructions_pdf.sql to attach a PDF." : putError.message || "Couldn't upload the PDF.");
    await upsertSettings(conferenceSlug, { review_instructions_pdf_path: path, review_instructions_pdf_name: file.name.slice(0, 200) }, "0038_review_instructions_pdf.sql");
    return { name: file.name.slice(0, 200), url: db.storage.from("public").getPublicUrl(path).data.publicUrl };
  },

  async loadSubmissionForm(conferenceSlug) {
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    const conf = await rows<{ id: string }>(db.from("conferences").select("id").eq("slug", conferenceSlug).limit(1), "read this conference");
    if (!conf[0]) return [];
    const fm = await db.from("conference_forms").select("schema").eq("conference_id", conf[0].id).eq("kind", "submission").maybeSingle();
    return fm.error ? [] : extrasFromStored((fm.data as { schema: unknown } | null)?.schema);
  },

  async saveSubmissionForm(conferenceSlug, extras) {
    const db: SupabaseClient = getSupabase();
    const me = (await currentUser(db)).id;
    const conf = await rows<{ id: string }>(db.from("conferences").select("id").eq("slug", conferenceSlug).limit(1), "read this conference");
    if (!conf[0]) throw new ServiceError("We couldn't find that conference.");
    const ids = extras.map((f) => f.id);
    if (extras.length > 30 || extras.some((f) => !f.label.trim() || f.label.length > 300 || (f.type === "single_choice" && (f.options ?? []).filter((o) => o.trim()).length < 2)) || new Set(ids).size !== ids.length) throw new ServiceError("Couldn't save that. Please check the questions (each needs a name, and a choice needs two options).");
    const missing = (e: { message?: string }) => /does not exist|schema cache/i.test(e.message ?? "");
    if (!extras.length) {
      const { error } = await db.from("conference_forms").delete().eq("conference_id", conf[0].id).eq("kind", "submission");
      if (error) { if (missing(error)) throw new ServiceError("Run supabase/migrations/0028_conference_settings.sql to save the submission form."); fail(error, "change the submission form"); }
      return;
    }
    const { error } = await db.from("conference_forms").upsert({ conference_id: conf[0].id, kind: "submission", schema: { extras }, updated_by: me }, { onConflict: "conference_id,kind" });
    if (error) { if (missing(error)) throw new ServiceError("Run supabase/migrations/0028_conference_settings.sql to save the submission form."); fail(error, "change the submission form"); }
  },

  async loadSettings(conferenceSlug) {
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    const conf = await rows<{ id: string; settings: { reviewTimeline?: Partial<ReviewTimeline>; submissionPolicy?: Partial<SubmissionPolicy>; reviewPolicy?: Partial<ReviewPolicy> } | null; review_mode: ReviewMode }>(db.from("conferences").select("id, settings, review_mode").eq("slug", conferenceSlug).limit(1), "read this conference");
    const base: ConferenceSettings = { timeline: DEFAULT_REVIEW_TIMELINE, limits: DEFAULT_REVIEW_LIMITS, presentationTypes: DEFAULT_PRESENTATION_TYPES, tracks: [], stored: false, submission: DEFAULT_SUBMISSION_POLICY, review: DEFAULT_REVIEW_POLICY };
    if (!conf[0]) return base;
    const [tracks, row] = await Promise.all([
      rows<{ id: string; name: string; description: string | null }>(db.from("tracks").select("id, name, description").eq("conference_id", conf[0].id).order("position"), "read the tracks"),
      db.from("conference_settings").select("reviewers_per_paper, max_papers_per_reviewer, presentation_types").eq("conference_id", conf[0].id).maybeSingle(),
    ]);
    // Until 0028_conference_settings.sql is run the table does not exist: the defaults show and "stored" stays false.
    const missing = row.error && /does not exist|schema cache/i.test(row.error.message ?? "");
    if (row.error && !missing) fail(row.error, "read the conference settings");
    const r = row.data as { reviewers_per_paper: number; max_papers_per_reviewer: number | null; presentation_types: string[] } | null;
    return {
      timeline: { ...DEFAULT_REVIEW_TIMELINE, ...(conf[0].settings?.reviewTimeline ?? {}) },
      limits: { reviewersPerPaper: r?.reviewers_per_paper ?? DEFAULT_REVIEW_LIMITS.reviewersPerPaper, maxPapersPerReviewer: r?.max_papers_per_reviewer ?? null, reviewMode: conf[0].review_mode },
      presentationTypes: r?.presentation_types?.length ? r.presentation_types : DEFAULT_PRESENTATION_TYPES,
      tracks: tracks.map((t) => ({ id: t.id, name: t.name, description: t.description ?? "" })),
      stored: !missing,
      submission: { ...DEFAULT_SUBMISSION_POLICY, ...(conf[0].settings?.submissionPolicy ?? {}) },
      review: { ...DEFAULT_REVIEW_POLICY, ...(conf[0].settings?.reviewPolicy ?? {}) },
    };
  },

  async saveReviewTimeline(conferenceSlug, t) {
    const ints = [t.reviewDays, t.reminder1Days, t.reminder2Days];
    if (ints.some((n) => !Number.isInteger(n) || n < 0 || n > 90) || t.reviewDays < 1) throw new ServiceError("Couldn't save that. Please check the timeline and try again.");
    await mergeSetting(conferenceSlug, "reviewTimeline", t, "change the review timeline");
  },

  async saveSubmissionPolicy(conferenceSlug, p) {
    const counts = [p.startNumber, p.maxSubmissions, p.maxPerAuthor];
    if (counts.some((n) => n !== null && (!Number.isInteger(n) || n < 1))) throw new ServiceError("Couldn't save that. The numbers must be whole numbers of 1 or more.");
    await mergeSetting(conferenceSlug, "submissionPolicy", p, "change the submission settings");
  },

  async saveReviewPolicy(conferenceSlug, p) {
    await mergeSetting(conferenceSlug, "reviewPolicy", p, "change the review settings");
  },

  async saveReviewLimits(conferenceSlug, l) {
    if (!Number.isInteger(l.reviewersPerPaper) || l.reviewersPerPaper < 1 || l.reviewersPerPaper > 20 || (l.maxPapersPerReviewer !== null && (!Number.isInteger(l.maxPapersPerReviewer) || l.maxPapersPerReviewer < 1 || l.maxPapersPerReviewer > 500))) throw new ServiceError("Couldn't save that. Please check the limits and try again.");
    if (!["double_blind", "single_blind", "open"].includes(l.reviewMode)) throw new ServiceError("Couldn't save that. Please check the review mode and try again.");
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    // The review mode is a column the conference already has, so it saves even before migration 0028; the limits need that migration.
    const { error } = await db.from("conferences").update({ review_mode: l.reviewMode }).eq("slug", conferenceSlug);
    if (error) fail(error, "change the review mode");
    await upsertSettings(conferenceSlug, { reviewers_per_paper: l.reviewersPerPaper, max_papers_per_reviewer: l.maxPapersPerReviewer });
  },

  async savePresentationTypes(conferenceSlug, types) {
    const clean = types.map((t) => t.trim());
    if (!clean.length || clean.length > 20 || clean.some((t) => !t || t.length > 80) || new Set(clean.map((t) => t.toLowerCase())).size !== clean.length) throw new ServiceError("Couldn't save that. Please check the submission types and try again.");
    await upsertSettings(conferenceSlug, { presentation_types: clean });
  },

  async saveTracks(conferenceSlug, tracks) {
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    const conf = await rows<{ id: string }>(db.from("conferences").select("id").eq("slug", conferenceSlug).limit(1), "read this conference");
    if (!conf[0]) throw new ServiceError("We couldn't find that conference.");
    const names = tracks.map((t) => t.name.trim().toLowerCase());
    if (tracks.some((t) => !t.name.trim() || t.name.length > 80 || t.description.length > 500) || new Set(names).size !== names.length) throw new ServiceError("Couldn't save that. Please check the tracks and try again.");
    const existing = await rows<{ id: string }>(db.from("tracks").select("id").eq("conference_id", conf[0].id), "read the tracks");
    const keep = new Set(tracks.filter((t) => UUID.test(t.id)).map((t) => t.id));
    const gone = existing.filter((t) => !keep.has(t.id)).map((t) => t.id);
    if (gone.length) { const { error } = await db.from("tracks").delete().in("id", gone); if (error) fail(error, "change the tracks"); }
    const mk = (t: ConferenceTrack, i: number) => ({ conference_id: conf[0].id, name: t.name.trim(), description: t.description.trim() || null, position: i });
    const old = tracks.map((t, i) => [t, i] as const).filter(([t]) => UUID.test(t.id));
    const fresh = tracks.map((t, i) => [t, i] as const).filter(([t]) => !UUID.test(t.id));
    if (old.length) { const { error } = await db.from("tracks").upsert(old.map(([t, i]) => ({ id: t.id, ...mk(t, i) }))); if (error) fail(error, "change the tracks"); }
    if (fresh.length) { const { error } = await db.from("tracks").insert(fresh.map(([t, i]) => mk(t, i))); if (error) fail(error, "change the tracks"); }
  },

  async saveScreeningSetup(conferenceSlug, setup) {
    const c = setup.criteria;
    const nums = [c.minPages, c.maxPages, c.doubleMinPages, c.doubleMaxPages, c.similarityLimit, c.aiLimit, c.correctionDays, c.revisionDays];
    if (nums.some((n) => !Number.isFinite(n) || n < 0 || n > 1000) || !["single", "double", "either"].includes(c.column) || c.minPages > c.maxPages || c.doubleMinPages > c.doubleMaxPages) throw new ServiceError("Couldn't save that. Please check the limits (a minimum can't be above its maximum).");
    // The prototype's own shape (screeningConfigOf), so its Initial Check and Plagiarism pages read the same record.
    await mergeSetting(conferenceSlug, "screening", { settings: { initialCheck: setup.initialCheck, plagiarism: setup.plagiarism, autoInitialCheck: false, autoInitialFail: "send_back" }, criteria: c }, "change the screening settings");
  },

  async loadEmailTemplates(conferenceSlug) {
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    const conf = await rows<{ id: string }>(db.from("conferences").select("id").eq("slug", conferenceSlug).limit(1), "read this conference");
    const empty: EmailTemplates = { platform: [], mine: {} };
    if (!conf[0]) return empty;
    const [platform, mine] = await Promise.all([
      db.from("email_templates").select("key, module, role, label, send_type, trigger_text, recipients, subject, body"),
      db.from("conference_email_templates").select("key, label, enabled, subject, body, is_custom").eq("conference_id", conf[0].id),
    ]);
    // Until 0005_email_templates.sql is run the tables do not exist: that reads as "no templates".
    for (const r of [platform, mine]) if (r.error) { if (/does not exist|schema cache/i.test(r.error.message ?? "")) return empty; fail(r.error, "read the email templates"); }
    return {
      platform: ((platform.data ?? []) as Array<{ key: string; module: string | null; role: string | null; label: string; send_type: string | null; trigger_text: string | null; recipients: string | null; subject: string; body: string }>).map((t) => ({ key: t.key, module: t.module ?? "", role: t.role ?? "", label: t.label, sendType: t.send_type ?? "", trigger: t.trigger_text ?? "", recipients: t.recipients ?? "", subject: t.subject, body: t.body })),
      mine: Object.fromEntries(((mine.data ?? []) as Array<{ key: string; label: string | null; enabled: boolean; subject: string; body: string; is_custom: boolean }>).map((t) => [t.key, { key: t.key, label: t.label ?? "", enabled: t.enabled, subject: t.subject, body: t.body, custom: t.is_custom } satisfies ConferenceTemplate])),
    };
  },

  async saveEmailTemplate(conferenceSlug, template) {
    if (!template.subject.trim() || template.subject.length > 300 || template.body.length > 100000 || template.key.length > 80 || (template.custom && !template.key.startsWith("custom:"))) throw new ServiceError("Couldn't save that. Please check the email and try again.");
    const db: SupabaseClient = getSupabase();
    const me = (await currentUser(db)).id;
    const conf = await rows<{ id: string }>(db.from("conferences").select("id").eq("slug", conferenceSlug).limit(1), "read this conference");
    if (!conf[0]) throw new ServiceError("We couldn't find that conference.");
    const { error } = await db.from("conference_email_templates").upsert({ conference_id: conf[0].id, key: template.key, label: template.label || null, enabled: template.enabled, subject: template.subject, body: template.body, is_custom: template.custom, updated_by: me, updated_at: new Date().toISOString() }, { onConflict: "conference_id,key" });
    if (error) fail(error, "save the email templates");
  },

  async deleteEmailTemplate(conferenceSlug, key) {
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    const conf = await rows<{ id: string }>(db.from("conferences").select("id").eq("slug", conferenceSlug).limit(1), "read this conference");
    if (!conf[0]) throw new ServiceError("We couldn't find that conference.");
    const { error } = await db.from("conference_email_templates").delete().eq("conference_id", conf[0].id).eq("key", key);
    if (error) fail(error, "save the email templates");
  },

  // `activity_log` (migration 0031): written by database triggers, read by the conference's chairs. Until that migration is run the table does not exist,
  // which reads as "no activity yet".
  async loadActivityLogs(conferenceSlug) {
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    const conf = await rows<{ id: string }>(db.from("conferences").select("id").eq("slug", conferenceSlug).limit(1), "read this conference");
    if (!conf[0]) return [];
    const { data, error } = await db.from("activity_log").select("id, created_at, actor_name, actor_role, action, module, description, status, reviewer_name, previous_value, new_value").eq("conference_id", conf[0].id).order("created_at", { ascending: false }).limit(1000);
    if (error) { if (/does not exist|schema cache/i.test(error.message ?? "")) return []; fail(error, "read the activity logs"); }
    return ((data ?? []) as Array<{ id: string; created_at: string; actor_name: string; actor_role: string; action: string; module: string; description: string; status: string; reviewer_name: string | null; previous_value: string | null; new_value: string | null }>).map((l) => ({
      id: l.id, datetime: l.created_at, actorName: l.actor_name, actorRole: (["chair", "author", "reviewer"].includes(l.actor_role) ? l.actor_role : "system") as ChairActivityLog["actorRole"],
      action: l.action, module: l.module, description: l.description, status: l.status === "failed" ? "failed" : "success",
      ...(l.reviewer_name ? { reviewerName: l.reviewer_name } : {}), ...(l.previous_value ? { previousValue: l.previous_value } : {}), ...(l.new_value ? { newValue: l.new_value } : {}),
    } satisfies ChairActivityLog));
  },

  async loadEmailLogs(conferenceSlug) {
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    const conf = await rows<{ id: string }>(db.from("conferences").select("id").eq("slug", conferenceSlug).limit(1), "read this conference");
    if (!conf[0]) return [];
    const { data, error } = await db.from("email_log").select("id, created_at, event, template_key, template_label, submission_id, to_email, to_name, recipient_type, subject, body, status, error").eq("conference_id", conf[0].id).order("created_at", { ascending: false }).limit(300);
    // Until 0003_email_log.sql is run the table does not exist: that reads as "no emails yet".
    if (error) { if (/does not exist|schema cache/i.test(error.message ?? "")) return []; fail(error, "read the email logs"); }
    return ((data ?? []) as Array<{ id: string; created_at: string; event: string; template_key: string; template_label: string | null; submission_id: string | null; to_email: string; to_name: string | null; recipient_type: string | null; subject: string; body: string | null; status: string; error: string | null }>).map((l) => ({
      id: l.id, createdAt: l.created_at, event: l.event, template: l.template_label || l.template_key, templateKey: l.template_key, submissionId: l.submission_id ?? undefined, toEmail: l.to_email, toName: l.to_name ?? "", recipientType: l.recipient_type ?? "",
      subject: l.subject, body: l.body ?? "", status: l.status === "failed" ? "failed" : "sent", error: l.error ?? "",
    } satisfies ChairEmailLog));
  },

  async saveDecisionTypes(conferenceSlug, types) {
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    const conf = await rows<{ id: string }>(db.from("conferences").select("id").eq("slug", conferenceSlug).limit(1), "read this conference");
    if (!conf[0]) throw new ServiceError("We couldn't find that conference.");
    const labels = types.map((t) => t.label.trim().toLowerCase());
    if (types.some((t) => !t.label.trim() || t.label.length > 80 || !/^#[0-9a-fA-F]{6}$/.test(t.color) || t.description.length > 1000) || new Set(labels).size !== labels.length) throw new ServiceError("Couldn't save that. Please check the decisions and try again.");
    const existing = await rows<{ id: string }>(db.from("decision_types").select("id").eq("conference_id", conf[0].id), "read the decision types");
    const keep = new Set(types.filter((t) => UUID.test(t.id)).map((t) => t.id));
    const gone = existing.filter((t) => !keep.has(t.id)).map((t) => t.id);
    if (gone.length) { const { error } = await db.from("decision_types").delete().in("id", gone); if (error) fail(error, "change decision types"); }
    if (types.some((t) => (t.authorLabel ?? "").length > 120)) throw new ServiceError("Couldn't save that. The text the author sees is too long.");
    // The "Author sees" column is migration 0039; until it is run the rest is saved and the text is not.
    const hasColumn = (await db.from("decision_types").select("author_label").limit(1)).error === null;
    if (!hasColumn && types.some((t) => (t.authorLabel ?? "").trim())) throw new ServiceError("Run supabase/migrations/0039_decision_author_label.sql to save the text authors see.");
    const mk = (t: DecisionType, i: number) => ({ conference_id: conf[0].id, label: t.label.trim(), color: t.color.toUpperCase(), outcome: t.outcome, description: t.description.trim() || null, position: i, ...(hasColumn ? { author_label: (t.authorLabel ?? "").trim() || null } : {}) });
    const old = types.map((t, i) => [t, i] as const).filter(([t]) => UUID.test(t.id));
    const fresh = types.map((t, i) => [t, i] as const).filter(([t]) => !UUID.test(t.id));
    if (old.length) { const { error } = await db.from("decision_types").upsert(old.map(([t, i]) => ({ id: t.id, ...mk(t, i) }))); if (error) fail(error, "change decision types"); }
    if (fresh.length) { const { error } = await db.from("decision_types").insert(fresh.map(([t, i]) => mk(t, i))); if (error) fail(error, "change decision types"); }
  },

  async uploadScreeningReport(paperDbId, file) {
    if (!UUID.test(paperDbId)) throw new ServiceError("Couldn't upload this report.");
    if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") throw new ServiceError("A plagiarism report must be a PDF.");
    if (file.size === 0) throw new ServiceError("That file is empty.");
    if (file.size > 26214400) throw new ServiceError("That file is too large — the limit is 25 MB.");
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    const sub = await rows<{ conference_id: string }>(db.from("submissions").select("conference_id").eq("id", paperDbId).limit(1), "upload this report");
    if (!sub[0]) throw new ServiceError("That paper doesn't exist.");
    const safe = file.name.replace(/[^A-Za-z0-9._-]+/g, "_");
    const path = `${sub[0].conference_id}/${paperDbId}/${Date.now().toString(36)}-${safe}`;
    const { error } = await db.storage.from("papers").upload(path, file, { contentType: "application/pdf", upsert: false });
    if (error) { if (/mime|type/i.test(error.message)) throw new ServiceError("A plagiarism report must be a PDF."); if (/size|large/i.test(error.message)) throw new ServiceError("That file is too large — the limit is 25 MB."); fail(error, "upload this report"); }
    return { name: file.name, path };
  },

  async fileUrl(storagePath, download) {
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    const { data, error } = await db.storage.from("papers").createSignedUrl(storagePath, 600, download ? { download } : undefined);
    if (error || !data) fail(error ?? { message: "no link" }, "open this file");
    return (data as { signedUrl: string }).signedUrl;
  },

  async saveScreening(paperDbId, version, record) {
    if (!UUID.test(paperDbId) || !Number.isInteger(version) || version < 1) throw new ServiceError("Couldn't save this decision.");
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    const { error } = await db.rpc("save_screening", { p_submission: paperDbId, p_version: version, p_record: record });
    if (error) fail(error, "record screening decisions");
  },

  async loadConference(conferenceSlug): Promise<ChairConference> {
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    const conf = await rows<{ id: string; acronym: string; settings: { screening?: { initialCheck?: boolean; plagiarism?: boolean; settings?: { initialCheck?: boolean; plagiarism?: boolean }; criteria?: Partial<ScreeningCriteria> } } | null }>(
      db.from("conferences").select("id, acronym, settings").eq("slug", conferenceSlug).limit(1), "read this conference");
    if (!conf[0]) return { dbId: "", cfpStatus: null, papers: [], decisionTypes: [], criteria: DEFAULT_CRITERIA, screening: { initialCheck: true, plagiarism: true } };
    const cid = conf[0].id;
    // The chair works with submitted papers only — a draft isn't a submission yet.
    const subs = (await rows<SubRow>(
      db.from("submissions").select("id, conference_id, paper_no, title, keywords, status, outcome, notified_outcome, decision_type_id, submitted_at, updated_at, withdrawn_at, withdrawn_by, details, screening").eq("conference_id", cid).order("paper_no"),
      "read the papers")).filter((s) => s.status !== "draft");
    const ids = inList(subs.map((s) => s.id));
    const [authors, files, assignments, reviews, waiting, types, cfp] = await Promise.all([
      rows<{ submission_id: string; name: string; email: string | null; affiliation: string | null; country: string | null; is_corresponding: boolean | null; user_id: string | null }>(db.from("submission_authors").select("submission_id, name, email, affiliation, country, is_corresponding, user_id").in("submission_id", ids).order("position"), "read the authors"),
      rows<{ submission_id: string; kind: string | null }>(db.from("submission_files").select("submission_id, kind").in("submission_id", ids), "read the files"),
      rows<{ submission_id: string; status: string }>(db.from("review_assignments").select("submission_id, status").in("submission_id", ids), "read the assignments"),
      rows<{ submission_id: string; status: string; score: number | null }>(db.from("reviews").select("submission_id, status, score").in("submission_id", ids), "read the reviews"),
      // Papers waiting for a new reviewer to join the committee. Empty until 0019_pending_review_assignments.sql is run.
      db.from("pending_review_assignments").select("submission_id").in("submission_id", ids).then(({ data, error }) => (error ? [] : ((data ?? []) as Array<{ submission_id: string }>))),
      decisionTypeRows(db, cid),
      // The Call for Papers' state (the Dashboard's "Submission link" card); tolerant of a read that fails.
      db.from("cfps").select("status").eq("conference_id", cid).limit(1).then(({ data, error }) => (error ? null : ((data ?? [])[0] as { status: string } | undefined)?.status ?? null)),
    ]);
    // The chair's saved screening setup is { settings: { initialCheck, plagiarism, … }, criteria: { … } } (the prototype's screeningConfigOf).
    const saved = conf[0].settings?.screening;
    const screening = saved?.settings ?? saved;
    const criteria: ScreeningCriteria = { ...DEFAULT_CRITERIA, ...(saved?.criteria ?? {}) };
    const papers: ChairPaper[] = subs.map((s) => {
      const mine = reviews.filter((r) => r.submission_id === s.id && r.status === "submitted");
      const scored = mine.map((r) => r.score).filter((n): n is number => typeof n === "number");
      const people: ChairAuthor[] = authors.filter((a) => a.submission_id === s.id).map((a) => ({ name: a.name, email: a.email ?? "", affiliation: a.affiliation ?? "", country: a.country ?? "", corresponding: Boolean(a.is_corresponding), hasAccount: a.user_id !== null }));
      return {
        id: `${paperPrefix(conf[0].acronym)}-${s.paper_no}`, dbId: s.id, conferenceId: conferenceSlug, title: s.title, keywords: s.keywords ?? [],
        track: s.details?.track || "General Track", presentationType: s.details?.presentationType || "Paper Presentation", authors: people,
        submittedAt: label(s.submitted_at), lastUpdate: label(s.updated_at),
        withdrawn: s.status === "withdrawn", withdrawnAt: label(s.withdrawn_at || s.updated_at), withdrawnBy: s.withdrawn_by === "chair" ? "chair" : "author",
        outcome: s.outcome ?? "no_decision", decisionTypeId: s.decision_type_id, notifiedOutcome: s.notified_outcome,
        reviewersAssigned: assignments.filter((a) => a.submission_id === s.id && a.status !== "declined" && a.status !== "removed").length + waiting.filter((w) => w.submission_id === s.id).length,
        reviewsReceived: mine.length,
        averageScore: scored.length ? Math.round((scored.reduce((a, b) => a + b, 0) / scored.length) * 10) / 10 : null,
        versions: files.filter((f) => f.submission_id === s.id && f.kind !== "supplementary").length,
        screening: s.screening ?? {},
      };
    });
    const decisionTypes: DecisionType[] = types.map((t) => ({ id: t.id, label: t.label, color: t.color, outcome: t.outcome, description: t.description ?? "", authorLabel: t.author_label ?? "" }));
    const cfpStatus = cfp === "draft" || cfp === "published" || cfp === "closed" ? cfp : null;
    return { dbId: cid, cfpStatus, papers, decisionTypes, criteria, screening: { initialCheck: screening?.initialCheck !== false, plagiarism: screening?.plagiarism !== false } };
  },
};
