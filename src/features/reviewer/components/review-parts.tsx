"use client";

import { CalendarCheck, Check, ChevronDown, ChevronRight, ChevronsUpDown, ChevronUp, Clock, Lock, Star, Tag, type LucideIcon } from "lucide-react";
import { useState, type KeyboardEvent, type ReactNode } from "react";
import { CertificateBadge } from "@/features/dashboard/components/certificate-badge";
import { IdTag } from "@/features/author/components/submission-parts";
import { fmtDay } from "@/features/author/format";
import type { ReviewerPaper } from "@/types/reviewer";
import { REVIEW_STATUS, REVIEW_STATUS_ORDER, type ReviewRow, type ReviewStatus } from "../status";

/* The pieces of the reviewer's paper lists (the prototype's src/author-module/ReviewerPapersList.jsx): a card, the table with its
   filters under the column titles, the clickable figures strip and the certificate badge. The review is double-blind, so the
   authors are never shown (the prototype hides them in this mode too). */

const CARD = { border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" } as const;
const rise = (i: number) => ({ animationDelay: `${Math.min(i, 10) * 60}ms` });
const fmtFull = (iso: string) => (iso ? fmtDay(iso, { day: "numeric", month: "short", year: "numeric" }) : "—");

export const FILTERS = [
  { key: "all", label: "All", test: () => true },
  { key: "respond", label: "Needs response", test: (r: ReviewRow) => r.status.key === "respond" },
  { key: "todo", label: "Pending", test: (r: ReviewRow) => ["todo", "draft", "overdue"].includes(r.status.key) },
  { key: "sent", label: "Reviewed", test: (r: ReviewRow) => r.status.key === "sent" },
] as const;
export type FilterKey = (typeof FILTERS)[number]["key"];

export function BlindNote({ compact = false }: { compact?: boolean }) {
  return <div className={`inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink-muted ${compact ? "mt-1" : "mt-2.5"}`}><Lock size={12} aria-hidden="true" /> Authors hidden · double-blind</div>;
}

/** A reviewer gets a Certificate of Appreciation for each paper once its review is sent. There is no certificates table yet, so none is
 *  ever issued here: the badge is the "not yet" one with the prototype's wording, and never opens anything. */
export function PaperCertificate({ row }: { row: ReviewRow }) {
  const sent = Boolean(row.paper.review);
  const certificate = sent
    ? { issued: false, count: 0, title: "Certificate not available yet", reason: `Certificates of Appreciation are not issued by this app yet. Your review of ${row.paper.id} is on record.` }
    : row.paper.response === "pending"
      ? { issued: false, count: 0, title: "No certificate yet", reason: "Accept this paper and send your review to get a Certificate of Appreciation." }
      : row.status.key === "closed"
        ? { issued: false, count: 0, title: "No certificate", reason: "The review window closed before a review was sent." }
        : { issued: false, count: 0, title: "No certificate yet", reason: "Send your review for this paper to get a Certificate of Appreciation." };
  return <CertificateBadge certificate={certificate} onOpen={() => undefined} />;
}

function metaOf(r: ReviewRow): Array<{ icon: LucideIcon; label: string; value: string; tone?: string }> {
  const p = r.paper;
  const pending = p.response === "pending";
  return [
    p.assignedOn ? { icon: CalendarCheck, label: "Assigned", value: p.assignedOn } : null,
    p.due && !pending ? { icon: Clock, label: "Review due", value: fmtFull(p.due), ...(r.late ? { tone: "var(--danger)" } : {}) } : null,
    p.review ? { icon: Star, label: "You sent it", value: p.review.submittedAt || "—" } : null,
    p.track ? { icon: Tag, label: "Track", value: p.track } : null,
  ].filter((m): m is { icon: LucideIcon; label: string; value: string; tone?: string } => m !== null);
}

/** Opens a paper with the keyboard like a link (the card is a div: a button inside a button is not valid). */
const activate = (open: () => void) => ({ role: "link" as const, tabIndex: 0, onClick: open, onKeyDown: (e: KeyboardEvent) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); open(); } } });

/* ---------------- one card ---------------- */

