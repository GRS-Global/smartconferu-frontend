import { getSupabase } from "@/lib/supabase";
import type { CertificateDesign, CertTypeKey, Design, Distribution, IssuedCertificate, ManualPerson, Recipient } from "@/features/certificates/data";
import type { CertificateService, MyCertificate, VerifiedCertificate } from "../certificates";
import { currentUser, fail } from "./shared";

/* Designs, sends and issued certificates (migration 0046), read and written with the user's own session: Row Level Security lets only the
   conference's chairs touch them. Issuing goes through `issue_certificates`, which gives every certificate its public ID. */

interface DesignRow { id: string; conference_id: string; name: string; type_key: CertTypeKey; design: Design; created_at: string }
interface DistributionRow {
  id: string; conference_id: string; design_id: string; name: string; audience: Distribution["audience"]; email: Distribution["email"];
  manual: ManualPerson[] | null; overrides: Distribution["overrides"] | null; status: "draft" | "sent"; sent_at: string | null; created_at: string;
}
interface IssuedRow {
  distribution_id: string; serial: string; name: string; email: string; affiliation: string; role_label: string; paper_label: string; paper_title: string;
  issued_at: string; status: "sent" | "bounced"; bounce_reason: string | null; opened: boolean; downloaded: boolean; verified_count: number;
}

const DESIGN_COLUMNS = "id, conference_id, name, type_key, design, created_at";
const DISTRIBUTION_COLUMNS = "id, conference_id, design_id, name, audience, email, manual, overrides, status, sent_at, created_at";
const ISSUED_COLUMNS = "distribution_id, serial, name, email, affiliation, role_label, paper_label, paper_title, issued_at, status, bounce_reason, opened, downloaded, verified_count";

const toDesign = (r: DesignRow): CertificateDesign => ({ id: r.id, conferenceId: r.conference_id, name: r.name, typeKey: r.type_key, design: r.design, createdAt: new Date(r.created_at).getTime() });
const toIssued = (r: IssuedRow): IssuedCertificate => ({
  key: `issued:${r.serial}`, serial: r.serial, name: r.name, email: r.email, affiliation: r.affiliation, roleLabel: r.role_label, paperId: r.paper_label, paperTitle: r.paper_title,
  issuedAt: new Date(r.issued_at).getTime(), status: r.status, bounceReason: r.bounce_reason, opened: r.opened, downloaded: r.downloaded, verifiedCount: r.verified_count,
});
const toDistribution = (r: DistributionRow, issued: IssuedCertificate[]): Distribution => ({
  id: r.id, conferenceId: r.conference_id, certId: r.design_id, name: r.name, audience: r.audience, email: r.email, manual: r.manual ?? [], overrides: r.overrides ?? {},
  status: r.status, sentAt: r.sent_at ? new Date(r.sent_at).getTime() : null, issued, createdAt: new Date(r.created_at).getTime(),
});

export const supabaseCertificateService: CertificateService = {
  async load(conferenceDbId) {
    const db = getSupabase();
    await currentUser(db);
    const [designs, dists, issued] = await Promise.all([
      db.from("certificate_designs").select(DESIGN_COLUMNS).eq("conference_id", conferenceDbId).order("created_at"),
      db.from("certificate_distributions").select(DISTRIBUTION_COLUMNS).eq("conference_id", conferenceDbId).order("created_at"),
      db.from("issued_certificates").select(ISSUED_COLUMNS).eq("conference_id", conferenceDbId).order("serial"),
    ]);
    if (designs.error) fail(designs.error, "read the certificate designs");
    if (dists.error) fail(dists.error, "read the certificate sends");
    if (issued.error) fail(issued.error, "read the issued certificates");
    const byDist = new Map<string, IssuedCertificate[]>();
    for (const r of (issued.data ?? []) as IssuedRow[]) byDist.set(r.distribution_id, [...(byDist.get(r.distribution_id) ?? []), toIssued(r)]);
    return {
      designs: ((designs.data ?? []) as DesignRow[]).map(toDesign),
      distributions: ((dists.data ?? []) as DistributionRow[]).map((r) => toDistribution(r, byDist.get(r.id) ?? [])),
    };
  },
  async createDesign(conferenceDbId, { name, typeKey, design }) {
    const db = getSupabase();
    await currentUser(db);
    const { data, error } = await db.from("certificate_designs").insert({ conference_id: conferenceDbId, name, type_key: typeKey, design }).select(DESIGN_COLUMNS).single();
    if (error) fail(error, "create the certificate");
    return toDesign(data as DesignRow);
  },
  async saveDesign(designId, patch) {
    const db = getSupabase();
    await currentUser(db);
    const { error } = await db.from("certificate_designs").update({ ...(patch.name !== undefined ? { name: patch.name } : {}), ...(patch.design ? { design: patch.design } : {}) }).eq("id", designId);
    if (error) fail(error, "save the certificate");
  },
  async deleteDesign(designId) {
    const db = getSupabase();
    await currentUser(db);
    const { error } = await db.from("certificate_designs").delete().eq("id", designId);
    if (error) fail(error, "delete the certificate");
  },
  async createDistribution(conferenceDbId, { designId, name, audience, email }) {
    const db = getSupabase();
    await currentUser(db);
    const { data, error } = await db.from("certificate_distributions").insert({ conference_id: conferenceDbId, design_id: designId, name, audience, email }).select(DISTRIBUTION_COLUMNS).single();
    if (error) fail(error, "create the send");
    return toDistribution(data as DistributionRow, []);
  },
  async saveDistribution(distributionId, patch) {
    const db = getSupabase();
    await currentUser(db);
    const { error } = await db.from("certificate_distributions").update(patch).eq("id", distributionId);
    if (error) fail(error, "save the send");
  },
  async deleteDistribution(distributionId) {
    const db = getSupabase();
    await currentUser(db);
    const { error } = await db.from("certificate_distributions").delete().eq("id", distributionId);
    if (error) fail(error, "delete the send");
  },
  async issue(distributionId, recipients: Recipient[]) {
    const db = getSupabase();
    await currentUser(db);
    const payload = recipients.map((r) => ({ name: r.name, email: r.email, affiliation: r.affiliation, roleLabel: r.roleLabel, paperId: r.paperId ?? "", paperTitle: r.paperTitle ?? "" }));
    const { error } = await db.rpc("issue_certificates", { p_distribution: distributionId, p_recipients: payload });
    if (error) fail(error, "issue the certificates");
  },
  async verify(serial) {
    const { data, error } = await getSupabase().rpc("verify_certificate", { p_serial: serial });
    if (error) fail(error, "check that certificate");
    return (data ?? null) as VerifiedCertificate | null;
  },
  async mine() {
    const db = getSupabase();
    await currentUser(db);
    const { data, error } = await db.rpc("my_certificates");
    // Until migration 0047 is run the function does not exist: the person simply has no certificates to show.
    if (error) { if (/could not find the function|does not exist|schema cache/i.test(error.message ?? "")) return []; fail(error, "read your certificates"); }
    return (Array.isArray(data) ? data : []) as MyCertificate[];
  },
  async recordEvent(serial, kind) {
    try {
      const db = getSupabase();
      await db.rpc("record_certificate_event", { p_serial: serial, p_kind: kind });
    } catch { /* tracking only: never in the way of the person */ }
  },
};
