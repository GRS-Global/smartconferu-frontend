"use client";

import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, Check, CalendarClock, ChevronDown, ChevronRight, ClipboardCheck, Download, FileText, FilterX, Info, Lock, RefreshCw, Send, Settings2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Spinner } from "@/components/ui/load-more";
import { cn } from "@/lib/cn";
import type { AutoCheck, ChairPaper, ScreeningCheck } from "@/types/chair";
import { EMAILED, isOverdue, type CheckItem, type DecisionMeta } from "../screening";

/* The pieces both screening tables (Initial Check, Plagiarism Check) and their per-paper pages share: a port of the prototype's
   src/chair-plagiarism/ScreeningTables.jsx building blocks, with the same sizes, colours and wording. */

export const CARD = { border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" } as const;
/** The prototype sets a cell control's border inline, so a focused control keeps it (no purple ring): kept the same here. */
export const CELL_INPUT = "h-8 px-2 rounded-md text-xs bg-white outline-none disabled:bg-canvas disabled:text-ink-faint";
export const CELL_INPUT_ST: CSSProperties = { border: "1.5px solid var(--border)", color: "var(--ink)" };
export const RED_ST: CSSProperties = { borderColor: "var(--danger)", color: "var(--danger)" };
/** Clicks on a control inside a row must not toggle the row. */
export const isControl = (el: EventTarget | null) => !!(el as HTMLElement | null)?.closest("button, input, select, label, a, textarea");

/* ---------- toast (the screening pages' own navy toast) ---------- */
export interface ScreeningToastData { title: string; text?: string }
export function ScreeningToast({ toast, onClose }: { toast: ScreeningToastData | null; onClose: () => void }) {
  useEffect(() => { if (!toast) return undefined; const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [toast, onClose]);
  if (!toast) return null;
  return (
    <div role="status" style={{ background: "var(--navy)" }} className="fixed bottom-6 right-6 z-50 flex max-w-sm items-start gap-2.5 rounded-xl px-4 py-3 text-white shadow-lg">
      <Check size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
      <div><div className="text-sm font-bold">{toast.title}</div>{toast.text && <div className="mt-0.5 text-xs opacity-80">{toast.text}</div>}</div>
    </div>
  );
}

/** A "please wait" cover while an email is sent (the prototype's LoadingOverlay, shared). */
export { LoadingOverlay } from "@/components/ui/load-more";

/* ---------- cells ---------- */
/** Green = yes, red = no. */
export function YesNoSwitch({ on, onChange, disabled, label, onText = "YES", offText = "NO" }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string; onText?: string; offText?: string }) {
  const width = Math.max(onText.length, offText.length) > 3 ? 84 : 58;
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} title={`${label}: ${on ? onText : offText}`} disabled={disabled} onClick={() => onChange(!on)} style={{ width, background: on ? "var(--success)" : "var(--danger)" }} className="relative h-7 shrink-0 cursor-pointer rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-45">
      <span className={`absolute inset-y-0 flex select-none items-center text-[10px] font-extrabold tracking-wide text-white ${on ? "left-2.5" : "right-2.5"}`}>{on ? onText : offText}</span>
      <span style={{ transform: `translateX(${on ? width - 25 : 3}px)` }} className="absolute left-0 top-[3px] h-[22px] w-[22px] rounded-full bg-white shadow transition-transform" />
    </button>
  );
}
/** Earlier versions are history: plain values instead of disabled controls. */
export const YesNoText = ({ on }: { on: boolean }) => <span style={{ color: on ? "var(--success)" : "var(--danger)" }} className="text-xs font-bold">{on ? "Yes" : "No"}</span>;
export const PlainText = ({ children }: { children: ReactNode }) => <span className="text-xs font-semibold text-ink-muted">{children}</span>;
export function DecisionChip({ value, options }: { value: string; options: DecisionMeta[] }) {
  const o = options.find((x) => x.key === value) ?? options[0];
  return <span style={{ color: o.color, background: o.bg }} className="inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-bold">{o.label}</span>;
}
export const LockNote = () => (
  <div title="Reviewers are assigned to this paper, so its screening can't change here. Use Peer Review instead." className="mt-1 inline-flex items-center gap-1 whitespace-nowrap text-[11px] text-ink-faint"><Lock size={11} aria-hidden="true" /> In peer review</div>
);
/** The row's decision changed and it no longer matches the active filter: it stays until the filter changes. */
export const MovedNote = () => <div style={{ color: "#92400E" }} className="mt-1 text-[10.5px] font-semibold leading-tight">Moved out of this filter — stays here until you change the filter</div>;
/** A small line under a cell: the allowed range, or what's wrong (red). */
export const CellHint = ({ bad, children }: { bad?: boolean; children: ReactNode }) => <div style={{ color: bad ? "var(--danger)" : "var(--ink-faint)" }} className="mt-1 whitespace-nowrap text-[10.5px] font-semibold">{children}</div>;

