import { api, apiBlob, ApiError } from "@/lib/api-client";
import { extrasFromStored } from "@/types/author-submission";
import type { AuthorPaper, AuthorSubmission, ConferenceDetails, PaperFile, PaperResult, PaperScreeningNotice, PaperStatus, ScreeningRequest, PlagiarismReport } from "@/types/author-submission";
import type { AuthorSubmissionService } from "../author-submissions";
import { ServiceError } from "../errors";
import { isValidEmail } from "@/lib/email";

/* The author side through the own backend: Backend/src/modules/submissions (the paper, its authors and files), `GET /submissions/:id/reviews`
   (the comments the chair shared) and `GET /public/conferences/:slug[/submission-form]` (what the New Submission page shows). What an author
   is told comes from the backend's author view only: an unsent decision already reads as "no decision" there. A paper file's `storagePath` here
   is "<paperId>/<fileId>", which `fileUrl` turns into the download route. */

interface PaperFileDto { id: string; kind: string; version: number; fileName: string; sizeBytes: number | null; uploadedAt: string }
interface AuthorDto { name: string; email: string; affiliation: string | null; country: string | null; corresponding: boolean; hasAccount: boolean }
interface SubmissionDto {
  id: string; paperId: string; paperNo: number; conferenceId: string; conferenceSlug: string; conferenceAcronym: string; view: "chair" | "author" | "reviewer";
  title: string; abstract: string; keywords: string[]; track: string | null; presentationType: string | null; authors: AuthorDto[] | null;
  status: "draft" | "submitted" | "withdrawn"; outcome: string; decisionNote: string | null; screening: Record<string, FullScreening> | null; files: PaperFileDto[];
  withdrawnAt: string | null; withdrawnBy: string | null; submittedAt: string; updatedAt: string; mySubmission: boolean; myCorresponding: boolean;
  registration?: { payment: "not_paid" | "paid" | "waived"; attendance: "physical" | "virtual" | null; presenterName: string | null } | null;
}
interface FullScreening {
  check?: { decision?: string; passed?: boolean };
  correction?: { reasons?: unknown; note?: unknown; by?: unknown; deadline?: unknown };
  outcome?: { kind?: string; emailedAt?: unknown; reasons?: unknown; note?: unknown; by?: unknown; deadline?: unknown; shareReport?: unknown };
  report?: { similarity?: unknown; file?: unknown; files?: unknown; at?: unknown };
  paths?: Record<string, unknown>;
}
interface PublicConference { id?: string; status?: string; acronym: string; title: string; submissionDeadline?: string | null; cfpStatus?: string }
interface ConferenceDto { acronym: string; title: string; status: string; startDate: string | null; endDate: string | null; city: string | null; state: string | null; country: string | null; webPage: string | null; contactEmail: string | null }
interface FormDto { tracks: string[]; presentationTypes: string[]; extras: unknown[]; guidelines: string }
interface MeDto { email: string | null; firstName: string; lastName: string; affiliation: string | null; country: string | null }

const STAGES = ["upload_pending", "no_decision", "plagiarism_clear"];
const label = (ts: string | null) => (ts ? new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "");
const text = (v: unknown) => (typeof v === "string" ? v : "");
const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const notFound = (e: unknown) => e instanceof ApiError && (e.status === 403 || e.status === 404);

/** The most a paper file may weigh in this app (the backend's own limit, MAX_UPLOAD_MB, is checked again there) and the kinds it accepts. */
const MAX_FILE_BYTES = 26214400;
const FILE_EXT = new Set(["pdf", "doc", "docx"]);
const bad = () => new ServiceError("Couldn't save that. Please check the details and try again.");

function checkFile(file: File): void {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (!FILE_EXT.has(ext)) throw new ServiceError("Only PDF or Word files can be uploaded.");
  if (file.size === 0) throw new ServiceError("That file is empty.");
  if (file.size > MAX_FILE_BYTES) throw new ServiceError("That file is too large — the limit is 25 MB.");
}

