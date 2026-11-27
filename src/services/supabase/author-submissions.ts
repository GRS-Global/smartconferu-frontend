import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import { ServiceError } from "../errors";
import { extrasFromStored } from "@/types/author-submission";
import type { AuthorPaper, AuthorSubmission, ConferenceDetails, PaperAuthor, PaperFile, PaperResult, PaperScreeningNotice, PaperStatus, ScreeningRequest } from "@/types/author-submission";
import type { AuthorSubmissionService } from "../author-submissions";
import { currentUser, fail, paperPrefix } from "./shared";
import { isValidEmail } from "@/lib/email";

/* The signed-in author's papers in one conference, read as the prototype does (src/data/workspace.js › loadWorkspace and
   submissionRow, author view) with the anon key and the user's session. Row Level Security decides which rows come back;
   every query also names the user. What an author is told comes from `notified_outcome` only — the chair's own `outcome`
   is never read for the result — so a decision that has not been sent can never show early. */

type Outcome = "upload_pending" | "no_decision" | "plagiarism_clear" | "revise" | "waitlist" | "accept" | "registered" | "reject";
interface SubmissionRow {
  id: string;
  paper_no: number;
  title: string;
  keywords?: string[] | null;
  status: "draft" | "submitted" | "withdrawn";
  outcome: Outcome | null;
  notified_outcome: Outcome | null;
  submitter_id: string | null;
  submitted_at: string | null;
  updated_at: string | null;
  details: { track?: string; presentationType?: string; fileName?: string } | null;
  // The chair's screening record per uploaded version, keyed "1", "2", …
  screening: Record<string, ScreeningRecord> | null;
}
interface ScreeningRecord {
  check?: { decision?: string; passed?: boolean };
  correction?: { deadline?: unknown };
  outcome?: { kind?: string; emailedAt?: unknown; deadline?: unknown };
}
interface AuthorRow { submission_id: string; name: string; email: string | null; affiliation: string | null; country: string | null; is_corresponding: boolean | null; user_id: string | null }
interface FileRow { submission_id: string; kind: string | null }

