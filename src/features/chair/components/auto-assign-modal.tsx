"use client";

import { AlertTriangle, Check, ChevronDown, Mail, Sparkles, UserPlus, X } from "lucide-react";
import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import type { PoolReviewer } from "@/types/chair";
import { loadOf, planAutoAssign, plusDaysISO, rankReviewersFor, type PlanItem } from "../assign-rules";
import type { PrRow } from "../peer-review";

/* Peer Review › Auto-assign (the prototype's AutoAssignModal): fills each paper up to the target with the lightest-loaded reviewer who has no conflict and
   is under the limit, and shows the plan to check before anything is sent: totals, "who gets what", "Needs a look" first (an empty slot, or a pick
   whose committee invitation is still pending or who goes over the limit), "Looks good" folded below, one line per reviewer, one choice per empty slot.
   Not ported: the keyword match (★ / "No expertise match") and the track record: the database keeps no reviewer expertise or history. */

const tag = (children: React.ReactNode, title?: string) => <span title={title} style={{ color: "#B45309", background: "var(--warning-soft)" }} className="inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-semibold">{children}</span>;
const initials = (n: string) => n.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();

export function AutoAssignModal({ rows, all, scope, pool, maxLoad, defaultDeadline, busy, onConfirm, onClose }: { rows: PrRow[]; all: PrRow[]; scope: "selected" | "all"; pool: PoolReviewer[]; maxLoad: number | null; defaultDeadline: string; busy: boolean; onConfirm: (plan: PlanItem[], deadline: string) => void; onClose: () => void }) {
  const [deadline, setDeadline] = useState(defaultDeadline || plusDaysISO(28));
  const [showGood, setShowGood] = useState(false);
  const [plan, setPlan] = useState<PlanItem[]>(() => planAutoAssign(rows, pool, all, maxLoad));
  const removePick = (id: string, memberId: string) => setPlan((p) => p.map((x) => (x.row.paper.dbId === id ? { ...x, reviewers: x.reviewers.filter((r) => r.memberId !== memberId) } : x)));
  const addPick = (id: string, memberId: string) => { const rev = pool.find((r) => r.memberId === memberId); if (rev) setPlan((p) => p.map((x) => (x.row.paper.dbId === id ? { ...x, reviewers: [...x.reviewers, rev] } : x))); };

  // How many papers each reviewer gets in this plan, and what their load becomes.
  const inPlan: Record<string, number> = {};
  plan.forEach((x) => x.reviewers.forEach((r) => { inPlan[r.memberId] = (inPlan[r.memberId] ?? 0) + 1; }));
  const loadAfter = (r: PoolReviewer) => loadOf(r, all) + (inPlan[r.memberId] ?? 0);
  // Why a pick may need a second look.
  const concerns = (r: PoolReviewer) => {
    const out: string[] = [];
    if (r.status === "invited") out.push("Committee invite pending");
    if (maxLoad && loadAfter(r) > maxLoad) out.push(`Over the ${maxLoad}-paper limit`);
    return out;
  };
  const cards = plan.map((x) => { const empty = Math.max(0, x.need - x.reviewers.length); const weak = x.reviewers.filter((r) => concerns(r).length).length; return { x, empty, weak, needsLook: empty > 0 || weak > 0 }; });
  // Which section a paper sits in is fixed when the dialog opens, so fixing a pick doesn't make its card jump away.
  const [lookIds] = useState(() => cards.filter((c) => c.needsLook).map((c) => c.x.row.paper.dbId));
  const needsLook = cards.filter((c) => lookIds.includes(c.x.row.paper.dbId));
  const good = cards.filter((c) => !lookIds.includes(c.x.row.paper.dbId));
  const goodOpen = showGood || needsLook.length === 0 || good.some((c) => c.needsLook);
  const total = plan.reduce((n, x) => n + x.reviewers.length, 0);
  const people = Object.keys(inPlan).length;
  const whoGetsWhat = Object.entries(inPlan).map(([id, n]) => { const r = pool.find((p) => p.memberId === id)!; return { r, n, warn: plan.some((x) => x.reviewers.some((y) => y.memberId === id) && concerns(r).length > 0) }; }).sort((a, b) => b.n - a.n || a.r.name.localeCompare(b.r.name));
  const sectionHead = (label: string, n: number, extra?: React.ReactNode) => (
    <div className="mb-2 mt-1 flex items-center justify-between gap-2"><span className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-ink-muted">{label} <span className="text-ink-faint">· {n}</span></span>{extra}</div>
  );

  const card = ({ x, empty }: (typeof cards)[number]) => {
    const options = rankReviewersFor(x.row, pool, all, maxLoad).filter((c) => !c.conflict && !c.full && !x.reviewers.some((r) => r.memberId === c.rev.memberId));
    const filled = empty === 0;
    const p = x.row.paper;
    return (
      <div key={p.dbId} style={{ border: `1px solid ${filled ? "var(--border)" : "#FCD9A8"}` }} className="rounded-xl bg-white">
        <div style={{ borderBottom: "1px solid var(--muted)" }} className="flex items-center gap-2.5 px-3.5 py-2.5">
          <span className="shrink-0 text-[11.5px] font-bold text-ink-muted">{p.id}</span>
          <span title={p.title} className="min-w-0 flex-1 truncate text-[13px] font-semibold text-navy">{p.title}</span>
          {x.row.reviewers.length > 0 && <span title={`Already reviewing: ${x.row.reviewers.map((r) => r.r.name).join(", ")}`} className="hidden shrink-0 text-[11px] text-ink-faint sm:inline">+{x.row.reviewers.length} already</span>}
          {filled
            ? <span style={{ background: "var(--success-soft)", color: "#15803D" }} className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold"><Check size={11} strokeWidth={3} aria-hidden="true" /> {x.row.target} of {x.row.target}</span>
            : <span style={{ background: "var(--warning-soft)", color: "#B45309" }} className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold"><AlertTriangle size={11} aria-hidden="true" /> {empty} slot{empty === 1 ? "" : "s"} empty</span>}
        </div>
        <ul className="px-3.5 py-1">
          {x.reviewers.map((r) => {
            const after = loadAfter(r);
            return (
              <li key={r.memberId} className="flex flex-wrap items-center gap-2.5 py-1.5">
                <span aria-hidden="true" className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[10.5px] font-bold text-primary">{initials(r.name)}</span>
                <span className="text-[13px] font-semibold text-ink">{r.name}</span>
                {concerns(r).map((c) => <span key={c}>{tag(c)}</span>)}
                <span style={{ color: maxLoad && after > maxLoad ? "var(--danger)" : "var(--ink-faint)" }} title="Papers they'll have after this" className="ml-auto whitespace-nowrap text-[11.5px]">{after} papers</span>
                <button type="button" onClick={() => removePick(p.dbId, r.memberId)} aria-label={`Remove ${r.name}`} title="Remove — then pick someone else" className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-ink-muted hover:bg-danger-soft hover:text-danger"><X size={14} aria-hidden="true" /></button>
              </li>
            );
          })}
          {Array.from({ length: empty }, (_, i) => (
            <li key={`slot-${i}`} className="py-1.5">
              {options.length ? (
                <label style={{ border: "1.5px dashed var(--border-strong)" }} className="flex h-9 items-center gap-2.5 rounded-lg px-3 transition-colors hover:border-primary">
                  <UserPlus size={14} aria-hidden="true" className="shrink-0 text-primary" />
                  <select value="" onChange={(e) => e.target.value && addPick(p.dbId, e.target.value)} aria-label={`Pick a reviewer for ${p.id}`} className="min-w-0 flex-1 cursor-pointer bg-transparent text-[13px] font-semibold text-primary outline-none">
                    <option value="">Pick a reviewer — lightest load first</option>
                    {options.map((c) => <option key={c.rev.memberId} value={c.rev.memberId}>{c.rev.name} · {c.load} papers</option>)}
                  </select>
                </label>
              ) : (
                <p style={{ color: "#B45309", background: "var(--warning-soft)" }} className="rounded-lg px-3 py-2 text-[12px]">No one left in the pool for this paper — invite more reviewers, or raise the paper limit in Settings › Review.</p>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <Modal title="Auto-assign reviewers" subtitle={`We picked reviewers for ${rows.length} ${scope === "selected" ? "selected " : ""}paper${rows.length === 1 ? "" : "s"}. Check the ones that need a look, then assign.`} icon={Sparkles} onClose={onClose} maxWidth="max-w-3xl">
      {rows.length === 0 ? (
        <p className="rounded-xl bg-canvas px-4 py-6 text-center text-sm text-ink-muted">Every {scope === "selected" ? "selected " : ""}paper already has its reviewers (or is waiting on the plagiarism check / a decision).</p>
      ) : (
        <>
          <div style={{ background: "var(--primary-soft)", border: "1px solid var(--primary-soft-border)" }} className="mb-4 rounded-xl px-4 py-3">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-navy">
              <span><b className="tabular-nums">{plan.length}</b> paper{plan.length === 1 ? "" : "s"}</span>
              <span><b className="tabular-nums">{total}</b> reviewer{total === 1 ? "" : "s"} to assign</span>
              <span className="inline-flex items-center gap-1"><Mail size={13} aria-hidden="true" /><b className="tabular-nums">{people}</b> {people === 1 ? "person gets" : "people get"} an email</span>
            </div>
            {whoGetsWhat.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="mr-0.5 text-[12px] font-semibold text-ink-muted">Who gets what:</span>
                {whoGetsWhat.map(({ r, n, warn }) => (
                  <span key={r.memberId} title={warn ? "One of their picks needs a look" : undefined} style={{ background: "#FFFFFF", border: `1px solid ${warn ? "#FCD9A8" : "var(--primary-soft-border)"}`, color: warn ? "#B45309" : "var(--navy)" }} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold">
                    {warn && <AlertTriangle size={11} aria-hidden="true" />}{r.name} <span style={{ color: warn ? "#B45309" : "var(--primary)" }} className="tabular-nums">+{n}</span>
                  </span>
                ))}
              </div>
            )}
            <p className="mt-2 flex items-start gap-1.5 text-[11.5px] text-ink-soft"><Sparkles size={12} aria-hidden="true" className="mt-0.5 shrink-0 text-primary" /> Picked by the lightest workload. Conflicts of interest{maxLoad ? ` and reviewers at their ${maxLoad}-paper limit` : ""} are never picked.</p>
          </div>

          <div className="flex max-h-[58vh] flex-col gap-2.5 overflow-y-auto pr-1">
            {needsLook.length > 0 && <>{sectionHead("Needs a look", needsLook.length)}{needsLook.map(card)}</>}
            {good.length > 0 && (
              <>
                {sectionHead("Looks good", good.length, needsLook.length > 0 && (
                  <button type="button" onClick={() => setShowGood((o) => !o)} aria-expanded={goodOpen} className="inline-flex cursor-pointer items-center gap-1 text-[12px] font-bold text-primary hover:underline">{goodOpen ? "Hide" : "Show"} <ChevronDown size={13} aria-hidden="true" style={{ transform: goodOpen ? "rotate(180deg)" : "none" }} /></button>
                ))}
                {goodOpen ? good.map(card) : <p className="rounded-lg bg-canvas px-3 py-2 text-[12.5px] text-ink-muted">{good.length} paper{good.length === 1 ? " has" : "s have"} every slot filled — nothing to check.</p>}
              </>
            )}
          </div>

          <div style={{ borderTop: "1px solid var(--muted)" }} className="mt-4 flex flex-wrap items-center gap-3 pt-4">
            <label className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-ink-soft">
              Review deadline
              <input type="date" value={deadline} min={plusDaysISO(1)} onChange={(e) => setDeadline(e.target.value || defaultDeadline)} aria-label="Review deadline" style={{ border: "1px solid var(--border)" }} className="h-8 rounded-lg bg-white px-2 text-[12.5px] font-semibold text-ink outline-none focus:border-primary" />
            </label>
            <div className="ml-auto flex items-center gap-2">
              <button type="button" onClick={onClose} className="h-10 cursor-pointer rounded-xl px-4 text-sm font-semibold text-ink-muted hover:bg-canvas">Cancel</button>
              <button type="button" disabled={!total || busy} onClick={() => onConfirm(plan, deadline)} className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-xl bg-primary px-5 text-sm font-bold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"><Check size={15} aria-hidden="true" /> {busy ? "Assigning…" : `Assign ${total} reviewer${total === 1 ? "" : "s"}`}</button>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}