export function ReviewCard({ row, index, onOpen }: { row: ReviewRow; index: number; onOpen: (p: ReviewerPaper) => void }) {
  const { paper, status, step } = row;
  const Icon = status.icon;
  return (
    <div {...activate(() => onOpen(paper))} aria-label={`${paper.id}: ${paper.title}`} style={{ ...CARD, borderLeft: `3px solid ${step.tone}`, ["--edge" as string]: step.tone, ...rise(index + 4) }} className="hd-rise hd-card group w-full cursor-pointer flex-col rounded-2xl bg-white text-left flex">
      <div style={{ background: status.bg, borderBottom: `1px solid ${status.border}`, color: status.color }} className="flex items-center gap-2.5 rounded-tl-xl rounded-tr-2xl py-2.5 pl-6 pr-5">
        <span style={{ background: "#FFFFFF", border: `1px solid ${status.border}` }} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"><Icon size={15} strokeWidth={2.4} aria-hidden="true" /></span>
        <span className="text-[13px] font-extrabold uppercase tracking-wide">{status.label}</span>
        <span className="ml-auto"><PaperCertificate row={row} /></span>
      </div>
      <div className="ui-card-split flex items-center gap-5 py-5 pl-6 pr-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <IdTag id={paper.id} />
            {paper.presentationType && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-ink-muted">{paper.presentationType}</span>}
          </div>
          <div className="mt-2 text-[16px] font-bold leading-snug text-navy transition-colors group-hover:text-primary">{paper.title}</div>
          <BlindNote />
          <div className="mt-3.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-dashed border-line pt-3">
            {metaOf(row).map((m) => {
              const MetaIcon = m.icon;
              return (
                <span key={m.label} className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12px]">
                  <MetaIcon size={13} aria-hidden="true" style={{ color: m.tone || "var(--ink-faint)" }} />
                  <span className="font-semibold text-ink-faint">{m.label}</span>
                  <span style={{ color: m.tone || "var(--ink-soft)" }} className="font-bold">{m.value}</span>
                </span>
              );
            })}
          </div>
        </div>
        <div className="ui-card-next flex w-[210px] shrink-0 flex-col justify-center self-stretch border-l border-muted pl-5 text-right">
          <div className="text-[10.5px] font-extrabold tracking-wider text-ink-faint">NEXT STEP</div>
          <div style={{ color: step.tone }} className="mt-1 text-[14px] font-extrabold leading-snug">{step.label}</div>
          <span className="hd-open mt-1.5 inline-flex items-center justify-end gap-1 text-[12px] font-bold text-primary">{step.cta} <ChevronRight size={13} aria-hidden="true" /></span>
        </div>
        <span aria-hidden="true" className="hd-arrow flex h-9 w-9 shrink-0 items-center justify-center rounded-full"><ChevronRight size={17} /></span>
      </div>
    </div>
  );
}

/* ---------------- the table ---------------- */

type SortKey = "id" | "due" | "score";
const SORTS: Record<SortKey, (r: ReviewRow) => string | number | null> = {
  id: (r) => r.paper.id,
  due: (r) => (r.paper.due && r.paper.response !== "pending" ? r.paper.due : null),
  score: (r) => (typeof r.paper.review?.score === "number" ? r.paper.review.score : null),
};
const SORT_FIRST_DIR: Record<SortKey, "asc" | "desc"> = { id: "asc", due: "asc", score: "desc" };
const FILTER_CTL = "h-7 w-full rounded-md border-[1.5px] border-line bg-white text-[11px] normal-case tracking-normal outline-none focus:border-primary";

function StatusPill({ status }: { status: ReviewStatus }) {
  const Icon = status.icon;
  return (
    <span style={{ color: status.color, background: status.bg }} className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-bold">
      {/* The score has its own column, so a sent review just says "Review sent". */}
      <Icon size={11} strokeWidth={2.6} aria-hidden="true" /> {status.key === "sent" ? REVIEW_STATUS.sent.label : status.label}
    </span>
  );
}

