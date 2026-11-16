"use client";

import { CalendarPlus, Check } from "lucide-react";
import { toDate } from "../format";

/* The author's key dates as a list beside the to-do list (the prototype's KeyDatesCompact, src/author-module/KeyDates.jsx).
   Each upcoming date can go to the calendar from its row (the icon shows on hover / focus), and every date at once from
   the header. */

export interface Milestone { key: string; label: string; iso: string; end?: string; days: number | null }

const WEEKDAY = (iso: string, style: "long" | "short" = "long") => toDate(iso).toLocaleDateString("en-US", { weekday: style });
const longDate = (iso: string) => toDate(iso).toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
const rel = (days: number) => (days === 0 ? "today" : days === 1 ? "tomorrow" : days > 0 ? `in ${days} days` : `${-days} days ago`);
const stateOf = (m: Milestone, next: Milestone | null) => (m === next ? "next" : (m.days ?? 0) < 0 ? "done" : "future");

export function KeyDatesCompact({ milestones, next, onAddAll, onAddOne }: { milestones: Milestone[]; next: Milestone | null; onAddAll: () => void; onAddOne: (m: Milestone) => void }) {
  const doneCount = milestones.filter((m) => (m.days ?? 0) < 0 && m !== next).length;
  return (
    <section aria-label="Key dates" style={{ border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }} className="overflow-hidden rounded-2xl bg-white">
      <div className="flex items-center justify-between gap-2 px-5 py-4">
        <h2 className="text-base font-extrabold text-navy">Key dates</h2>
        <span className="flex items-center gap-2">
          <span className="text-[12.5px] font-semibold text-ink-muted">{doneCount} of {milestones.length} done</span>
          <button type="button" onClick={onAddAll} title="Add every date to your calendar" aria-label="Add every date to your calendar" className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-primary-soft hover:text-primary">
            <CalendarPlus size={15} aria-hidden="true" />
          </button>
        </span>
      </div>
      <ol>
        {milestones.map((m) => {
          const st = stateOf(m, next);
          return (
            <li key={m.key} style={{ borderTop: "1px solid var(--muted)", background: st === "next" ? "var(--primary-soft)" : "transparent", boxShadow: st === "next" ? "inset 3px 0 0 var(--primary)" : "none" }} className="group flex items-center gap-3.5 px-5 py-3">
              {st === "done" ? (
                <span style={{ background: "var(--success-soft)", color: "#15803D" }} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"><Check size={14} strokeWidth={3} aria-hidden="true" /></span>
              ) : st === "next" ? (
                <span style={{ border: "5px solid var(--primary)" }} className="box-border h-7 w-7 shrink-0 rounded-full bg-white" />
              ) : (
                <span style={{ border: "3px solid var(--border-strong)" }} className="box-border h-7 w-7 shrink-0 rounded-full bg-white" />
              )}
              <div className="min-w-0 flex-1">
                <div className={`text-sm ${st === "next" ? "font-extrabold text-navy" : "font-bold text-ink"}`}>{m.label}</div>
                <div className="text-[12.5px] text-ink-muted">
                  {m.end && m.end !== m.iso ? `${WEEKDAY(m.iso, "short")} ${toDate(m.iso).getDate()} – ${longDate(m.end)}` : longDate(m.iso)}
                </div>
              </div>
              {st !== "done" && (
                <button type="button" onClick={() => onAddOne(m)} title={`Add "${m.label}" to your calendar`} aria-label={`Add ${m.label} to calendar`} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-ink-muted opacity-0 transition-opacity hover:bg-white hover:text-primary focus:opacity-100 group-hover:opacity-100">
                  <CalendarPlus size={14} aria-hidden="true" />
                </button>
              )}
              {st === "done" ? (
                <span style={{ color: "#15803D", background: "var(--success-soft)" }} className="rounded-full px-2.5 py-1 text-xs font-bold">Done</span>
              ) : (
                <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${st === "next" ? "bg-primary text-white" : "bg-muted text-ink-soft"}`}>{rel(m.days ?? 0)}</span>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
