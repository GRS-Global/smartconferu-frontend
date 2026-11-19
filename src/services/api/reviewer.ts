import { PEER_REVIEW_FORM, sectionsFromStored } from "@/features/reviewer/form-schema";
import { api, ApiError, publicFileUrl } from "@/lib/api-client";
import type { ReviewDetail, ReviewFile, ReviewValues, ReviewerAssignments, ReviewerPaper } from "@/types/reviewer";
import type { ReviewerService } from "../reviewer";
import { ServiceError } from "../errors";

/* The reviewer's side through the own backend: `GET /me/review-assignments` (the papers given to the person), `GET /assignments/:id` (their saved
   review), `GET /assignments/:id/review-form` (the conference's own form + instructions, and the decision once the authors were told: those are
   kept in chair-only settings), `GET /submissions/:id` (the paper's files) and `POST /assignments/:id/respond`, `PUT /assignments/:id/review`.
   The review is double-blind: the authors are never read. A paper file's `storagePath` is "<paperId>/<fileId>" (see services/api/author-submissions.ts).
   "Ask for more time": `POST /assignments/:id/extension-request` (the latest request of each assignment comes with it as `extension`). Backend/src/modules/reviews. */

interface ReviewDto { id: string; status: "draft" | "submitted"; score: number | null; confidence: string | null; commentsToAuthor: string | null; commentsToChair: string | null; answers: Record<string, unknown>; submittedAt: string | null; updatedAt: string }
interface ExtensionDto { id: string; date: string; reason: string | null; status: "pending" | "approved" | "declined"; note: string | null; createdAt: string; decidedAt: string | null }
interface AssignmentDto {
  id: string; submissionId: string; status: "assigned" | "accepted" | "declined" | "submitted" | "removed"; dueAt: string | null; assignedAt: string;
  review: ReviewDto | null; extension: ExtensionDto | null; can: { respond: boolean; review: boolean };
}
interface MyAssignmentDto extends AssignmentDto {
  paper: { id: string; paperId: string; title: string; abstract: string; keywords: string[]; track: string | null; presentationType: string | null; conferenceSlug: string; outcome: string; withdrawn: boolean };
}
interface ConferenceDto { startDate: string | null; reviewDeadline: string | null }
interface FormDto { form: unknown; instructions: { text: string; mode: "html" | "pdf"; pdf: { path: string; name: string } | null }; decision: { outcome: string; label: string | null; color: string | null } | null }
interface PaperDto { files: Array<{ id: string; kind: string; version: number; fileName: string; uploadedAt: string }> }

const label = (ts: string | null) => (ts ? new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "");
const isoDay = (ts: string | null) => (ts ? ts.slice(0, 10) : "");
const shift = (iso: string, days: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(y, m - 1, d + days);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
};
const notYours = (e: unknown) => e instanceof ApiError && (e.status === 403 || e.status === 404);

/* The review form's answers -> the review's fields (the prototype's saveReview, src/data/workspace.js). */
const SCORE_MAX = 5;
const CONFIDENCE = ["low", "medium", "high"];
const text = (v: unknown) => (typeof v === "string" ? v : "");
function fieldsOf(values: ReviewValues) {
  const score = Number(values["f-score"]);
  const confidence = text(values["f-confidence"]).toLowerCase();
  return {
    score: score >= 1 && score <= SCORE_MAX ? Math.round(score) : null,
    confidence: CONFIDENCE.includes(confidence) ? confidence : null,
    commentsToAuthor: text(values["f-to-author"]).slice(0, 20000) || null,
    commentsToChair: text(values["f-to-chair"]).slice(0, 20000) || null,
    answers: values,
  };
}

/** What the decision is called when the chair gave it no wording of its own. */
const DECISION_COLORS: Record<string, string> = { accept: "#16A34A", registered: "#0D9488", reject: "#DC2626", revise: "#F59E0B", waitlist: "#8B5CF6" };
const DECISION_LABELS: Record<string, string> = { accept: "Accepted", registered: "Accepted", reject: "Not accepted", revise: "Revision requested", waitlist: "Waitlisted" };