export function ReviewsTable({ rows, onOpen, onAccept, onDecline }: { rows: ReviewRow[]; onOpen: (p: ReviewerPaper) => void; onAccept: ((p: ReviewerPaper) => void) | null; onDecline: ((p: ReviewerPaper) => void) | null }) {
  const [sort, setSort] = useState<{ key: SortKey | null; dir: "asc" | "desc" }>({ key: null, dir: "asc" });
  const [f, setF] = useState({ id: "", title: "", due: "all", status: "all", score: "all" });
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: SORT_FIRST_DIR[key] }));
  const idq = f.id.trim().toLowerCase();
  const tq = f.title.trim().toLowerCase();
  const dueMatch: Record<string, (r: ReviewRow) => boolean> = {
    overdue: (r) => r.late,
    week: (r) => { const d = r.paper.due && r.paper.response !== "pending" && !r.paper.review ? (new Date(`${r.paper.due}T23:59:59`).getTime() - Date.now()) / 86400000 : null; return d != null && d >= 0 && d <= 7; },
    none: (r) => !r.paper.due || r.paper.response === "pending" || !!r.paper.review,
  };
  const scoreMatch: Record<string, (r: ReviewRow) => boolean> = { scored: (r) => typeof r.paper.review?.score === "number", none: (r) => typeof r.paper.review?.score !== "number" };
  const shown = rows
    .filter((r) => !idq || r.paper.id.toLowerCase().includes(idq))
    .filter((r) => !tq || `${r.paper.title} ${r.paper.track}`.toLowerCase().includes(tq))
    .filter((r) => f.due === "all" || dueMatch[f.due](r))
    .filter((r) => f.status === "all" || r.status.key === f.status)
    .filter((r) => f.score === "all" || scoreMatch[f.score](r));
  if (sort.key) {
    const sign = sort.dir === "desc" ? -1 : 1;
    const get = SORTS[sort.key];
    // A paper without a value (no score yet, nothing due) always sorts last.
    shown.sort((a, b) => {
      const va = get(a); const vb = get(b);
      if (va == null || vb == null) return va == null ? (vb == null ? 0 : 1) : -1;
      return sign * (typeof va === "string" && typeof vb === "string" ? va.localeCompare(vb, undefined, { numeric: true }) : Number(va) - Number(vb));
    });
  }
  const filtersOn = Boolean(idq || tq || f.due !== "all" || f.status !== "all" || f.score !== "all");
  const clear = () => setF({ id: "", title: "", due: "all", status: "all", score: "all" });

  const count = (pred: (r: ReviewRow) => boolean) => rows.filter(pred).length;
  const pick = (current: string, list: Array<[string, string, number]>): Array<[string, string, boolean]> => [["all", `All (${rows.length})`, false], ...list.map(([k, label, n]): [string, string, boolean] => [k, `${label} (${n})`, n === 0 && current !== k])];
  const statusOptions = pick(f.status, REVIEW_STATUS_ORDER.map((k) => [k, REVIEW_STATUS[k].label, count((r) => r.status.key === k)]));
  const dueOptions: Array<[string, string, boolean]> = [["all", "All", false], ["overdue", "Overdue", false], ["week", "Next 7 days", false], ["none", "Nothing due", false]];
  const scoreOptions: Array<[string, string, boolean]> = [["all", "All", false], ["scored", "Has score", false], ["none", "No score yet", false]];

  const Select = ({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: Array<[string, string, boolean]> }) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} style={{ color: value === "all" ? "var(--ink-faint)" : "var(--primary)" }} className={`${FILTER_CTL} cursor-pointer px-1.5 font-semibold`}>
      {options.map(([k, l, off]) => <option key={k} value={k} disabled={off}>{l}</option>)}
    </select>
  );
  const Text = ({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) => (
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label} className={`${FILTER_CTL} px-2 font-medium placeholder:font-normal placeholder:text-slate-400`} />
  );
  const th = (label: string, opts: { sortKey?: SortKey; filter?: ReactNode; className?: string; style?: React.CSSProperties } = {}) => {
    const on = opts.sortKey && sort.key === opts.sortKey;
    const Icon = on ? (sort.dir === "asc" ? ChevronUp : ChevronDown) : ChevronsUpDown;
    return (
      <th scope="col" aria-sort={opts.sortKey ? (on ? (sort.dir === "asc" ? "ascending" : "descending") : "none") : undefined} style={{ background: "#F8FAFC", boxShadow: "inset 0 -1px 0 var(--border)", color: "var(--ink-muted)", ...opts.style }} className={`px-2.5 pb-2 pt-2.5 text-left align-top ${opts.className ?? ""}`}>
        <div className="mb-1.5 flex items-center gap-1 whitespace-nowrap text-[10.5px] font-bold uppercase tracking-wider">
          {opts.sortKey ? <button type="button" onClick={() => toggleSort(opts.sortKey!)} className={`inline-flex items-center gap-1 font-bold uppercase tracking-wider hover:text-navy ${on ? "text-navy" : ""}`}>{label} <Icon size={12} aria-hidden="true" style={{ opacity: on ? 1 : 0.4 }} /></button> : label}
        </div>
        {opts.filter ?? <div className="h-7" />}
      </th>
    );
  };
  const STICKY = { position: "sticky", right: 0, zIndex: 2, background: "#FFFFFF", boxShadow: "-8px 0 12px -10px rgba(11,16,32,0.25)", borderLeft: "1px solid var(--border)" } as const;

  return (
    <div style={CARD} className="overflow-x-auto rounded-2xl bg-white">
      <table className="w-full text-[13px]">
        <thead>
          <tr>
            {th("ID", { sortKey: "id", className: "min-w-[110px]", filter: <Text label="Search ID" value={f.id} onChange={set("id")} placeholder="Search ID" /> })}
            {th("Paper", { className: "min-w-[240px]", filter: <Text label="Search title or track" value={f.title} onChange={set("title")} placeholder="Search title or track" /> })}
            {th("Assigned")}
            {th("Review due", { sortKey: "due", className: "min-w-[130px]", filter: <Select label="Review due" value={f.due} onChange={set("due")} options={dueOptions} /> })}
            {th("Status", { className: "min-w-[170px]", filter: <Select label="Status" value={f.status} onChange={set("status")} options={statusOptions} /> })}
            {th("Score", { sortKey: "score", className: "min-w-[110px]", filter: <Select label="Score" value={f.score} onChange={set("score")} options={scoreOptions} /> })}
            {th("Certificate", { className: "text-center" })}
            {th("Action", { className: "min-w-[150px]", style: { position: "sticky", right: 0, zIndex: 12, borderLeft: "1px solid var(--border)", boxShadow: "-8px 0 12px -10px rgba(11,16,32,0.25), inset 0 -1px 0 var(--border)" } })}
          </tr>
        </thead>
        <tbody>
          {shown.map((r, i) => {
            const p = r.paper;
            return (
              <tr key={p.assignmentId} onClick={() => onOpen(p)} className={`cursor-pointer border-b border-muted align-top transition-colors hover:bg-canvas ${i % 2 ? "ui-row-alt" : ""}`}>
                <td className="whitespace-nowrap px-3 py-3 font-semibold text-ink-muted">{p.id}</td>
                <td className="px-3 py-3"><div title={p.title} className="line-clamp-2 max-w-[420px] font-semibold leading-snug text-navy">{p.title}</div><BlindNote compact /></td>
                <td className="whitespace-nowrap px-3 py-3 text-ink-soft">{p.assignedOn || "—"}</td>
                <td style={{ color: r.late ? "var(--danger-ink)" : "var(--ink-soft)" }} className={`whitespace-nowrap px-3 py-3 text-xs ${r.late ? "font-bold" : "font-semibold"}`}>{p.due && p.response !== "pending" ? fmtFull(p.due) : "—"}</td>
                <td className="whitespace-nowrap px-3 py-3"><StatusPill status={r.status} /></td>
                <td className="whitespace-nowrap px-3 py-3">
                  {typeof p.review?.score === "number" ? <span className="text-[13px] font-extrabold text-navy">{p.review.score}<span className="text-[10.5px] font-semibold text-ink-faint">/5</span></span> : <span className="text-ink-faint">—</span>}
                </td>
                <td className="px-3 py-3 text-center"><PaperCertificate row={r} /></td>
                <td style={STICKY} className="whitespace-nowrap py-3 pl-3 pr-4">
                  {/* Says what the paper needs next: Respond · Start review · Continue review · Edit review · View paper. */}
                  {r.status.key === "respond" && onAccept && onDecline ? (
                    <span className="inline-flex items-center gap-1">
                      <button type="button" onClick={(e) => { e.stopPropagation(); onDecline(p); }} title="Decline this paper — the chair is told so they can reassign it" className="h-8 w-[74px] rounded-lg border border-line bg-white text-xs font-bold text-ink-soft transition-colors hover:bg-canvas hover:text-navy">Decline</button>
                      <button type="button" onClick={(e) => { e.stopPropagation(); onAccept(p); }} title="Accept this paper and start reviewing" className="inline-flex h-8 w-[74px] items-center justify-center gap-1 rounded-lg border border-primary bg-primary text-xs font-bold text-white hover:brightness-95"><Check size={13} strokeWidth={3} aria-hidden="true" /> Accept</button>
                    </span>
                  ) : (
                    <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(p); }} className={`h-8 w-[152px] rounded-lg border text-xs font-bold hover:brightness-95 ${r.status.key === "sent" || r.status.key === "closed" ? "border-line bg-white text-navy" : "border-primary bg-primary text-white"}`}>{r.step.cta}</button>
                  )}
                </td>
              </tr>
            );
          })}
          {shown.length === 0 && (
            <tr><td colSpan={8} className="py-6 text-center text-xs text-ink-faint">No papers match these filters.{filtersOn && <> <button type="button" onClick={clear} className="font-bold text-primary hover:underline">Clear filters</button></>}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- the counts, as filters ----------------
   The same numbers as the Overview's strip (Papers Assigned · Reviewed · Pending · Invitation Rejected), each one filters the list
   below; click the chosen one again to show everything. "Needs response" joins when there are papers waiting for an answer. */
export function ReviewerFilterStrip({ rows, filter, onChange, assigned, declined }: { rows: ReviewRow[]; filter: FilterKey; onChange: (k: FilterKey) => void; assigned: number; declined: number }) {
  const test = (key: FilterKey) => FILTERS.find((x) => x.key === key)!.test;
  const overdue = rows.filter((r) => r.status.key === "overdue").length;
  const items: Array<{ key: FilterKey | null; label: string; n: number; color: string; warn?: boolean; note?: string; extra?: boolean; fixed?: boolean }> = [
    { key: "all", label: "Papers Assigned", n: assigned, color: "var(--navy)" },
    { key: "sent", label: "Reviewed", n: rows.filter(test("sent")).length, color: "var(--success-ink)" },
    { key: "todo", label: "Pending", n: rows.filter(test("todo")).length, color: overdue ? "var(--danger-ink)" : "var(--warning-ink)", warn: true, note: overdue ? " · overdue" : "" },
    { key: "respond", label: "Needs response", n: rows.filter(test("respond")).length, color: "#6D28D9", extra: true },
    { key: null, label: "Invitation Rejected", n: declined, color: "var(--ink-soft)", fixed: true },
  ];
  return (
    <div role="radiogroup" aria-label="Filter your reviews" style={CARD} className="sub-strip flex flex-wrap overflow-hidden rounded-2xl bg-white">
      {items.filter((it) => !it.extra || it.n > 0).map((it, i) => {
        const on = it.key !== null && filter === it.key;
        const off = !it.fixed && it.n === 0 && it.key !== "all" && !on;
        const body = (
          <>
            <b style={{ color: it.n ? it.color : "var(--ink-faint)" }} className="text-xl leading-tight tabular-nums">{it.n}</b>
            <span className={`text-xs font-semibold leading-tight ${on ? "text-primary" : "text-ink-muted"}`}>{it.label}{it.note || ""}</span>
          </>
        );
        const common = { borderLeft: i ? "1px solid var(--muted)" : "none", background: on ? "var(--primary-soft)" : it.warn && it.n ? (overdue ? "var(--danger-soft)" : "var(--warning-soft)") : "#FFFFFF", boxShadow: on ? "inset 0 -3px 0 var(--primary)" : "none" };
        const cls = "flex min-w-[120px] flex-1 basis-0 flex-col items-start justify-center gap-0.5 px-3.5 py-3 text-left";
        return it.fixed || it.key === null
          ? <div key={it.label} title="Rejected invitations are no longer on your list" style={common} className={cls}>{body}</div>
          : (
            <button key={it.key} type="button" role="radio" aria-checked={on} disabled={off} onClick={() => onChange(on && it.key !== "all" ? "all" : (it.key as FilterKey))} title={off ? `No ${it.label.toLowerCase()}` : on && it.key !== "all" ? "Click again to show everything" : `Show ${it.label.toLowerCase()}`} style={common} className={`${cls} transition-colors enabled:hover:bg-primary-soft disabled:cursor-not-allowed`}>{body}</button>
          );
      })}
    </div>
  );
}
