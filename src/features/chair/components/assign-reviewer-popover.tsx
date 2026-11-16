"use client";

import { Check, Plus, Search, UserPlus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PoolReviewer } from "@/types/chair";
import type { PrRow } from "../peer-review";

/* Peer Review › "Assign" / "Find replacement" under a paper's reviewers (the prototype's AssignReviewerPopover): the committee with each person's
   current load, the ones who cannot take this paper greyed out (an author of it, or already at the limit), "+" on a reviewer to set the review
   deadline and Assign. Not ported: the keyword match (★ "Matches: …", it needs each reviewer's expertise, which the database does not keep) and the
   "track record" line (it needs every conference's history). */

const W = 360;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const plusDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };

export interface AssignCandidate { rev: PoolReviewer; load: number; conflict: string | null; full: boolean }

export function AssignReviewerPopover({ row, candidates, maxLoad, deadline, anchor, onAssign, onInvite, onClose, busy }: { row: PrRow; candidates: AssignCandidate[]; maxLoad: number | null; deadline: string; anchor: DOMRect; onAssign: (rev: PoolReviewer, due: string) => void; onInvite: () => void; onClose: () => void; busy: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  const [picking, setPicking] = useState<string | null>(null);
  const [due, setDue] = useState(deadline || plusDays(28));
  useEffect(() => {
    const down = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    // The page scrolling moves the anchor away, so close; scrolling the list inside doesn't count.
    const scroll = (e: Event) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    window.addEventListener("scroll", scroll, true);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); window.removeEventListener("scroll", scroll, true); };
  }, [onClose]);
  // Lightest load first (no expertise data to rank by), blocked ones last.
  const list = useMemo(() => candidates
    .filter((c) => !q.trim() || c.rev.name.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => Number(Boolean(a.conflict) || a.full) - Number(Boolean(b.conflict) || b.full) || a.load - b.load || a.rev.name.localeCompare(b.rev.name)), [candidates, q]);
  const left = Math.min(Math.max(8, anchor.left), window.innerWidth - W - 8);
  const below = anchor.bottom + 6 + 420 < window.innerHeight;
  const initials = (n: string) => n.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div ref={ref} role="dialog" aria-label={`Assign a reviewer to ${row.paper.id}`} style={{ position: "fixed", left, width: W, ...(below ? { top: anchor.bottom + 6 } : { bottom: window.innerHeight - anchor.top + 6 }), border: "1px solid var(--border)", boxShadow: "0 16px 40px rgba(11,16,32,0.18)" }} className="z-50 overflow-hidden rounded-2xl bg-white">
      <div style={{ borderBottom: "1px solid var(--muted)" }} className="px-4 pb-3 pt-3.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-bold text-navy">Assign to {row.paper.id}</span>
          <span style={{ color: row.reviewers.length < row.target ? "#B45309" : "var(--success)" }} className="text-xs font-bold">{row.reviewers.length} / {row.target} assigned</span>
        </div>
        <label style={{ border: "1px solid var(--border)" }} className="mt-2.5 flex h-8 items-center gap-2 rounded-lg px-2.5">
          <Search size={13} aria-hidden="true" className="text-ink-faint" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search reviewers" aria-label="Search reviewers" className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-slate-400" />
        </label>
      </div>
      <ul className="max-h-[260px] overflow-y-auto py-1">
        {list.length === 0 && <li className="px-4 py-5 text-center text-xs text-ink-faint">No more reviewers in the pool — invite someone new.</li>}
        {list.map(({ rev, load, conflict, full }) => {
          const blocked = Boolean(conflict) || full;
          const open = picking === rev.memberId;
          return (
            <li key={rev.memberId} className="px-4 py-2" style={{ opacity: blocked ? 0.6 : 1, background: open ? "var(--primary-soft)" : undefined }}>
              <div className="flex items-start gap-2.5">
                <span aria-hidden="true" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[11px] font-bold text-primary">{initials(rev.name)}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[13px] font-semibold text-ink">{rev.name}</span>
                    {rev.status === "invited" && <span style={{ background: "var(--warning-soft)", color: "#B45309" }} className="rounded px-1.5 text-[10px] font-bold">Invited</span>}
                  </div>
                  <div style={{ color: conflict ? "var(--danger)" : "var(--ink-faint)" }} className="text-[11px] leading-snug">{conflict ? `⚠ ${conflict}` : rev.email}</div>
                </div>
                <span style={{ color: full ? "var(--danger)" : "var(--ink-muted)" }} title="Papers already assigned in this conference" className="shrink-0 pt-0.5 text-[11px] font-bold tabular-nums">{load}{maxLoad ? `/${maxLoad}` : ""} papers</span>
                {!open && (
                  <button type="button" disabled={blocked} onClick={() => { setPicking(rev.memberId); setDue(deadline || plusDays(28)); }} title={conflict ? "Conflict of interest — can't be assigned" : full ? "Already at the maximum papers per reviewer" : `Assign ${rev.name}`} aria-label={`Assign ${rev.name}`} style={blocked ? { color: "var(--border-strong)", border: "1px solid var(--border)" } : { color: "var(--primary)", border: "1px solid var(--primary-soft-border)", background: "var(--primary-soft)" }} className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg enabled:hover:border-primary disabled:cursor-not-allowed">
                    <Plus size={14} aria-hidden="true" />
                  </button>
                )}
              </div>
              {open && (
                <div className="ml-6 mt-2 flex flex-wrap items-center gap-2">
                  <label className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink-soft">
                    Review deadline
                    <input type="date" value={due} min={plusDays(1)} onChange={(e) => setDue(e.target.value)} autoFocus aria-label={`Review deadline for ${rev.name}`} style={{ border: "1px solid var(--border)" }} className="h-8 rounded-lg bg-white px-2 text-[12.5px] font-semibold text-ink outline-none focus:border-primary" />
                  </label>
                  <span className="ml-auto inline-flex gap-1.5">
                    <button type="button" onClick={() => setPicking(null)} className="h-8 cursor-pointer rounded-lg px-2.5 text-[12px] font-semibold text-ink-muted hover:bg-white">Cancel</button>
                    <button type="button" disabled={!due || busy} onClick={() => onAssign(rev, due)} className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg bg-primary px-3 text-[12px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"><Check size={13} aria-hidden="true" /> Assign</button>
                  </span>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <button type="button" onClick={onInvite} style={{ borderTop: "1px solid var(--muted)" }} className="inline-flex w-full cursor-pointer items-center gap-1.5 px-4 py-2.5 text-left text-xs font-bold text-primary hover:bg-canvas"><UserPlus size={13} aria-hidden="true" /> Invite someone new</button>
    </div>
  );
}