/** What the author has been told: the backend's author view already hides a decision that was not sent. */
const told = (s: SubmissionDto): string | null => (STAGES.includes(s.outcome) ? null : s.outcome);

function resultOf(s: SubmissionDto): PaperResult {
  if (s.status === "draft") return "draft";
  switch (told(s)) {
    // Accepted: registered once the chair records the fee as paid or waived.
    case "accept": return s.registration?.payment === "paid" || s.registration?.payment === "waived" ? "registered" : "not_registered";
    case "registered": return "registered";
    case "reject": return "not_accepted";
    default: return "no_result"; // nothing sent, or a revision / waitlist (still "no result" to the author)
  }
}

function statusOf(s: SubmissionDto): PaperStatus {
  if (s.status === "draft") return "draft";
  const o = told(s) ?? s.outcome;
  if (o === "accept" || o === "registered") return "accepted";
  if (o === "reject") return "rejected";
  if (o === "plagiarism_clear" || !STAGES.includes(o)) return "under_review";
  return "submitted";
}

/** The newest version's open request (correction or revision), as a short note for the list. */
function screeningRequestOf(s: SubmissionDto, versions: number): ScreeningRequest | null {
  if (s.status === "withdrawn") return null;
  const r = s.screening?.[String(versions)] ?? {};
  const decision = r.check?.decision || (r.check?.passed ? "passed" : r.correction ? "revision" : "pending");
  if (r.correction && decision === "revision") return { kind: "correction", version: versions, deadline: text(r.correction.deadline) };
  if (r.outcome?.kind === "revision" && r.outcome.emailedAt !== null && r.outcome.emailedAt !== undefined) return { kind: "revision", version: versions, deadline: text(r.outcome.deadline) };
  return null;
}

/** The same request with what the author may read of it: what to fix, by when, and the similarity score only when the chair shared it. */
function noticeOf(s: SubmissionDto, versions: number): PaperScreeningNotice | null {
  if (s.status === "withdrawn") return null;
  const r = s.screening?.[String(versions)] ?? {};
  const decision = r.check?.decision || (r.check?.passed ? "passed" : r.correction ? "revision" : "pending");
  if (r.correction && decision === "revision") {
    return { kind: "correction", version: versions, deadline: text(r.correction.deadline), reasons: strings(r.correction.reasons), note: text(r.correction.note), by: text(r.correction.by) || "Conference Chair", similarity: null };
  }
  if (r.outcome?.kind === "revision" && r.outcome.emailedAt !== null && r.outcome.emailedAt !== undefined) {
    const files = Array.isArray(r.report?.files) ? r.report.files : [r.report?.file];
    // The report always goes to the author now (attached to the email and on this page), so its score does too.
    const shared = files.some(Boolean) && typeof r.report?.similarity === "number";
    // Only the similarity reason is the author's to read — the AI-writing reason keeps its wording but never quotes the score.
    const reasons = strings(r.outcome.reasons).map((x) => x.replace(/\s*\(\d+(\.\d+)?%, limit \d+%\)/, ""));
    return { kind: "revision", version: versions, deadline: text(r.outcome.deadline), reasons, note: text(r.outcome.note), by: text(r.outcome.by) || "Conference Chair", similarity: shared ? (r.report!.similarity as number) : null };
  }
  return null;
}

/** The plagiarism report of every version whose Plagiarism Check decision the author was told: cleared, or a revision / rejection that was
 *  emailed (the same rule the API uses to let the author open the file). Newest version first. */
