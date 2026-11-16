import type { AutoCheck, ChairPaper, ScreeningCheck, ScreeningCriteria, ScreeningRecord } from "@/types/chair";
import { checkDecisionOf, inPeerReview, screeningStageOf } from "./stage";

/* The Initial Check's rules (the prototype's src/chair-plagiarism/data.js: DECISIONS, blankCheck, lengthState, evaluateCheck). The
   chair's record of a version is `submissions.screening[n]`; what the PDF itself showed is `submission_files.auto_check`. */

export interface DecisionMeta { key: string; label: string; color: string; bg: string; hint: string }
export const CHECK_DECISIONS: DecisionMeta[] = [
  { key: "pending", label: "No Decision", color: "var(--ink-muted)", bg: "var(--muted)", hint: "Not decided yet." },
  { key: "passed", label: "Passed", color: "#15803D", bg: "var(--success-soft)", hint: "Meets the requirements — moves on to Plagiarism check." },
  { key: "hold", label: "Hold", color: "#475569", bg: "#E2E8F0", hint: "Paused — nothing is sent to the author." },
  { key: "revision", label: "Revision", color: "#B45309", bg: "#FFF4E5", hint: "The author must fix it and upload a new version. Send the email." },
  { key: "reject", label: "Reject", color: "#B91C1C", bg: "#FEE2E2", hint: "The paper is out of the process. Send the email to tell the author." },
];
/** Decisions that are emailed to the author. */
export const EMAILED = ["revision", "reject"];

export const COLUMN_OPTIONS = [{ key: "single", label: "Single column" }, { key: "double", label: "Double column" }] as const;

export const pageRange = (c: ScreeningCriteria, column: string | undefined) => (column === "double" ? { min: c.doubleMinPages, max: c.doubleMaxPages } : { min: c.minPages, max: c.maxPages });
export type LengthState = "blank" | "ok" | "short" | "long";
export function lengthState(check: ScreeningCheck, c: ScreeningCriteria): LengthState {
  const raw = String(check.pages ?? "").trim();
  if (!raw) return "blank";
  const { min, max } = pageRange(c, check.column);
  const pages = Number(raw);
  return pages < min ? "short" : pages > max ? "long" : "ok";
}
export const columnOk = (check: ScreeningCheck, c: ScreeningCriteria) => c.column === "either" || check.column === c.column;

export const blankCheck = (c: ScreeningCriteria): ScreeningCheck => ({ editable: true, english: true, column: c.column === "double" ? "double" : "single", pages: "", decision: "pending", comment: "" });

/** The values the automatic check found, ready to merge into a check (nothing while it is running or when it failed). */
export function autoValues(auto: AutoCheck | null): Partial<ScreeningCheck> {
  if (!auto || auto.status !== "done") return {};
  const out: Partial<ScreeningCheck> = {};
  if (Number.isFinite(auto.pages)) out.pages = String(auto.pages);
  if (typeof auto.editable === "boolean") out.editable = auto.editable;
  if (typeof auto.english === "boolean") out.english = auto.english;
  if (auto.column) out.column = auto.column;
  return out;
}

export interface CheckItem { key: string; label: string; ok: boolean; problem: string; /** What was found, in words (the report's right-hand column). */ value: string }
/** Each requirement against the criteria; `problem` is the plain sentence the author receives when it fails. */
export function evaluateCheck(check: ScreeningCheck, c: ScreeningCriteria): CheckItem[] {
  const pages = Number(check.pages) || 0;
  const recorded = check.pages !== null && check.pages !== undefined && String(check.pages).trim() !== "";
  const { min, max } = pageRange(c, check.column);
  const layout = check.column === "double" ? "double column" : "single column";
  const want = COLUMN_OPTIONS.find((o) => o.key === c.column)?.label.toLowerCase();
  const items: CheckItem[] = [
    { key: "editable", label: "PDF Editable", ok: !!check.editable, value: check.editable ? "Yes" : "No — scanned / image PDF", problem: "The paper is not editable (scanned or image-only PDF). Please upload a text-based PDF or Word file." },
    { key: "english", label: "English", ok: !!check.english, value: check.english ? "Yes" : "No", problem: "The paper must be written in English." },
    { key: "column", label: "Paper Layout", ok: columnOk(check, c), value: COLUMN_OPTIONS.find((o) => o.key === check.column)?.label ?? "—", problem: c.column === "either" ? "" : `Please use the ${want} conference template.` },
    { key: "pages", label: "Page Count", ok: !recorded || (pages >= min && pages <= max), value: recorded ? `${pages} page${pages === 1 ? "" : "s"} (${layout}: ${min}–${max})` : "Not recorded", problem: pages < min ? `The paper is too short (${pages} pages). In ${layout} the minimum is ${min} pages.` : `The paper is too long (${pages} pages). In ${layout} the maximum is ${max} pages.` },
  ];
  (check.other ?? []).forEach((o, i) => items.push({ key: `other-${o.key ?? i}`, label: o.label, ok: false, value: "Missing", problem: o.problem }));
  return items;
}

