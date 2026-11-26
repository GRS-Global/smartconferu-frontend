import type { ChairPaper, ReviewBoard } from "@/types/chair";
import type { Conference } from "@/types/conference";

/* The certificate module's types, constants and rules (the prototype's src/chair-certificates/data.js). The prototype keeps designs and sends in
   memory; here they are rows of the database (migration 0046; services/certificates.ts) and everything in this file is pure: it holds no state.

   Two kinds of record, matching the two menu items:
   - a DESIGN: artwork and wording, nothing else. Made once, reused by any number of sends.
   - a SEND (distribution): points at a design, carries the audience rule, the covering email and, once it has gone out, the issued certificates.

   A recipient list is not a spreadsheet you upload: it is a rule over data the platform already holds (accepted authors, reviewers who finished).
   resolveAudience() is that rule engine. Typing people in by hand stays as the escape hatch. */

export type CertTypeKey = "presentation" | "participation" | "appreciation" | "publication" | "author";
export type ToneKey = "primary" | "secondary" | "accent" | "success" | "warning" | "danger" | "muted";

export interface CertificateType { key: CertTypeKey; label: string; short: string; line: string; defaultSource: string; tone: ToneKey; body: string }

/** The five certificate types. `defaultSource` wires each one to the audience it almost always means. */
export const CERTIFICATE_TYPES: CertificateType[] = [
  { key: "presentation", label: "Certificate of Presentation", short: "Of Presentation", line: "OF PRESENTATION", defaultSource: "presenting-authors", tone: "primary", body: "for presenting {{paperTitle}}" },
  { key: "participation", label: "Certificate of Participation", short: "Of Participation", line: "OF PARTICIPATION", defaultSource: "registered-attendees", tone: "accent", body: "for taking part in {{conferenceName}}" },
  { key: "appreciation", label: "Certificate of Appreciation", short: "Of Appreciation", line: "OF APPRECIATION", defaultSource: "reviewers-complete", tone: "secondary", body: "in appreciation of service as {{roleLabel}}" },
  { key: "publication", label: "Certificate of Publication", short: "Of Publication", line: "OF PUBLICATION", defaultSource: "published-authors", tone: "success", body: "whose paper {{paperTitle}} has been published in the conference proceedings" },
  { key: "author", label: "Certificate to Author", short: "To Author", line: "TO THE AUTHOR", defaultSource: "accepted-authors", tone: "primary", body: "whose paper {{paperTitle}} was accepted for {{conferenceName}}" },
];
export const getCertificateType = (key: string | undefined): CertificateType => CERTIFICATE_TYPES.find((t) => t.key === key) ?? CERTIFICATE_TYPES[0];

export interface Palette { ink: string; accent: string; paper: string; rule: string }
export type Layout = "double-border" | "ornate-border" | "banner-top";
export interface CertificateTemplate { key: string; name: string; layout: Layout; palette: Palette }
export const CERTIFICATE_TEMPLATES: CertificateTemplate[] = [
  { key: "classic-navy", name: "Classic Navy", layout: "double-border", palette: { ink: "#1E1B4B", accent: "#06B6D4", paper: "#FDFDFB", rule: "#C7D2FE" } },
  { key: "bordered-gold", name: "Bordered Gold", layout: "ornate-border", palette: { ink: "#7C2D12", accent: "#B45309", paper: "#FFFBF3", rule: "#FDE68A" } },
  { key: "modern-minimal", name: "Modern Minimal", layout: "banner-top", palette: { ink: "#0B1020", accent: "#4F46E5", paper: "#FFFFFF", rule: "#E2E8F0" } },
  { key: "quiet-teal", name: "Quiet Teal", layout: "banner-top", palette: { ink: "#134E4A", accent: "#0F766E", paper: "#FFFFFF", rule: "#99F6E4" } },
];
export const getTemplate = (key: string): CertificateTemplate => CERTIFICATE_TEMPLATES.find((t) => t.key === key) ?? CERTIFICATE_TEMPLATES[0];

