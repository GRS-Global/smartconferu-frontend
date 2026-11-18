import { api, ApiError } from "@/lib/api-client";
import { DEFAULT_CFP_PERMISSIONS, type CfpDetail, type CfpManager, type CfpRow, type PublicCfp } from "@/types/cfp";
import type { CfpService } from "../cfps";
import { ServiceError } from "../errors";

/* Calls for Papers through the own backend (Backend/src/modules/conferences: conferences.controller.ts, cfps.service.ts).
   What is kept where: the page's text is HTML in `content.doc`, the page address authors visit in `content.publicSlug`, the look in `theme.id` — the
   same places the Supabase version used. The backend replaces `content` / `theme` as a whole, so a save reads what is stored and writes it back merged.
   Every `:conferenceId` in a path may be the conference's slug.

   Not in the backend yet (see GAP-REPORT.md): finding a published CFP by its page address (`loadPublic`), checking whether a page address is taken
   (`takenPages`) and the managers' permissions. */

const isoDay = (ts: string | null) => (ts ? ts.slice(0, 10) : "");
const PAGE = /^[A-Za-z0-9_-]+$/;
const CFP_ROLES = ["chair", "track_chair", "cfp_manager"];
const str = (v: unknown) => (typeof v === "string" ? v : "");

interface ConferenceResponse {
  id: string; slug: string; acronym: string; title: string; status: string; country: string | null; startDate: string | null; endDate: string | null;
  submissionDeadline: string | null; cfpStatus: string; myRoles: string[];
}
interface CfpResponse { conferenceId: string; status: string; content: Record<string, unknown>; theme: Record<string, unknown>; decidedAt: string | null; submittedAt: string | null; adminNote: string | null; updatedAt: string }
interface MemberResponse { id: string; role: string; status: string; name: string; email: string | null }
interface SubmissionLite { status: string }

/** `in_review` waits for the Super Admin; `rejected` is a draft again (the note says why). */
const cfpStatus = (s: string): CfpRow["status"] => (s === "published" || s === "closed" ? s : s === "in_review" ? "review" : "draft");
const denied = (e: unknown) => e instanceof ApiError && (e.status === 403 || e.status === 404);

/** Papers sent so far (drafts and withdrawn ones are not counted). Only the whole team sees every paper; anyone else gets 0. */
async function countPapers(slug: string): Promise<number> {
  try {
    return (await api<SubmissionLite[]>(`/conferences/${slug}/submissions`)).filter((s) => s.status !== "draft" && s.status !== "withdrawn").length;
  } catch (e) {
    if (denied(e)) return 0;
    throw e;
  }
}

const getCfp = (slug: string) => api<CfpResponse>(`/conferences/${slug}/cfp`);
const patchCfp = (slug: string, body: { content?: Record<string, unknown>; theme?: Record<string, unknown> }) => api<CfpResponse>(`/conferences/${slug}/cfp`, { method: "PATCH", body });

