"use client";

import { Check, FileCheck, EyeOff, XCircle } from "lucide-react";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { AuthRequiredError } from "@/services/errors";
import { getReviewerService } from "@/services/reviewer";
import { DECLINE_ASSIGNMENT_REASONS, type ReviewerPaper } from "@/types/reviewer";
import { fmtDay } from "@/features/author/format";

/* Accept or decline an assignment (the prototype's AcceptAssignmentModal and DeclineAssignmentModal). Both save through the database's
   respond_to_assignment (the chair is told when a paper is declined) and say so in the dialog when that fails. */

export type Respond = { paper: ReviewerPaper; kind: "accept" | "decline" } | null;

const failure = (e: unknown) => (e instanceof Error && e.message ? e.message : "Something went wrong — please try again.");

function Footer({ onCancel, children }: { onCancel: () => void; children: React.ReactNode }) {
  return (
    <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-line pt-4">
      <button type="button" onClick={onCancel} className="h-10 rounded-xl px-3 text-sm font-semibold text-ink-muted transition-colors hover:bg-canvas">Cancel</button>
      {children}
    </div>
  );
}

function AcceptForm({ paper, onClose, onDone, onSessionEnded }: { paper: ReviewerPaper; onClose: () => void; onDone: (r: "accepted") => void; onSessionEnded: () => void }) {
  const [coi, setCoi] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const confirm = async () => {
    if (saving) return;
    setSaving(true); setError("");
    try { await (await getReviewerService()).respond(paper.assignmentId, true); onClose(); onDone("accepted"); }
    catch (e) { if (e instanceof AuthRequiredError) { onClose(); onSessionEnded(); } else setError(failure(e)); }
    finally { setSaving(false); }
  };
  return (
    <>
      <div className="rounded-xl border border-line bg-canvas p-4">
        <div className="text-sm font-bold leading-snug text-navy">{paper.title}</div>
        <div className="mt-1 flex items-center gap-1 text-[11px] text-ink-faint"><EyeOff size={11} aria-hidden="true" /> Double-blind — author names are hidden</div>
      </div>
      <label style={{ border: `1.5px solid ${coi ? "var(--primary)" : "var(--border)"}`, background: coi ? "var(--primary-soft)" : "#FFFFFF" }} className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl p-3.5 transition-colors">
        <input type="checkbox" checked={coi} onChange={(e) => setCoi(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-primary" />
        <span>
          <span className="block text-sm font-semibold text-ink">I have no conflict of interest with this paper</span>
          <span className="mt-0.5 block text-xs leading-relaxed text-ink-muted">I&apos;m not an author, I don&apos;t work at an author&apos;s institution, and I haven&apos;t collaborated with an author in the last 3 years.</span>
        </span>
      </label>
      <p className="mt-3 text-[11px] text-ink-faint">Have a conflict? Cancel and choose <b>Decline → Conflict of interest</b> instead.</p>
      {error && <p role="alert" className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-xs font-semibold text-danger-ink">{error}</p>}
      <Footer onCancel={onClose}>
        <button type="button" disabled={!coi || saving} onClick={confirm} className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"><Check size={15} aria-hidden="true" /> {saving ? "Saving…" : "Accept & start reviewing"}</button>
      </Footer>
    </>
  );
}

function DeclineForm({ paper, onClose, onDone, onSessionEnded }: { paper: ReviewerPaper; onClose: () => void; onDone: (r: "declined") => void; onSessionEnded: () => void }) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const confirm = async () => {
    if (saving) return;
    setSaving(true); setError("");
    try { await (await getReviewerService()).respond(paper.assignmentId, false, [reason, note.trim()].filter(Boolean).join(" — ")); onClose(); onDone("declined"); }
    catch (e) { if (e instanceof AuthRequiredError) { onClose(); onSessionEnded(); } else setError(failure(e)); }
    finally { setSaving(false); }
  };
  return (
    <>
      <div className="mb-2 text-[13px] font-semibold text-ink-soft">Why are you declining? <span className="text-danger-ink">*</span></div>
      <div className="grid gap-2 sm:grid-cols-2">
        {DECLINE_ASSIGNMENT_REASONS.map((r) => {
          const on = reason === r;
          return <button key={r} type="button" onClick={() => setReason(r)} aria-pressed={on} style={{ border: `1.5px solid ${on ? "var(--primary)" : "var(--border)"}`, background: on ? "var(--primary-soft)" : "#FFFFFF", color: on ? "var(--primary)" : "var(--ink)" }} className="rounded-xl px-3.5 py-2.5 text-left text-sm font-semibold transition-colors">{r}</button>;
        })}
      </div>
      <label htmlFor="decline-note" className="mb-1.5 mt-4 block text-[13px] font-semibold text-ink-soft">Note to the chair {reason === "Other" ? <span className="text-danger-ink">*</span> : <span className="font-normal text-ink-faint">(optional)</span>}</label>
      <textarea id="decline-note" rows={3} value={note} maxLength={800} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Suggest a colleague who'd be a better fit…" className="w-full resize-y rounded-xl border-[1.5px] border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-primary" />
      {error && <p role="alert" className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-xs font-semibold text-danger-ink">{error}</p>}
      <Footer onCancel={onClose}>
        <button type="button" disabled={!reason || (reason === "Other" && !note.trim()) || saving} onClick={confirm} className="h-10 rounded-xl bg-danger px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45">{saving ? "Saving…" : "Decline paper"}</button>
      </Footer>
    </>
  );
}

/** The accept / decline dialog for one paper. `onDone` gets what happened so the page can say so and read the list again. */
export function AssignmentDialogs({ respond, onClose, onDone, onSessionEnded }: { respond: Respond; onClose: () => void; onDone: (paper: ReviewerPaper, result: "accepted" | "declined") => void; onSessionEnded: () => void }) {
  const paper = respond?.paper;
  const kind = respond?.kind;
  const due = paper?.due ? fmtDay(paper.due, { day: "numeric", month: "short", year: "numeric" }) : "—";
  return (
    <>
      <Dialog open={kind === "accept"} onClose={onClose} title="Accept this paper?" description={paper ? `${paper.id} · review due ${due}` : undefined} icon={FileCheck} size="md">
        {paper && kind === "accept" && <AcceptForm paper={paper} onClose={onClose} onDone={(r) => onDone(paper, r)} onSessionEnded={onSessionEnded} />}
      </Dialog>
      <Dialog open={kind === "decline"} onClose={onClose} title="Decline this paper?" description={paper ? `${paper.id} · the chair is told so they can reassign it` : undefined} icon={XCircle} size="md">
        {paper && kind === "decline" && <DeclineForm paper={paper} onClose={onClose} onDone={(r) => onDone(paper, r)} onSessionEnded={onSessionEnded} />}
      </Dialog>
    </>
  );
}