export const PALETTE_PRESETS: Array<{ key: string; label: string; palette: Palette }> = [
  { key: "indigo", label: "Indigo", palette: { ink: "#1E1B4B", accent: "#06B6D4", paper: "#FDFDFB", rule: "#C7D2FE" } },
  { key: "gold", label: "Gold", palette: { ink: "#7C2D12", accent: "#B45309", paper: "#FFFBF3", rule: "#FDE68A" } },
  { key: "forest", label: "Forest", palette: { ink: "#134E4A", accent: "#0F766E", paper: "#FBFEFD", rule: "#99F6E4" } },
  { key: "charcoal", label: "Charcoal", palette: { ink: "#0B1020", accent: "#475569", paper: "#FFFFFF", rule: "#CBD5E1" } },
];

/* ---------------- Free layout ----------------
   Every piece of the certificate is a positioned box in a fixed base-pixel space, so the designer can drag anything anywhere and a thumbnail is
   the same artwork under a CSS transform. Two base sizes, one per orientation; switching orientation re-seeds positions from that side's
   defaults, since a portrait page is not a rotated landscape one. */
export type Orientation = "landscape" | "portrait";
export const BASE_SIZES: Record<Orientation, { w: number; h: number }> = { landscape: { w: 1000, h: 707 }, portrait: { w: 707, h: 1000 } };

export const ELEMENT_LABELS: Record<string, string> = {
  headline: "Headline", typeLine: "Type line", rule: "Divider rule", leadIn: "Lead-in",
  recipientName: "Recipient name", bodyLine: "Body line", qr: "QR & certificate ID", logo: "Logo",
  sig0: "Signature 1", sig1: "Signature 2", sig2: "Signature 3",
};

export interface ElementBox { x: number; y: number; w: number; align?: "left" | "center" | "right"; size?: number; moved?: boolean }
export type Elements = Record<string, ElementBox>;
export interface Signatory { name: string; title: string }
export interface Design {
  templateKey: string; layout: Layout; palette: Palette; orientation: Orientation;
  headline: string; typeLine: string; leadIn: string; bodyLine: string;
  signatories: Signatory[]; showQr: boolean; showLogo: boolean;
  /** null = the platform mark; a data URL once the chair uploaded a logo. */
  logoSrc: string | null;
  elements: Elements;
  /** Free-form studio document (features/certificates/studio). When present it is what is drawn everywhere; the fields above are the v1 design it was made from. */
  studio?: import("./studio/model").StudioDoc;
  /** Which certificate type this design is for (its row's `typeKey`, repeated here so a merge field can name it wherever only the design is at hand). */
  typeKey?: CertTypeKey;
}

/* Signature blocks sit side by side and re-centre as a group when one is added or removed, but only the ones the chair has not already moved. */
const SIG_W = 220;
function signatureSeats(w: number, count: number): number[] {
  const gap = 32;
  const total = count * SIG_W + (count - 1) * gap;
  const left = Math.round((w - total) / 2);
  return Array.from({ length: count }, (_, i) => left + i * (SIG_W + gap));
}

export function defaultElements(orientation: Orientation = "landscape", signatoryCount = 1): Elements {
  const { w, h } = BASE_SIZES[orientation] || BASE_SIZES.landscape;
  const landscape = orientation === "landscape";
  const pad = landscape ? 70 : 60;
  const colW = w - pad * 2;
  const seats = signatureSeats(w, Math.max(1, signatoryCount));

  const els: Elements = {
    headline: { x: pad, y: Math.round(h * 0.10), w: colW, align: "center", size: landscape ? 64 : 52 },
    typeLine: { x: pad, y: Math.round(h * 0.21), w: colW, align: "center", size: landscape ? 26 : 22 },
    rule: { x: Math.round(w / 2 - 50), y: Math.round(h * 0.285), w: 100, size: 3 },
    leadIn: { x: pad, y: Math.round(h * 0.335), w: colW, align: "center", size: 21 },
    recipientName: { x: pad, y: Math.round(h * 0.39), w: colW, align: "center", size: landscape ? 52 : 44 },
    bodyLine: { x: pad + 30, y: Math.round(h * 0.505), w: colW - 60, align: "center", size: 21 },
    qr: { x: pad, y: h - 145, w: 70 },
    logo: { x: w - pad - 110, y: h - 150, w: 110 },
  };
  seats.forEach((x, i) => { els[`sig${i}`] = { x, y: h - 205, w: SIG_W, align: "center", size: 32 }; });
  return els;
}

