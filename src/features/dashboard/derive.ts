import type {
  AuthorPaperResult, Conference, ConferenceRole, DashboardSource, SourceConference,
} from "@/types/conference";

/* Pure derivation of the My Conferences rows from the source records. Ported from the prototype
   (src/author-dashboard/data.js) minus every generated/sample branch: a conference with no papers
   of yours has none, so its figures are zero. */

const DAY = 24 * 60 * 60 * 1000;

export const toDate = (iso: string): Date => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const shiftDays = (iso: string, days: number): Date => {
  const d = toDate(iso);
  d.setDate(d.getDate() + days);
  return d;
};
const shortDate = (iso: string) => toDate(iso).toLocaleDateString("en-US", { day: "numeric", month: "short" });
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/* ---------- vocabulary ---------- */

export interface PaperResultDef {
  key: AuthorPaperResult;
  label: string;
  short: string;
  color: string;
  action?: boolean;
  counted?: boolean;
}

/** The outcomes the author sees — every one comes from the paper's *notified* outcome (nothing notified = "No Decision"),
 *  so an unpublished decision never shows here. `counted` ones are dashboard numbers; drafts only feed chips and filters. */
export const PAPER_RESULTS: PaperResultDef[] = [
  { key: "not_registered", label: "Accepted – registration pending", short: "registration pending", color: "var(--warning)", action: true, counted: true },
  { key: "registered", label: "Accepted & registered", short: "accepted & registered", color: "var(--success)", counted: true },
  { key: "not_accepted", label: "Rejected", short: "rejected", color: "var(--ink-soft)", counted: true },
  { key: "revise", label: "Revision Required", short: "revision required", color: "var(--warning)", counted: true },
  { key: "waitlist", label: "Waitlisted", short: "waitlisted", color: "var(--ink-soft)", counted: true },
  { key: "no_result", label: "No Decision", short: "no decision", color: "var(--ink-soft)", counted: true },
  { key: "draft", label: "Paper Upload Pending", short: "upload pending", color: "var(--ink-muted)" },
];

export type OutcomeKey = "submitted" | "registered" | "notRegistered" | "pending" | "rejected" | "revise" | "waitlist" | "noDecision";

export interface OutcomeColumn {
  key: OutcomeKey;
  label: string;
  color: string;
  accepted?: boolean;
  action?: boolean;
}

/** Option D splits "Accepted" three ways: registered / not registered (conference over) / registration pending. */
export const OUTCOME_COLUMNS: OutcomeColumn[] = [
  { key: "submitted", label: "Submitted", color: "var(--navy)" },
  { key: "registered", label: "Registered", color: "var(--success)", accepted: true },
  { key: "notRegistered", label: "Not registered", color: "var(--danger)", accepted: true },
  { key: "pending", label: "Registration pending", color: "var(--warning)", accepted: true, action: true },
  { key: "rejected", label: "Not Accepted", color: "var(--ink-soft)" },
  { key: "revise", label: "Revision Required", color: "var(--warning)" },
  { key: "waitlist", label: "Waitlisted", color: "var(--ink-soft)" },
  { key: "noDecision", label: "No Decision", color: "var(--ink-soft)" },
];

export const NEXT_STEP_OPTIONS = [
  { key: "register", label: "Register now" },
  { key: "draft", label: "Upload & submit your paper" },
  { key: "live", label: "Happening now" },
  { key: "revise", label: "Revision required" },
  { key: "waitlist", label: "Waitlisted" },
  { key: "wait", label: "No decision yet" },
  { key: "ready", label: "You're all set" },
  { key: "feedback", label: "Share feedback" },
  { key: "none", label: "Nothing to do" },
];

export const COMMITTEE_ROLES = [
  "Conference Chair", "Program Secretary", "Conference Secretary", "Technical Program Committee Chair",
  "Technical Program Committee Member", "Advisory Committee", "Session Chair", "Publicity Chair", "Publication Chair",
];

const AUTHOR_CERT_TYPES = ["presentation", "author", "publication", "participation"];

/* ---------- row shape ---------- */

export interface CertificateState {
  issued: boolean;
  count: number;
  title: string;
  reason: string;
}

export interface NextStep {
  key: string;
  text: string;
  action?: string | boolean;
  tone?: "warning" | "danger";
  /** Extra explanation, shown as a tooltip. */
  note?: string;
}

export interface DateHint {
  text: string;
  tone: "live" | "soon" | "later" | "past";
}

