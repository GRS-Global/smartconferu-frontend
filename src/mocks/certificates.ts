import { certificateSerial, type CertificateDesign, type Distribution, type IssuedCertificate } from "@/features/certificates/data";
import type { CertificateService, CertificatesData, MyCertificate, VerifiedCertificate, WithdrawnCertificate } from "@/services/certificates";

/* NEXT_PUBLIC_DATA_SOURCE=mock only (UI work: no network, no accounts). Designs and sends are kept in memory for the page's lifetime, like the
   prototype does; nothing is stored anywhere. The mock conference is "DSAI 2027" (src/mocks/conferences.ts). */

const CONFERENCE = { name: "International Conference on Data Systems and Applied Intelligence", acronym: "DSAI 2027", startDate: "2027-02-17", endDate: "2027-02-19", city: "Pune", country: "India", contactEmail: "info@dsai2027.example.org" };
let counter = 0;
const id = (prefix: string) => `${prefix}-${++counter}`;
const store: { designs: CertificateDesign[]; distributions: Distribution[] } = { designs: [], distributions: [] };
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const snapshot = (): CertificatesData => clone({ designs: store.designs, distributions: store.distributions });

export const mockCertificateService: CertificateService = {
  async load() { return snapshot(); },
  async createDesign(conferenceDbId, { name, typeKey, design }) {
    const d: CertificateDesign = { id: id("design"), conferenceId: conferenceDbId, name, typeKey, design: clone(design), createdAt: Date.now() };
    store.designs.push(d);
    return clone(d);
  },
  async saveDesign(designId, patch) {
    const d = store.designs.find((x) => x.id === designId);
    if (!d) return;
    if (patch.name !== undefined) d.name = patch.name;
    if (patch.design) d.design = clone(patch.design);
  },
  async deleteDesign(designId) {
    store.designs = store.designs.filter((d) => d.id !== designId);
    store.distributions = store.distributions.filter((d) => d.certId !== designId);
  },
  async createDistribution(conferenceDbId, { designId, name, audience, email }) {
    const d: Distribution = { id: id("dist"), conferenceId: conferenceDbId, certId: designId, name, audience, email, manual: [], overrides: {}, status: "draft", sentAt: null, issued: [], createdAt: Date.now() };
    store.distributions.push(d);
    return clone(d);
  },
  async saveDistribution(distributionId, patch) {
    const d = store.distributions.find((x) => x.id === distributionId);
    if (d) Object.assign(d, clone(patch));
  },
  async deleteDistribution(distributionId) {
    store.distributions = store.distributions.filter((d) => d.id !== distributionId);
  },
  async issue(distributionId, recipients) {
    const d = store.distributions.find((x) => x.id === distributionId);
    if (!d || d.status === "sent") return;
    const type = store.designs.find((x) => x.id === d.certId)?.typeKey;
    const base = store.distributions.filter((x) => store.designs.find((y) => y.id === x.certId)?.typeKey === type).reduce((n, x) => n + x.issued.length, 0);
    const now = Date.now();
    const issued: IssuedCertificate[] = recipients.map((r, i) => ({
      key: `issued:${i}`, serial: certificateSerial(CONFERENCE, type, base + i), name: r.name, email: r.email, affiliation: r.affiliation, roleLabel: r.roleLabel,
      paperId: r.paperId ?? "", paperTitle: r.paperTitle ?? "", issuedAt: now, status: "sent", bounceReason: null, opened: false, downloaded: false, verifiedCount: 0,
    }));
    d.issued = issued;
    d.status = "sent";
    d.sentAt = now;
  },
  async verify(serial): Promise<VerifiedCertificate | WithdrawnCertificate | null> {
    for (const d of store.distributions) {
      const r = d.issued.find((x) => x.serial === serial);
      const design = store.designs.find((x) => x.id === d.certId);
      if (r && design) {
        r.verifiedCount += 1;
        if (r.revokedAt) return { revoked: true, serial, revokedAt: new Date(r.revokedAt).toISOString(), replacedBy: r.replacedBy ?? null, conference: { name: CONFERENCE.name, acronym: CONFERENCE.acronym, contactEmail: null } };
        return { serial, name: r.name, affiliation: r.affiliation, roleLabel: r.roleLabel, paperId: r.paperId, paperTitle: r.paperTitle, issuedAt: new Date(r.issuedAt).toISOString(), typeKey: design.typeKey, signatory: design.design.signatories[0] ?? {}, conference: CONFERENCE };
      }
    }
    return null;
  },
  // The mock account is "Asha Verma" (src/mocks/author-submissions.ts): the certificates issued to her address are hers.
  async mine(): Promise<MyCertificate[]> {
    const out: MyCertificate[] = [];
    for (const d of store.distributions) {
      const design = store.designs.find((x) => x.id === d.certId);
      if (!design) continue;
      for (const r of d.issued) {
        if (r.email.toLowerCase() !== "asha@example.org") continue;
        out.push({ serial: r.serial, name: r.name, affiliation: r.affiliation, roleLabel: r.roleLabel, paperId: r.paperId, paperTitle: r.paperTitle, issuedAt: new Date(r.issuedAt).toISOString(), typeKey: design.typeKey, design: clone(design.design), conference: { id: "demo-dsai-2027", status: "active", ...CONFERENCE } });
      }
    }
    return out.sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  },
  async revoke(serial, reason) {
    const r = store.distributions.flatMap((d) => d.issued).find((x) => x.serial === serial);
    if (!r) throw new Error("That certificate was not found.");
    if (r.revokedAt) throw new Error("This certificate has already been withdrawn.");
    r.revokedAt = Date.now(); r.revokeReason = reason?.trim() || null;
  },
  async resend(serial) {
    const r = store.distributions.flatMap((d) => d.issued).find((x) => x.serial === serial);
    if (!r) throw new Error("That certificate was not found.");
    if (r.revokedAt) throw new Error("This certificate has been withdrawn, so it cannot be sent again. Reissue it instead.");
    if (!r.email) throw new Error("This person has no email address. Reissue the certificate with one.");
    r.resentAt = Date.now();
  },
  async reissue(serial, changes) {
    const d = store.distributions.find((x) => x.issued.some((i) => i.serial === serial));
    const r = d?.issued.find((x) => x.serial === serial);
    if (!d || !r) throw new Error("That certificate was not found.");
    if (r.revokedAt) throw new Error("This certificate has already been withdrawn or replaced.");
    if (changes.name !== undefined && !changes.name.trim()) throw new Error("The name cannot be empty.");
    const type = store.designs.find((x) => x.id === d.certId)?.typeKey;
    const used = store.distributions.filter((x) => store.designs.find((y) => y.id === x.certId)?.typeKey === type).reduce((n, x) => n + x.issued.length, 0);
    const fresh: IssuedCertificate = { ...clone(r), ...changes, key: `issued:${used}`, serial: certificateSerial(CONFERENCE, type, used), issuedAt: Date.now(), status: "sent", bounceReason: null, opened: false, downloaded: false, verifiedCount: 0, revokedAt: null, revokeReason: null, replacedBy: null, resentAt: null };
    r.revokedAt = Date.now(); r.revokeReason = "Replaced by a corrected certificate"; r.replacedBy = fresh.serial;
    d.issued.push(fresh);
    return clone(fresh);
  },
  async recordEvent(serial, kind) {
    for (const d of store.distributions) {
      const r = d.issued.find((x) => x.serial === serial);
      if (r) { r.opened = true; if (kind === "downloaded") r.downloaded = true; }
    }
  },
};