export const apiCfpService: CfpService = {
  async list() {
    const { conferences } = await api<{ conferences: ConferenceResponse[] }>("/conferences");
    const mine = conferences.filter((c) => (c.status === "active" || c.status === "archived") && c.myRoles.some((r) => CFP_ROLES.includes(r)));
    return Promise.all(mine.map(async (c): Promise<CfpRow> => {
      const cfp = await getCfp(c.slug);
      const status = cfpStatus(cfp.status);
      return {
        slug: c.slug, acronym: c.acronym, name: c.title, status,
        hasDraft: str(cfp.content.doc).trim() !== "",
        submissions: status === "draft" ? 0 : await countPapers(c.slug),
        startDate: isoDay(c.startDate), endDate: isoDay(c.endDate), deadline: isoDay(c.submissionDeadline), country: c.country ?? "",
      };
    }));
  },

  async load(slug) {
    let cfp: CfpResponse;
    try { cfp = await getCfp(slug); } catch (e) { if (denied(e)) return null; throw e; }
    const status = cfpStatus(cfp.status);
    // Only chairs may list the team; a CFP manager who is not a chair simply sees no list.
    const members = await api<MemberResponse[]>(`/conferences/${slug}/members`, { query: { role: "cfp_manager" } }).catch((e: unknown) => { if (denied(e)) return [] as MemberResponse[]; throw e; });
    return {
      status, rejection: cfp.status === "rejected" ? cfp.adminNote ?? "" : "", doc: str(cfp.content.doc), publicSlug: str(cfp.content.publicSlug), themeId: str(cfp.theme.id) || "classic",
      submissions: status === "draft" ? 0 : await countPapers(slug),
      managers: members.filter((m) => m.status !== "removed").map((m): CfpManager => ({
        id: m.id, name: m.name || m.email || "CFP manager", email: m.email ?? "", status: m.status === "active" || m.status === "declined" ? m.status : "invited",
        // The backend keeps no per-manager permissions yet: everyone shows the defaults.
        permissions: { ...DEFAULT_CFP_PERMISSIONS },
      })),
    } satisfies CfpDetail;
  },

  // The backend can't find a CFP by its page address yet (only by the conference's slug): reads as "no CFP there".
  async loadPublic(page): Promise<PublicCfp | null> {
    void page;
    return null;
  },

  // The backend does not check page addresses yet, so none is reported as taken; publishing is where a clash would have to be refused.
  async takenPages() { return []; },

  async publish(slug, page) {
    if (!PAGE.test(page) || !/[A-Za-z]/.test(page) || !/[0-9]/.test(page)) throw new ServiceError("Choose a page with letters, digits, underscores or hyphens, including at least one letter and one digit.");
    const cur = await getCfp(slug);
    // The page can be chosen once: a CFP that already has one keeps it.
    if (!str(cur.content.publicSlug)) await patchCfp(slug, { content: { ...cur.content, publicSlug: page } });
    // The backend sends it to the Super Admin ("in_review"); only a CFP that was approved before and then closed opens again at once.
    const sent = await api<CfpResponse>(`/conferences/${slug}/cfp/publish`, { method: "POST" });
    return sent.status === "in_review" ? "review" : undefined;
  },

  async close(slug) { await api(`/conferences/${slug}/cfp/close`, { method: "POST" }); },

  async saveContent(slug, html) {
    if (html.length > 200000) throw new ServiceError("The text is too long.");
    const cur = await getCfp(slug);
    if (cur.status === "closed") throw new ServiceError("This CFP is closed and can't be updated.");
    await patchCfp(slug, { content: { ...cur.content, doc: html } });
  },

  async saveTheme(slug, themeId) {
    if (!/^[a-z]{2,20}$/.test(themeId)) throw new ServiceError("Pick one of the themes.");
    const cur = await getCfp(slug);
    if (cur.status === "closed") throw new ServiceError("This CFP is closed and can't be updated.");
    await patchCfp(slug, { theme: { ...cur.theme, id: themeId } });
  },

  async addManager(slug, who) {
    const email = who.email.trim().toLowerCase();
    const name = `${who.firstName.trim()} ${who.lastName.trim()}`.trim();
    if (!who.firstName.trim() || !who.lastName.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ServiceError("Please fill in first name, last name and a valid email.");
    const r = await api<{ created: boolean; member: { id: string } }>(`/conferences/${slug}/members`, { method: "POST", body: { email, role: "cfp_manager", displayName: name } });
    if (!r.created) throw new ServiceError("That person is already a manager of this CFP.");
    return r.member.id;
  },

  async saveManagers(slug, kept, removed) {
    for (const k of kept) {
      if (!k.name.trim()) throw new ServiceError("Every manager needs a name.");
      await api(`/conferences/${slug}/members/${k.id}`, { method: "PATCH", body: { displayName: k.name.trim().slice(0, 200) } });
    }
    for (const id of removed) await api(`/conferences/${slug}/members/${id}`, { method: "DELETE" });
  },

  async discardDraft(slug) {
    const cur = await getCfp(slug);
    // Only an unpublished CFP can be cleared.
    if (cur.status === "published" || cur.status === "closed") throw new ServiceError("Only a CFP that was never published can be discarded.");
    await patchCfp(slug, { content: {}, theme: {} });
  },
};
