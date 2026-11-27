"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { INPUT_CLASS } from "@/components/ui/field";
import type { ChairReviewer } from "@/types/chair";

/* The chair's actions on one reviewer of a paper, and "Ask author to fix" (the prototype's ChairPaperActionModal and CHAIR_PAPER_ACTIONS).
   Each asks for what the prototype asks for: a personal note (reminder), a new deadline (extend), a message, nothing but a confirmation (remove),
   and for the fix request what needs fixing and by when. The email each one sends is worked out by the email server, not here. */

export type ReviewerAction = { type: "remind" | "extend" | "message" | "remove"; reviewer: ChairReviewer };

const REMIND_NOTE = "Just a friendly nudge — your review of this paper is still pending. Thank you for your help!";
const LABEL = "mb-1.5 block text-[13px] font-semibold text-ink-soft";
const AREA = "w-full resize-none rounded-xl border-[1.5px] border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary-soft placeholder:text-ink-faint";

const CFG = {
  remind: { title: "Send reminder", text: "Personal note", placeholder: "", confirm: "Send reminder" },
  extend: { title: "Extend review deadline", date: "New deadline", confirm: "Extend deadline" },
  message: { title: "Message reviewer", text: "Message", placeholder: "e.g. Could you expand on your concerns about the evaluation?", confirm: "Send message" },
  remove: { title: "Remove reviewer", confirm: "Remove reviewer" },
} as const;

/** The day after today, as YYYY-MM-DD (the earliest a new deadline can be). */
const tomorrow = () => { const d = new Date(); d.setDate(d.getDate() + 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

function ActionForm({ action, paperLabel, onClose, onConfirm, busy, error }: { action: ReviewerAction; paperLabel: string; onClose: () => void; onConfirm: (input: { text: string; date: string }) => void; busy: boolean; error: string }) {
  const cfg = CFG[action.type];
  const [text, setText] = useState(action.type === "remind" ? REMIND_NOTE : "");
  const [date, setDate] = useState("");
  const min = tomorrow();
  const needsText = action.type === "message";
  const valid = (!needsText || text.trim()) && (action.type !== "extend" || (date && date >= min));
  return (
    <>
      <div className="space-y-4">
        {action.type === "remove" && (
          <p className="text-sm leading-relaxed text-ink-soft">{action.reviewer.review ? "Their submitted review will be removed from this paper." : `${action.reviewer.name} will no longer review this paper.`}</p>
        )}
        {"text" in cfg && (
          <label className="block">
            <span className={LABEL}>{cfg.text}{needsText && <span className="text-danger-ink"> *</span>}</span>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={2000} placeholder={cfg.placeholder} className={AREA} />
          </label>
        )}
        {"date" in cfg && (
          <label className="block">
            <span className={LABEL}>{cfg.date} <span className="text-danger-ink">*</span></span>
            <input type="date" min={min} value={date} onChange={(e) => setDate(e.target.value)} className={INPUT_CLASS} />
          </label>
        )}
      </div>
      {error && <p role="alert" className="mt-3 text-sm font-semibold text-danger-ink">{error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button className={action.type === "remove" ? "bg-danger hover:bg-danger" : undefined} disabled={busy || !valid} onClick={() => onConfirm({ text: text.trim(), date })}>{busy ? "Saving…" : cfg.confirm}</Button>
      </div>
      <p className="mt-3 text-[11px] text-ink-faint">{paperLabel} · the reviewer is emailed about this.</p>
    </>
  );
}

/** Send reminder / Extend deadline / Message / Remove, for one reviewer of one paper. */
export function ReviewerActionDialog({ action, paperLabel, onClose, onConfirm, busy, error }: { action: ReviewerAction | null; paperLabel: string; onClose: () => void; onConfirm: (input: { text: string; date: string }) => void; busy: boolean; error: string }) {
  return (
    <Dialog open={action !== null} onClose={onClose} title={action ? CFG[action.type].title : ""} description={action ? `${action.reviewer.name} · ${paperLabel}` : ""} size="md">
      {action && <ActionForm key={action.type + action.reviewer.assignmentId} action={action} paperLabel={paperLabel} onClose={onClose} onConfirm={onConfirm} busy={busy} error={error} />}
    </Dialog>
  );
}

/** "Ask author to fix": what needs fixing and by when; the authors are emailed. */
export function FixRequestDialog({ open, paperLabel, onClose, onConfirm, busy, error }: { open: boolean; paperLabel: string; onClose: () => void; onConfirm: (input: { issue: string; fixBy: string }) => void; busy: boolean; error: string }) {
  const [issue, setIssue] = useState("");
  const [fixBy, setFixBy] = useState("");
  const min = tomorrow();
  return (
    <Dialog open={open} onClose={onClose} title="Ask author to fix" description={`${paperLabel} · flag a fixable problem with a deadline`} size="md">
      {open && (
        <>
          <div className="space-y-4">
            <label className="block">
              <span className={LABEL}>What needs fixing <span className="text-danger-ink">*</span></span>
              <textarea value={issue} onChange={(e) => setIssue(e.target.value)} rows={3} maxLength={2000} placeholder="e.g. The PDF is missing author affiliations on the first page." className={AREA} />
            </label>
            <label className="block">
              <span className={LABEL}>Fix by <span className="text-danger-ink">*</span></span>
              <input type="date" min={min} value={fixBy} onChange={(e) => setFixBy(e.target.value)} className={INPUT_CLASS} />
            </label>
          </div>
          {error && <p role="alert" className="mt-3 text-sm font-semibold text-danger-ink">{error}</p>}
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button disabled={busy || !issue.trim() || !fixBy || fixBy < min} onClick={() => onConfirm({ issue: issue.trim(), fixBy })}>{busy ? "Saving…" : "Send request"}</Button>
          </div>
          <p className="mt-3 text-[11px] text-ink-faint">The paper&apos;s corresponding authors are emailed.</p>
        </>
      )}
    </Dialog>
  );
}
