"use client";

import { BookOpen, ChevronDown, Download, Eye, Tag, Users, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { monogram } from "@/features/author/format";

/* Pieces of the review workspace shared by the chair's "Add your review" page and the reviewer's review page (the prototype's ReviewPaperHeader and
   ReviewAbstractCard): the paper's banner, the abstract, and the "Draft saved … ago" wording. */

const CARD = { border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" } as const;
/** What the banner needs of a paper (the reviewer's papers carry no authors: reviews are double-blind). */
export interface PaperLike { id: string; title: string; track: string; presentationType: string; submittedAt?: string | null; authors: { name: string; email?: string; affiliation?: string; corresponding?: boolean }[] }
export const age = (t: number) => { const s = Math.round((Date.now() - t) / 1000); return s < 10 ? "just now" : s < 60 ? `${s}s ago` : `${Math.round(s / 60)} min ago`; };

/** One round icon button of the file strip (the prototype's FileIconAction), with a tooltip on hover / focus. */
function FileIconAction({ icon: Icon, label, onClick, primary = false }: { icon: LucideIcon; label: string; onClick: () => void; primary?: boolean }) {
  return (
    <span className="group/fa relative inline-flex">
      <button type="button" onClick={onClick} aria-label={label} style={primary ? { background: "var(--primary)", color: "#FFFFFF" } : { background: "#FFFFFF", color: "var(--primary)", border: "1px solid var(--border)" }} className={`inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg transition-colors ${primary ? "hover:bg-primary-hover" : "hover:border-[var(--primary-soft-border)] hover:bg-primary-soft"}`}><Icon size={15} aria-hidden="true" /></button>
      <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 -translate-x-1/2 translate-y-1 whitespace-nowrap rounded-md bg-navy px-2 py-1 text-[11px] font-semibold text-white opacity-0 transition-all duration-150 group-focus-within/fa:translate-y-0 group-focus-within/fa:opacity-100 group-hover/fa:translate-y-0 group-hover/fa:opacity-100">{label}<span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-navy" /></span>
    </span>
  );
}

export function PaperHeader({ paper, acronym, keywords, compact, file, onFile }: { paper: PaperLike; acronym: string; keywords: string[]; compact: boolean; file: { name: string } | null; onFile: (download: boolean) => void }) {
  const [all, setAll] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const more = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  useEffect(() => {
    if (!all) return undefined;
    const close = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setAll(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setAll(false); };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [all]);
  const toggle = () => {
    if (!all && more.current && wrap.current) { const b = more.current.getBoundingClientRect(); const w = wrap.current.getBoundingClientRect(); setPos({ left: Math.max(0, b.left - w.left), top: b.bottom - w.top + 8 }); }
    setAll((v) => !v);
  };
  const [first, ...rest] = paper.authors;
  const chip = { background: "#FFFFFF", border: "1px solid var(--banner-border)" } as const;
  const chipCls = "rounded-full px-2 py-0.5 text-xs font-semibold text-ink-soft";
  const initials = (nm: string) => nm.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  const dt = "flex w-24 shrink-0 items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-muted";
  return (
    <div ref={wrap} className="relative mb-5">
      <section aria-label="Paper" className="ui-banner">
        <div className={`flex items-start gap-4 px-6 ${compact ? "pb-4 pt-5" : "pb-5 pt-7"}`}>
          <span aria-hidden="true" className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl bg-white text-lg font-extrabold text-primary shadow-sm">{monogram(acronym)}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5"><span style={chip} className="rounded-full px-2 py-0.5 text-xs font-bold text-primary">{acronym}</span><span style={chip} className={chipCls}>{paper.id}</span>{paper.track && <span style={chip} className={chipCls}>{paper.track}</span>}{paper.presentationType && <span style={chip} className={chipCls}>{paper.presentationType}</span>}</div>
            <h2 title={paper.title} className="mt-2.5 line-clamp-2 text-xl font-extrabold leading-snug tracking-tight text-navy">{paper.title}</h2>
            <dl className={`space-y-2.5 ${compact ? "mt-3" : "mt-4"}`}>
              {first && (
                <div className="flex flex-col items-start gap-1.5 sm:flex-row sm:gap-3">
                  <dt className={`${dt} pt-1.5`}><Users size={12} aria-hidden="true" /> {paper.authors.length > 1 ? "Authors" : "Author"}</dt>
                  <dd className="flex min-w-0 flex-wrap items-center gap-2">
                    <span style={chip} className="inline-flex min-w-0 items-center gap-2 rounded-full py-1 pl-1 pr-2.5"><span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">{initials(first.name)}</span><span className="truncate text-sm font-semibold text-ink">{first.name}</span>{first.affiliation && <span className="max-w-[12rem] truncate text-xs text-ink-muted">· {first.affiliation}</span>}</span>
                    {rest.length > 0 && <button ref={more} type="button" onClick={toggle} aria-expanded={all} aria-label={`Show all ${paper.authors.length} authors`} style={{ background: all ? "var(--primary)" : "#FFFFFF", color: all ? "#FFFFFF" : "var(--primary)", border: "1px solid var(--primary-soft-border)" }} className="inline-flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-bold transition-colors">+{rest.length} more <ChevronDown size={12} aria-hidden="true" className={`transition-transform ${all ? "rotate-180" : ""}`} /></button>}
                  </dd>
                </div>
              )}
              {keywords.length > 0 && (
                <div className="flex flex-col items-start gap-1.5 sm:flex-row sm:gap-3">
                  <dt className={`${dt} pt-1`}><Tag size={12} aria-hidden="true" /> Keywords</dt>
                  <dd className="flex min-w-0 flex-wrap items-center gap-1.5">{keywords.map((k) => <span key={k} style={{ background: "rgba(255,255,255,0.75)", border: "1px solid var(--banner-border)" }} className="rounded-md px-2.5 py-1 text-xs font-semibold text-ink-soft">{k}</span>)}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
        {!compact && file && (
          <div style={{ borderTop: "1px solid var(--banner-border)", background: "rgba(255,255,255,0.6)" }} className="flex flex-wrap items-center gap-3 px-6 py-3">
            <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-danger-soft text-[10px] font-extrabold tracking-wide text-danger">PDF</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-ink">{file.name}</span><span className="block text-[11px] text-ink-faint">Submitted paper{paper.submittedAt ? ` · ${paper.submittedAt}` : ""}</span></span>
            <span className="inline-flex shrink-0 items-center gap-1.5"><FileIconAction icon={Eye} label="View" onClick={() => onFile(false)} /><FileIconAction icon={Download} label="Download" onClick={() => onFile(true)} primary /></span>
          </div>
        )}
      </section>
      {all && (
        <div style={{ left: pos.left, top: pos.top, border: "1px solid var(--border)", boxShadow: "0 16px 40px rgba(15,23,42,0.16)" }} className="absolute z-30 w-80 max-w-[calc(100vw-2rem)] rounded-2xl bg-white p-2">
          <div className="px-2.5 pb-2 pt-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-faint">{paper.authors.length} authors</div>
          <ul className="max-h-72 overflow-y-auto">
            {paper.authors.map((a, i) => (
              <li key={`${a.email || a.name}-${i}`} className="flex items-start gap-2.5 rounded-xl px-2.5 py-2 hover:bg-canvas">
                <span style={i === 0 ? { background: "var(--primary)", color: "#FFFFFF" } : { background: "var(--primary-soft)", color: "var(--primary)" }} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold">{initials(a.name)}</span>
                <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-1.5"><span className="text-sm font-semibold text-ink">{a.name}</span>{a.corresponding && <span className="rounded bg-success-soft px-1.5 py-0.5 text-[10px] font-bold text-success">Corresponding</span>}</span>{a.affiliation && <span className="block truncate text-xs text-ink-muted">{a.affiliation}</span>}</span>
                <span className="mt-0.5 shrink-0 text-[11px] font-semibold text-ink-faint">#{i + 1}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** The abstract: a few lines with "Show full abstract" when it is long (fewer lines while the paper is beside the form). */
export function AbstractCard({ text, compact }: { text: string; compact: boolean }) {
  const [open, setOpen] = useState(false);
  const long = text.length > (compact ? 200 : 420);
  return (
    <section aria-label="Abstract" style={CARD} className={`rounded-2xl bg-white px-6 ${compact ? "mb-4 py-3.5" : "mb-5 py-5"}`}>
      <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-faint"><BookOpen size={12} aria-hidden="true" /> Abstract</h3>
      <p style={long && !open ? { display: "-webkit-box", WebkitLineClamp: compact ? 2 : 4, WebkitBoxOrient: "vertical", overflow: "hidden" } : undefined} className="whitespace-pre-line text-sm leading-relaxed text-ink-soft">{text}</p>
      {long && <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="mt-2 inline-flex cursor-pointer items-center gap-1 text-xs font-bold text-primary hover:underline">{open ? "Show less" : "Show full abstract"} <ChevronDown size={12} aria-hidden="true" className={open ? "rotate-180" : ""} /></button>}
    </section>
  );
}

