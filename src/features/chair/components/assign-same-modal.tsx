"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import type { PoolReviewer } from "@/types/chair";
import { plusDaysISO } from "../assign-rules";

/* Peer Review › "Assign same reviewers" (the prototype's AssignReviewersBulkModal): tick the committee members who should review every selected paper,
   set the review deadline, Assign. A reviewer who is in conflict with a paper, or already on it, is skipped for that paper. Not ported: the
   "Suggested · expertise matches submission keywords" group (no reviewer expertise in the database) and the sample-mode email note. */
export function AssignSameModal({ reviewers, submissionCount, defaultDeadline, busy, error, onAssign, onClose }: { reviewers: PoolReviewer[]; submissionCount: number; defaultDeadline: string; busy: boolean; error: string; onAssign: (ids: string[], deadline: string) => void; onClose: () => void }) {
  const [ids, setIds] = useState<string[]>([]);
  const [deadline, setDeadline] = useState(defaultDeadline || plusDaysISO(28));
  const toggle = (id: string) => setIds((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  const can = ids.length > 0 && !busy;
  return (
    <Modal title="Assign Reviewers" onClose={onClose}>
      <p className="mb-4 text-sm text-ink-muted">Assign to {submissionCount} selected submission{submissionCount === 1 ? "" : "s"}.</p>
      <div style={{ border: "1px solid var(--border)" }} className="mb-5 max-h-64 space-y-1 overflow-y-auto rounded-xl px-3 py-1.5">
        {reviewers.length === 0 && <p className="text-xs text-ink-faint">No reviewers invited yet — add some from Reviewers &amp; PC first.</p>}
        {reviewers.map((r) => (
          <label key={r.memberId} className="flex cursor-pointer items-start gap-2.5 py-2 text-sm text-ink">
            <input type="checkbox" checked={ids.includes(r.memberId)} onChange={() => toggle(r.memberId)} className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded accent-primary" />
            <span className="min-w-0"><span className="flex flex-wrap items-center gap-1.5"><span className="font-medium">{r.name}</span></span></span>
          </label>
        ))}
      </div>
      <div style={{ background: "var(--canvas)", border: "1px solid var(--border)" }} className="mb-3 rounded-xl px-3.5 py-3">
        <label className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-ink-soft">
          Review deadline
          <input type="date" value={deadline} min={plusDaysISO(1)} onChange={(e) => setDeadline(e.target.value || defaultDeadline)} aria-label="Review deadline" style={{ border: "1px solid var(--border)" }} className="h-8 rounded-lg bg-white px-2 text-[12.5px] font-semibold text-ink outline-none focus:border-primary" />
        </label>
      </div>
      {error && <p role="alert" className="mb-3 text-sm font-semibold text-danger">{error}</p>}
      <button type="button" onClick={() => onAssign(ids, deadline)} disabled={!can} style={{ background: can ? "var(--primary)" : "var(--muted)", color: can ? "#FFFFFF" : "var(--ink-faint)" }} className="w-full cursor-pointer rounded-lg py-2.5 text-sm font-bold transition-colors disabled:cursor-not-allowed">{busy ? "Assigning…" : "Assign"}</button>
    </Modal>
  );
}
