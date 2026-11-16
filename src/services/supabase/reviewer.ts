import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import { PEER_REVIEW_FORM, sectionsFromStored } from "@/features/reviewer/form-schema";
import type { ReviewDetail, ReviewFile, ReviewValues, ReviewerPaper } from "@/types/reviewer";
import type { ReviewerService } from "../reviewer";
import { ServiceError } from "../errors";
import { readInstructions } from "./instructions";
import { currentUser, fail, paperPrefix } from "./shared";

/* The papers assigned to the signed-in reviewer, read as the prototype does (src/data/workspace.js › loadWorkspace, reviewer view)
   with the anon key and the user's session. Row Level Security returns only the papers the chair assigned to this reviewer;
   every query also names the user. The authors are not read at all: the review is double-blind. */

interface AssignmentRow { id: string; submission_id: string; status: "assigned" | "accepted" | "declined" | "submitted" | "removed"; due_at: string | null; assigned_at: string | null }
interface PaperRow { id: string; conference_id: string; paper_no: number; title: string; abstract: string | null; keywords: string[] | null; status: "draft" | "submitted" | "withdrawn"; submitted_at: string | null; details: { track?: string; presentationType?: string } | null }
interface ReviewRow { assignment_id: string; status: "draft" | "submitted"; score: number | null; submitted_at: string | null; updated_at: string | null }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const label = (ts: string | null) => (ts ? new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "");
const isoDay = (ts: string | null) => (ts ? ts.slice(0, 10) : "");
const inList = (ids: string[]) => (ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
const shift = (iso: string, days: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(y, m - 1, d + days);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
};

async function rows<T>(query: PromiseLike<{ data: unknown; error: { message?: string } | null }>, what: string): Promise<T[]> {
  const { data, error } = await query;
  if (error) fail(error, what);
  return (data ?? []) as T[];
}

/* The review form's answers -> the review's columns (the prototype's saveReview, src/data/workspace.js). */
const SCORE_MAX = 5;
const CONFIDENCE = ["low", "medium", "high"];
const text = (v: unknown) => (typeof v === "string" ? v : "");
function fieldsOf(values: ReviewValues) {
  const score = Number(values["f-score"]);
  const confidence = text(values["f-confidence"]).toLowerCase();
  return {
    score: score >= 1 && score <= SCORE_MAX ? Math.round(score) : null,
    confidence: CONFIDENCE.includes(confidence) ? confidence : null,
    comments_to_author: text(values["f-to-author"]).slice(0, 20000) || null,
    comments_to_chair: text(values["f-to-chair"]).slice(0, 20000) || null,
    answers: values,
  };
}

export const supabaseReviewerService: ReviewerService = {
  async loadReview(conferenceSlug, paperLabel) {
    const found = (await this.listAssignments(conferenceSlug)).papers.find((p) => p.id === paperLabel);
    if (!found) return null;
    const db: SupabaseClient = getSupabase();
    const me = (await currentUser(db)).id;
    const [review, files, sub] = await Promise.all([
      rows<{ status: "draft" | "submitted"; answers: ReviewValues | null }>(db.from("reviews").select("status, answers").eq("assignment_id", found.assignmentId).eq("reviewer_id", me).limit(1), "read your review"),
      rows<{ kind: string | null; file_name: string; uploaded_at: string | null; storage_path: string | null }>(db.from("submission_files").select("kind, file_name, uploaded_at, storage_path").eq("submission_id", found.dbId).order("uploaded_at"), "read the paper's files"),
      rows<{ notified_outcome: string | null; notified_decision_type_id: string | null }>(db.from("submissions").select("notified_outcome, notified_decision_type_id").eq("id", found.dbId).limit(1), "read the paper"),
    ]);
    const told = sub[0]?.notified_outcome ?? null;
    let decisionLabel = "";
    let decisionColor = "";
    if (told) {
      const type = sub[0]?.notified_decision_type_id ? await rows<{ label: string; color: string | null }>(db.from("decision_types").select("label, color").eq("id", sub[0].notified_decision_type_id).limit(1), "read the decision") : [];
      decisionColor = type[0]?.color || ({ accept: "#16A34A", registered: "#0D9488", reject: "#DC2626", revise: "#F59E0B", waitlist: "#8B5CF6" } as Record<string, string>)[told] || "#64748B";
      decisionLabel = type[0]?.label || ({ accept: "Accepted", registered: "Accepted", reject: "Not accepted", revise: "Revision requested", waitlist: "Waitlisted" } as Record<string, string>)[told] || "Decision released";
    }
    // The chair's own review form and instructions (migration 0028); without them the standard ones are used.
    const confRow = await rows<{ conference_id: string }>(db.from("submissions").select("conference_id").eq("id", found.dbId).limit(1), "read the paper");
    const cid = confRow[0]?.conference_id;
    const [formRow, ins] = cid ? await Promise.all([
      db.from("conference_forms").select("schema").eq("conference_id", cid).eq("kind", "peer_review").maybeSingle(),
      readInstructions(db, cid),
    ]) : [null, null];
    const form = (formRow && !formRow.error ? sectionsFromStored((formRow.data as { schema: unknown } | null)?.schema) : null) ?? PEER_REVIEW_FORM;
    const instructions = ins?.text ?? "";
    const mine = review[0];
    const paperFiles: ReviewFile[] = files.filter((f) => f.kind !== "supplementary").map((f) => ({ name: f.file_name, uploadedAt: label(f.uploaded_at), storagePath: f.storage_path }));
    return {
      paper: found, form, instructions, instructionsMode: ins?.mode ?? "html", instructionsPdf: ins?.pdf ?? null,
      values: (mine?.answers && typeof mine.answers === "object" ? mine.answers : {}) as ReviewValues,
      state: mine ? mine.status : "none",
      files: paperFiles,
      decision: told ? { label: decisionLabel, color: decisionColor } : null,
    } satisfies ReviewDetail;
  },

  async saveReview(assignmentId, paperDbId, values, submit) {
    if (!UUID.test(assignmentId) || !UUID.test(paperDbId)) throw new ServiceError("Couldn't save this review.");
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    // One review per assignment: the first save creates it, later ones change it.
    const { data: existing, error: readError } = await db.from("reviews").select("id, status").eq("assignment_id", assignmentId).maybeSingle();
    if (readError) fail(readError, "save this review");
    if (existing?.status === "submitted" && !submit) return { firstSubmit: false }; // a draft never takes a sent review back
    const fields = { ...fieldsOf(values), status: submit ? "submitted" : "draft" };
    const { error } = existing
      ? await db.from("reviews").update(fields).eq("id", existing.id)
      : await db.from("reviews").insert({ assignment_id: assignmentId, submission_id: paperDbId, ...fields });
    if (error) {
      if (/row-level security/i.test(error.message)) throw new ServiceError("This review can't be changed any more — the paper already has a decision.");
      fail(error, "save this review");
    }
    return { firstSubmit: submit && existing?.status !== "submitted" };
  },

  async listAssignments(conferenceSlug) {
    const db: SupabaseClient = getSupabase();
    const me = (await currentUser(db)).id;
    const conf = await rows<{ id: string; acronym: string; start_date: string | null; review_deadline: string | null }>(
      db.from("conferences").select("id, acronym, start_date, review_deadline").eq("slug", conferenceSlug).limit(1), "read this conference");
    if (!conf[0]) return { papers: [], declined: 0 };
    const mine = (await rows<AssignmentRow>(db.from("review_assignments").select("id, submission_id, status, due_at, assigned_at").eq("reviewer_id", me), "read your reviews"))
      .filter((a) => a.status !== "removed");
    if (!mine.length) return { papers: [], declined: 0 };
    const papers = await rows<PaperRow>(
      db.from("submissions").select("id, conference_id, paper_no, title, abstract, keywords, status, submitted_at, details").in("id", inList(mine.map((a) => a.submission_id))).eq("conference_id", conf[0].id).order("paper_no"),
      "read your reviews");
    const here = new Set(papers.map((p) => p.id));
    const inConf = mine.filter((a) => here.has(a.submission_id));
    const reviews = inConf.length
      ? await rows<ReviewRow>(db.from("reviews").select("assignment_id, status, score, submitted_at, updated_at").eq("reviewer_id", me).in("assignment_id", inList(inConf.map((a) => a.id))), "read your reviews")
      : [];
    // "Ask for more time" requests (migration 0043). Until it is run the table is missing: no request shows, nothing fails.
    const asked = inConf.length
      ? await db.from("review_extension_requests").select("assignment_id, requested_date, reason, status, created_at").in("assignment_id", inList(inConf.map((a) => a.id))).order("created_at", { ascending: false })
        .then(({ data, error }) => (error ? [] : ((data ?? []) as Array<{ assignment_id: string; requested_date: string; reason: string | null; status: "pending" | "approved" | "declined"; created_at: string }>)))
      : [];
    // When a review is due: the chair's date for this reviewer, else the conference's review deadline, else 45 days before it starts.
    const fallback = isoDay(conf[0].review_deadline) || (conf[0].start_date ? shift(isoDay(conf[0].start_date), -45) : "");
    const out: ReviewerPaper[] = [];
    for (const a of inConf) {
      if (a.status === "declined") continue;
      const p = papers.find((x) => x.id === a.submission_id)!;
      const rv = reviews.find((r) => r.assignment_id === a.id);
      const sent = a.status === "submitted" || rv?.status === "submitted";
      out.push({
        id: `${paperPrefix(conf[0].acronym)}-${p.paper_no}`,
        dbId: p.id, assignmentId: a.id, conferenceId: conferenceSlug,
        title: p.title, abstract: p.abstract ?? "", keywords: p.keywords ?? [],
        track: p.details?.track || "General Track", presentationType: p.details?.presentationType || "Paper Presentation",
        response: a.status === "assigned" ? "pending" : "accepted",
        assignedOn: label(a.assigned_at),
        due: isoDay(a.due_at) || fallback,
        review: sent ? { score: rv?.score ?? null, submittedAt: label(rv?.submitted_at ?? rv?.updated_at ?? null) } : null,
        draft: !sent && rv?.status === "draft",
        withdrawn: p.status === "withdrawn",
        extension: ((x) => (x ? { date: x.requested_date, reason: x.reason ?? "", at: label(x.created_at), status: x.status } : null))(asked.find((e) => e.assignment_id === a.id)),
      });
    }
    return { papers: out, declined: inConf.filter((a) => a.status === "declined").length };
  },

  async respond(assignmentId, accept, reason) {
    if (!UUID.test(assignmentId)) throw new ServiceError("Couldn't answer this assignment.");
    const text = (reason ?? "").trim().slice(0, 1000);
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    // respond_to_assignment (migration 0002) checks that the assignment is the caller's and tells the chair.
    const { error } = await db.rpc("respond_to_assignment", { p_assignment: assignmentId, p_accept: accept, p_reason: text || null });
    if (error) fail(error, "answer this assignment");
  },

  async requestExtension(assignmentId, dateISO, reason) {
    if (!UUID.test(assignmentId) || !/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) throw new ServiceError("Couldn't send this request.");
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    // request_review_extension (migration 0043) checks the assignment is the caller's, that nothing is open already, and tells the chairs.
    const { error } = await db.rpc("request_review_extension", { p_assignment: assignmentId, p_date: dateISO, p_reason: reason.trim().slice(0, 1000) || null });
    if (error) {
      if (/does not exist|schema cache|Could not find the function/i.test(error.message)) throw new ServiceError("Asking for more time isn't switched on yet — the owner needs to run migration 0043.");
      if (/P0002|Assignment not found/i.test(error.message)) throw new ServiceError("This paper isn't assigned to you.");
      // The function's own messages ("You already have a request waiting for the chair.") are meant to be read as they are.
      if (!/row-level security|permission denied|jwt/i.test(error.message)) throw new ServiceError(error.message);
      fail(error, "send this request");
    }
  },
};