export interface ReviewerFigures {
  assigned: number;
  done: number;
  pending: number;
  declined: number;
  due: Date;
  dueSubId: string | null;
  overdue: boolean;
  certificate: CertificateState;
  next: NextStep;
}

export interface ChairFigures {
  received: number;
  accepted: number;
  rejected: number;
  undecided: number;
  withdrawn: number;
  registrations: number;
  next: NextStep;
}

export interface CommitteeFigures {
  label: string;
  certificate: CertificateState;
  next: NextStep;
}

export type AuthorOutcomes = Record<OutcomeKey, number> & { accepted: number };

export interface DashboardRow {
  conf: Conference;
  roles: ConferenceRole[];
  counts: Record<AuthorPaperResult, number>;
  sent: number;
  accepted: number;
  hint: DateHint;
  year: string;
  certificate: CertificateState;
  anyCertificate: boolean;
  next: NextStep;
  reviewer: ReviewerFigures | null;
  chair: ChairFigures | null;
  committee: CommitteeFigures | null;
  outcomes: { author: AuthorOutcomes | null };
}

/* ---------- pieces ---------- */

export function dateHint(conf: Conference, today: Date): DateHint {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const start = toDate(conf.startDate);
  const end = toDate(conf.endDate);
  if (t >= start && t <= end) return { text: `Today · Day ${Math.round((t.getTime() - start.getTime()) / DAY) + 1}`, tone: "live" };
  if (t > end) return { text: "Finished", tone: "past" };
  const days = Math.round((start.getTime() - t.getTime()) / DAY);
  if (days <= 60) return { text: days === 1 ? "tomorrow" : `in ${days} days`, tone: days <= 30 ? "soon" : "later" };
  const months = Math.round(days / 30);
  return { text: `in ${months} month${months === 1 ? "" : "s"}`, tone: "later" };
}

const noCertificate = (title: string, reason: string): CertificateState => ({ issued: false, count: 0, title, reason });

function authorCertificate(conf: Conference, counts: Record<AuthorPaperResult, number>, roles: ConferenceRole[], issued: boolean): CertificateState {
  const finished = conf.status === "archived";
  if (issued) return { issued: true, count: 1, title: "Certificate ready", reason: "Also sent to your email." };
  if (roles.includes("committee")) {
    return noCertificate("No certificate yet", finished
      ? "The organisers haven't sent committee certificates yet."
      : `Committee members get theirs by email automatically after the conference ends on ${shortDate(conf.endDate)}.`);
  }
  if (!roles.includes("author")) return noCertificate("No certificate", "Certificates go to authors who present and to committee members.");
  if (finished && counts.registered > 0) return noCertificate("No certificate yet", "The organisers haven't sent certificates for this conference yet.");
  if (counts.not_registered > 0) return noCertificate("No certificate yet", "Register for your accepted paper first. You'll get your certificate after you present.");
  if (counts.registered > 0) return noCertificate("No certificate yet", `You'll get your certificate after you present (conference starts ${shortDate(conf.startDate)}).`);
  return noCertificate("No certificate yet", "Certificates are issued for accepted papers that are presented.");
}

function roleCertificate(conf: Conference, count: number, role: "reviewer" | "chair" | "committee"): CertificateState {
  if (count > 0) {
    return { issued: true, count, title: count > 1 ? `${count} certificates ready` : "Certificate ready", reason: "Certificate of Appreciation. Also sent to your email." };
  }
  const when = conf.status === "archived" ? "The organisers haven't sent it yet." : `It's sent after the conference ends on ${shortDate(conf.endDate)}.`;
  const who = role === "reviewer" ? "Reviewers who complete their reviews get a Certificate of Appreciation."
    : role === "chair" ? "Conference chairs get a Certificate of Appreciation."
      : "Committee members get a Certificate of Appreciation by email automatically.";
  return noCertificate("No certificate yet", `${who} ${when}`);
}

function authorNext(conf: Conference, counts: Record<AuthorPaperResult, number>, hint: DateHint, roles: ConferenceRole[]): NextStep {
  if (!roles.includes("author")) return { key: "none", text: "—" };
  if (counts.not_registered > 0) return { key: "register", text: "Register now", action: true };
  if (counts.draft > 0 && conf.status === "active") return { key: "draft", text: "Upload & submit your paper", tone: "warning" };
  if (hint.tone === "live" && counts.registered > 0) return { key: "live", text: "Happening now" };
  if (conf.status === "archived" && counts.registered > 0) return { key: "feedback", text: "Share feedback" };
  if (counts.revise > 0) return { key: "revise", text: "Revision required", tone: "warning" };
  if (counts.waitlist > 0) return { key: "waitlist", text: "Waitlisted" };
  if (counts.no_result > 0) return { key: "wait", text: "No decision yet" };
  if (counts.registered > 0) return { key: "ready", text: "You're all set" };
  return { key: "none", text: "Nothing to do" };
}