/** A version's check as the page shows it: the blank check, then what the PDF showed, then what the chair saved. */
export function checkOf(rec: ScreeningRecord | undefined, auto: AutoCheck | null, c: ScreeningCriteria): ScreeningCheck & { decision: string } {
  return { ...blankCheck(c), ...autoValues(auto), ...(rec?.check ?? {}), decision: checkDecisionOf(rec) };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const fmtDate = (d: Date) => `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
export const todayLabel = () => fmtDate(new Date());
export const inDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return fmtDate(d); };
export const toIsoDay = (label: string) => { const d = new Date(label); return Number.isNaN(d.getTime()) ? "" : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
export const fromIsoDay = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return y ? fmtDate(new Date(y, m - 1, d)) : ""; };
export const isOverdue = (deadline: string | undefined) => { if (!deadline) return false; const t = Date.parse(deadline); return !Number.isNaN(t) && t < new Date().setHours(0, 0, 0, 0); };

/** The record after a change to the check (the prototype's setCheck): values the chair sets are remembered as theirs, a new
 *  decision has not been emailed yet, and leaving "Revision" drops the correction request. */
export function withCheckPatch(rec: ScreeningRecord | undefined, auto: AutoCheck | null, c: ScreeningCriteria, patch: Partial<ScreeningCheck>): ScreeningRecord {
  const edited = { ...(rec?.check?.edited ?? {}) };
  for (const k of ["editable", "english", "column", "pages"] as const) if (k in patch) edited[k] = true;
  const before = checkDecisionOf(rec);
  const check: ScreeningCheck = { ...checkOf(rec, auto, c), ...patch, edited, at: todayLabel(), by: "Conference Chair" };
  check.passed = check.decision === "passed";
  if ("decision" in patch) { delete check.autoSet; check.chairSet = true; }
  if (patch.decision && patch.decision !== before) check.emailedAt = null;
  const next: ScreeningRecord = { ...(rec ?? {}), check };
  if (check.decision !== "revision") delete next.correction;
  return next;
}

/* ---------- plagiarism check ---------- */
export const PLAG_DECISIONS: DecisionMeta[] = [
  CHECK_DECISIONS[0],
  { key: "clear", label: "Plag Cleared", color: "#15803D", bg: "var(--success-soft)", hint: "No plagiarism issue — reviewers can be assigned." },
  CHECK_DECISIONS[2],
  { key: "revision", label: "Revision", color: "#C2410C", bg: "#FFEDD5", hint: "The author must rewrite or cite the matched parts and upload a new version. Send the email." },
  CHECK_DECISIONS[4],
];
export const plagDecisionOf = (rec: ScreeningRecord | undefined): string => rec?.outcome?.kind || "pending";
export const MAX_REPORT_FILES = 2;
export const reportFilesOf = (rec: ScreeningRecord | undefined): string[] => (rec?.report?.files ?? [rec?.report?.file]).filter((x): x is string => Boolean(x));
export const PLAG_REVISION_PROBLEM = "Some passages overlap with existing sources and need to be rewritten or properly cited.";
export const PLAG_REJECT_PROBLEM = "The paper contains too much overlapping or AI-generated text to be accepted.";

/** The record after the chair picks a plagiarism decision (the prototype's setOutcome); "pending" takes it back. */
export function withOutcome(rec: ScreeningRecord | undefined, kind: string): ScreeningRecord {
  const next: ScreeningRecord = { ...(rec ?? {}) };
  if (kind === "pending") { delete next.outcome; return next; }
  next.outcome = { kind, reasons: [], note: "", at: todayLabel(), by: "Conference Chair", emailedAt: null };
  return next;
}
/** The record after the chair edits the iThenticate scores / report files. */
export function withReport(rec: ScreeningRecord | undefined, patch: NonNullable<ScreeningRecord["report"]>, paths?: Record<string, string>): ScreeningRecord {
  const next: ScreeningRecord = { ...(rec ?? {}), report: { similarity: null, ai: null, file: "", ...(rec?.report ?? {}), ...patch, at: todayLabel(), by: "Conference Chair" } };
  if (paths) next.paths = { ...(rec?.paths ?? {}), ...paths };
  return next;
}

/** Where a paper stands at the two steps before peer review, for Peer Review's Initial check / Plagiarism columns and filters (the prototype's
 *  screeningStatusOf). null = that step is switched off for the conference. A paper that already has reviewers (or a decision) has passed both;
 *  Plagiarism is "waiting" until the initial check is passed. */
export function screeningStatusOf(p: ChairPaper, screening: { initialCheck: boolean; plagiarism: boolean }): { initial: string | null; plag: string | null } {
  const rec = p.screening[String(p.versions)];
  const past = inPeerReview(p);
  const initial = !screening.initialCheck ? null : past ? "passed" : checkDecisionOf(rec);
  const plag = !screening.plagiarism ? null
    : past || p.outcome === "plagiarism_clear" || screeningStageOf(p, screening) === "clear" ? "clear"
      : initial && initial !== "passed" ? "waiting"
        : plagDecisionOf(rec);
  return { initial, plag };
}
export const SCREENING_WAITING: DecisionMeta = { key: "waiting", label: "Not started", color: "var(--ink-faint)", bg: "var(--muted)", hint: "" };
export const screeningMeta = (list: DecisionMeta[], key: string): DecisionMeta => (key === "waiting" ? SCREENING_WAITING : list.find((d) => d.key === key) ?? SCREENING_WAITING);