const label = (ts: string | null) => (ts ? new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "");
const inList = (ids: string[]) => (ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

async function rows<T>(query: PromiseLike<{ data: unknown; error: { message?: string } | null }>, what: string): Promise<T[]> {
  const { data, error } = await query;
  if (error) fail(error, what);
  return (data ?? []) as T[];
}

/** What the author has been told: the prototype's `paperResultFor` over the author view of the row. */
function resultOf(s: SubmissionRow): PaperResult {
  if (s.status === "draft") return "draft";
  switch (s.notified_outcome) {
    case "accept": return "not_registered";
    case "registered": return "registered";
    case "reject": return "not_accepted";
    default: return "no_result"; // nothing sent, or a revision / waitlist (still "no result" to the author)
  }
}

/** The prototype's `screeningRequestOf`, on the newest uploaded version only: an open correction, or a revision the chair has emailed. */
function screeningRequestOf(s: SubmissionRow, versions: number): ScreeningRequest | null {
  if (s.status === "withdrawn") return null;
  const record = s.screening?.[String(versions)] ?? {};
  const decision = record.check?.decision || (record.check?.passed ? "passed" : record.correction ? "revision" : "pending");
  const due = (v: unknown) => (typeof v === "string" ? v : "");
  if (record.correction && decision === "revision") return { kind: "correction", version: versions, deadline: due(record.correction.deadline) };
  if (record.outcome?.kind === "revision" && record.outcome.emailedAt !== null) return { kind: "revision", version: versions, deadline: due(record.outcome.deadline) };
  return null;
}

/* ---- one paper's own page ---- */

const PAPERS_BUCKET = "papers";

// Which status of the author's views each decision outcome words (Settings › Decision › "Author sees").
const LABEL_KEY: Record<string, string> = { upload_pending: "draft", no_decision: "waiting", plagiarism_clear: "waiting", revise: "revise", waitlist: "waitlisted", accept: "pending", registered: "registered", reject: "rejected" };
/** The chair's own wording of the statuses for a conference ("Author sees"; migration 0039): {} when none is set or the column is not there yet. */
async function statusLabelsOf(db: SupabaseClient, conferenceId: string): Promise<Record<string, string>> {
  const { data, error } = await db.from("decision_types").select("outcome, author_label").eq("conference_id", conferenceId).order("position");
  if (error) return {};
  const out: Record<string, string> = {};
  for (const r of (data ?? []) as Array<{ outcome: string; author_label: string | null }>) {
    const label = (r.author_label ?? "").trim(); const key = LABEL_KEY[r.outcome];
    if (label && key && !out[key]) out[key] = label;
  }
  return out;
}
const STAGES: Outcome[] = ["upload_pending", "no_decision", "plagiarism_clear"];
const text = (v: unknown) => (typeof v === "string" ? v : "");

interface PaperRow extends SubmissionRow {
  conference_id: string;
  abstract: string | null;
  keywords: string[] | null;
  notified_note: string | null;
  withdrawn_at: string | null;
  withdrawn_by: string | null;
}
interface FullScreening {
  check?: { decision?: string; passed?: boolean };
  correction?: { reasons?: unknown; note?: unknown; by?: unknown; deadline?: unknown };
  outcome?: { kind?: string; emailedAt?: unknown; reasons?: unknown; note?: unknown; by?: unknown; deadline?: unknown; shareReport?: unknown };
  report?: { similarity?: unknown; file?: unknown; files?: unknown };
}

/** What the author is told about where the paper stands (the prototype's author view of a row: only what was sent counts). */
function statusOf(s: PaperRow): PaperStatus {
  if (s.status === "draft") return "draft";
  const told = s.notified_outcome;
  const o: Outcome = told ?? (s.outcome && STAGES.includes(s.outcome) ? s.outcome : "no_decision");
  if (o === "accept" || o === "registered") return "accepted";
  if (o === "reject") return "rejected";
  if (o === "plagiarism_clear" || (o && !STAGES.includes(o))) return "under_review";
  return "submitted";
}

/** The newest version's open request as the author may read it: what to fix, by when, and the similarity score only when shared. */
function noticeOf(s: PaperRow, versions: number): PaperScreeningNotice | null {
  if (s.status === "withdrawn") return null;
  const r = ((s.screening ?? {}) as Record<string, FullScreening>)[String(versions)] ?? {};
  const decision = r.check?.decision || (r.check?.passed ? "passed" : r.correction ? "revision" : "pending");
  const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  if (r.correction && decision === "revision") {
    return { kind: "correction", version: versions, deadline: text(r.correction.deadline), reasons: strings(r.correction.reasons), note: text(r.correction.note), by: text(r.correction.by) || "Conference Chair", similarity: null };
  }
  if (r.outcome?.kind === "revision" && r.outcome.emailedAt !== null) {
    const files = Array.isArray(r.report?.files) ? r.report.files : [r.report?.file];
    const shared = Boolean(r.outcome.shareReport) && files.some(Boolean) && typeof r.report?.similarity === "number";
    // Only the similarity reason is the author's to read — the AI-writing reason keeps its wording but never quotes the score.
    const reasons = strings(r.outcome.reasons).map((x) => x.replace(/\s*\(\d+(\.\d+)?%, limit \d+%\)/, ""));
    return { kind: "revision", version: versions, deadline: text(r.outcome.deadline), reasons, note: text(r.outcome.note), by: text(r.outcome.by) || "Conference Chair", similarity: shared ? (r.report!.similarity as number) : null };
  }
  return null;
}

/** The most a paper file may weigh (the storage bucket's own limit) and the kinds it accepts. */
export const MAX_FILE_BYTES = 26214400;
const FILE_TYPES: Record<string, string> = { pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bad = () => new ServiceError("Couldn't save that. Please check the details and try again.");

export const supabaseAuthorSubmissionService: AuthorSubmissionService = {
  async loadSubmitForm(conferenceSlug) {
    const db: SupabaseClient = getSupabase();
    const user = await currentUser(db);
    const conf = await rows<{ id: string; acronym: string; title: string; status: string; submission_deadline: string | null; settings: { submissionPolicy?: { guidelines?: string } } | null }>(db.from("conferences").select("id, acronym, title, status, submission_deadline, settings").eq("slug", conferenceSlug).limit(1), "read this conference");
    if (!conf[0]) return null;
    const [tracks, me] = await Promise.all([
      rows<{ name: string }>(db.from("tracks").select("name").eq("conference_id", conf[0].id), "read the tracks"),
      rows<{ email: string | null; first_name: string | null; last_name: string | null; affiliation: string | null; country: string | null }>(db.from("profiles").select("email, first_name, last_name, affiliation, country").eq("id", user.id).limit(1), "read your profile"),
    ]);
    const p = me[0];
    // The chair’s submission types (migration 0028); until it is run, or when none were chosen, the standard three.
    const cs = await db.from("conference_settings").select("presentation_types").eq("conference_id", conf[0].id).maybeSingle();
    const types = !cs.error ? (cs.data as { presentation_types: string[] } | null)?.presentation_types : null;
    const fm = await db.from("conference_forms").select("schema").eq("conference_id", conf[0].id).eq("kind", "submission").maybeSingle();
    const extras = !fm.error ? extrasFromStored((fm.data as { schema: unknown } | null)?.schema) : [];
    return {
      extras,
      slug: conferenceSlug, acronym: conf[0].acronym, name: conf[0].title, closed: conf[0].status !== "active", deadline: (conf[0].submission_deadline ?? "").slice(0, 10), guidelines: conf[0].settings?.submissionPolicy?.guidelines ?? "",
      tracks: tracks.length ? tracks.map((t) => t.name) : ["General Track"],
      presentationTypes: types?.length ? types : ["Paper Presentation", "Poster Presentation", "Workshop"],
      me: { name: [p?.first_name, p?.last_name].filter(Boolean).join(" "), email: p?.email || user.email || "", affiliation: p?.affiliation || "", country: p?.country || "" },
    };
  },

  async checkDuplicate(conferenceSlug, title) {
    if (!title.trim()) return { found: false, mine: false };
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    const conf = await rows<{ id: string }>(db.from("conferences").select("id").eq("slug", conferenceSlug).limit(1), "read this conference");
    if (!conf[0]) return { found: false, mine: false };
    // The database can see every paper of the conference (an author cannot), so it answers.
    const { data, error } = await db.rpc("check_duplicate_submission", { p_conference: conf[0].id, p_title: title });
    if (error) return { found: false, mine: false };
    const row = Array.isArray(data) ? data[0] : data;
    return { found: Boolean(row?.found), mine: Boolean(row?.mine) };
  },

  async submitPaper(conferenceSlug, paper) {
    const title = paper.title.trim(); const abstract = paper.abstract.trim();
    const authors = paper.authors.filter((a) => a.email.trim());
    if (!title || !abstract || title.length > 500 || abstract.length > 20000 || !authors.length || authors.some((a) => !a.name.trim() || !isValidEmail(a.email.trim()))) throw bad();
    const ext = (paper.file.name.split(".").pop() || "").toLowerCase();
    if (!FILE_TYPES[ext]) throw new ServiceError("Only PDF or Word files can be uploaded.");
    if (paper.file.size === 0) throw new ServiceError("That file is empty.");
    if (paper.file.size > MAX_FILE_BYTES) throw new ServiceError("That file is too large — the limit is 25 MB.");
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    const conf = await rows<{ id: string; acronym: string }>(db.from("conferences").select("id, acronym").eq("slug", conferenceSlug).limit(1), "read this conference");
    if (!conf[0]) throw new ServiceError("We couldn't find that conference.");
    const keywords = paper.keywords.map((k) => k.trim()).filter(Boolean).slice(0, 30);
    const { data, error } = await db.from("submissions").insert({
      conference_id: conf[0].id, title, abstract, keywords,
      details: { track: paper.track || "General Track", presentationType: paper.presentationType || "Paper Presentation", responses: paper.responses ?? {}, fileName: paper.file.name },
    }).select("id, paper_no").single();
    if (error) { if (/permission|row-level/i.test(error.message)) throw new ServiceError("Submissions to this conference are closed (or it isn't open yet)."); fail(error, "submit to this conference"); }
    const sub = data as { id: string; paper_no: number };
    const { error: authorsError } = await db.from("submission_authors").insert(authors.map((a, i) => ({ submission_id: sub.id, position: i, name: a.name.trim(), email: a.email.trim(), affiliation: a.affiliation.trim() || null, country: a.country || null, is_corresponding: a.corresponding })));
    if (authorsError) fail(authorsError, "add the authors");
    const safe = paper.file.name.replace(/[^A-Za-z0-9._-]+/g, "_");
    const path = `${conf[0].id}/${sub.id}/${Date.now().toString(36)}-${safe}`;
    const { error: putError } = await db.storage.from(PAPERS_BUCKET).upload(path, paper.file, { contentType: paper.file.type || FILE_TYPES[ext], upsert: false });
    if (putError) { if (/mime|type/i.test(putError.message)) throw new ServiceError("Only PDF or Word files can be uploaded."); if (/size|large/i.test(putError.message)) throw new ServiceError("That file is too large — the limit is 25 MB."); fail(putError, "upload this file"); }
    const { error: fileError } = await db.from("submission_files").insert({ submission_id: sub.id, kind: "paper", version: 1, storage_path: path, file_name: paper.file.name, size_bytes: paper.file.size, auto_check: paper.autoCheck ?? null });
    if (fileError) fail(fileError, "save the file");
    return { dbId: sub.id, label: `${paperPrefix(conf[0].acronym)}-${sub.paper_no}` };
  },

  async uploadFile(paperDbId, file, as, autoCheck) {
    if (!UUID.test(paperDbId)) throw bad();
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    if (!FILE_TYPES[ext]) throw new ServiceError("Only PDF or Word files can be uploaded.");
    if (file.size === 0) throw new ServiceError("That file is empty.");
    if (file.size > MAX_FILE_BYTES) throw new ServiceError("That file is too large — the limit is 25 MB.");
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    // The conference's id is the first folder of the file's path; the number of versions decides the new version's number.
    const sub = await rows<{ conference_id: string }>(db.from("submissions").select("conference_id").eq("id", paperDbId).limit(1), "read your paper");
    if (!sub[0]) throw new ServiceError("We couldn't find that paper.");
    const existing = await rows<{ kind: string | null }>(db.from("submission_files").select("kind").eq("submission_id", paperDbId), "read the paper's files");
    const versions = existing.filter((f) => f.kind !== "supplementary").length;
    const safe = file.name.replace(/[^A-Za-z0-9._-]+/g, "_");
    const path = `${sub[0].conference_id}/${paperDbId}/${Date.now().toString(36)}-${safe}`;
    // Row Level Security on the bucket and on submission_files lets only an author of the paper add files to it.
    const { error: putError } = await db.storage.from(PAPERS_BUCKET).upload(path, file, { contentType: file.type || FILE_TYPES[ext], upsert: false });
    if (putError) {
      if (/mime|type/i.test(putError.message)) throw new ServiceError("Only PDF or Word files can be uploaded.");
      if (/size|large/i.test(putError.message)) throw new ServiceError("That file is too large — the limit is 25 MB.");
      fail(putError, "upload this file");
    }
    // "revision" is what the prototype records for a version added after the first (the database moves the paper back to the initial check).
    const { error } = await db.from("submission_files").insert({
      submission_id: paperDbId, kind: as === "supporting" ? "supplementary" : "revision", version: as === "supporting" ? 1 : versions + 1,
      storage_path: path, file_name: file.name, size_bytes: file.size, auto_check: as === "supporting" ? null : autoCheck ?? null,
    });
    if (error) fail(error, "save the file");
  },

  async updateDetails(paperDbId, patch) {
    const title = patch.title.trim();
    const abstract = patch.abstract.trim();
    const keywords = patch.keywords.map((k) => k.trim()).filter(Boolean);
    if (!UUID.test(paperDbId) || !title || !abstract || title.length > 500 || abstract.length > 20000 || keywords.length > 30 || keywords.some((k) => k.length > 100)) throw bad();
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    // update_paper_details (migration 0022) checks who may change the paper and refuses once a decision is recorded.
    const { error } = await db.rpc("update_paper_details", { p_submission: paperDbId, p_title: title, p_abstract: abstract, p_keywords: keywords });
    if (error) fail(error, "change this paper");
  },

  async saveAuthors(paperDbId, authors) {
    const list = authors.map((a) => ({ name: a.name.trim(), email: a.email.trim(), affiliation: a.affiliation.trim(), country: a.country.trim(), corresponding: Boolean(a.corresponding) }));
    if (!UUID.test(paperDbId) || !list.length || list.length > 50 || !list.some((a) => a.corresponding)
      || list.some((a) => !a.name || a.name.length > 200 || !isValidEmail(a.email) || a.email.length > 254 || a.affiliation.length > 300 || a.country.length > 100)) throw bad();
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    // save_paper_authors (0022): the submitter replaces the list; authors whose email stays are kept as they are.
    const { error } = await db.rpc("save_paper_authors", { p_submission: paperDbId, p_authors: list });
    if (error) fail(error, "change the authors of this paper");
  },

  async withdraw(paperDbId) {
    if (!UUID.test(paperDbId)) throw bad();
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    const { error } = await db.rpc("withdraw_submission", { p_submission: paperDbId });
    if (error) fail(error, "withdraw this paper");
  },

  async paperByLabel(labelText) {
    const m = /^([A-Za-z0-9]{1,40})-(\d{1,9})$/.exec(labelText);
    if (!m) return null;
    const db: SupabaseClient = getSupabase();
    const user = await currentUser(db);
    const me = user.id;
    await db.rpc("claim_my_papers").then(() => null, () => null);
    const [links, mine] = await Promise.all([
      rows<{ submission_id: string }>(db.from("submission_authors").select("submission_id").eq("user_id", me), "read your papers"),
      rows<{ id: string }>(db.from("submissions").select("id").eq("submitter_id", me), "read your papers"),
    ]);
    const ids = [...new Set([...links.map((l) => l.submission_id), ...mine.map((x) => x.id)])];
    if (!ids.length) return null;
    const subs = await rows<PaperRow>(
      db.from("submissions")
        .select("id, conference_id, paper_no, title, abstract, keywords, status, outcome, notified_outcome, notified_note, submitter_id, submitted_at, updated_at, withdrawn_at, withdrawn_by, details, screening")
        .in("id", ids).eq("paper_no", Number(m[2])),
      "read your papers",
    );
    const confs = subs.length
      ? await rows<{ id: string; slug: string; acronym: string; title: string; status: string; start_date: string | null; end_date: string | null }>(
        db.from("conferences").select("id, slug, acronym, title, status, start_date, end_date").in("id", inList(subs.map((x) => x.conference_id))), "read this conference")
      : [];
    // The label is the conference's prefix plus the paper number; two conferences can share a number, so the prefix decides.
    const s = subs.find((x) => { const c = confs.find((k) => k.id === x.conference_id); return c && paperPrefix(c.acronym) === m[1].toUpperCase(); });
    const conf = s && confs.find((k) => k.id === s.conference_id);
    if (!s || !conf) return null;

    const [authors, files, shared] = await Promise.all([
      rows<AuthorRow>(db.from("submission_authors").select("submission_id, name, email, affiliation, country, is_corresponding, user_id").eq("submission_id", s.id).order("position"), "read the authors"),
      rows<{ submission_id: string; kind: string | null; file_name: string; uploaded_at: string | null; storage_path: string | null }>(
        db.from("submission_files").select("submission_id, kind, file_name, uploaded_at, storage_path").eq("submission_id", s.id).order("uploaded_at"), "read the files"),
      rows<{ reviewer_no: number; comments_to_author: string | null; submitted_at: string | null }>(
        db.from("author_reviews").select("reviewer_no, comments_to_author, submitted_at").eq("submission_id", s.id).order("reviewer_no"), "read the comments"),
    ]);

    const toFile = (f: (typeof files)[number], type?: string): PaperFile => ({ name: f.file_name, uploadedAt: label(f.uploaded_at), storagePath: f.storage_path, ...(type ? { type } : {}) });
    const paperFiles = files.filter((f) => f.kind !== "supplementary");
    // A paper with a recorded file name but no file rows has one version (the prototype's default).
    const versions: PaperFile[] = paperFiles.length ? paperFiles.map((f) => toFile(f)) : s.details?.fileName ? [{ name: s.details.fileName, uploadedAt: label(s.submitted_at), storagePath: null }] : [];
    const told = s.notified_outcome;
    const myEmail = (user.email ?? "").toLowerCase();
    const end = (conf.end_date ?? "").slice(0, 10) || "9999-12-31";
    const today = new Date();
    const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const comments = shared.filter((r) => (r.comments_to_author ?? "").trim()).map((r, i) => ({ n: i + 1, text: r.comments_to_author as string, submittedAt: label(r.submitted_at) }));

    const statusLabels = await statusLabelsOf(db, conf.id);
    const out: AuthorPaper = {
      statusLabels,
      id: `${paperPrefix(conf.acronym)}-${s.paper_no}`,
      dbId: s.id,
      conferenceId: conf.slug,
      title: s.title,
      myEmails: myEmail ? [myEmail] : [],
      authors: authors.map((a) => ({
        name: a.name, email: a.email ?? "", affiliation: a.affiliation ?? "", country: a.country ?? "", corresponding: Boolean(a.is_corresponding),
        isMe: a.user_id === me || (myEmail !== "" && (a.email ?? "").toLowerCase() === myEmail),
      })),
      submittedAt: s.status === "draft" ? null : label(s.submitted_at),
      lastUpdate: label(s.updated_at),
      track: s.details?.track || "General Track",
      presentationType: s.details?.presentationType || "Paper Presentation",
      withdrawn: s.status === "withdrawn",
      mySubmission: s.submitter_id === me,
      myCorresponding: s.submitter_id === me || authors.some((a) => a.user_id === me && a.is_corresponding),
      result: resultOf(s),
      decision: told === "revise" || told === "waitlist" ? told : null,
      uploadPending: !told && s.outcome === "upload_pending",
      status: statusOf(s),
      abstract: s.abstract ?? "",
      keywords: s.keywords ?? [],
      versions,
      supporting: files.filter((f) => f.kind === "supplementary").map((f) => toFile(f, "Supplementary material")),
      decisionTold: told === "registered" ? "accept" : told === "accept" || told === "reject" || told === "revise" || told === "waitlist" ? told : null,
      decisionNote: told ? s.notified_note ?? "" : "",
      comments,
      withdrawnAt: label(s.withdrawn_at || s.updated_at),
      withdrawnBy: s.withdrawn_by === "chair" ? "chair" : "author",
      screeningNotice: noticeOf(s, versions.length),
      conference: { id: conf.slug, acronym: conf.acronym, name: conf.title, status: conf.status === "archived" || end < todayIso ? "archived" : "active", startDate: (conf.start_date ?? "").slice(0, 10) || end, endDate: end },
    };
    return out;
  },

  async fileUrl(storagePath, downloadAs) {
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    // Row Level Security on the storage bucket decides who may sign a link for which path.
    const { data, error } = await db.storage.from(PAPERS_BUCKET).createSignedUrl(storagePath, 600, downloadAs ? { download: downloadAs } : undefined);
    if (error || !data) fail(error, "open this file");
    return data.signedUrl;
  },

  async conferenceDetails(conferenceSlug) {
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    const r = await rows<{ acronym: string; title: string; city: string | null; state: string | null; country: string | null; web_page: string | null; contact_email: string | null }>(
      db.from("conferences").select("acronym, title, city, state, country, web_page, contact_email").eq("slug", conferenceSlug).limit(1),
      "read this conference",
    );
    if (!r[0]) return null;
    const out: ConferenceDetails = { acronym: r[0].acronym, name: r[0].title, city: r[0].city ?? "", state: r[0].state ?? "", country: r[0].country ?? "", webPage: r[0].web_page ?? "", contactEmail: r[0].contact_email ?? "" };
    return out;
  },

  async listForConference(conferenceSlug) {
    const db: SupabaseClient = getSupabase();
    const me = (await currentUser(db)).id;
    // Links papers that list this account's email but aren't linked yet (a co-author added before they registered).
    // Existing RPC the prototype and the dashboard call on load; skipped quietly if it isn't installed.
    await db.rpc("claim_my_papers").then(() => null, () => null);

    const conf = await rows<{ id: string; acronym: string }>(db.from("conferences").select("id, acronym").eq("slug", conferenceSlug).limit(1), "read this conference");
    if (!conf[0]) return [];
    const [links, mine] = await Promise.all([
      rows<{ submission_id: string }>(db.from("submission_authors").select("submission_id").eq("user_id", me), "read your papers"),
      rows<{ id: string }>(db.from("submissions").select("id").eq("submitter_id", me).eq("conference_id", conf[0].id), "read your papers"),
    ]);
    const ids = [...new Set([...links.map((l) => l.submission_id), ...mine.map((m) => m.id)])];
    if (!ids.length) return [];

    const subs = await rows<SubmissionRow>(
      db.from("submissions")
        .select("id, paper_no, title, keywords, status, outcome, notified_outcome, submitter_id, submitted_at, updated_at, details, screening")
        .in("id", ids).eq("conference_id", conf[0].id).order("paper_no"),
      "read your papers",
    );
    const subIds = subs.map((s) => s.id);
    const statusLabels = await statusLabelsOf(db, conf[0].id);
    const [authors, files] = await Promise.all([
      rows<AuthorRow>(db.from("submission_authors").select("submission_id, name, email, affiliation, country, is_corresponding, user_id").in("submission_id", inList(subIds)).order("position"), "read the authors"),
      rows<FileRow>(db.from("submission_files").select("submission_id, kind").in("submission_id", inList(subIds)), "read the files"),
    ]);

    return subs.map((s): AuthorSubmission => {
      const list: PaperAuthor[] = authors.filter((a) => a.submission_id === s.id).map((a) => ({
        name: a.name, email: a.email ?? "", affiliation: a.affiliation ?? "", country: a.country ?? "", corresponding: Boolean(a.is_corresponding),
      }));
      const mineAuthor = authors.some((a) => a.submission_id === s.id && a.user_id === me && a.is_corresponding);
      // Uploaded versions of the paper (supplementary files are not versions); a paper with a recorded file name but no file rows has one.
      const versions = files.filter((f) => f.submission_id === s.id && f.kind !== "supplementary").length || (s.details?.fileName ? 1 : 0);
      const told = s.notified_outcome;
      return {
        statusLabels,
        id: `${paperPrefix(conf[0].acronym)}-${s.paper_no}`,
        dbId: s.id,
        conferenceId: conferenceSlug,
        title: s.title,
        keywords: s.keywords ?? [],
        authors: list,
        submittedAt: s.status === "draft" ? null : label(s.submitted_at),
        lastUpdate: label(s.updated_at),
        track: s.details?.track || "General Track",
        presentationType: s.details?.presentationType || "Paper Presentation",
        withdrawn: s.status === "withdrawn",
        mySubmission: s.submitter_id === me,
        myCorresponding: s.submitter_id === me || mineAuthor,
        result: resultOf(s),
        decision: told === "revise" || told === "waitlist" ? told : null,
        uploadPending: !told && s.outcome === "upload_pending",
        screeningRequest: screeningRequestOf(s, versions),
      };
    });
  },
};
