import { api, ApiError } from "@/lib/api-client";
import type { CertificateDesign, CertTypeKey, Design, Distribution, IssuedCertificate, Recipient } from "@/features/certificates/data";
import type { CertificateService, MyCertificate, VerifiedCertificate, WithdrawnCertificate } from "../certificates";

/* Certificates through the own backend (Backend/src/modules/certificates, routes in ../API.md): designs, sends, issuing (the backend numbers the
   certificates and emails the recipients itself), the public check of a certificate ID and the certificates a person holds. Every `:conferenceId`
   may be the conference's slug or its UUID. */

interface DesignRow { id: string; conferenceId: string; name: string; typeKey: CertTypeKey; design: Design; createdAt: string }
interface IssuedRow {
  serial: string; name: string; email: string; affiliation: string; roleLabel: string; paperId: string; paperTitle: string; issuedAt: string;
  status: "sent" | "bounced"; bounceReason: string | null; opened: boolean; downloaded: boolean; verifiedCount: number;
  revokedAt: string | null; revokeReason: string | null; replacedBy: string | null; resentAt: string | null;
}
interface DistributionRow {
  id: string; conferenceId: string; designId: string; name: string; audience: Distribution["audience"]; email: Distribution["email"];
  manual: Distribution["manual"]; overrides: Distribution["overrides"]; status: "draft" | "sent"; sentAt: string | null; createdAt: string; issued: IssuedRow[];
}

const ms = (iso: string) => new Date(iso).getTime();
const toDesign = (r: DesignRow): CertificateDesign => ({ id: r.id, conferenceId: r.conferenceId, name: r.name, typeKey: r.typeKey, design: r.design, createdAt: ms(r.createdAt) });
const toIssued = (r: IssuedRow): IssuedCertificate => ({
  key: `issued:${r.serial}`, serial: r.serial, name: r.name, email: r.email, affiliation: r.affiliation, roleLabel: r.roleLabel, paperId: r.paperId, paperTitle: r.paperTitle,
  issuedAt: ms(r.issuedAt), status: r.status, bounceReason: r.bounceReason, opened: r.opened, downloaded: r.downloaded, verifiedCount: r.verifiedCount,
  revokedAt: r.revokedAt ? ms(r.revokedAt) : null, revokeReason: r.revokeReason, replacedBy: r.replacedBy, resentAt: r.resentAt ? ms(r.resentAt) : null,
});
const toDistribution = (r: DistributionRow): Distribution => ({
  id: r.id, conferenceId: r.conferenceId, certId: r.designId, name: r.name, audience: r.audience, email: r.email, manual: r.manual ?? [], overrides: r.overrides ?? {},
  status: r.status, sentAt: r.sentAt ? ms(r.sentAt) : null, issued: r.issued.map(toIssued), createdAt: ms(r.createdAt),
});

export const apiCertificateService: CertificateService = {
  async load(conferenceDbId) {
    const d = await api<{ designs: DesignRow[]; distributions: DistributionRow[] }>(`/conferences/${conferenceDbId}/certificates`);
    return { designs: d.designs.map(toDesign), distributions: d.distributions.map(toDistribution) };
  },
  async createDesign(conferenceDbId, { name, typeKey, design }) {
    return toDesign(await api<DesignRow>(`/conferences/${conferenceDbId}/certificates/designs`, { method: "POST", body: { name, typeKey, design } }));
  },
  async saveDesign(designId, patch) {
    await api(`/certificate-designs/${designId}`, { method: "PATCH", body: { ...(patch.name !== undefined ? { name: patch.name } : {}), ...(patch.design ? { design: patch.design } : {}) } });
  },
  async deleteDesign(designId) {
    await api(`/certificate-designs/${designId}`, { method: "DELETE" });
  },
  async createDistribution(conferenceDbId, { designId, name, audience, email }) {
    return toDistribution(await api<DistributionRow>(`/conferences/${conferenceDbId}/certificates/distributions`, { method: "POST", body: { designId, name, audience, email } }));
  },
  async saveDistribution(distributionId, patch) {
    await api(`/certificate-distributions/${distributionId}`, { method: "PATCH", body: patch });
  },
  async deleteDistribution(distributionId) {
    await api(`/certificate-distributions/${distributionId}`, { method: "DELETE" });
  },
  async issue(distributionId, recipients: Recipient[]) {
    const list = recipients.map((r) => ({ name: r.name, email: r.email || undefined, affiliation: r.affiliation || undefined, roleLabel: r.roleLabel || undefined, paperId: r.paperId || undefined, paperTitle: r.paperTitle || undefined }));
    await api(`/certificate-distributions/${distributionId}/issue`, { method: "POST", body: { recipients: list } });
  },
  async verify(serial) {
    try { return await api<VerifiedCertificate | WithdrawnCertificate>(`/certificates/verify/${encodeURIComponent(serial)}`, { auth: false }); }
    catch (e) { if (e instanceof ApiError && e.status === 404) return null; throw e; }
  },
  async revoke(serial, reason) {
    await api(`/certificates/issued/${encodeURIComponent(serial)}/revoke`, { method: "POST", body: reason?.trim() ? { reason: reason.trim() } : {} });
  },
  async resend(serial) {
    await api(`/certificates/issued/${encodeURIComponent(serial)}/resend`, { method: "POST" });
  },
  async reissue(serial, changes) {
    return toIssued(await api<IssuedRow>(`/certificates/issued/${encodeURIComponent(serial)}/reissue`, { method: "POST", body: changes }));
  },
  async mine() {
    return api<MyCertificate[]>("/me/certificates");
  },
  async recordEvent(serial, kind) {
    try { await api(`/certificates/${encodeURIComponent(serial)}/events`, { method: "POST", body: { kind } }); }
    catch { /* tracking only: never in the way of the person */ }
  },
};
