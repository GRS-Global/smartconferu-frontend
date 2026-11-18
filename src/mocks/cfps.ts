import { DEFAULT_CFP_PERMISSIONS, type CfpDetail, type CfpRow, type PublicCfp } from "@/types/cfp";
import type { CfpService } from "../services/cfps";

/* Mock mode (NEXT_PUBLIC_DATA_SOURCE=mock) only: kept in memory for the page's life. */
const parity = process.env.NEXT_PUBLIC_MOCK_FIXTURES === "parity";
const rows: CfpRow[] = parity
  ? [{ slug: "demo-dsai-2027", acronym: "DSAI 2027", name: "Demo conference", status: "published", hasDraft: true, submissions: 3, startDate: "2027-03-10", endDate: "2027-03-12", deadline: "2027-01-10", country: "India" }]
  : [];
const details = new Map<string, CfpDetail>(parity ? [["demo-dsai-2027", { status: "published", doc: "<p>Call for papers.</p>", themeId: "classic", publicSlug: "DSAI2027", submissions: 3, managers: [] }]] : []);

export const mockCfpService: CfpService = {
  async list() { return rows.map((r) => ({ ...r })); },
  async load(slug) { const d = details.get(slug); return d ? { ...d, managers: [...d.managers] } : null; },
  async loadPublic(page) {
    const hit = [...details.entries()].find(([, d]) => d.publicSlug === page && d.status !== "draft");
    const r = hit && rows.find((x) => x.slug === hit[0]);
    if (!hit || !r) return null;
    return { slug: r.slug, acronym: r.acronym, name: r.name, status: hit[1].status as PublicCfp["status"], venue: "", city: "", country: "", webPage: "", contactEmail: "", about: "", topics: [], startDate: r.startDate, endDate: r.endDate, submissionDeadline: r.deadline, doc: hit[1].doc, themeId: hit[1].themeId };
  },
  async takenPages() { return []; },
  async publish(slug, page) {
    const d = details.get(slug);
    if (d) details.set(slug, { ...d, status: "published", publicSlug: page });
    const r = rows.find((x) => x.slug === slug);
    if (r) r.status = "published";
  },
  async close(slug) {
    const d = details.get(slug);
    if (d) details.set(slug, { ...d, status: "closed" });
    const r = rows.find((x) => x.slug === slug);
    if (r) r.status = "closed";
  },
  async saveContent(slug, html) { const d = details.get(slug); if (d) details.set(slug, { ...d, doc: html }); },
  async saveTheme(slug, themeId) { const d = details.get(slug); if (d) details.set(slug, { ...d, themeId }); },
  async addManager(slug, who) {
    const d = details.get(slug);
    const id = `mock-m-${(d?.managers.length ?? 0) + 1}`;
    if (d) details.set(slug, { ...d, managers: [...d.managers, { id, name: `${who.firstName} ${who.lastName}`.trim(), email: who.email, status: "invited", permissions: who.permissions ?? DEFAULT_CFP_PERMISSIONS }] });
    return id;
  },
  async saveManagers(_slug, kept, removed) {
    details.forEach((d, k) => details.set(k, { ...d, managers: d.managers.filter((m) => !removed.includes(m.id)).map((m) => { const u = kept.find((x) => x.id === m.id); return u ? { ...m, name: u.name, permissions: u.permissions } : m; }) }));
  },
  async discardDraft(slug) { const d = details.get(slug); if (d) details.set(slug, { ...d, doc: "", themeId: "classic" }); },
};