function reviewerNext(conf: Conference, rv: Pick<ReviewerFigures, "assigned" | "overdue" | "pending">): NextStep {
  if (conf.status === "archived") return { key: "none", text: "Nothing to do" };
  if (rv.assigned === 0) return { key: "waiting", text: "No papers assigned yet" };
  if (rv.overdue) return { key: "overdue", text: `${plural(rv.pending, "review")} overdue`, action: "Review now", tone: "danger" };
  if (rv.pending > 0) return { key: "review", text: `${plural(rv.pending, "review")} to do`, action: "Start reviewing" };
  return { key: "done", text: "All reviews sent" };
}

function chairNext(conf: Conference, ch: Pick<ChairFigures, "undecided" | "accepted" | "registrations">): NextStep {
  if (conf.status === "archived") return { key: "none", text: "Finished" };
  if (ch.undecided > 0) return { key: "decide", text: `${plural(ch.undecided, "paper")} need a decision`, action: "Open submissions" };
  // `registrations` counts papers *marked* registered — real registrations can't be verified yet (no registration source).
  if (ch.accepted > ch.registrations) return { key: "registrations", text: `${plural(ch.accepted - ch.registrations, "accepted paper")} not marked registered`, note: "Registration can't be verified yet — this counts papers whose outcome is marked registered." };
  return { key: "ready", text: "All papers decided" };
}

function committeeNext(conf: Conference, hint: DateHint, cert: CertificateState): NextStep {
  if (cert.issued) return { key: "certificate", text: "Certificate ready" };
  if (conf.status === "archived") return { key: "none", text: "Finished" };
  return { key: "upcoming", text: hint.tone === "live" ? "Conference is on now" : `Conference ${hint.text}` };
}

/* ---------- rows ---------- */

export function buildDashboardRows(source: DashboardSource, today: Date): DashboardRow[] {
  return source.conferences.map(({ conference: conf, roles, committeeRole }: SourceConference) => {
    const counts = Object.fromEntries(PAPER_RESULTS.map((r) => [r.key, 0])) as Record<AuthorPaperResult, number>;
    if (roles.includes("author")) {
      source.authorPapers.filter((p) => p.conferenceId === conf.id).forEach((p) => { counts[p.result] += 1; });
    }
    const sent = counts.no_result + counts.revise + counts.waitlist + counts.not_registered + counts.registered + counts.not_accepted;
    const accepted = counts.not_registered + counts.registered;
    const hint: DateHint = conf.status === "archived" ? { text: "Finished", tone: "past" } : dateHint(conf, today);
    const certs = source.certificates.filter((c) => c.conferenceId === conf.id);
    const appreciation = certs.filter((c) => c.type === "appreciation").length;
    const over = conf.status === "archived" || toDate(conf.endDate) < today;

    let reviewer: ReviewerFigures | null = null;
    if (roles.includes("reviewer")) {
      const mine = source.reviewerAssignments.filter((a) => a.conferenceId === conf.id);
      const toReview = mine.filter((a) => !a.declined && !a.reviewed);
      const dueOf = (a: { dueDate: string | null }) => a.dueDate || conf.reviewDeadline || "";
      const next = toReview.map((a) => ({ id: a.paperLabel, iso: dueOf(a) })).filter((x) => x.iso).sort((a, b) => a.iso.localeCompare(b.iso))[0];
      const dueISO = next?.iso || conf.reviewDeadline || "";
      const due = dueISO ? toDate(dueISO) : shiftDays(conf.startDate, -45);
      const assigned = mine.length;
      const done = mine.filter((a) => a.reviewed).length;
      let declined = mine.filter((a) => a.declined).length;
      let pending = Math.max(0, assigned - done - declined);
      // Once a conference is archived, a review still pending counts as a rejected invitation.
      if (conf.status === "archived") { declined += pending; pending = 0; }
      const overdue = pending > 0 && conf.status !== "archived" && today > due;
      const figures = { assigned, done, pending, declined, due, dueSubId: next?.id ?? null, overdue };
      reviewer = { ...figures, certificate: roleCertificate(conf, appreciation, "reviewer"), next: reviewerNext(conf, figures) };
    }

    let chair: ChairFigures | null = null;
    if (roles.includes("chair")) {
      const papers = source.chairPapers.filter((p) => p.conferenceId === conf.id);
      const open = papers.filter((p) => !p.withdrawn);
      const acc = open.filter((p) => p.decision === "accepted").length;
      const rej = open.filter((p) => p.decision === "rejected").length;
      const figures = {
        received: papers.length, accepted: acc, rejected: rej, undecided: open.length - acc - rej,
        withdrawn: papers.length - open.length, registrations: open.filter((p) => p.registered).length,
      };
      chair = { ...figures, next: chairNext(conf, figures) };
    }

    let committee: CommitteeFigures | null = null;
    if (roles.includes("committee")) {
      const certificate = roleCertificate(conf, appreciation, "committee");
      committee = { label: committeeRole ?? "Committee Member", certificate, next: committeeNext(conf, hint, certificate) };
    }

    const authorIssued = certs.some((c) => AUTHOR_CERT_TYPES.includes(c.type));
    return {
      conf,
      roles,
      counts,
      sent,
      accepted,
      hint,
      year: conf.endDate.slice(0, 4),
      certificate: authorCertificate(conf, counts, roles, authorIssued),
      anyCertificate: certs.length > 0,
      next: authorNext(conf, counts, hint, roles),
      reviewer,
      chair,
      committee,
      outcomes: {
        author: roles.includes("author") ? {
          submitted: sent,
          registered: counts.registered,
          notRegistered: over ? counts.not_registered : 0,
          pending: over ? 0 : counts.not_registered,
          rejected: counts.not_accepted,
          revise: counts.revise,
          waitlist: counts.waitlist,
          noDecision: counts.no_result,
          accepted: accepted,
        } : null,
      },
    };
  });
}

