import { FileCheck } from "lucide-react";
import type { ReactNode } from "react";
import { ATTENDANCE_LABELS, PAYMENT_LABELS, attendanceLabel, type ChairConference, type ChairPaper, type ReviewBoard } from "@/types/chair";
import { CHAIR_STAGES, chairStageOf, isDecision, type Screening } from "./stage";

/* The Submissions list's column catalogue (the prototype's SUBMISSION_COLUMNS, submissionColumnTools and SUBMISSION_COLUMN_GROUPS):
   what each column shows, which ones are on by default, and the search box or dropdown under its title. Columns that need tables
   the database does not have (session & slot, the submission form's own answers) are not offered. Payment, attendance and presenter are
   what the chair records by hand on an accepted paper (Registration & attendance); other papers show a dash. */

export interface ColumnCtx { data: ChairConference; screening: Screening; board: ReviewBoard | null }
export interface ListColumn { key: string; group: "submission" | "authors" | "review" | "registration"; label: string; defaultOn: boolean; pinned?: boolean; render: (p: ChairPaper, ctx: ColumnCtx) => ReactNode }

export const COLUMN_GROUPS: Array<{ key: ListColumn["group"]; label: string }> = [
  { key: "submission", label: "Submission" },
  { key: "authors", label: "Authors" },
  { key: "review", label: "Review & decision" },
  { key: "registration", label: "Registration & attendance" },
];

const dash = () => <span style={{ color: "var(--border-strong)" }} className="text-xs">—</span>;
const pill = (text: string, color: string, bg: string) => <span style={{ color, background: bg }} className="whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold">{text}</span>;
const correspondingOf = (p: ChairPaper) => p.authors.find((a) => a.corresponding) ?? p.authors[0];

/** The decision column's text and colour: the decision type the chair picked, or the outcome's plain name. */
export function decisionOf(p: ChairPaper, data: ChairConference): { label: string; color: string } | null {
  if (!isDecision(p.outcome)) return null;
  const type = data.decisionTypes.find((t) => t.id === p.decisionTypeId) ?? data.decisionTypes.find((t) => t.outcome === p.outcome);
  const plain: Record<string, { label: string; color: string }> = { accept: { label: "Accept", color: "#16A34A" }, registered: { label: "Registered", color: "#16A34A" }, reject: { label: "Reject", color: "#DC2626" }, revise: { label: "Revision", color: "#D97706" }, waitlist: { label: "Waitlist", color: "#7C3AED" } };
  return type ? { label: type.label, color: type.color } : plain[p.outcome] ?? { label: p.outcome, color: "#64748B" };
}

