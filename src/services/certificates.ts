import { DATA_SOURCE } from "@/lib/config";
import type { CertificateDesign, CertTypeKey, Design, Distribution, DistributionAudience, DistributionEmail, IssuedCertificate, ManualPerson, Recipient } from "@/features/certificates/data";

/** The certificates of a conference: designs, sends and what was issued (migration 0046). Failures throw like the other services
 *  (AuthRequiredError, ServiceConfigError, ServiceError with a message ready to show). */
export interface CertificatesData { designs: CertificateDesign[]; distributions: Distribution[] }

/** What the public verify page shows for a certificate ID: only what is printed on the certificate, plus the conference's own details. */
export interface VerifiedCertificate {
  revoked?: false;
  serial: string; name: string; affiliation: string; roleLabel: string; paperId: string; paperTitle: string; issuedAt: string; typeKey: CertTypeKey;
  signatory: { name?: string; title?: string };
  conference: { name: string; acronym: string; startDate: string | null; endDate: string | null; city: string | null; country: string | null; contactEmail: string | null };
}

/** What the public check shows for a certificate a chair has withdrawn: nothing about the person. */
export interface WithdrawnCertificate {
  revoked: true; serial: string; revokedAt: string; replacedBy: string | null;
  conference: { name: string; acronym: string; contactEmail: string | null };
}

/** A certificate issued to the signed-in person (`my_certificates`, migration 0047): what is printed on it, its design and the conference it is from. */
export interface MyCertificate {
  serial: string; name: string; affiliation: string; roleLabel: string; paperId: string; paperTitle: string; issuedAt: string; typeKey: CertTypeKey; design: Design;
  /** Set once a chair has withdrawn it (`replacedBy`: the ID of its replacement). */
  revokedAt?: string | null; replacedBy?: string | null;
  conference: { id: string; acronym: string; name: string; startDate: string | null; endDate: string | null; city: string | null; country: string | null; contactEmail: string | null; status: string };
}

export interface CertificateService {
  /** Every design and send of a conference (by its database id), each send with the certificates issued through it. */
  load(conferenceDbId: string): Promise<CertificatesData>;
  createDesign(conferenceDbId: string, input: { name: string; typeKey: CertTypeKey; design: Design }): Promise<CertificateDesign>;
  /** Saves a design's name and / or artwork. */
  saveDesign(designId: string, patch: { name?: string; design?: Design }): Promise<void>;
  /** Deletes a design (its sends go with it). */
  deleteDesign(designId: string): Promise<void>;
  createDistribution(conferenceDbId: string, input: { designId: string; name: string; audience: DistributionAudience; email: DistributionEmail }): Promise<Distribution>;
  saveDistribution(distributionId: string, patch: { audience?: DistributionAudience; email?: DistributionEmail; manual?: ManualPerson[]; overrides?: Record<string, { email?: string }> }): Promise<void>;
  deleteDistribution(distributionId: string): Promise<void>;
  /** Issues the send (`issue_certificates`): every recipient gets a certificate with its own ID and the send becomes "sent". */
  issue(distributionId: string, recipients: Recipient[]): Promise<void>;
  /** The public check of a certificate ID (`verify_certificate`); null when there is none. Works without signing in. */
  verify(serial: string): Promise<VerifiedCertificate | WithdrawnCertificate | null>;
  /** Chairs: withdraws an issued certificate (the public check then says it is no longer valid). Own backend and mock only. */
  revoke?(serial: string, reason?: string): Promise<void>;
  /** Chairs: sends the certificate email again, same ID. Own backend and mock only. */
  resend?(serial: string): Promise<void>;
  /** Chairs: replaces a certificate with a corrected one (new ID, emailed); the old one is withdrawn and points at it. Own backend and mock only. */
  reissue?(serial: string, changes: { name?: string; email?: string; affiliation?: string; roleLabel?: string; paperTitle?: string }): Promise<IssuedCertificate>;
  /** Every certificate issued to the signed-in person, newest first. Empty (never an error) until migration 0047 is run. */
  mine(): Promise<MyCertificate[]>;
  /** The person opened or downloaded their own certificate (`record_certificate_event`); the chair's tracking reads it. Never throws. */
  recordEvent(serial: string, kind: "opened" | "downloaded"): Promise<void>;
}

/** The service for the configured data source (no fallback from one to the other). */
export async function getCertificateService(): Promise<CertificateService> {
  if (DATA_SOURCE === "mock") return (await import("@/mocks/certificates")).mockCertificateService;
  if (DATA_SOURCE === "api") return (await import("./api/certificates")).apiCertificateService;
  return (await import("./supabase/certificates")).supabaseCertificateService;
}