/* ---------- totals ---------- */

export type RoleTotals = Record<string, number>;

export function sumRoleCounts(rows: DashboardRow[], role: "reviewer" | "chair" | "committee"): RoleTotals {
  if (role === "reviewer") {
    const list = rows.filter((r) => r.reviewer);
    const s = (k: "assigned" | "done" | "pending" | "declined") => list.reduce((a, r) => a + (r.reviewer?.[k] ?? 0), 0);
    return { conferences: list.length, assigned: s("assigned"), done: s("done"), pending: s("pending"), declined: s("declined"), overdue: list.filter((r) => r.reviewer?.overdue).length };
  }
  if (role === "chair") {
    const list = rows.filter((r) => r.chair);
    const s = (k: "received" | "accepted" | "rejected" | "undecided" | "withdrawn" | "registrations") => list.reduce((a, r) => a + (r.chair?.[k] ?? 0), 0);
    return { conferences: list.length, received: s("received"), accepted: s("accepted"), rejected: s("rejected"), undecided: s("undecided"), withdrawn: s("withdrawn"), registrations: s("registrations") };
  }
  const list = rows.filter((r) => r.committee);
  return {
    conferences: list.length,
    upcoming: list.filter((r) => r.conf.status === "active").length,
    finished: list.filter((r) => r.conf.status !== "active").length,
    certificates: list.filter((r) => r.committee?.certificate.issued).length,
  };
}

export function sumOutcomes(rows: DashboardRow[]): RoleTotals {
  const list = rows.filter((r) => r.outcomes.author);
  const total: RoleTotals = { conferences: list.length, accepted: 0 };
  OUTCOME_COLUMNS.forEach((c) => { total[c.key] = 0; });
  list.forEach((r) => {
    const o = r.outcomes.author as AuthorOutcomes;
    OUTCOME_COLUMNS.forEach((c) => { total[c.key] += o[c.key]; });
    total.accepted += o.accepted;
  });
  return total;
}

export function sumCounts(rows: DashboardRow[]): RoleTotals {
  const authorRows = rows.filter((r) => r.roles.includes("author"));
  const total: RoleTotals = { conferences: authorRows.length, sent: 0, accepted: 0, certificates: 0 };
  PAPER_RESULTS.forEach((r) => { total[r.key] = 0; });
  authorRows.forEach((row) => {
    PAPER_RESULTS.forEach((r) => { total[r.key] += row.counts[r.key]; });
    total.sent += row.sent;
    total.accepted += row.accepted;
  });
  total.certificates = rows.filter((r) => r.certificate.issued).length;
  return total;
}
