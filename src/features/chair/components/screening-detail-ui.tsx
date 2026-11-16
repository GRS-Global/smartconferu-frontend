"use client";

import { Check, ChevronLeft, ChevronRight, Download, Eye, X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { CARD } from "./screening-ui";

/* The pieces the paper's own Initial Check / Plagiarism Check pages share (the prototype's CheckRow, VersionActions, SectionCard and the
   Paper n of N bar in src/chair-plagiarism/ScreeningTables.jsx). */

/** One requirement: a status dot, what it is and what the conference asks for, and its control on the right. */
export function CheckRow({ state, title, need, tag, children }: { state: "ok" | "bad" | "blank"; title: string; need: string; tag?: ReactNode; children?: ReactNode }) {
  const tone = state === "ok" ? { bg: "var(--success-soft)", fg: "var(--success)" } : state === "bad" ? { bg: "var(--danger-soft)", fg: "var(--danger)" } : { bg: "var(--muted)", fg: "var(--ink-faint)" };
  return (
    <li className="flex flex-wrap items-center gap-4 px-5 py-4">
      <span style={{ background: tone.bg, color: tone.fg }} className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
        {state === "ok" ? <Check size={14} strokeWidth={3} aria-hidden="true" /> : state === "bad" ? <X size={14} strokeWidth={3} aria-hidden="true" /> : <span aria-hidden="true" className="h-0.5 w-2 rounded bg-current" />}
      </span>
      <div className="min-w-[200px] flex-1">
        <div className="text-sm font-bold text-navy">{title}</div>
        <div className="mt-0.5 text-xs text-ink-muted">{need}</div>
        {tag}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-3">{children}</div>
    </li>
  );
}

/** View and Download for one file, as the Files table on the paper's details page has them: an outlined eye and a filled download. */
export function VersionActions({ onView, onDownload }: { onView: () => void; onDownload: () => void }) {
  const tip = "pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 -translate-x-1/2 translate-y-1 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold text-white opacity-0 transition-all duration-150 group-focus-within/fa:translate-y-0 group-focus-within/fa:opacity-100 group-hover/fa:translate-y-0 group-hover/fa:opacity-100";
  const one = (Icon: typeof Eye, label: string, onClick: () => void, primary: boolean) => (
    <span className="group/fa relative inline-flex">
      <button type="button" onClick={onClick} aria-label={label} style={primary ? { background: "var(--primary)", color: "#FFFFFF" } : { background: "#FFFFFF", color: "var(--primary)", border: "1px solid var(--border)" }} className={cn("inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg transition-colors", primary ? "hover:bg-primary-hover" : "hover:border-primary-soft-border hover:bg-primary-soft")}><Icon size={15} aria-hidden="true" /></button>
      <span role="tooltip" style={{ background: "var(--navy)" }} className={tip}>{label}<span style={{ borderTopColor: "var(--navy)" }} className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent" /></span>
    </span>
  );
  return <span className="inline-flex shrink-0 items-center gap-1.5">{one(Eye, "View", onView, false)}{one(Download, "Download", onDownload, true)}</span>;
}

export const SectionCard = ({ title, hint, action, children, pad = true }: { title: string; hint?: string; action?: ReactNode; children: ReactNode; pad?: boolean }) => (
  <section style={CARD} className="overflow-hidden rounded-2xl bg-white">
    <div className="flex flex-wrap items-start justify-between gap-3 px-5 pb-3 pt-5">
      <div><h3 className="text-sm font-bold text-navy">{title}</h3>{hint && <p className="mt-0.5 text-xs text-ink-muted">{hint}</p>}</div>
      {action}
    </div>
    <div className={pad ? "px-5 pb-5" : ""}>{children}</div>
  </section>
);

/** "Paper 3 of 250" with Prev / Next through the same list the table shows. */
export function PaperNav({ backLabel, onBack, at, total, prev, next, onGo }: { backLabel: string; onBack: () => void; at: number; total: number; prev: string | null; next: string | null; onGo: (id: string) => void }) {
  return (
    <div style={{ border: "1px solid var(--border)" }} className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-white px-3 py-2">
      <button type="button" onClick={onBack} className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg px-2 text-xs font-bold text-ink-muted hover:bg-canvas"><ChevronLeft size={14} aria-hidden="true" /> {backLabel}</button>
      {at >= 0 && (
        <>
          <span aria-hidden="true" style={{ background: "var(--border)" }} className="h-5 w-px" />
          <span className="min-w-0 truncate text-xs text-ink-soft">Paper <b className="tabular-nums text-navy">{at + 1} of {total}</b></span>
          <div className="ml-auto flex items-center gap-1.5">
            {([[prev, "Prev", false], [next, "Next", true]] as const).map(([target, label, after]) => (
              <button key={label} type="button" disabled={!target} onClick={() => target && onGo(target)} title={target ? `${label}: ${target}` : label === "Prev" ? "This is the first paper" : "This is the last paper"} style={{ border: "1px solid var(--border)", color: "var(--ink-soft)" }} className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg bg-white px-3 text-xs font-semibold enabled:hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-40">
                {!after && <ChevronLeft size={14} aria-hidden="true" />} {label} {after && <ChevronRight size={14} aria-hidden="true" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