function reportsOf(s: SubmissionDto): PlagiarismReport[] {
  const out: PlagiarismReport[] = [];
  for (const [key, r] of Object.entries(s.screening ?? {})) {
    const version = Number(key);
    if (!Number.isInteger(version) || !r) continue;
    const kind = r.outcome?.kind;
    const told = kind === "clear" || ((kind === "revision" || kind === "reject") && Boolean(r.outcome?.emailedAt));
    if (!told) continue;
    const names = Array.isArray(r.report?.files) ? r.report.files : [r.report?.file];
    const files: PaperFile[] = [];
    for (const name of names) {
      const path = typeof name === "string" ? r.paths?.[name] : undefined;
      if (typeof name === "string" && name && typeof path === "string" && path) files.push({ name, uploadedAt: text(r.report?.at), storagePath: path, type: "Plagiarism report" });
    }
    if (!files.length) continue;
    out.push({ version, decision: kind, similarity: typeof r.report?.similarity === "number" ? r.report.similarity : null, files });
  }
  return out.sort((a, b) => b.version - a.version);
}

const paperVersions = (s: SubmissionDto) => s.files.filter((f) => f.kind !== "supplementary").sort((a, b) => a.version - b.version);

function toListItem(s: SubmissionDto): AuthorSubmission {
  const t = told(s);
  return {
    id: s.paperId, dbId: s.id, conferenceId: s.conferenceSlug, title: s.title, keywords: s.keywords,
    authors: (s.authors ?? []).map((a) => ({ name: a.name, email: a.email, affiliation: a.affiliation ?? "", country: a.country ?? "", corresponding: a.corresponding })),
    submittedAt: s.status === "draft" ? null : label(s.submittedAt), lastUpdate: label(s.updatedAt),
    track: s.track || "General Track", presentationType: s.presentationType || "Paper Presentation",
    withdrawn: s.status === "withdrawn", mySubmission: s.mySubmission, myCorresponding: s.myCorresponding,
    result: resultOf(s), decision: t === "revise" || t === "waitlist" ? t : null, uploadPending: s.outcome === "upload_pending",
    screeningRequest: screeningRequestOf(s, paperVersions(s).length),
    registration: s.registration ? { payment: s.registration.payment, attendance: s.registration.attendance, presenterName: s.registration.presenterName } : null,
  };
}

const toFile = (paperId: string, f: PaperFileDto, type?: string): PaperFile => ({ name: f.fileName, uploadedAt: label(f.uploadedAt), storagePath: `${paperId}/${f.id}`, ...(type ? { type } : {}) });

async function toPaper(s: SubmissionDto): Promise<AuthorPaper> {
  const [conf, me, reviews] = await Promise.all([
    api<ConferenceDto>(`/conferences/${s.conferenceSlug}`),
    api<MeDto>("/me"),
    // The comments the chair shared (only once the decision was sent); a failure here must not hide the paper.
    api<{ authorReviews?: Array<{ commentsToAuthor: string | null; submittedAt: string | null }> }>(`/submissions/${s.id}/reviews`).catch(() => ({ authorReviews: [] })),
  ]);
  const myEmail = (me.email ?? "").toLowerCase();
  const t = told(s);
  const versions = paperVersions(s);
  const end = (conf.endDate ?? "").slice(0, 10) || "9999-12-31";
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const comments = (reviews.authorReviews ?? []).filter((r) => (r.commentsToAuthor ?? "").trim()).map((r, i) => ({ n: i + 1, text: r.commentsToAuthor as string, submittedAt: label(r.submittedAt) }));
  return {
    ...toListItem(s),
    authors: (s.authors ?? []).map((a) => ({
      name: a.name, email: a.email, affiliation: a.affiliation ?? "", country: a.country ?? "", corresponding: a.corresponding,
      isMe: myEmail !== "" && a.email.toLowerCase() === myEmail,
    })),
    myEmails: myEmail ? [myEmail] : [],
    status: statusOf(s),
    abstract: s.abstract, keywords: s.keywords,
    versions: versions.map((f) => toFile(s.id, f)),
    supporting: s.files.filter((f) => f.kind === "supplementary").map((f) => toFile(s.id, f, "Supplementary material")),
    decisionTold: t === "registered" ? "accept" : t === "accept" || t === "reject" || t === "revise" || t === "waitlist" ? t : null,
    decisionNote: t ? s.decisionNote ?? "" : "",
    comments,
    withdrawnAt: label(s.withdrawnAt || s.updatedAt),
    withdrawnBy: s.withdrawnBy === "chair" ? "chair" : "author",
    screeningNotice: noticeOf(s, versions.length),
    plagiarismReports: s.status === "withdrawn" ? [] : reportsOf(s),
    conference: { id: s.conferenceSlug, acronym: conf.acronym, name: conf.title, status: conf.status === "archived" || end < today ? "archived" : "active", startDate: (conf.startDate ?? "").slice(0, 10) || end, endDate: end },
  };
}