/* Adding or removing a signatory re-seats the row, but never overrides a block the chair has dragged somewhere deliberate (`moved`). */
export function reseatSignatures(elements: Elements, orientation: Orientation, count: number): Elements {
  const { w, h } = BASE_SIZES[orientation] || BASE_SIZES.landscape;
  const seats = signatureSeats(w, Math.max(1, count));
  const next: Elements = { ...elements };
  for (let i = 0; i < 3; i++) {
    const id = `sig${i}`;
    if (i >= count) { delete next[id]; continue; }
    const existing = next[id];
    if (existing?.moved) continue;
    next[id] = { ...(existing || { w: SIG_W, align: "center" as const, size: 32 }), x: seats[i], y: existing?.y ?? h - 205 };
  }
  return next;
}

/** The starting design of a new certificate. */
export function defaultDesign(typeKey: CertTypeKey, templateKey: string, signatory: Signatory = { name: "", title: "Conference Chair" }): Design {
  const template = getTemplate(templateKey);
  const type = getCertificateType(typeKey);
  return {
    templateKey: template.key, layout: template.layout, palette: { ...template.palette }, orientation: "landscape",
    headline: "CERTIFICATE", typeLine: type.line, leadIn: "This certificate is proudly awarded to", bodyLine: type.body,
    signatories: [signatory], showQr: true, showLogo: true, logoSrc: null, elements: defaultElements("landscape", 1), typeKey,
  };
}

export interface CertificateDesign { id: string; conferenceId: string; name: string; typeKey: CertTypeKey; design: Design; createdAt: number }

/* ---------------- Audience ---------------- */
export interface Recipient {
  /** Stable key of this row (so a fix typed into the table survives the list being re-resolved). */
  key?: string;
  name: string; email: string; affiliation: string; roleLabel: string;
  paperId?: string; paperTitle?: string; ticketType?: string;
  reviewsAssigned?: number; reviewsDone?: number; reviewerId?: string;
  /** When the certificate was issued (ms); the merge field {{issueDate}} reads it, and uses today's date for one not issued yet. */
  issuedAt?: number;
  manual?: boolean; source?: string; serial?: string;
}

/** What the audience sources read: the conference's submitted papers (as its chair sees them) and the reviewers rolled up from its review board. */
export interface AudienceContext { papers: ChairPaper[]; reviewers: ReviewerRoll[]; conference: Pick<Conference, "id" | "acronym" | "name" | "startDate" | "endDate" | "city" | "country"> & { contactEmail?: string }; /** Certificates of this type already issued in the conference (so a new send's IDs carry on from them). */ serialBase?: number }
export interface ReviewerRoll { reviewerId: string; name: string; email: string; assigned: number; done: number }

const accepted = (papers: ChairPaper[]) => papers.filter((p) => !p.withdrawn && (p.outcome === "accept" || p.outcome === "registered"));

/** One row per (author, paper) pair, so a person with two accepted papers gets two certificates, which is what a conference awards. */
function authorsOf(papers: ChairPaper[], { correspondingOnly = false } = {}): Recipient[] {
  const out: Recipient[] = [];
  papers.forEach((p) => {
    const marked = p.authors.filter((a) => a.corresponding);
    const authors = correspondingOnly ? (marked.length ? marked : p.authors.slice(0, 1)) : p.authors;
    authors.forEach((a) => out.push({ name: a.name, email: a.email || "", affiliation: a.affiliation || "", roleLabel: correspondingOnly ? "Presenting author" : "Author", paperId: p.id, paperTitle: p.title }));
  });
  return out;
}

/** The reviewers of every paper rolled up across the conference: one row per person, with how many reviews they were given and finished.
 *  Only reviewers who accepted an assignment count; the chair's own reviews do not. */
