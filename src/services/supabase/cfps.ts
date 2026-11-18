import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import { DEFAULT_CFP_PERMISSIONS, type CfpDetail, type CfpManager, type CfpPermissions, type CfpRow, type PublicCfp } from "@/types/cfp";
import type { CfpService } from "../cfps";
import { ServiceError } from "../errors";
import { currentUser, fail } from "./shared";

/* The Calls for Papers of the conferences the signed-in user chairs (or manages the CFP of): each conference's own `cfps` row (status, content,
   theme), the number of papers and the CFP managers. Row Level Security shows a chair their own conferences' rows and lets the conference's team
   change `content` and `theme`; publishing and closing go through `publish_cfp` / `close_cfp` (migrations 0006 and 0011).

   What is kept where: the CFP page's text is HTML in `cfps.content.doc`, the page authors visit is `cfps.content.publicSlug`, the look is
   `cfps.theme.id`. The conference's own details (dates, venue, topics …) stay on the conference (Conference Settings › Conference Details). */

const inList = (ids: string[]) => (ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
const isoDay = (ts: string | null) => (ts ? ts.slice(0, 10) : "");
const PAGE = /^[A-Za-z0-9_-]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function rows<T>(query: PromiseLike<{ data: unknown; error: { message?: string } | null }>, what: string): Promise<T[]> {
  const { data, error } = await query;
  if (error) fail(error, what);
  return (data ?? []) as T[];
}

async function conferenceId(db: SupabaseClient, slug: string): Promise<string> {
  const c = await rows<{ id: string }>(db.from("conferences").select("id").eq("slug", slug).limit(1), "read this conference");
  if (!c[0]) throw new ServiceError("We couldn't find that conference.");
  return c[0].id;
}

export const supabaseCfpService: CfpService = {
  async list() {
    const db: SupabaseClient = getSupabase();
    const me = (await currentUser(db)).id;
    const mine = await rows<{ conference_id: string }>(db.from("conference_members").select("conference_id").eq("user_id", me).eq("status", "active").in("role", ["chair", "track_chair", "cfp_manager"]), "read your Calls for Papers");
    const ids = [...new Set(mine.map((m) => m.conference_id))];
    if (!ids.length) return [];
    const [confs, cfps, subs] = await Promise.all([
      rows<{ id: string; slug: string; acronym: string; title: string; status: string; start_date: string | null; end_date: string | null; country: string | null; submission_deadline: string | null; created_at: string }>(
        db.from("conferences").select("id, slug, acronym, title, status, start_date, end_date, country, submission_deadline, created_at").in("id", inList(ids)).order("created_at"), "read your Calls for Papers"),
      rows<{ conference_id: string; status: string; content: { doc?: unknown } | null }>(db.from("cfps").select("conference_id, status, content").in("conference_id", inList(ids)), "read your Calls for Papers"),
      rows<{ conference_id: string }>(db.from("submissions").select("conference_id").in("conference_id", inList(ids)).neq("status", "draft").neq("status", "withdrawn"), "count the papers"),
    ]);
    return confs.filter((c) => c.status !== "pending_approval" && c.status !== "rejected").map((c): CfpRow => {
      const row = cfps.find((x) => x.conference_id === c.id);
      const st = row?.status;
      return {
        slug: c.slug, acronym: c.acronym, name: c.title,
        status: st === "published" || st === "closed" ? st : "draft",
        hasDraft: typeof row?.content?.doc === "string" && row.content.doc.trim() !== "",
        submissions: subs.filter((s) => s.conference_id === c.id).length,
        startDate: isoDay(c.start_date), endDate: isoDay(c.end_date), deadline: isoDay(c.submission_deadline), country: c.country ?? "",
      };
    });
  },

  async load(slug) {
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    const c = await rows<{ id: string }>(db.from("conferences").select("id").eq("slug", slug).limit(1), "read this Call for Papers");
    if (!c[0]) return null;
    const [cfp, subs, members] = await Promise.all([
      rows<{ status: string; content: Record<string, unknown> | null; theme: Record<string, unknown> | null }>(db.from("cfps").select("status, content, theme").eq("conference_id", c[0].id).limit(1), "read this Call for Papers"),
      rows<{ id: string }>(db.from("submissions").select("id").eq("conference_id", c[0].id).neq("status", "draft").neq("status", "withdrawn"), "count the papers"),
      rows<{ id: string; display_name: string | null; invited_email: string | null; status: string }>(db.from("conference_members").select("id, display_name, invited_email, status").eq("conference_id", c[0].id).eq("role", "cfp_manager").neq("status", "removed"), "read the CFP managers"),
    ]);
    // What each manager may do (migration 0045). Until it is run the column is missing: every manager shows the defaults, nothing fails.
    const perms = members.length
      ? await db.from("conference_members").select("id, cfp_permissions").in("id", members.map((m) => m.id)).then(({ data, error }) => (error ? [] : ((data ?? []) as Array<{ id: string; cfp_permissions: Partial<CfpPermissions> | null }>)))
      : [];
    const permsOf = (id: string): CfpPermissions => ({ ...DEFAULT_CFP_PERMISSIONS, ...(perms.find((p) => p.id === id)?.cfp_permissions ?? {}) });
    const row = cfp[0];
    const str = (v: unknown) => (typeof v === "string" ? v : "");
    const status = row?.status === "published" || row?.status === "closed" ? row.status : "draft";
    return {
      status, doc: str(row?.content?.doc), publicSlug: str(row?.content?.publicSlug), themeId: str(row?.theme?.id) || "classic",
      submissions: subs.length,
      managers: members.map((m): CfpManager => ({ id: m.id, name: m.display_name || m.invited_email || "CFP manager", email: m.invited_email ?? "", status: m.status === "active" || m.status === "declined" ? m.status : "invited", permissions: permsOf(m.id) })),
    } satisfies CfpDetail;
  },

  async loadPublic(page) {
    if (!PAGE.test(page)) return null;
    const db: SupabaseClient = getSupabase();
    // Row Level Security lets anyone read a published or closed CFP and an active conference.
    const found = await rows<{ conference_id: string; status: string; content: Record<string, unknown> | null; theme: Record<string, unknown> | null }>(db.from("cfps").select("conference_id, status, content, theme").eq("content->>publicSlug", page).limit(1), "read this Call for Papers");
    const cfp = found[0];
    if (!cfp || (cfp.status !== "published" && cfp.status !== "closed")) return null;
    const c = await rows<{ slug: string; acronym: string; title: string; venue: string | null; city: string | null; country: string | null; web_page: string | null; contact_email: string | null; about: string | null; start_date: string | null; end_date: string | null; submission_deadline: string | null; details: { topics?: unknown } | null }>(
      db.from("conferences").select("slug, acronym, title, venue, city, country, web_page, contact_email, about, start_date, end_date, submission_deadline, details").eq("id", cfp.conference_id).limit(1), "read this conference");
    if (!c[0]) return null;
    const str = (v: unknown) => (typeof v === "string" ? v : "");
    return {
      slug: c[0].slug, acronym: c[0].acronym, name: c[0].title, status: cfp.status,
      venue: c[0].venue ?? "", city: c[0].city ?? "", country: c[0].country ?? "", webPage: c[0].web_page ?? "", contactEmail: c[0].contact_email ?? "", about: c[0].about ?? "",
      topics: Array.isArray(c[0].details?.topics) ? (c[0].details?.topics as unknown[]).filter((t): t is string => typeof t === "string") : [],
      startDate: isoDay(c[0].start_date), endDate: isoDay(c[0].end_date), submissionDeadline: isoDay(c[0].submission_deadline),
      doc: str(cfp.content?.doc), themeId: str(cfp.theme?.id) || "classic",
    } satisfies PublicCfp;
  },

  async takenPages(slug, pages) {
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    const id = await conferenceId(db, slug);
    const clean = pages.filter((p) => PAGE.test(p));
    if (!clean.length) return [];
    // Row Level Security lets anyone read published CFPs (and a chair read their own), so a page taken by a draft elsewhere is not seen here:
    // publish() asks again, and a clash there is refused.
    const found = await rows<{ conference_id: string; content: { publicSlug?: string } | null }>(db.from("cfps").select("conference_id, content").in("content->>publicSlug", clean).neq("conference_id", id), "check the CFP page");
    return found.map((f) => f.content?.publicSlug ?? "").filter(Boolean);
  },

  async publish(slug, page) {
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    const id = await conferenceId(db, slug);
    if (!PAGE.test(page) || !/[A-Za-z]/.test(page) || !/[0-9]/.test(page)) throw new ServiceError("Choose a page with letters, digits, underscores or hyphens, including at least one letter and one digit.");
    const [taken] = await Promise.all([this.takenPages(slug, [page])]);
    if (taken.length) throw new ServiceError("That page is already taken by another CFP — try another.");
    const cur = await rows<{ content: Record<string, unknown> | null }>(db.from("cfps").select("content").eq("conference_id", id).limit(1), "read this Call for Papers");
    const existing = typeof cur[0]?.content?.publicSlug === "string" ? String(cur[0]?.content?.publicSlug) : "";
    // The page can be chosen once: a CFP that already has one keeps it.
    if (!existing) {
      const { error } = await db.from("cfps").update({ content: { ...(cur[0]?.content ?? {}), publicSlug: page } }).eq("conference_id", id);
      if (error) fail(error, "choose the CFP page");
    }
    const { error } = await db.rpc("publish_cfp", { p_conference: id });
    if (error) {
      if (/42501|Only a chair/i.test(error.message)) throw new ServiceError("Only a chair of this conference can publish its Call for Papers.");
      if (/22023|approved/i.test(error.message)) throw new ServiceError("The conference has to be approved before its Call for Papers can be published.");
      fail(error, "publish the Call for Papers");
    }
  },

  async close(slug) {
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    const id = await conferenceId(db, slug);
    const { error } = await db.rpc("close_cfp", { p_conference: id });
    if (error) {
      if (/22023|Only a published/i.test(error.message)) throw new ServiceError("Only a published Call for Papers can be closed.");
      fail(error, "close the Call for Papers");
    }
  },

  async saveContent(slug, html) {
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    const id = await conferenceId(db, slug);
    if (html.length > 200000) throw new ServiceError("The text is too long.");
    const cur = await rows<{ status: string; content: Record<string, unknown> | null }>(db.from("cfps").select("status, content").eq("conference_id", id).limit(1), "read this Call for Papers");
    if (cur[0]?.status === "closed") throw new ServiceError("This CFP is closed and can't be updated.");
    const { error } = await db.from("cfps").update({ content: { ...(cur[0]?.content ?? {}), doc: html } }).eq("conference_id", id);
    if (error) fail(error, "save the CFP text");
  },

  async saveTheme(slug, themeId) {
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    const id = await conferenceId(db, slug);
    if (!/^[a-z]{2,20}$/.test(themeId)) throw new ServiceError("Pick one of the themes.");
    const { error } = await db.from("cfps").update({ theme: { id: themeId } }).eq("conference_id", id).neq("status", "closed");
    if (error) fail(error, "save the theme");
  },

  async addManager(slug, who) {
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    const id = await conferenceId(db, slug);
    const email = who.email.trim().toLowerCase();
    const name = `${who.firstName.trim()} ${who.lastName.trim()}`.trim();
    if (!who.firstName.trim() || !who.lastName.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ServiceError("Please fill in first name, last name and a valid email.");
    const existing = await rows<{ id: string; status: string }>(db.from("conference_members").select("id, status").eq("conference_id", id).eq("role", "cfp_manager").eq("invited_email", email).limit(1), "read the CFP managers");
    if (existing[0] && existing[0].status !== "removed" && existing[0].status !== "declined") throw new ServiceError("That person is already a manager of this CFP.");
    if (existing[0]) { const { error } = await db.from("conference_members").delete().eq("id", existing[0].id); if (error) fail(error, "add a CFP manager"); }
    const base = { conference_id: id, invited_email: email, role: "cfp_manager", display_name: name };
    let made = await db.from("conference_members").insert({ ...base, cfp_permissions: who.permissions }).select("id").single();
    // Until migration 0045 is run the permissions column does not exist: the manager is still added (with the defaults).
    if (made.error && /cfp_permissions|schema cache/i.test(made.error.message)) made = await db.from("conference_members").insert(base).select("id").single();
    if (made.error) fail(made.error, "add a CFP manager");
    return (made.data as { id: string }).id;
  },

  async saveManagers(_slug, kept, removed) {
    if ([...kept.map((k) => k.id), ...removed].some((id) => !UUID.test(id))) throw new ServiceError("Couldn't save the managers.");
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    for (const k of kept) {
      if (!k.name.trim()) throw new ServiceError("Every manager needs a name.");
      let up = await db.from("conference_members").update({ display_name: k.name.trim().slice(0, 200), cfp_permissions: k.permissions }).eq("id", k.id).eq("role", "cfp_manager");
      if (up.error && /cfp_permissions|schema cache/i.test(up.error.message)) up = await db.from("conference_members").update({ display_name: k.name.trim().slice(0, 200) }).eq("id", k.id).eq("role", "cfp_manager");
      if (up.error) fail(up.error, "save the managers");
    }
    if (removed.length) {
      const { error } = await db.from("conference_members").delete().in("id", removed).eq("role", "cfp_manager");
      if (error) fail(error, "remove the CFP managers");
    }
  },

  async discardDraft(slug) {
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    const id = await conferenceId(db, slug);
    // Only an unpublished CFP can be cleared (the update is limited to the draft row).
    const { error } = await db.from("cfps").update({ content: {}, theme: {} }).eq("conference_id", id).eq("status", "draft");
    if (error) fail(error, "discard this draft");
  },
};