export const COLUMNS: ListColumn[] = [
  { key: "id", group: "submission", label: "Submission ID", defaultOn: true, render: (p) => <span className="whitespace-nowrap text-xs font-semibold text-ink-muted">{p.id}</span> },
  {
    key: "title", group: "submission", label: "Title", defaultOn: true, pinned: true,
    render: (p) => (
      <div className="min-w-0 max-w-[clamp(200px,20vw,300px)]">
        <div className="text-[13px] font-bold leading-snug text-navy">{p.title}</div>
        <div className="mt-0.5 truncate text-[11.5px] text-ink-muted">{p.authors.map((a) => a.name).join(", ")}</div>
        {p.authors.some((a) => a.corresponding && !a.hasAccount) && <div title="The paper is linked to this author when they register with the email on the paper" className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-warning">Awaiting author account</div>}
      </div>
    ),
  },
  { key: "track", group: "submission", label: "Track", defaultOn: true, render: (p) => <span className="text-xs text-ink-soft">{p.track}</span> },
  { key: "type", group: "submission", label: "Presentation type", defaultOn: true, render: (p) => <span className="whitespace-nowrap text-xs text-ink-soft">{p.presentationType || "—"}</span> },
  {
    key: "status", group: "submission", label: "Status", defaultOn: true,
    render: (p, ctx) => {
      const c = chairStageOf(p, ctx.screening);
      const stage = CHAIR_STAGES.find((x) => x.key === c.key);
      const style = stage ? { color: stage.color, background: stage.bg } : { color: "var(--ink-muted)", background: "var(--muted)" };
      return <span style={style} title={stage ? `${c.label} · ${c.status}` : c.status} className="inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold">{c.status}</span>;
    },
  },
  { key: "submittedAt", group: "submission", label: "Submitted on", defaultOn: false, render: (p) => <span className="whitespace-nowrap text-xs text-ink-muted">{p.submittedAt || "—"}</span> },
  { key: "updatedAt", group: "submission", label: "Last update", defaultOn: true, render: (p) => <span className="whitespace-nowrap text-xs text-ink-muted">{p.lastUpdate || "—"}</span> },
  { key: "file", group: "submission", label: "Paper file", defaultOn: false, render: (p) => <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-primary"><FileCheck size={13} aria-hidden="true" /> {p.id}_v{Math.max(1, p.versions)}.pdf</span> },
  { key: "authors", group: "authors", label: "All author names", defaultOn: false, render: (p) => <span className="text-xs text-ink-soft">{p.authors.map((a) => a.name).join(", ")}</span> },
  { key: "corresponding", group: "authors", label: "Corresponding author", defaultOn: false, render: (p) => <span className="whitespace-nowrap text-xs text-ink-soft">{correspondingOf(p)?.name || "—"}</span> },
  { key: "email", group: "authors", label: "Email", defaultOn: false, render: (p) => <span className="text-xs text-ink-muted">{correspondingOf(p)?.email || "—"}</span> },
  { key: "affiliation", group: "authors", label: "Affiliation", defaultOn: false, render: (p) => <span className="text-xs text-ink-muted">{correspondingOf(p)?.affiliation || "—"}</span> },
  { key: "authorCount", group: "authors", label: "Number of authors", defaultOn: false, render: (p) => <span className="text-xs text-ink-soft">{p.authors.length}</span> },
  {
    key: "reviewProgress", group: "review", label: "Review progress", defaultOn: true,
    render: (p) => {
      if (!p.reviewersAssigned) return <span className="whitespace-nowrap text-xs font-semibold text-warning">none assigned</span>;
      return (
        <div className="flex items-center gap-2">
          <span className="block h-1.5 w-12 shrink-0 overflow-hidden rounded-full bg-muted"><span style={{ width: `${(p.reviewsReceived / p.reviewersAssigned) * 100}%` }} className="block h-full rounded-full bg-primary" /></span>
          <span className="whitespace-nowrap text-xs font-semibold text-ink-soft">{p.reviewsReceived}/{p.reviewersAssigned}</span>
        </div>
      );
    },
  },
  { key: "avgScore", group: "review", label: "Average score", defaultOn: true, render: (p) => (p.averageScore == null ? dash() : pill(`${p.averageScore}`, "var(--primary)", "var(--primary-soft)")) },
  {
    key: "reviewers", group: "review", label: "Assigned reviewers", defaultOn: false,
    render: (p, ctx) => {
      const names = (ctx.board?.papers[p.dbId]?.reviewers ?? []).map((r) => r.name);
      return names.length ? <span className="text-xs text-ink-soft">{names.join(", ")}</span> : dash();
    },
  },
  {
    key: "decision", group: "review", label: "Decision", defaultOn: true,
    render: (p, ctx) => {
      const d = decisionOf(p, ctx.data);
      return d
        ? <span style={{ color: d.color, background: `${d.color}1A`, border: `1px solid ${d.color}33` }} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold"><span style={{ background: d.color }} className="h-1.5 w-1.5 rounded-full" />{d.label}</span>
        : <span className="text-xs text-ink-faint">Pending</span>;
    },
  },
  {
    key: "payment", group: "registration", label: "Payment", defaultOn: true,
    render: (p) => {
      const r = p.registration;
      if (!r) return dash();
      const [color, bg] = PAYMENT_PILL[r.payment];
      return pill(PAYMENT_LABELS[r.payment], color, bg);
    },
  },
  {
    key: "attendance", group: "registration", label: "Attending", defaultOn: true,
    render: (p) => {
      const r = p.registration;
      if (!r) return dash();
      return r.attendance ? pill(ATTENDANCE_LABELS[r.attendance], r.attendance === "physical" ? "#7C3AED" : "#0369A1", r.attendance === "physical" ? "#F3E8FF" : "#E0F2FE") : <span className="whitespace-nowrap text-xs text-ink-faint">Not known</span>;
    },
  },
  { key: "presenter", group: "registration", label: "Presenter", defaultOn: false, render: (p) => (p.registration ? <span className="whitespace-nowrap text-xs text-ink-soft">{presenterOf(p) || "Not chosen"}</span> : dash()) },
];

const PAYMENT_PILL = { paid: ["#15803D", "var(--success-soft)"], waived: ["#0369A1", "#E0F2FE"], not_paid: ["#B45309", "var(--warning-soft)"] } as const;
/** The presenting author's name (or their email, when they left the author list). */
export const presenterOf = (p: ChairPaper) => p.registration?.presenterName || p.registration?.presenterEmail || "";
/** The text the Payment / Attending / Presenter filters compare (empty for a paper that is not accepted). */
export const registrationFilterValue: Record<"payment" | "attendance" | "presenter", (p: ChairPaper) => string> = {
  payment: (p) => (p.registration ? PAYMENT_LABELS[p.registration.payment] : ""),
  attendance: (p) => (p.registration ? attendanceLabel(p.registration.attendance) : ""),
  presenter: (p) => (p.registration ? presenterOf(p) || "Not chosen" : ""),
};
/** The registration columns, shown on the Registration stage even when the chair's saved columns leave them out. */
export const REGISTRATION_COLUMNS = ["payment", "attendance", "presenter"];

export const DEFAULT_COLUMNS = COLUMNS.filter((c) => c.defaultOn).map((c) => c.key);
/** Column widths as on the Peer Review list. Columns not listed size to what they hold. */
export const COLUMN_WIDTHS: Record<string, { min?: number; width?: string }> = {
  id: { min: 100 }, title: { min: 200, width: "clamp(200px, 20vw, 300px)" }, track: { min: 130 }, type: { min: 130 }, status: { min: 135 },
  submittedAt: { min: 115 }, updatedAt: { min: 115 }, reviewProgress: { min: 130 }, avgScore: { min: 105 }, decision: { min: 125 },
  payment: { min: 115 }, attendance: { min: 115 }, presenter: { min: 130 },
};

/* The filters under the column titles. */
const dateValue = (text: string | null) => { const t = Date.parse(text || ""); return Number.isNaN(t) ? null : t; };
export const ageBucket = (label: string) => { const t = dateValue(label); if (t == null) return "older"; const d = Math.floor((Date.now() - t) / 86400000); return d <= 7 ? "week" : d <= 30 ? "month" : "older"; };
export const progressOf = (p: ChairPaper) => (!p.reviewersAssigned ? "none" : p.reviewsReceived === 0 ? "waiting" : p.reviewsReceived >= p.reviewersAssigned ? "complete" : "partial");
export const scoreBand = (p: ChairPaper) => (p.averageScore == null ? "none" : p.averageScore >= 4 ? "high" : p.averageScore >= 3 ? "mid" : "low");
export const AGE_OPTIONS: Array<[string, string]> = [["all", "All"], ["week", "Last 7 days"], ["month", "8–30 days ago"], ["older", "Older"]];
export const REVIEW_PROGRESS_OPTIONS: Array<[string, string]> = [["all", "All"], ["none", "None assigned"], ["waiting", "No reviews in yet"], ["partial", "Some reviews in"], ["complete", "All reviews in"]];
export const SCORE_BAND_OPTIONS: Array<[string, string]> = [["all", "All"], ["high", "4 and above"], ["mid", "3 to 4"], ["low", "Below 3"], ["none", "No score yet"]];
/** "2 of 3 reviews in" and its kin are one status here, so the dropdown stays short. */
export const statusFilterValue = (p: ChairPaper, screening: Screening) => { const st = chairStageOf(p, screening).status; return /^\d+ of \d+ reviews in$/.test(st) ? "Reviews in progress" : st; };

/* Which columns a chair has on, kept per conference in this browser (the prototype keeps them for the visit only), and the named views. */
const colKey = (slug: string) => `smartconferu.submissionColumns.${slug}`;
const viewKey = (slug: string) => `smartconferu.submissionViews.${slug}`;
export interface SavedView { id: string; name: string; columns: string[]; filter: string }
const valid = (keys: unknown): string[] | null => (Array.isArray(keys) ? keys.filter((k): k is string => typeof k === "string" && COLUMNS.some((c) => c.key === k)) : null);
export function readColumns(slug: string): string[] {
  try { const v = valid(JSON.parse(window.localStorage.getItem(colKey(slug)) || "null")); if (v && v.includes("title")) return v; } catch { /* storage off */ }
  return DEFAULT_COLUMNS;
}
export function writeColumns(slug: string, keys: string[]) { try { window.localStorage.setItem(colKey(slug), JSON.stringify(keys)); } catch { /* storage off */ } }
export function readViews(slug: string): SavedView[] {
  try { const v = JSON.parse(window.localStorage.getItem(viewKey(slug)) || "[]") as SavedView[]; return Array.isArray(v) ? v.filter((x) => x && typeof x.id === "string" && typeof x.name === "string" && valid(x.columns)) : []; } catch { return []; }
}
export function writeViews(slug: string, views: SavedView[]) { try { window.localStorage.setItem(viewKey(slug), JSON.stringify(views)); } catch { /* storage off */ } }