export function reviewerRollup(board: ReviewBoard | null): ReviewerRoll[] {
  const byId = new Map<string, ReviewerRoll>();
  Object.values(board?.papers ?? {}).forEach((entry) => entry.reviewers.forEach((r) => {
    if (r.byChair || r.response !== "accepted") return;
    const cur = byId.get(r.reviewerId) ?? { reviewerId: r.reviewerId, name: r.name, email: r.email, assigned: 0, done: 0 };
    cur.assigned += 1;
    if (r.review) cur.done += 1;
    byId.set(r.reviewerId, cur);
  }));
  return [...byId.values()];
}
const reviewerRows = (list: ReviewerRoll[]): Recipient[] => list.map((r) => ({ name: r.name, email: r.email, affiliation: "", roleLabel: "Reviewer", reviewsAssigned: r.assigned, reviewsDone: r.done, reviewerId: r.reviewerId }));

export interface AudienceSource { key: string; label: string; note: string; blockedReason?: string; resolve: (ctx: AudienceContext) => Recipient[] }
export const AUDIENCE_SOURCES: AudienceSource[] = [
  { key: "presenting-authors", label: "Presenting authors", note: "The corresponding author on every accepted submission.", resolve: ({ papers }) => authorsOf(accepted(papers), { correspondingOnly: true }) },
  { key: "accepted-authors", label: "Accepted authors", note: "Every named author on an accepted submission, co-authors included.", resolve: ({ papers }) => authorsOf(accepted(papers)) },
  { key: "published-authors", label: "Published papers", note: "Accepted submissions whose camera-ready file has been confirmed.", resolve: () => [], blockedReason: "No camera-ready file has been confirmed yet." },
  { key: "reviewers-complete", label: "Reviewers who finished", note: "Reviewers who submitted every review assigned to them.", resolve: ({ reviewers }) => reviewerRows(reviewers.filter((r) => r.assigned > 0 && r.done === r.assigned)) },
  { key: "reviewers-all", label: "All reviewers", note: "Everyone who accepted at least one review assignment.", resolve: ({ reviewers }) => reviewerRows(reviewers) },
  // Registrations and the organising committee are not in the database yet, so nobody is listed (and nobody is invented).
  { key: "registered-attendees", label: "Registered attendees", note: "Everyone with a completed registration for this conference.", resolve: () => [] },
  { key: "committee", label: "Committee & session chairs", note: "People listed on the organising committee for this conference.", resolve: () => [] },
];
export const getAudienceSource = (key: string): AudienceSource => AUDIENCE_SOURCES.find((s) => s.key === key) ?? AUDIENCE_SOURCES[0];

export interface AudienceCondition { key: string; label: string; test: (r: Recipient) => boolean; appliesTo?: string[] }
export const AUDIENCE_CONDITIONS: AudienceCondition[] = [
  { key: "has-email", label: "Has an email address on file", test: (r) => !!r.email },
  { key: "reviews-2plus", label: "Completed 2 or more reviews", test: (r) => (r.reviewsDone || 0) >= 2, appliesTo: ["reviewers-complete", "reviewers-all"] },
  { key: "physical-ticket", label: "Attending in person", test: (r) => r.ticketType === "Physical", appliesTo: ["registered-attendees"] },
  { key: "has-affiliation", label: "Has an affiliation on file", test: (r) => !!r.affiliation },
];

