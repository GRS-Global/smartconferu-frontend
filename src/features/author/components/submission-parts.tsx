"use client";

import {
  ArrowDown, ArrowUp, ArrowUpDown, BadgeCheck, Ban, CalendarCheck, ChevronRight, CircleSlash, Clock, CreditCard, FileUp, Hash, Hourglass,
  ListOrdered, Mail, PenLine, PlusCircle, Tag, XCircle, type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AuthorSubmission, PaperAuthor } from "@/types/author-submission";
import { STATUS_FILTERS, STATUS_ORDER, type FilterKey, type Status, type StatusKey, type SubmissionRow } from "../status";
import { paperPageHref } from "../links";

/* The pieces of the prototype's My Submissions list (src/author-module/SubmissionsList.jsx): the status pill, each author
   with an avatar, the paper ID tag, a card, the sortable table, the filter strip and the empty state. */

const CARD = { border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" } as const;
export const cardStyle = CARD;

const STATUS_ICON: Record<StatusKey, LucideIcon> = {
  withdrawn: Ban, draft: FileUp, revise: PenLine, waitlisted: ListOrdered, waiting: Hourglass,
  registered: BadgeCheck, unregistered: CircleSlash, pending: CreditCard, rejected: XCircle,
};

export function StatusPill({ status }: { status: Status }) {
  const Icon = STATUS_ICON[status.key] || Hourglass;
  return (
    <span style={{ color: status.color, background: status.bg, border: `1px solid ${status.border}`, ...(status.pulse ? { boxShadow: "0 0 0 3px rgba(217,119,6,0.22)" } : {}) }} className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-extrabold ${status.pulse ? "animate-pulse" : ""}`}>
      <Icon size={13} strokeWidth={2.4} aria-hidden="true" /> {status.label}
    </span>
  );
}

const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase();

function AuthorAvatar({ a, size }: { a: PaperAuthor; size: number }) {
  return (
    <span aria-hidden="true" style={{ width: size, height: size }} className={`flex shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold ${a.corresponding ? "bg-primary text-white" : "bg-primary-soft text-primary"}`}>
      {initialsOf(a.name)}
    </span>
  );
}

/** Every author at once, in author order. The corresponding author(s) are a filled blue pill with a mail icon; co-authors are plain outlined pills. */
export function AuthorLine({ authors, compact = false }: { authors: PaperAuthor[]; compact?: boolean }) {
  if (!authors.length) return null;
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${compact ? "mt-1" : "mt-2.5"}`}>
      {authors.map((x, i) => {
        const lead = x.corresponding;
        return (
          <span
            key={x.email || `${x.name}-${i}`}
            title={[x.name, lead ? "Corresponding author" : "Co-author", x.affiliation, x.country].filter(Boolean).join(" · ")}
            style={lead ? { background: "var(--primary-soft)", border: "1px solid var(--primary)", color: "var(--primary-hover)" } : { background: "#FFFFFF", border: "1px dashed var(--border-strong)", color: "var(--ink-soft)" }}
            className={`inline-flex max-w-full items-center gap-1.5 rounded-full ${compact ? "py-px pl-0.5 pr-2" : "py-0.5 pl-1 pr-2.5"}`}
          >
            <AuthorAvatar a={x} size={compact ? 18 : 22} />
            <span className={`${compact ? "text-[12px]" : "text-[12.5px]"} ${lead ? "font-extrabold" : "font-semibold"} truncate`}>{x.name}</span>
            {lead
              ? <span title="Corresponding author" role="img" aria-label="Corresponding author" className="inline-flex shrink-0 cursor-help items-center"><Mail size={12} strokeWidth={2.6} /></span>
              : !compact && <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-ink-faint">Co-author</span>}
          </span>
        );
      })}
    </div>
  );
}

/** "Co-author" on a paper somebody else submitted, so it's clear why it's on this list. */
export function RoleTag({ sub }: { sub: AuthorSubmission }) {
  if (sub.mySubmission) return null;
  return (
    <span title={sub.myCorresponding ? "You're a corresponding author — you get every update about this paper by email" : "You're a co-author — the corresponding authors get the email updates"} className="rounded-full border border-primary-soft-border bg-primary-soft px-2 py-0.5 text-[11px] font-bold text-primary">
      {sub.myCorresponding ? "Co-author · corresponding" : "Co-author"}
    </span>
  );
}

export function IdTag({ id }: { id: string }) {
  return (
    <span style={{ background: "linear-gradient(#FFFFFF,#FFFFFF) padding-box, linear-gradient(90deg,#7C3AED 0%,#06B6D4 100%) border-box", border: "1.5px solid transparent" }} className="hd-id inline-flex items-center gap-0.5 rounded-lg py-0.5 pl-2 pr-2.5 shadow-[0_2px_8px_rgba(124,58,237,0.12)]">
      <Hash size={13} strokeWidth={3} aria-hidden="true" className="text-primary" />
      <span className="text-[13px] font-extrabold tabular-nums text-navy" style={{ letterSpacing: "0.01em" }}>{id}</span>
    </span>
  );
}

const metaOf = (sub: AuthorSubmission) => [
  { icon: CalendarCheck, label: "Submitted", value: sub.submittedAt || "Not sent yet" },
  sub.lastUpdate ? { icon: Clock, label: sub.submittedAt ? "Last updated" : "Last saved", value: sub.lastUpdate } : null,
  sub.track ? { icon: Tag, label: "Track", value: sub.track } : null,
].filter((m): m is { icon: LucideIcon; label: string; value: string } => m !== null);

/* ---------------- one card ---------------- */

export function SubmissionCard({ row, index }: { row: SubmissionRow; index: number }) {
  const { sub, status, step } = row;
  const Icon = STATUS_ICON[status.key] || Hourglass;
  const href = paperPageHref(sub.id, sub.conferenceId);
  const rise = { animationDelay: `${Math.min(index + 4, 10) * 60}ms` };
  const body = (
    <>
      {/* The status leads the card: a full-width band in the status colour, so it never overflows. */}
      <div style={{ background: status.bg, borderBottom: `1px solid ${status.border}`, color: status.color }} className="flex items-center gap-2.5 rounded-tl-xl rounded-tr-2xl py-2.5 pl-6 pr-5">
        <span style={{ background: "#FFFFFF", border: `1px solid ${status.border}`, color: status.color.toUpperCase() === "#FFFFFF" ? status.bg : status.color }} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"><Icon size={15} strokeWidth={2.4} aria-hidden="true" /></span>
        <span className="text-[13px] font-extrabold uppercase tracking-wide">{status.label}</span>
      </div>
      <div className="ui-card-split flex items-center gap-5 py-5 pl-6 pr-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <IdTag id={sub.id} />
            {sub.presentationType && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-ink-muted">{sub.presentationType}</span>}
            <RoleTag sub={sub} />
          </div>
          <div className="mt-2 text-[16px] font-bold leading-snug text-navy transition-colors group-hover:text-primary">{sub.title}</div>
          <AuthorLine authors={sub.authors} />
          <div className="mt-3.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-dashed border-line pt-3">
            {metaOf(sub).map((m) => {
              const MetaIcon = m.icon;
              return (
                <span key={m.label} className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12px]">
                  <MetaIcon size={13} aria-hidden="true" className="text-ink-faint" />
                  <span className="font-semibold text-ink-faint">{m.label}</span>
                  <span className="font-bold text-ink-soft">{m.value}</span>
                </span>
              );
            })}
          </div>
        </div>
        <div className="ui-card-next flex w-[210px] shrink-0 flex-col justify-center self-stretch border-l border-muted pl-5 text-right">
          <div className="text-[10.5px] font-extrabold tracking-wider text-ink-faint">NEXT STEP</div>
          <div style={{ color: step.tone }} className="mt-1 text-[14px] font-extrabold leading-snug">{step.label}</div>
          <span className="hd-open mt-1.5 inline-flex items-center justify-end gap-1 text-[12px] font-bold text-primary">Open submission <ChevronRight size={13} aria-hidden="true" /></span>
        </div>
        <span aria-hidden="true" className="hd-arrow flex h-9 w-9 shrink-0 items-center justify-center rounded-full"><ChevronRight size={17} /></span>
      </div>
    </>
  );
  const cls = "hd-rise hd-card group flex w-full flex-col rounded-2xl bg-white text-left";
  const style = { ...CARD, borderLeft: `3px solid ${step.tone}`, ["--edge" as string]: step.tone, ...rise };
  return href
    ? <Link href={href} style={style} className={cls}>{body}</Link>
    : <div style={style} className={cls}>{body}</div>;
}

/* ---------------- the table ---------------- */

// "Aug 19, 2026" -> sortable number; "Not sent yet" / missing sorts as empty.
const dateValue = (text: string | null) => { const t = Date.parse(text || ""); return Number.isNaN(t) ? null : t; };
type SortKey = "id" | "submitted" | "updated" | "status";
const SORTS: Record<SortKey, (r: SubmissionRow) => string | number | null> = {
  id: (r) => r.sub.id,
  submitted: (r) => dateValue(r.sub.submittedAt),
  updated: (r) => dateValue(r.sub.lastUpdate),
  status: (r) => STATUS_ORDER.indexOf(r.status.key),
};

/** The card view's sort choices. Withdrawn papers stay at the end whichever order is chosen. */
export const CARD_SORTS = [
  { key: "default", label: "Needs me first" },
  { key: "newest", label: "Newest submitted" },
  { key: "oldest", label: "Oldest submitted" },
  { key: "updated", label: "Recently updated" },
  { key: "id", label: "Paper ID" },
  { key: "title", label: "Title A–Z" },
  { key: "status", label: "Status" },
] as const;
export type CardSortKey = (typeof CARD_SORTS)[number]["key"];

export function sortCards(rows: SubmissionRow[], key: CardSortKey): SubmissionRow[] {
  const by: Partial<Record<CardSortKey, (a: SubmissionRow, b: SubmissionRow) => number>> = {
    newest: (a, b) => (dateValue(b.sub.submittedAt) ?? -Infinity) - (dateValue(a.sub.submittedAt) ?? -Infinity),
    oldest: (a, b) => (dateValue(a.sub.submittedAt) ?? Infinity) - (dateValue(b.sub.submittedAt) ?? Infinity),
    updated: (a, b) => (dateValue(b.sub.lastUpdate) ?? -Infinity) - (dateValue(a.sub.lastUpdate) ?? -Infinity),
    id: (a, b) => a.sub.id.localeCompare(b.sub.id, undefined, { numeric: true }),
    title: (a, b) => a.sub.title.localeCompare(b.sub.title),
    status: (a, b) => STATUS_ORDER.indexOf(a.status.key) - STATUS_ORDER.indexOf(b.status.key),
  };
  const fn = by[key];
  if (!fn) return rows;
  return [...rows.filter((r) => !r.sub.withdrawn).sort(fn), ...rows.filter((r) => r.sub.withdrawn)];
}

export function SubmissionsTable({ rows }: { rows: SubmissionRow[] }) {
  const router = useRouter();
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" } | null>(null);
  const th = "px-4 py-3 text-left text-[12.5px] font-bold whitespace-nowrap";
  // Only ID, the two dates and Status sort. First click: Z→A / newest first; second: reverse; third: off.
  // ID and dates start descending; Status starts with what needs you (ascending). Withdrawn papers stay at the end.
  const sorted = !sort ? rows : [...rows].sort((a, b) => {
    if (a.sub.withdrawn !== b.sub.withdrawn) return a.sub.withdrawn ? 1 : -1;
    const va = SORTS[sort.key](a);
    const vb = SORTS[sort.key](b);
    if (va == null || vb == null) return va == null && vb == null ? 0 : va == null ? 1 : -1; // empty always last
    const d = typeof va === "string" && typeof vb === "string" ? va.localeCompare(vb, undefined, { numeric: true }) : Number(va) - Number(vb);
    return sort.dir === "asc" ? d : -d;
  });
  const sortHeader = (label: string, key: SortKey, first: "asc" | "desc" = "desc") => {
    const on = sort?.key === key;
    const Icon = !on ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
    const other = first === "desc" ? "asc" : "desc";
    const next: typeof sort = !on ? { key, dir: first } : sort.dir === first ? { key, dir: other } : null;
    return (
      <button type="button" onClick={() => setSort(next)} title={`Sort by ${label.toLowerCase()}`} className={`inline-flex items-center gap-1 hover:text-navy ${on ? "text-primary" : ""}`}>
        {label}
        <Icon size={12} strokeWidth={2.6} aria-hidden="true" className={`shrink-0 ${on ? "" : "opacity-45"}`} />
      </button>
    );
  };
  const ariaSort = (key: SortKey) => (sort?.key === key ? (sort.dir === "asc" ? "ascending" : "descending") : undefined);
  return (
    <div style={CARD} className="overflow-x-auto rounded-2xl bg-white">
      <table className="ui-table w-full text-[13.5px]">
        <thead>
          <tr className="border-b border-line bg-canvas text-ink-soft">
            <th scope="col" aria-sort={ariaSort("id")} className={`${th} rounded-tl-2xl`}>{sortHeader("ID", "id")}</th>
            <th scope="col" className={th}>Submission</th>
            <th scope="col" className={th}>Type</th>
            <th scope="col" className={th}>Track</th>
            <th scope="col" aria-sort={ariaSort("submitted")} className={th}>{sortHeader("Submitted", "submitted")}</th>
            <th scope="col" aria-sort={ariaSort("updated")} className={th}>{sortHeader("Last update", "updated")}</th>
            <th scope="col" aria-sort={ariaSort("status")} className={`${th} text-center`}>{sortHeader("Status", "status", "asc")}</th>
            <th scope="col" className={th}>Next step</th>
            <th scope="col" className="w-10 rounded-tr-2xl"><span className="sr-only">Open</span></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(({ sub, status, step }, i) => {
            const href = paperPageHref(sub.id, sub.conferenceId);
            return (
              <tr key={sub.dbId} onClick={() => { if (href) router.push(href); }} className={`border-b border-muted transition-colors ${href ? "cursor-pointer" : ""} ${i % 2 ? "ui-row-alt" : ""}`}>
                <td className="whitespace-nowrap px-4 py-3.5 align-top font-extrabold tabular-nums text-navy">{sub.id}</td>
                <td className="min-w-[260px] px-4 py-3.5 align-top">
                  <div className="font-bold leading-snug text-navy">{href ? <Link href={href} className="hover:text-primary">{sub.title}</Link> : sub.title}</div>
                  <AuthorLine authors={sub.authors} compact />
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 align-top text-ink-soft">{sub.presentationType || "—"}</td>
                <td className="px-4 py-3.5 align-top text-ink-soft">{sub.track || "—"}</td>
                <td className="whitespace-nowrap px-4 py-3.5 align-top text-ink-soft">{sub.submittedAt || "Not sent yet"}</td>
                <td className="whitespace-nowrap px-4 py-3.5 align-top text-ink-soft">{sub.lastUpdate || "—"}</td>
                <td className="px-4 py-3.5 text-center align-top"><StatusPill status={status} /></td>
                <td style={{ color: step.tone }} className="px-4 py-3.5 align-top font-bold">{step.label}</td>
                <td className="px-3 py-3.5 align-top"><ChevronRight size={16} aria-hidden="true" className="text-line-strong" /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function NewSubmissionButton({ href }: { href: string }) {
  return (
    <Link href={href} className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-primary px-5 text-[14px] font-bold text-white transition-shadow hover:shadow-[0_0_24px_rgba(124,58,237,0.35)]">
      <PlusCircle size={15} aria-hidden="true" /> New Submission
    </Link>
  );
}

export function EmptySubmissions({ acronym, finished, newHref }: { acronym: string; finished: boolean; newHref: string | null }) {
  return (
    <div className="rounded-xl border-[1.5px] border-dashed border-primary bg-primary-soft p-8 text-center">
      <p className="mb-1 text-sm font-semibold text-navy">You haven&apos;t made a submission to {acronym}</p>
      {!finished && newHref && (
        <Link href={newHref} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white"><PlusCircle size={16} aria-hidden="true" /> Make your first submission</Link>
      )}
    </div>
  );
}

/* ---------------- the counts, as filters ----------------
   The same numbers as the Overview's strip (Submitted · Accepted · Rejected · No Decision · Registered · Not Registered ·
   Registration Pending), but each one is a button that filters the list below. Clicking the chosen one again shows
   everything. "Upload pending" and "Withdrawn" join only when there are some. */
const STRIP_ITEMS: Array<{ key: FilterKey; label: string; color: string; sub?: boolean; warn?: boolean; extra?: boolean }> = [
  { key: "all", label: "All", color: "var(--navy)" },
  { key: "submitted", label: "Submitted", color: "var(--navy)" },
  { key: "accepted", label: "Accepted", color: "var(--success-ink)" },
  { key: "rejected", label: "Rejected", color: "var(--ink-soft)" },
  { key: "nodecision", label: "No Decision", color: "var(--ink-soft)" },
  { key: "registered", label: "Registered", color: "var(--success-ink)", sub: true },
  { key: "notregistered", label: "Not Registered", color: "var(--danger-ink)", sub: true },
  { key: "regpending", label: "Registration Pending", color: "var(--warning-ink)", sub: true, warn: true },
  { key: "draft", label: "Upload Pending", color: "var(--warning-ink)", extra: true },
  { key: "withdrawn", label: "Withdrawn", color: "var(--danger-ink)", extra: true },
];

export function FilterStrip({ rows, closed, filter, onChange }: { rows: SubmissionRow[]; closed: boolean; filter: FilterKey; onChange: (k: FilterKey) => void }) {
  const items = STRIP_ITEMS.map((it) => ({ ...it, n: rows.filter((r) => STATUS_FILTERS.find((f) => f.key === it.key)!.test(r, closed)).length })).filter((it) => !it.extra || it.n > 0);
  return (
    <div role="radiogroup" aria-label="Filter your submissions" style={CARD} className="sub-strip flex flex-wrap overflow-hidden rounded-2xl bg-white">
      {items.map((it, i) => {
        const on = filter === it.key;
        const off = it.n === 0 && it.key !== "all" && !on;
        return (
          <button
            key={it.key}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={off}
            onClick={() => onChange(on && it.key !== "all" ? "all" : it.key)}
            title={off ? `No ${it.label.toLowerCase()} submissions` : on && it.key !== "all" ? "Click again to show everything" : `Show ${it.label.toLowerCase()}`}
            style={{
              borderLeft: i ? "1px solid var(--muted)" : "none",
              background: on ? "var(--primary-soft)" : it.warn && it.n ? "var(--warning-soft)" : it.sub ? "rgba(238,242,255,0.45)" : "#FFFFFF",
              boxShadow: on ? "inset 0 -3px 0 var(--primary)" : "none",
            }}
            className="flex min-w-[112px] flex-1 basis-0 flex-col items-start justify-center gap-0.5 px-3.5 py-3 text-left transition-colors enabled:hover:bg-primary-soft disabled:cursor-not-allowed"
          >
            {it.sub && <span className="text-[10px] font-bold uppercase leading-none tracking-wide text-ink-faint">Accepted</span>}
            <b style={{ color: it.n ? it.color : "var(--border-strong)" }} className="text-xl leading-tight tabular-nums">{it.n}</b>
            <span className={`text-xs font-semibold leading-tight ${on ? "text-primary" : "text-ink-muted"}`}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}