/** Checks the decision against the row: Passed while something fails (or the length is missing), or a Revision / Reject with nothing failing. */
export function DecisionWarning({ decision, failing, lengthBlank, noReport }: { decision: string; failing?: CheckItem[]; lengthBlank?: boolean; noReport?: boolean }) {
  let text = ""; let bad = true;
  if (failing) {
    if (decision === "passed" && failing.length) text = `${failing.length} check${failing.length === 1 ? "" : "s"} failing: ${failing.map((i) => i.label).join(", ")}`;
    else if (decision === "passed" && lengthBlank) text = "Length not entered";
    else if (EMAILED.includes(decision) && !failing.length) { text = "No check failed — give the reason in the email"; bad = false; }
  } else if (noReport && ["clear", "revision", "reject"].includes(decision)) text = "No report uploaded";
  if (!text) return null;
  return <div style={{ color: bad ? "var(--danger)" : "var(--ink-faint)" }} className="mt-1 flex items-start gap-1 text-[10.5px] font-semibold leading-tight">{bad && <AlertTriangle size={11} aria-hidden="true" className="mt-px shrink-0" />} <span>{text}</span></div>;
}

export function DecisionSelect({ value, options, onChange, disabled, title, label }: { value: string; options: DecisionMeta[]; onChange: (v: string) => void; disabled?: boolean; title?: string; label: string }) {
  const o = options.find((x) => x.key === value) ?? options[0];
  return (
    <select value={value} disabled={disabled} title={title} aria-label={label} onChange={(e) => onChange(e.target.value)} style={{ color: o.color, background: o.bg, border: `1.5px solid ${value === "pending" ? "var(--border)" : "transparent"}` }} className="h-8 w-full cursor-pointer rounded-md pl-2 pr-6 text-xs font-bold outline-none disabled:cursor-not-allowed disabled:opacity-60">
      {options.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
    </select>
  );
}

/** ID on top, the version under it. The arrow (and the row itself) opens the earlier versions. */
export function IdCell({ paper, n, latest, count, open, onToggle, onOpenCheck, openTitle = "Open this paper's initial check" }: { paper: ChairPaper; n: number; latest: boolean; count: number; open: boolean; onToggle: () => void; onOpenCheck?: (() => void) | null; openTitle?: string }) {
  const canOpen = latest && count > 1;
  return (
    <div className="flex items-start gap-1.5">
      {canOpen ? (
        <button type="button" onClick={onToggle} aria-expanded={open} aria-label={`${open ? "Hide" : "Show"} earlier versions of ${paper.id}`} style={{ color: open ? "var(--primary)" : "var(--ink-muted)" }} className="-ml-1 inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md hover:bg-primary-soft">
          {open ? <ChevronDown size={15} aria-hidden="true" /> : <ChevronRight size={15} aria-hidden="true" />}
        </button>
      ) : <span aria-hidden="true" style={{ color: "var(--ink-faint)" }} className={`w-6 shrink-0 text-center ${latest ? "" : "pt-0.5"}`}>{latest ? "" : "└"}</span>}
      <div className="min-w-0">
        {latest && onOpenCheck ? (
          <button type="button" onClick={onOpenCheck} title={openTitle} className="cursor-pointer whitespace-nowrap text-[13px] font-bold leading-6 text-navy underline-offset-2 hover:text-primary hover:underline">{paper.id}</button>
        ) : (
          <div style={{ color: latest ? "var(--navy)" : "var(--ink-muted)" }} className="whitespace-nowrap text-[13px] font-bold leading-6">{paper.id}</div>
        )}
        <div className="mt-0.5 flex items-center gap-1.5">
          <span style={{ background: latest ? "var(--primary-soft)" : "var(--muted)", color: latest ? "var(--primary)" : "var(--ink-muted)" }} className="rounded px-1.5 py-0.5 text-[10.5px] font-extrabold">V{n}</span>
          {canOpen && <span className="whitespace-nowrap text-[10.5px] text-ink-faint">+{count - 1} earlier</span>}
        </div>
      </div>
    </div>
  );
}

/** Title in up to two lines; click it to open the submission's details page. Reading the PDF and downloading it have their own links. */
export function TitleCell({ paper, latest, onOpenDetails, onOpenPdf, onDownload, onOpenCheck, checkTitle = "Everything about this paper's initial check", checkLabel = "Check details" }: { paper: ChairPaper; latest: boolean; onOpenDetails: () => void; onOpenPdf: () => void; onDownload: () => void; onOpenCheck?: (() => void) | null; checkTitle?: string; checkLabel?: string }) {
  return (
    <div className="min-w-0">
      <button type="button" onClick={onOpenDetails} title={`${paper.title}\nOpen the submission details`} style={{ color: latest ? "var(--ink)" : "var(--ink-muted)" }} className="cursor-pointer text-left text-[13.5px] font-semibold leading-snug underline-offset-2 hover:text-primary hover:underline">{paper.title}</button>
      <div className="mt-1 flex items-center gap-3">
        <button type="button" onClick={onOpenPdf} className="inline-flex cursor-pointer items-center gap-1 text-[11.5px] font-semibold text-ink-muted hover:text-primary"><FileText size={12} aria-hidden="true" /> View PDF</button>
        <button type="button" onClick={onDownload} className="inline-flex cursor-pointer items-center gap-1 text-[11.5px] font-semibold text-ink-muted hover:text-primary"><Download size={12} aria-hidden="true" /> Download paper</button>
      </div>
      {onOpenCheck && (
        <button type="button" onClick={onOpenCheck} title={checkTitle} className="mt-2 inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-primary-soft-border bg-primary-soft pl-2.5 pr-2 text-[11.5px] font-bold text-primary transition-colors hover:border-primary hover:bg-primary hover:text-white">
          <ClipboardCheck size={12} aria-hidden="true" /> {checkLabel} <ChevronRight size={13} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/** Where a value came from is for us, not the chair: the table only speaks up when the chair should act ("Verify" when the check wasn't sure). */
export function AutoTag({ auto, field, check }: { auto: AutoCheck | null | undefined; field: "editable" | "english" | "column" | "pages"; check: ScreeningCheck }) {
  if (!auto || auto.status !== "done" || check.edited?.[field]) return null;
  const conf = field === "column" ? auto.confidence?.column : field === "english" ? auto.confidence?.english : "high";
  if (conf !== "low") return null;
  return <div title="Not certain — please check this in the PDF." style={{ color: "#B45309", background: "#FFF4E5" }} className="mt-1 inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-bold"><AlertTriangle size={10} aria-hidden="true" /> Verify</div>;
}
export const MISSING_LABEL: Record<string, string> = { title: "title", author_names: "author names", affiliations: "affiliations", abstract: "abstract", keywords: "keywords", references: "references" };
/** Under the upload date: only what needs the chair — a check still running / failed, missing parts. An anonymised PDF has no names by design. */
export function AutoStatus({ auto, doubleBlind = false }: { auto: AutoCheck | null | undefined; doubleBlind?: boolean }) {
  if (!auto) return <div className="mt-1.5 inline-flex items-center gap-1 whitespace-nowrap text-[10.5px] font-semibold text-ink-muted"><AlertTriangle size={11} aria-hidden="true" /> Check the PDF manually</div>;
  if (auto.status === "running") return <div className="mt-1.5 inline-flex items-center gap-1 whitespace-nowrap text-[10.5px] font-semibold text-ink-muted"><Spinner size={11} /> Reading PDF…</div>;
  if (auto.status === "failed") return <div title={auto.error} className="mt-1.5 inline-flex items-center gap-1 whitespace-nowrap text-[10.5px] font-semibold text-ink-muted"><AlertTriangle size={11} aria-hidden="true" /> Check the PDF manually</div>;
  const missing = (auto.missing ?? []).filter((k) => !(doubleBlind && (k === "author_names" || k === "affiliations"))).map((k) => MISSING_LABEL[k] ?? k);
  if (!missing.length) return null;
  return <div style={{ color: "#B45309" }} className="mt-1.5 text-[10.5px] font-semibold leading-tight">Missing: {missing.join(", ")}</div>;
}

const DAY = 86400000;
const parseDay = (label: string | null | undefined) => { const t = Date.parse(label ?? ""); return Number.isNaN(t) ? null : t; };
/** Whole days between an upload date and today (null when the date is unknown). */
export const daysAgo = (label: string | null | undefined): number | null => { const t = parseDay(label); if (t === null) return null; const d = new Date(); d.setHours(0, 0, 0, 0); return Math.round((d.getTime() - t) / DAY); };
export const submittedBucket = (label: string | null | undefined) => { const ago = daysAgo(label); return ago === null ? "older" : ago <= 7 ? "week" : ago <= 30 ? "month" : "older"; };
/** When this version was uploaded, and how long ago — a resubmission says so. */
export function SubmittedCell({ at, n }: { at: string | null | undefined; n: number }) {
  const ago = daysAgo(at);
  return (
    <div className="leading-tight">
      <div className="whitespace-nowrap text-[13px] font-semibold text-ink">{at || "—"}</div>
      {ago !== null && <div className="mt-1 whitespace-nowrap text-[11px] text-ink-faint">{n > 1 ? "Resubmitted · " : ""}{ago <= 0 ? "today" : ago === 1 ? "yesterday" : `${ago} days ago`}</div>}
    </div>
  );
}

/** The due date for the author's new version: neutral while there's time, red once it has passed. */
export function DueLine({ deadline }: { deadline: string | undefined }) {
  if (!deadline) return null;
  const late = isOverdue(deadline);
  return (
    <span style={late ? { color: "var(--danger)", background: "var(--danger-soft)" } : { color: "var(--ink-muted)", background: "var(--canvas)" }} className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold">
      {late ? <AlertTriangle size={11} aria-hidden="true" /> : <CalendarClock size={11} aria-hidden="true" />} {late ? "Overdue · " : "Due "}{deadline}
    </span>
  );
}

export function EmailCell({ enabled, sentAt, deadline, onSend, disabledHint }: { enabled: boolean; sentAt: string | null; deadline?: string; onSend: () => void; disabledHint: string }) {
  if (sentAt) {
    return (
      <div className="flex flex-col items-center gap-1">
        <span style={{ color: "var(--success)" }} className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-bold"><Check size={13} strokeWidth={3} aria-hidden="true" /> Sent · {sentAt}</span>
        <DueLine deadline={deadline} />
        {enabled && <button type="button" onClick={onSend} style={{ color: isOverdue(deadline) ? "var(--danger)" : "var(--primary)" }} className="cursor-pointer text-[11px] font-semibold hover:underline">Send again</button>}
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-1">
      <button type="button" onClick={onSend} disabled={!enabled} title={enabled ? "Write the email to the author" : disabledHint} style={enabled ? { background: "var(--primary)", color: "#FFFFFF" } : { background: "var(--muted)", color: "var(--ink-faint)" }} className="inline-flex h-8 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md px-3 text-xs font-bold enabled:hover:bg-primary-hover disabled:cursor-not-allowed"><Send size={12} aria-hidden="true" /> Send Email</button>
    </div>
  );
}

/* ---------- table shell: sticky header, a filter under every column title ---------- */
/** `info`: what the column means, shown on hover / focus of the (i) next to the title. `tip`: where the bubble opens. */
export function Th({ label, info, tip = "center", children, className = "", align = "left" }: { label: ReactNode; info?: string; tip?: "left" | "right" | "center"; children?: ReactNode; className?: string; align?: "left" | "center" }) {
  const pos = tip === "left" ? "left-0" : tip === "right" ? "right-0" : "left-1/2 -translate-x-1/2";
  const name = typeof label === "string" ? label : "column";
  return (
    <th style={{ background: "#F8FAFC", boxShadow: "inset 0 -1px 0 var(--border)", color: "var(--ink-muted)" }} className={`sticky top-0 z-10 px-2.5 pb-2 pt-2.5 text-left align-top focus-within:z-30 hover:z-30 ${className}`}>
      <div className={`mb-1.5 flex items-center gap-1 whitespace-nowrap text-[10.5px] font-bold uppercase tracking-wider ${align === "center" ? "justify-center" : ""}`}>
        {label}
        {info && (
          <span tabIndex={0} aria-label={`About ${name}`} className="group relative inline-flex cursor-help outline-none">
            <Info size={12} aria-hidden="true" style={{ color: "var(--ink-faint)" }} className="group-hover:text-primary group-focus:text-primary" />
            <span role="tooltip" style={{ background: "var(--navy)" }} className={`pointer-events-none absolute top-full z-30 mt-1.5 hidden w-64 whitespace-pre-line rounded-lg px-3 py-2 text-left text-[11.5px] font-medium normal-case leading-snug tracking-normal text-white shadow-lg group-hover:block group-focus:block ${pos}`}>{info}</span>
          </span>
        )}
      </div>
      {children || <div className="h-7" />}
    </th>
  );
}
export const decisionInfo = (options: DecisionMeta[]) => options.map((d) => `${d.label} — ${d.hint}`).join("\n");
export function FilterSelect({ value, onChange, options, label }: { value: string; onChange: (v: string) => void; options: Array<[string, string]>; label: string }) {
  return (
    <select value={value} aria-label={label} onChange={(e) => onChange(e.target.value)} style={{ ...CELL_INPUT_ST, color: value === "all" ? "var(--ink-faint)" : "var(--primary)" }} className="h-7 w-full cursor-pointer rounded-md bg-white px-1.5 text-[11px] font-semibold outline-none">
      {options.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
    </select>
  );
}
export function FilterText({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return <input value={value} aria-label={placeholder} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={CELL_INPUT_ST} className="h-7 w-full rounded-md bg-white px-2 text-[11px] font-medium outline-none placeholder:font-normal placeholder:text-slate-400" />;
}
export const YES_NO: Array<[string, string]> = [["all", "All"], ["yes", "Yes"], ["no", "No"]];
export const yesNo = (f: string, v: boolean) => f === "all" || (f === "yes" ? v : !v);
export const SUBMITTED_OPTIONS: Array<[string, string]> = [["all", "All"], ["week", "Last 7 days"], ["month", "8–30 days ago"], ["older", "Older"]];
export const EMAIL_OPTIONS: Array<[string, string]> = [["all", "All"], ["due", "To send"], ["sent", "Sent"], ["overdue", "Overdue"]];

/** The heading of an ID column that sorts: the label with an arrow (first click highest first, second lowest first, third clears). */
export function IdSortLabel({ label, dir, onToggle }: { label: string; dir: "asc" | "desc" | null; onToggle: () => void }) {
  const Icon = !dir ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  const title = !dir ? `Sort by ${label}` : dir === "desc" ? "Highest first · click for lowest first" : "Lowest first · click to clear";
  return (
    <button type="button" onClick={onToggle} title={title} aria-label={`Sort by ${label}`} style={{ color: dir ? "var(--primary)" : "inherit" }} className="inline-flex cursor-pointer items-center gap-1 hover:text-navy">
      {label}
      <Icon size={12} strokeWidth={2.6} aria-hidden="true" style={{ opacity: dir ? 1 : 0.45 }} className="shrink-0" />
    </button>
  );
}

export function TableFrame({ minWidth, children, empty }: { minWidth: number; children: ReactNode; empty: string | null }) {
  return (
    <div style={CARD} className="overflow-hidden rounded-2xl bg-white">
      <div style={{ maxHeight: "calc(100vh - 250px)", minHeight: 320 }} className="overflow-auto">
        {/* Fixed layout: every column keeps its set width; a long title wraps (taller row). */}
        <table style={{ minWidth, tableLayout: "fixed" }} className="w-full border-separate border-spacing-0 text-sm">{children}</table>
        {empty && <div className="py-16 text-center text-sm text-ink-faint">{empty}</div>}
      </div>
    </div>
  );
}

export function Toolbar({ summary, filtersOn, onClear, moved = 0, onRefresh, children }: { summary: ReactNode; filtersOn: boolean; onClear: () => void; moved?: number; onRefresh: () => void; children?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap items-center gap-1.5">{summary}</div>
      <div className="ml-auto flex items-center gap-2">
        {children}
        {moved > 0 && (
          <button type="button" onClick={onRefresh} title="Re-apply the filters to the list" style={{ color: "#92400E", background: "#FFFBEB", border: "1px solid #FCD9A8" }} className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-xs font-semibold hover:bg-[#FEF3C7]"><RefreshCw size={13} aria-hidden="true" /> {moved} changed row{moved === 1 ? "" : "s"} no longer match{moved === 1 ? "es" : ""} · Refresh list</button>
        )}
        {filtersOn && <button type="button" onClick={onClear} style={{ color: "var(--ink-soft)", border: "1px solid var(--border)" }} className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-white px-3 text-xs font-semibold hover:text-primary"><FilterX size={13} aria-hidden="true" /> Clear filters</button>}
      </div>
    </div>
  );
}
/** Count chips above the table — click one to filter the Decision column. */
export function SummaryChip({ label, count, color, bg, active, onClick }: { label: string; count: number; color: string; bg: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} style={{ color, background: bg, outline: active ? `2px solid ${color}` : "none" }} className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-xs font-bold">
      {label} <span className="tabular-nums opacity-80">{count}</span>
    </button>
  );
}

/** Tick papers (or "select all" in the header), then pick a decision for all of them at once. */
export function BulkBar({ count, options, onPick, onClear, children }: { count: number; options: DecisionMeta[]; onPick: (d: DecisionMeta) => void; onClear: () => void; children?: ReactNode }) {
  if (!count) return null;
  return (
    <div style={{ background: "var(--navy)" }} className="mb-3 flex flex-wrap items-center gap-2.5 rounded-xl px-4 py-2.5 text-white">
      <span className="whitespace-nowrap text-sm font-bold">{count} selected</span>
      <span aria-hidden="true" className="h-5 w-px bg-white/20" />
      <span className="text-xs font-semibold opacity-80">Set decision:</span>
      {options.map((d) => <button key={d.key} type="button" onClick={() => onPick(d)} style={{ background: d.bg, color: d.color }} className="h-7 cursor-pointer rounded-full px-2.5 text-xs font-bold hover:brightness-95">{d.label}</button>)}
      <div className="ml-auto flex items-center gap-2">{children}<button type="button" onClick={onClear} className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg px-2.5 text-xs font-semibold hover:bg-white/10"><X size={13} aria-hidden="true" /> Clear selection</button></div>
    </div>
  );
}

/** Header / row checkbox. Rows pass the range-select props (Shift + click, drag); the header passes onChange. */
export function SelectBox({ checked, onChange, label, disabled, indeterminate, ...rest }: { checked: boolean; onChange?: (on: boolean) => void; label: string; disabled?: boolean; indeterminate?: boolean } & Record<string, unknown>) {
  return (
    <input type="checkbox" aria-label={label} title={label} checked={checked} disabled={disabled} onChange={onChange ? (e) => onChange(e.target.checked) : () => undefined} ref={(el) => { if (el) el.indeterminate = !!indeterminate; }} className="h-4 w-4 cursor-pointer accent-primary disabled:cursor-not-allowed" {...rest} />
  );
}

/* ---------- popups ---------- */
export function ScreeningModal({ title, subtitle, onClose, children, footer, width = 640 }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode; footer?: ReactNode; width?: number }) {
  useEffect(() => { const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.45)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={title} data-modal="" style={{ maxWidth: width }} className="flex max-h-[90vh] w-full flex-col rounded-2xl bg-white shadow-2xl">
        <div className="ui-modal-head flex items-start gap-3 rounded-t-2xl px-5 py-4">
          <div className="min-w-0 flex-1"><h3 className="text-base font-extrabold text-navy">{title}</h3>{subtitle && <p className="mt-0.5 truncate text-xs text-ink-muted">{subtitle}</p>}</div>
          <button type="button" onClick={onClose} aria-label="Close" className="cursor-pointer rounded-md p-1 text-ink-faint hover:bg-canvas"><X size={18} aria-hidden="true" /></button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="ui-modal-foot flex items-center justify-end gap-2 rounded-b-2xl px-5 py-3.5">{footer}</div>}
      </div>
    </div>
  );
}
export const Btn = ({ primary, children, ...rest }: { primary?: boolean; children: ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button type="button" {...rest} style={primary ? { background: "var(--primary)", color: "#FFFFFF" } : { border: "1px solid var(--border)", color: "var(--ink-soft)" }} className={cn("inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50", primary ? "enabled:hover:bg-primary-hover" : "bg-white hover:bg-canvas")}>{children}</button>
);

/** The "Screening Settings" button in the page header (the prototype's SettingsButton: 36 px, soft text). */
export function ScreeningSettingsButton({ href }: { href: string }) {
  return (
    <Link href={href} style={{ border: "1px solid var(--border)", color: "var(--ink-soft)" }} className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-white px-3.5 text-sm font-semibold hover:text-primary">
      <Settings2 size={14} aria-hidden="true" /> Screening Settings
    </Link>
  );
}

/* ---------- reports: what was recorded for one version ---------- */
import type { ScreeningCriteria, ScreeningRecord } from "@/types/chair";
import { CHECK_DECISIONS, PLAG_DECISIONS, blankCheck, evaluateCheck, plagDecisionOf, reportFilesOf } from "../screening";
import { checkDecisionOf } from "../stage";

/** One step's recorded decision, as a badge (+ who/when and what that decision means). */
export function DecisionLine({ decision, by, at, sent }: { decision: DecisionMeta; by?: string; at?: string; sent: boolean }) {
  return (
    <div className="mb-2.5 flex flex-wrap items-center gap-2">
      <span style={{ color: decision.color, background: decision.bg }} className="rounded-full px-2.5 py-1 text-xs font-bold">{decision.label}</span>
      {at && <span className="text-xs text-ink-faint">{by || "Conference Chair"} · {at}</span>}
      {decision.key !== "pending" && !(sent && EMAILED.includes(decision.key)) && <span className="w-full text-xs text-ink-muted">{decision.hint}</span>}
    </div>
  );
}
export const ReportRow = ({ ok, icon, label, value }: { ok?: boolean; icon?: ReactNode; label: string; value: string }) => (
  <li className="flex items-center gap-3 px-3.5 py-2.5">
    <span style={{ background: icon ? "var(--muted)" : ok ? "var(--success-soft)" : "var(--danger-soft)", color: icon ? "var(--ink-soft)" : ok ? "var(--success)" : "var(--danger)" }} className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full">{icon || (ok ? <Check size={12} strokeWidth={3} aria-hidden="true" /> : <X size={12} strokeWidth={3} aria-hidden="true" />)}</span>
    <span className="flex-1 text-sm font-semibold text-ink">{label}</span>
    <span style={{ color: ok || icon ? "var(--ink-muted)" : "var(--danger)" }} className="break-all text-right text-xs font-semibold">{value}</span>
  </li>
);
export const SentNote = ({ title, reasons, note }: { title: string; reasons?: string[]; note?: string }) => (
  <div style={{ background: "#FFF4E5", color: "#92400E" }} className="mt-3 rounded-lg px-3.5 py-2.5 text-xs">
    <div className="mb-1 font-bold">{title}</div>
    {(reasons ?? []).map((r) => <div key={r}>• {r}</div>)}
    {note && <div className="mt-1 italic">“{note}”</div>}
  </div>
);
const REPORT_LIST = "divide-y divide-line rounded-xl";

/** What was recorded at the initial check for a version: the decision, the checklist and any correction request. */
export function InitialCheckSection({ rec, criteria }: { rec: ScreeningRecord | undefined; criteria: ScreeningCriteria }) {
  const check = { ...blankCheck(criteria), ...(rec?.check ?? {}) };
  const decision = CHECK_DECISIONS.find((d) => d.key === checkDecisionOf(rec)) ?? CHECK_DECISIONS[0];
  const corr = rec?.correction;
  return (
    <>
      <DecisionLine decision={decision} by={rec?.check?.by} at={rec?.check?.at} sent={!!(rec?.check?.emailedAt || corr?.emailedAt)} />
      <ul style={{ border: "1px solid var(--border)" }} className={REPORT_LIST}>{evaluateCheck(check, criteria).map((it) => <ReportRow key={it.key} ok={it.ok} label={it.label} value={it.value} />)}</ul>
      {corr && <SentNote title={`Correction emailed ${corr.emailedAt || corr.at}${corr.deadline ? ` · due ${corr.deadline}` : ""}`} reasons={corr.reasons} note={corr.note} />}
    </>
  );
}
/** What was recorded at the plagiarism check: the decision, the iThenticate scores and report file, and any revision / reject email. */
export function PlagiarismSection({ rec, criteria }: { rec: ScreeningRecord | undefined; criteria: ScreeningCriteria }) {
  const decision = PLAG_DECISIONS.find((d) => d.key === plagDecisionOf(rec)) ?? PLAG_DECISIONS[0];
  const report = rec?.report;
  const files = reportFilesOf(rec);
  const score = (value: number | null | undefined, limit: number) => (typeof value === "number" ? { ok: value <= limit, value: `${value}% (limit ${limit}%)` } : { ok: true, value: "Not recorded" });
  const sim = score(report?.similarity, criteria.similarityLimit), ai = score(report?.ai, criteria.aiLimit);
  const o = rec?.outcome;
  return (
    <>
      <DecisionLine decision={decision} by={o?.by} at={o?.at} sent={!!o?.emailedAt} />
      {report ? (
        <ul style={{ border: "1px solid var(--border)" }} className={REPORT_LIST}>
          <ReportRow ok={sim.ok} label="Similarity" value={sim.value} />
          <ReportRow ok={ai.ok} label="AI-generated text" value={ai.value} />
          <ReportRow icon={<FileText size={12} aria-hidden="true" />} label="Report file" value={files.length ? files.join(", ") : "None attached"} />
        </ul>
      ) : <div style={{ background: "var(--canvas)", border: "1px solid var(--border)" }} className="rounded-xl px-3.5 py-2.5 text-sm text-ink-soft">No iThenticate report added yet.</div>}
      {o && ((o.reasons?.length ?? 0) > 0 || o.note || o.emailedAt) && <SentNote title={o.emailedAt ? `Emailed ${o.emailedAt}${o.deadline ? ` · due ${o.deadline}` : ""}` : "Not emailed yet"} reasons={o.reasons} note={o.note} />}
    </>
  );
}
/** Plagiarism check › "Initial Check" column: what was recorded for that version. */
export function InitialReportModal({ paper, n, rec, criteria, onClose }: { paper: ChairPaper; n: number; rec: ScreeningRecord | undefined; criteria: ScreeningCriteria; onClose: () => void }) {
  return (
    <ScreeningModal title={`Initial Check Report — V${n}`} subtitle={`${paper.id} · ${paper.title}`} onClose={onClose} width={560} footer={<Btn onClick={onClose}>Close</Btn>}>
      <InitialCheckSection rec={rec} criteria={criteria} />
    </ScreeningModal>
  );
}

/** A decision for several papers is never applied straight away: the chair sees what will happen first. */
export function BulkConfirmModal({ decision, total, change, notes, onConfirm, onClose, emailable, defaultDue }: { decision: DecisionMeta; total: number; change: number; notes: string[]; onConfirm: (o: { sendEmails: boolean; dueIso: string }) => void; onClose: () => void; emailable: boolean; defaultDue: string }) {
  const [sendEmails, setSendEmails] = useState(true);
  const [dueIso, setDueIso] = useState(defaultDue);
  const willEmail = emailable && sendEmails && change > 0;
  return (
    <ScreeningModal title="Confirm decision change" subtitle={`${total} paper${total === 1 ? "" : "s"} selected`} onClose={onClose} width={560} footer={<><Btn onClick={onClose}>Cancel</Btn><Btn primary disabled={!change || (willEmail && decision.key === "revision" && !dueIso)} onClick={() => onConfirm({ sendEmails: willEmail, dueIso })}>{willEmail ? <Send size={14} aria-hidden="true" /> : <Check size={14} aria-hidden="true" />} Yes, change {change}{willEmail ? " & email authors" : ` to ${decision.label}`}</Btn></>}>
      <p className="mb-3 text-sm leading-relaxed text-ink">
        {change ? <>Do you really want to change the decision of <b>{change} paper{change === 1 ? "" : "s"}</b> to <span style={{ color: decision.color, background: decision.bg }} className="whitespace-nowrap rounded-full px-2 py-0.5 font-bold">{decision.label}</span>?</> : <>None of the selected papers can be changed to <b>{decision.label}</b>.</>}
      </p>
      <p className="mb-3 text-xs text-ink-muted">{decision.label}: {decision.hint}</p>
      {notes.length > 0 ? <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink-soft">{notes.map((t) => <li key={t}>{t}</li>)}</ul> : <p className="text-sm text-ink-soft">All {change} will change to {decision.label}.</p>}
      {emailable && change > 0 && (
        <div style={{ border: "1px solid var(--primary-soft-border)" }} className="mt-4 rounded-xl bg-primary-soft px-4 py-3">
          <label className="flex cursor-pointer items-start gap-2.5">
            <input type="checkbox" checked={sendEmails} onChange={(e) => setSendEmails(e.target.checked)} className="mt-0.5 h-4 w-4 cursor-pointer accent-primary" />
            <span>
              <span className="block text-sm font-bold text-navy">Email the {change} author{change === 1 ? "" : "s"} now</span>
              <span className="mt-0.5 block text-xs text-ink-muted">Each gets the standard email for their paper — what to fix and the report. Untick to send them one by one from the Send Email column instead.</span>
            </span>
          </label>
          {sendEmails && decision.key === "revision" && (
            <label className="mt-3 flex items-center gap-2 pl-6"><span className="text-xs font-bold text-ink-soft">New version due by</span><input type="date" value={dueIso} onChange={(e) => setDueIso(e.target.value)} style={CELL_INPUT_ST} className={`${CELL_INPUT} h-8 text-xs`} /></label>
          )}
        </div>
      )}
    </ScreeningModal>
  );
}