/* ---------------- Sends ---------------- */
export interface IssuedCertificate {
  key?: string; serial: string; name: string; email: string; affiliation: string; roleLabel: string; paperId: string; paperTitle: string;
  issuedAt: number; status: "sent" | "bounced"; bounceReason: string | null; opened: boolean; downloaded: boolean; verifiedCount: number;
  /** Withdrawn by a chair (the public check says so); `replacedBy` is the ID of the corrected certificate. */
  revokedAt?: number | null; revokeReason?: string | null; replacedBy?: string | null; resentAt?: number | null;
}
export interface DistributionAudience { sourceKey: string; conditions: string[]; excludeAlreadyIssued: boolean; timing: string }
export interface DistributionEmail { subject: string; body: string; attachPdf: boolean; saveToAccount: boolean; bccConference: boolean }
export interface ManualPerson { key: string; name: string; email: string; affiliation: string; roleLabel: string; paperId?: string; paperTitle?: string }
export interface Distribution {
  id: string; conferenceId: string; certId: string; name: string;
  audience: DistributionAudience; email: DistributionEmail; manual: ManualPerson[]; overrides: Record<string, { email?: string }>;
  status: "draft" | "sent"; sentAt: number | null; issued: IssuedCertificate[]; createdAt: number;
}

export const DEFAULT_EMAIL_BODY = [
  "Dear {{recipientName}},",
  "",
  "Thank you for taking part in {{conferenceName}}.",
  "",
  "Your certificate is attached. It is also saved in your Smartconferu account, and the QR code on it links to a page anyone can use to confirm it is genuine.",
  "",
  "With warm regards,",
  "The {{conferenceName}} organising committee",
].join("\n");

/** The starting point of a new send. */
export function defaultDistribution(cert: Pick<CertificateDesign, "typeKey">, sourceKey?: string, name?: string): Pick<Distribution, "name" | "audience" | "email"> {
  const type = getCertificateType(cert.typeKey);
  const key = sourceKey || type.defaultSource;
  return {
    name: name || `${getAudienceSource(key).label} — ${type.short}`,
    audience: { sourceKey: key, conditions: ["has-email"], excludeAlreadyIssued: true, timing: "manual" },
    email: { subject: `Your ${type.label} — {{conferenceName}}`, body: DEFAULT_EMAIL_BODY, attachPdf: true, saveToAccount: true, bccConference: false },
  };
}