export const apiReviewerService: ReviewerService = {
  async listAssignments(slug) {
    const [mine, conf] = await Promise.all([
      api<MyAssignmentDto[]>("/me/review-assignments", { query: { conferenceId: slug } }).catch((e: unknown) => { if (notYours(e)) return [] as MyAssignmentDto[]; throw e; }),
      // When a review is due: the chair's date for this reviewer, else the conference's review deadline, else 45 days before it starts.
      api<ConferenceDto>(`/conferences/${encodeURIComponent(slug)}`).catch((): ConferenceDto => ({ startDate: null, reviewDeadline: null })),
    ]);
    const fallback = isoDay(conf.reviewDeadline) || (conf.startDate ? shift(isoDay(conf.startDate), -45) : "");
    const papers: ReviewerPaper[] = [];
    let declined = 0;
    for (const a of [...mine].sort((x, y) => x.paper.paperId.localeCompare(y.paper.paperId, undefined, { numeric: true }))) {
      if (a.status === "removed") continue;
      if (a.status === "declined") { declined += 1; continue; }
      const sent = a.status === "submitted" || a.review?.status === "submitted";
      papers.push({
        id: a.paper.paperId, dbId: a.paper.id, assignmentId: a.id, conferenceId: slug,
        title: a.paper.title, abstract: a.paper.abstract, keywords: a.paper.keywords,
        track: a.paper.track || "General Track", presentationType: a.paper.presentationType || "Paper Presentation",
        response: a.status === "assigned" ? "pending" : "accepted",
        assignedOn: label(a.assignedAt), due: isoDay(a.dueAt) || fallback,
        review: sent ? { score: a.review?.score ?? null, submittedAt: label(a.review?.submittedAt ?? a.review?.updatedAt ?? null) } : null,
        draft: !sent && a.review?.status === "draft",
        withdrawn: a.paper.withdrawn,
        extension: a.extension ? { date: a.extension.date, reason: a.extension.reason ?? "", at: label(a.extension.createdAt), status: a.extension.status } : null,
      });
    }
    return { papers, declined } satisfies ReviewerAssignments;
  },

  async loadReview(slug, paperLabel) {
    const found = (await this.listAssignments(slug)).papers.find((p) => p.id === paperLabel);
    if (!found) return null;
    const [assignment, setup, paper] = await Promise.all([
      api<AssignmentDto>(`/assignments/${found.assignmentId}`),
      api<FormDto>(`/assignments/${found.assignmentId}/review-form`),
      api<PaperDto>(`/submissions/${found.dbId}`),
    ]);
    const files: ReviewFile[] = paper.files.filter((f) => f.kind !== "supplementary").sort((a, b) => a.version - b.version)
      .map((f) => ({ name: f.fileName, uploadedAt: label(f.uploadedAt), storagePath: `${found.dbId}/${f.id}` }));
    const told = setup.decision;
    const mine = assignment.review;
    return {
      paper: found,
      form: sectionsFromStored(setup.form) ?? PEER_REVIEW_FORM,
      instructions: setup.instructions.text, instructionsMode: setup.instructions.mode,
      instructionsPdf: setup.instructions.pdf ? { name: setup.instructions.pdf.name, url: publicFileUrl(setup.instructions.pdf.path) } : null,
      values: (mine?.answers && typeof mine.answers === "object" ? mine.answers : {}) as ReviewValues,
      state: mine ? mine.status : "none",
      files,
      decision: told ? { label: told.label || DECISION_LABELS[told.outcome] || "Decision released", color: told.color || DECISION_COLORS[told.outcome] || "#64748B" } : null,
    } satisfies ReviewDetail;
  },

  async saveReview(assignmentId, _paperDbId, values, submit) {
    // A draft never takes a sent review back (the backend leaves it as it is); the decision locks the review ("This review can't be changed any more ...").
    const r = await api<{ firstSubmit: boolean }>(`/assignments/${assignmentId}/review`, { method: "PUT", body: { ...fieldsOf(values), submit } });
    return { firstSubmit: Boolean(r.firstSubmit) };
  },

  async respond(assignmentId, accept, reason) {
    await api(`/assignments/${assignmentId}/respond`, { method: "POST", body: { accept, reason: accept ? null : (reason ?? "").trim().slice(0, 1000) || null } });
  },

  async requestExtension(assignmentId, dateISO, reason) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) throw new ServiceError("Choose a date.");
    // The backend's own messages ("You already have a request waiting for the chair.", "Choose a date after the current deadline ...") are meant to be read as they are.
    await api(`/assignments/${assignmentId}/extension-request`, { method: "POST", body: { date: dateISO, reason: reason.trim().slice(0, 1000) || null } });
  },
};
