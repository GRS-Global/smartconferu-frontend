import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import type { PaperCandidate, ProposalConference, Publication, Receipt, WatchedCfp } from "@/types/account";
import type { AccountExtrasService } from "../account-extras";
import { ServiceError } from "../errors";
import { currentUser, fail, paperPrefix } from "./shared";

/* The account pages (migration 0050): receipts, the CFP watchlist, preprints / slides and publishing proposals are the person's own rows. Papers come
   from the submissions they sent or are listed on; Calls for Papers and conferences are public to read (published CFPs, active conferences). Until
   0050 is run the lists simply read as empty, and saving says so. */

const inList = (ids: string[]) => (ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
const isoDay = (ts: string | null) => (ts ? ts.slice(0, 10) : "");
const missing = (m?: string) => /does not exist|schema cache/i.test(m ?? "");
const NEEDS_MIGRATION = "This isn't set up on the database yet — ask the owner to run migration 0050.";

async function rows<T>(query: PromiseLike<{ data: unknown; error: { message?: string } | null }>, what: string, tolerateMissing = false): Promise<T[]> {
  const { data, error } = await query;
  if (error) { if (tolerateMissing && missing(error.message)) return []; fail(error, what); }
  return (data ?? []) as T[];
}

type ConfRow = { id: string; slug: string; acronym: string; title: string; country: string | null; end_date: string | null; submission_deadline: string | null; details: { topics?: unknown } | null };
const CONF_COLUMNS = "id, slug, acronym, title, country, end_date, submission_deadline, details";
const topicsOf = (c: ConfRow) => (Array.isArray(c.details?.topics) ? (c.details?.topics as unknown[]).filter((t): t is string => typeof t === "string") : []);
const watched = (c: ConfRow, page = ""): WatchedCfp => ({ cfpPage: page, slug: c.slug, acronym: c.acronym, name: c.title, country: c.country ?? "", submissionDeadline: isoDay(c.submission_deadline), endDate: isoDay(c.end_date), topics: topicsOf(c) });
const dateLabel = (ts: string | null) => (ts ? new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "");

export const supabaseAccountExtrasService: AccountExtrasService = {
  async receipts() {
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    const r = await rows<{ id: number; description: string; amount: number; paid_on: string }>(db.from("user_receipts").select("id, description, amount, paid_on").order("paid_on", { ascending: false }), "read your receipts", true);
    return r.map((x) => ({ id: x.id, description: x.description, amount: Number(x.amount), date: x.paid_on } satisfies Receipt));
  },
  async deleteReceipt(id) {
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    const { error } = await db.from("user_receipts").delete().eq("id", id);
    if (error) fail(error, "delete this receipt");
  },

  async watchlist() {
    const db: SupabaseClient = getSupabase();
    const me = (await currentUser(db)).id;
    const links = await rows<{ conference_id: string }>(db.from("cfp_watchlist").select("conference_id").eq("user_id", me), "read your watchlist", true);
    if (!links.length) return [];
    const ids = links.map((l) => l.conference_id);
    const [confs, pages] = await Promise.all([
      rows<ConfRow>(db.from("conferences").select(CONF_COLUMNS).in("id", inList(ids)), "read your watchlist"),
      rows<{ conference_id: string; content: { publicSlug?: string } | null }>(db.from("cfps").select("conference_id, content").in("conference_id", inList(ids)).in("status", ["published", "closed"]), "read your watchlist"),
    ]);
    return confs.map((c) => watched(c, pages.find((p) => p.conference_id === c.id)?.content?.publicSlug ?? ""));
  },
  async searchCfps(text, exclude) {
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    const q = text.trim().replace(/[%,()]/g, " ").trim();
    if (!q) return [];
    const open = await rows<{ conference_id: string; content: { publicSlug?: string } | null }>(db.from("cfps").select("conference_id, content").in("status", ["published", "closed"]), "search the Calls for Papers");
    if (!open.length) return [];
    const confs = await rows<ConfRow>(db.from("conferences").select(CONF_COLUMNS).in("id", inList(open.map((o) => o.conference_id))).or(`acronym.ilike.%${q}%,title.ilike.%${q}%`).limit(24), "search the Calls for Papers");
    return confs.filter((c) => !exclude.includes(c.slug)).slice(0, 6).map((c) => watched(c, open.find((o) => o.conference_id === c.id)?.content?.publicSlug ?? ""));
  },
  async addToWatchlist(slug) {
    const db: SupabaseClient = getSupabase();
    const me = (await currentUser(db)).id;
    const c = await rows<{ id: string }>(db.from("conferences").select("id").eq("slug", slug).limit(1), "add this to your watchlist");
    if (!c[0]) throw new ServiceError("We couldn't find that conference.");
    const { error } = await db.from("cfp_watchlist").upsert({ user_id: me, conference_id: c[0].id }, { onConflict: "user_id,conference_id", ignoreDuplicates: true });
    if (error) { if (missing(error.message)) throw new ServiceError(NEEDS_MIGRATION); fail(error, "add this to your watchlist"); }
  },
  async removeFromWatchlist(slugs) {
    const db: SupabaseClient = getSupabase();
    const me = (await currentUser(db)).id;
    const c = await rows<{ id: string }>(db.from("conferences").select("id").in("slug", slugs.length ? slugs : [""]), "update your watchlist");
    const { error } = await db.from("cfp_watchlist").delete().eq("user_id", me).in("conference_id", inList(c.map((x) => x.id)));
    if (error) fail(error, "update your watchlist");
  },

  async myPapers() {
    const db: SupabaseClient = getSupabase();
    const me = (await currentUser(db)).id;
    const [links, mine] = await Promise.all([
      rows<{ submission_id: string }>(db.from("submission_authors").select("submission_id").eq("user_id", me), "read your papers"),
      rows<{ id: string }>(db.from("submissions").select("id").eq("submitter_id", me), "read your papers"),
    ]);
    const ids = [...new Set([...links.map((l) => l.submission_id), ...mine.map((x) => x.id)])];
    if (!ids.length) return [];
    const subs = await rows<{ id: string; conference_id: string; paper_no: number; title: string; abstract: string | null; keywords: string[] | null; submitted_at: string | null; updated_at: string | null }>(
      db.from("submissions").select("id, conference_id, paper_no, title, abstract, keywords, submitted_at, updated_at").in("id", ids).eq("status", "submitted").order("submitted_at", { ascending: false }), "read your papers");
    if (!subs.length) return [];
    const [confs, authors] = await Promise.all([
      rows<{ id: string; acronym: string; title: string }>(db.from("conferences").select("id, acronym, title").in("id", inList([...new Set(subs.map((s) => s.conference_id))])), "read your papers"),
      rows<{ submission_id: string; name: string; email: string; position: number }>(db.from("submission_authors").select("submission_id, name, email, position").in("submission_id", subs.map((s) => s.id)).order("position"), "read the authors"),
    ]);
    return subs.map((s) => {
      const c = confs.find((k) => k.id === s.conference_id);
      return {
        id: s.id, label: `${paperPrefix(c?.acronym ?? "")}-${s.paper_no}`, conferenceAcronym: c?.acronym ?? "", conferenceName: c?.title ?? "", title: s.title, abstract: s.abstract ?? "",
        keywords: s.keywords ?? [], authors: authors.filter((a) => a.submission_id === s.id).map((a) => ({ name: a.name, email: a.email })), date: dateLabel(s.submitted_at ?? s.updated_at),
      } satisfies PaperCandidate;
    });
  },
  async publications(kind) {
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    const r = await rows<{ id: string; title: string; authors: string; source: string | null; source_submission: string | null }>(
      db.from("user_publications").select("id, title, authors, source, source_submission").eq("kind", kind).order("created_at", { ascending: false }), "read your list", true);
    return r.map((x) => ({ id: x.id, title: x.title, authors: x.authors, source: x.source, paperId: x.source_submission } satisfies Publication));
  },
  async createPublication(input) {
    const db: SupabaseClient = getSupabase();
    const me = (await currentUser(db)).id;
    const names = input.authors.filter((a) => a.firstName || a.lastName).map((a) => `${a.firstName} ${a.lastName}`.trim()).join(", ");
    const { title, fromPaper, kind, ...rest } = input;
    const { error } = await db.from("user_publications").insert({
      user_id: me, kind, title: title.trim() || (kind === "slides" ? "Untitled slides" : "Untitled preprint"), authors: names || "Not set",
      source: kind === "slides" ? (input.event?.trim() || null) : (fromPaper?.acronym ?? null), source_submission: fromPaper?.id ?? null, data: rest,
    });
    if (error) { if (missing(error.message)) throw new ServiceError(NEEDS_MIGRATION); fail(error, "save this"); }
  },

  async proposalConferences() {
    const db: SupabaseClient = getSupabase();
    const me = (await currentUser(db)).id;
    const mine = await rows<{ conference_id: string }>(db.from("conference_members").select("conference_id").eq("user_id", me).eq("status", "active").eq("role", "chair"), "read your conferences");
    if (!mine.length) return [];
    const confs = await rows<{ slug: string; acronym: string; title: string; end_date: string | null }>(db.from("conferences").select("slug, acronym, title, end_date").in("id", inList(mine.map((m) => m.conference_id))).order("end_date", { ascending: false }), "read your conferences");
    return confs.map((c) => ({ slug: c.slug, acronym: c.acronym, name: c.title, endDate: isoDay(c.end_date) } satisfies ProposalConference));
  },
  async submitProposal(form) {
    const db: SupabaseClient = getSupabase();
    const me = (await currentUser(db)).id;
    const { error } = await db.from("publishing_proposals").insert({ user_id: me, title: String(form.title || "").trim() || "Untitled volume", data: form });
    if (error) { if (missing(error.message)) throw new ServiceError(NEEDS_MIGRATION); fail(error, "send your proposal"); }
  },
};