/* ---------------- Certificate IDs ---------------- */
const TYPE_CODE: Record<string, string> = { presentation: "PRS", participation: "PAR", appreciation: "APP", publication: "PUB", author: "AUT" };
export function certificateSerial(conference: { acronym?: string } | null | undefined, typeKey: string | undefined, index: number): string {
  /* "ISBM 2026" -> "ISBM26", not "ISBM20": the letters and the year are pulled out separately so a blind character cap can never cut a year in half. */
  const acronym = conference?.acronym || "";
  const letters = (acronym.match(/[A-Za-z]+/g) || []).join("").toUpperCase().slice(0, 8);
  const year = (acronym.match(/\d{4}/) || [])[0];
  const prefix = `${letters || "CNF"}${year ? year.slice(2) : ""}`;
  return `${prefix}-${TYPE_CODE[typeKey ?? ""] || "GEN"}-${String(index).padStart(3, "0")}`;
}
/** The public page a certificate's QR code opens. */
export const verifyPath = (serial: string) => `/verify/${encodeURIComponent(serial)}`;
export function verifyUrl(serial: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}${verifyPath(serial)}`;
}

/* ---------------- The rule engine ----------------
   Resolve a send's audience into recipients, apply its conditions, attach a stable key and a serial, and report what was left out and why.
   The "why" is half the value: a chair who can't see why six people dropped off the list won't trust the list. */
export interface ResolvedAudience { source: AudienceSource; recipients: Recipient[]; excluded: Array<Recipient & { reason: string }>; blockedReason: string | null }
export function resolveAudience(dist: Pick<Distribution, "id" | "audience" | "manual" | "overrides" | "issued" | "certId"> | null, ctx: AudienceContext, typeKey: string | undefined): ResolvedAudience {
  if (!dist) return { source: AUDIENCE_SOURCES[0], recipients: [], excluded: [], blockedReason: null };
  const source = getAudienceSource(dist.audience.sourceKey);
  const raw = source.resolve(ctx);
  const withKeys: Recipient[] = raw.map((r, i) => {
    const key = `${source.key}:${r.paperId || r.reviewerId || r.email || r.name}:${i}`;
    return { ...r, ...(dist.overrides[key] || {}), key, source: source.key };
  });
  const manual: Recipient[] = dist.manual.map((r) => ({ ...r, manual: true, ...(dist.overrides[r.key] || {}) }));
  const all = [...withKeys, ...manual];

  /* A live audience re-resolves every time it is read, so without this a chair who leaves one running would re-issue to the same person each
     time their record changed. Matched on the issued record rather than on the rule, because the rule is the thing that keeps moving. */
  const alreadyIssued = dist.audience.excludeAlreadyIssued ? new Set(dist.issued.map((r) => (r.email || r.name || "").toLowerCase())) : new Set<string>();

  const active = AUDIENCE_CONDITIONS.filter((c) => dist.audience.conditions.includes(c.key));
  const excluded: Array<Recipient & { reason: string }> = [];
  const included: Recipient[] = [];
  all.forEach((r) => {
    if (alreadyIssued.has((r.email || r.name || "").toLowerCase())) { excluded.push({ ...r, reason: "Already has this certificate" }); return; }
    const failed = active.find((c) => !c.test(r));
    if (failed) excluded.push({ ...r, reason: failed.label });
    else included.push(r);
  });

  const base = ctx.serialBase ?? 0;
  const withSerials = included.map((r, i) => ({ ...r, serial: certificateSerial(ctx.conference, typeKey, base + i) }));
  return { source, recipients: withSerials, excluded, blockedReason: source.blockedReason || null };
}

/** Counts an audience source without needing a send: used by the pickers, which show real numbers before anything has been created. */
export function countAudience(sourceKey: string, ctx: AudienceContext, typeKey?: string): number {
  const stub = { id: `count-${sourceKey}`, certId: "", audience: { sourceKey, conditions: ["has-email"], excludeAlreadyIssued: false, timing: "manual" }, manual: [], overrides: {}, issued: [] };
  return resolveAudience(stub, ctx, typeKey).recipients.length;
}

export interface DeliveryStats { total: number; delivered: number; opened: number; downloaded: number; verified: number; bounced: number }
export function deliveryStats(issued: IssuedCertificate[]): DeliveryStats {
  const total = issued.length;
  const delivered = issued.filter((r) => r.status !== "bounced").length;
  return {
    total, delivered,
    opened: issued.filter((r) => r.opened).length,
    downloaded: issued.filter((r) => r.downloaded).length,
    verified: issued.filter((r) => r.verifiedCount > 0).length,
    bounced: total - delivered,
  };
}

/* ---------------- Merge fields ----------------
   Every field here has real data behind it: the recipient's row, the conference's own record, the certificate being issued or the signature block on
   the design. Nothing is invented: a field whose data is missing prints nothing (and the checks say so).
   `email` says where an EMAIL can use the field: "all" = every mode; "api" = only the own backend, which fills it itself (the Supabase mail server
   knows just the original ten); "never" = the certificate's own text only. */
export type FieldEmail = "all" | "api" | "never";
export interface MergeField { token: string; label: string; email: FieldEmail }
export const MERGE_FIELDS: Array<{ group: string; fields: MergeField[] }> = [
  { group: "Recipient", fields: [{ token: "recipientName", label: "Full name", email: "all" }, { token: "affiliation", label: "Affiliation / institution", email: "all" }, { token: "roleLabel", label: "Role", email: "all" }] },
  { group: "Submission", fields: [{ token: "paperTitle", label: "Paper title", email: "all" }, { token: "paperId", label: "Paper ID", email: "all" }] },
  { group: "Conference", fields: [{ token: "conferenceName", label: "Conference name", email: "all" }, { token: "conferenceAcronym", label: "Acronym", email: "all" }, { token: "conferenceDates", label: "Dates", email: "all" }, { token: "conferenceVenue", label: "Venue", email: "all" }, { token: "conferenceCity", label: "City", email: "api" }, { token: "conferenceCountry", label: "Country", email: "api" }, { token: "conferenceYear", label: "Year", email: "api" }] },
  { group: "Certificate", fields: [{ token: "certificateType", label: "Certificate type", email: "api" }, { token: "serial", label: "Certificate ID", email: "all" }, { token: "issueDate", label: "Issue date", email: "api" }, { token: "verificationUrl", label: "Verification link", email: "api" }] },
  { group: "Signatory", fields: [{ token: "signatoryName", label: "Signatory name", email: "never" }, { token: "signatoryTitle", label: "Signatory designation", email: "never" }] },
];
/** What people ask for that the platform has no record of yet, so there is no field for it (shown in the designer so nobody looks for it). */
export const UNAVAILABLE_FIELDS: Array<{ label: string; why: string }> = [
  { label: "Presentation date", why: "needs the programme, which is not in the database yet" },
  { label: "Organizer name", why: "a conference has no organizer field yet" },
  { label: "Chair / director signature fields", why: "signatures are pictures: add one from the Signatures tab" },
];
/** The fields an email can use in the current data source. */
export function emailMergeFields(mode: "api" | "other"): MergeField[] {
  return MERGE_FIELDS.flatMap((g) => g.fields).filter((f) => f.email === "all" || (f.email === "api" && mode === "api"));
}

type DatedConference = { startDate?: string; endDate?: string } | null | undefined;
export function formatConferenceDates(conference: DatedConference): string {
  if (!conference?.startDate) return "";
  const fmt = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  return conference.endDate && conference.endDate !== conference.startDate ? `${fmt(conference.startDate)} – ${fmt(conference.endDate)}` : fmt(conference.startDate);
}

type MergeConference = { name?: string; acronym?: string; startDate?: string; endDate?: string; city?: string; country?: string } | null | undefined;
type MergeRecipient = Partial<Pick<Recipient, "name" | "affiliation" | "roleLabel" | "serial" | "paperTitle" | "paperId" | "issuedAt">> | null | undefined;
/** What does not come from the person or the conference: the certificate type, who signs, and the date to use when none was issued yet. */
export interface MergeExtras { typeKey?: string; signatory?: { name?: string; title?: string }; now?: Date }

const longDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

export function mergeValues(recipient: MergeRecipient, conference: MergeConference, extras: MergeExtras = {}): Record<string, string> {
  const issued = recipient?.issuedAt !== undefined && recipient.issuedAt !== null ? new Date(recipient.issuedAt) : (extras.now ?? new Date());
  const type = extras.typeKey ? CERTIFICATE_TYPES.find((t) => t.key === extras.typeKey) : undefined;
  return {
    recipientName: recipient?.name || "",
    affiliation: recipient?.affiliation || "",
    roleLabel: recipient?.roleLabel || "",
    serial: recipient?.serial || "",
    paperTitle: recipient?.paperTitle || "",
    paperId: recipient?.paperId || "",
    conferenceName: conference?.name || "",
    conferenceAcronym: conference?.acronym || "",
    conferenceDates: formatConferenceDates(conference),
    conferenceVenue: [conference?.city, conference?.country].filter(Boolean).join(", "),
    conferenceCity: conference?.city || "",
    conferenceCountry: conference?.country || "",
    conferenceYear: conference?.startDate ? conference.startDate.slice(0, 4) : "",
    certificateType: type?.label ?? "",
    issueDate: Number.isNaN(issued.getTime()) ? "" : longDate(issued),
    verificationUrl: recipient?.serial ? verifyUrl(recipient.serial) : "",
    signatoryName: extras.signatory?.name?.trim() || "",
    signatoryTitle: extras.signatory?.title?.trim() || "",
  };
}

/** An unresolved token collapses to an empty string rather than printing braces onto a certificate. */
export function applyMerge(text: string | undefined, values: Record<string, string>): string {
  if (!text) return "";
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, token: string) => values[token] ?? "");
}

/** A stand-in recipient so the designer and the template picker always have something to draw. */
export function sampleRecipient(conference: { acronym?: string } | null | undefined, typeKey: string | undefined): Recipient & { serial: string } {
  return { name: "Dr. Anika Rao", email: "", affiliation: "IIT Bombay", roleLabel: "Presenting author", paperId: "SUB-014", paperTitle: "Federated Learning for Edge Diagnostics", serial: certificateSerial(conference, typeKey, 0) };
}