const implemented: AuthorSubmissionService = {
  async loadSubmitForm(slug, behalf = false) {
    let conf: PublicConference;
    try { conf = await api<PublicConference>(`/public/conferences/${encodeURIComponent(slug)}`, { auth: false }); } catch (e) { if (notFound(e)) return null; throw e; }
    const me = await api<MeDto>("/me");
    const base = { slug, acronym: conf.acronym, name: conf.title, me: { name: [me.firstName, me.lastName].filter(Boolean).join(" "), email: me.email ?? "", affiliation: me.affiliation ?? "", country: me.country ?? "" } };
    // An archived conference answers with a short notice only: the author's page says it is closed (a chair on an author's behalf still gets the form).
    if (conf.status === "archived" && !behalf) return { ...base, closed: true, deadline: "", guidelines: "", tracks: ["General Track"], presentationTypes: ["Paper Presentation"], extras: [] };
    const form = await api<FormDto>(`/public/conferences/${encodeURIComponent(slug)}/submission-form`, { auth: false });
    return {
      ...base,
      extras: extrasFromStored({ extras: form.extras }),
      // Closed while the CFP is not live, and once the deadline is over (the backend refuses a paper then too: better say so before the form is filled in).
      // A chair on an author's behalf is never held by the CFP or its deadline (the backend lets them through too).
      closed: !behalf && (conf.cfpStatus !== "published" || (Boolean(conf.submissionDeadline) && new Date(conf.submissionDeadline as string).getTime() < Date.now())), deadline: (conf.submissionDeadline ?? "").slice(0, 10), guidelines: form.guidelines,
      tracks: form.tracks.length ? form.tracks : ["General Track"],
      presentationTypes: form.presentationTypes.length ? form.presentationTypes : ["Paper Presentation", "Poster Presentation", "Workshop"],
    };
  },

  async checkDuplicate(slug, title) {
    if (!title.trim()) return { found: false, mine: false };
    try {
      const r = await api<{ found: boolean; mine: boolean }>(`/conferences/${encodeURIComponent(slug)}/submissions/duplicate-check`, { query: { title: title.trim() } });
      return { found: Boolean(r.found), mine: Boolean(r.mine) };
    } catch (e) {
      if (e instanceof ApiError) return { found: false, mine: false }; // the check is a courtesy: it never blocks the form
      throw e;
    }
  },

  async submitPaper(slug, paper) {
    const title = paper.title.trim(); const abstract = paper.abstract.trim();
    const authors = paper.authors.filter((a) => a.email.trim());
    if (!title || !abstract || title.length > 500 || !authors.length || authors.some((a) => !a.name.trim() || !isValidEmail(a.email.trim()))) throw bad();
    checkFile(paper.file);
    const created = await api<SubmissionDto>(`/conferences/${encodeURIComponent(slug)}/submissions`, {
      method: "POST",
      body: {
        title, abstract, keywords: paper.keywords.map((k) => k.trim()).filter(Boolean).slice(0, 20),
        authors: authors.map((a) => ({ name: a.name.trim(), email: a.email.trim(), affiliation: a.affiliation.trim() || null, country: a.country || null, corresponding: a.corresponding })),
        track: paper.track || "General Track", presentationType: paper.presentationType || "Paper Presentation", responses: paper.responses ?? {},
      },
    });
    // The paper and its file are two calls: when the file fails, the paper is already saved and the author can add the file from its page.
    try { await this.uploadFile(created.id, paper.file, "version", paper.autoCheck); } catch (e) {
      throw new ServiceError(`Your paper was saved as ${created.paperId}, but its file couldn't be uploaded (${e instanceof Error ? e.message : "unknown error"}). Open it from My Submissions and upload the file again.`);
    }
    return { dbId: created.id, label: created.paperId };
  },

  async uploadFile(paperDbId, file, as, autoCheck) {
    checkFile(file);
    const body = new FormData();
    body.append("file", file);
    if (as === "supporting") body.append("supplementary", "true");
    else if (autoCheck) body.append("autoCheck", JSON.stringify(autoCheck));
    await api(`/submissions/${paperDbId}/files`, { method: "POST", body });
  },

  async updateDetails(paperDbId, patch) {
    const title = patch.title.trim(); const abstract = patch.abstract.trim();
    const keywords = patch.keywords.map((k) => k.trim()).filter(Boolean);
    if (!title || !abstract || title.length > 500 || keywords.length > 20 || keywords.some((k) => k.length > 100)) throw bad();
    await api(`/submissions/${paperDbId}`, { method: "PATCH", body: { title, abstract, keywords } });
  },

  async saveAuthors(paperDbId, authors) {
    const list = authors.map((a) => ({ name: a.name.trim(), email: a.email.trim(), affiliation: a.affiliation.trim() || null, country: a.country.trim() || null, corresponding: Boolean(a.corresponding) }));
    if (!list.length || list.length > 50 || !list.some((a) => a.corresponding) || list.some((a) => !a.name || !isValidEmail(a.email))) throw bad();
    await api(`/submissions/${paperDbId}/authors`, { method: "PUT", body: { authors: list } });
  },

  async withdraw(paperDbId) { await api(`/submissions/${paperDbId}/withdraw`, { method: "POST" }); },

  async paperByLabel(labelText) {
    if (!/^([A-Za-z0-9]{1,40})-(\d{1,9})$/.test(labelText)) return null;
    try { return await toPaper(await api<SubmissionDto>(`/submissions/by-label/${encodeURIComponent(labelText)}`)); } catch (e) { if (notFound(e)) return null; throw e; }
  },

  /** `storagePath` is "<paperId>/<fileId>" for a paper file, or a plagiarism report's stored path ("conferences/…/plagiarism/report-….pdf").
   *  The routes need the Bearer header, so the bytes are fetched and handed over as a temporary address. */
  async fileUrl(storagePath, downloadAs) {
    let blob: Blob;
    if (storagePath.startsWith("conferences/")) {
      blob = await apiBlob("/files", { query: { path: storagePath } });
    } else {
      const [paperId, fileId] = storagePath.split("/");
      if (!paperId || !fileId) throw new ServiceError("We couldn't open this file.");
      blob = await apiBlob(`/submissions/${paperId}/files/${fileId}`);
    }
    // A download is typed as plain bytes so that the browser saves it instead of showing it.
    const url = URL.createObjectURL(downloadAs ? new Blob([blob], { type: "application/octet-stream" }) : blob);
    setTimeout(() => URL.revokeObjectURL(url), 10 * 60 * 1000);
    return url;
  },

  async conferenceDetails(slug) {
    try {
      const c = await api<ConferenceDto>(`/conferences/${slug}`);
      return { acronym: c.acronym, name: c.title, city: c.city ?? "", state: c.state ?? "", country: c.country ?? "", webPage: c.webPage ?? "", contactEmail: c.contactEmail ?? "" } satisfies ConferenceDetails;
    } catch (e) {
      if (notFound(e)) return null;
      throw e;
    }
  },

  async listForConference(slug) {
    try {
      const all = await api<SubmissionDto[]>(`/conferences/${encodeURIComponent(slug)}/submissions`);
      // The list also holds papers given to the person to review: only their own are listed here.
      return all.filter((s) => s.view === "author" || s.mySubmission).sort((a, b) => a.paperNo - b.paperNo).map(toListItem);
    } catch (e) { if (notFound(e)) return []; throw e; }
  },
};

export const apiAuthorSubmissionService: AuthorSubmissionService = implemented;
