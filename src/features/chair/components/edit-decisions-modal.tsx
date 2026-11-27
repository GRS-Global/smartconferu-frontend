"use client";

import { AlertTriangle, Check, Info } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import type { DecisionType, Outcome } from "@/types/chair";

/* Peer Review › "Edit decisions" (the prototype's EditDecisionsModal): pick one of the conference's decision types, Apply, then confirm. Applies to every
   selected paper at once.
   Deliberate difference: the prototype's confirmation says the authors "will be emailed this decision". Here (and in the prototype's own toast on this
   page) recording a decision emails nobody: it is the chair's own record, and the authors only see it after "Notify authors". The text says that. */

const STAGE = ["upload_pending", "no_decision", "plagiarism_clear"];
const OUTCOME_LABEL: Record<Outcome, string> = { upload_pending: "Paper upload pending", no_decision: "No decision", plagiarism_clear: "Plagiarism cleared", accept: "Accepted", registered: "Registered", revise: "Revision requested", waitlist: "Waitlisted", reject: "Rejected" };

function TypeButton({ type, active, onClick }: { type: DecisionType; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} title={type.description || undefined} style={{ background: active ? type.color : "#FFFFFF", color: active ? "#FFFFFF" : "var(--ink)", border: `1.5px solid ${active ? type.color : "var(--border)"}` }} className={`flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-left transition-colors ${active ? "" : "hover:bg-canvas"}`}>
      <span aria-hidden="true" style={{ background: active ? "#FFFFFF" : type.color }} className="h-2.5 w-2.5 shrink-0 rounded-full" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold">{type.label}</span>
        <span style={{ color: active ? "rgba(255,255,255,0.85)" : "var(--ink-faint)" }} className="mt-0.5 block text-[10px] font-semibold">{OUTCOME_LABEL[type.outcome]}</span>
      </span>
      {active && <Check size={14} aria-hidden="true" className="shrink-0" />}
    </button>
  );
}

export function EditDecisionsModal({ types, papers, currentTypeOf, settingsHref, busy, error, onApply, onClose }: { types: DecisionType[]; papers: Array<{ id: string }>; currentTypeOf: (id: string) => string | null; settingsHref: string; busy: boolean; error: string; onApply: (type: DecisionType) => void; onClose: () => void }) {
  const [typeId, setTypeId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const picked = types.find((t) => t.id === typeId);
  const n = papers.length;
  if (confirming && picked) {
    const stageOnly = STAGE.includes(picked.outcome);
    const already = papers.filter((p) => currentTypeOf(p.id) === picked.id).length;
    return (
      <Modal title="Confirm decision change" icon={AlertTriangle} onClose={onClose} maxWidth="max-w-lg" actions={<>
        <button type="button" onClick={() => setConfirming(false)} disabled={busy} style={{ border: "1px solid var(--border)" }} className="h-10 cursor-pointer rounded-lg bg-white px-4 text-sm font-semibold text-ink-soft hover:bg-canvas disabled:cursor-not-allowed">Back</button>
        <button type="button" onClick={() => onApply(picked)} disabled={busy} className="h-10 cursor-pointer rounded-lg bg-primary px-4 text-sm font-bold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60">{busy ? "Applying…" : `Yes, change ${n} decision${n === 1 ? "" : "s"}`}</button>
      </>}>
        <p className="text-sm leading-relaxed text-ink">Do you really want to change the decision of <b>{n} submission{n === 1 ? "" : "s"}</b> to <span style={{ color: picked.color, background: `${picked.color}18` }} className="whitespace-nowrap rounded-full px-2 py-0.5 font-bold">{picked.label}</span>?</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-ink-soft">
          {stageOnly ? <li>This only moves the papers to “{picked.label}”. No email is sent.</li> : <li>No email is sent. The decision is recorded for you only; the authors are told when you notify them from the Decided list.</li>}
          {already > 0 && <li>{already} already {already === 1 ? "has" : "have"} this decision.</li>}
        </ul>
        <p className="mt-3 max-h-24 overflow-y-auto text-xs text-ink-faint">{papers.map((p) => p.id).join(", ")}</p>
        {error && <p role="alert" className="mt-3 text-sm font-semibold text-danger-ink">{error}</p>}
      </Modal>
    );
  }
  return (
    <Modal title="Edit Decisions" onClose={onClose} maxWidth="max-w-lg">
      <p className="mb-4 text-sm text-ink-muted">Apply to {n} selected submission{n === 1 ? "" : "s"}.</p>
      <div className="mb-5 grid gap-1.5 sm:grid-cols-2">
        {types.map((t) => <TypeButton key={t.id} type={t} active={typeId === t.id} onClick={() => setTypeId(t.id)} />)}
        {types.length === 0 && <p className="rounded-lg bg-canvas px-3 py-2.5 text-xs leading-relaxed text-ink-faint">No decision types set up yet. <Link href={settingsHref} className="font-semibold text-primary hover:underline">Add them in Settings › Decision</Link></p>}
      </div>
      {picked && STAGE.includes(picked.outcome) && <p className="mb-4 flex items-center gap-1.5 rounded-lg bg-canvas px-3 py-2.5 text-xs text-ink-muted"><Info size={13} aria-hidden="true" className="shrink-0" /> This only moves the selected papers to “{picked.label}”. No email is sent.</p>}
      {picked && !STAGE.includes(picked.outcome) && <p className="mb-4 flex items-center gap-1.5 rounded-lg bg-canvas px-3 py-2.5 text-xs text-ink-muted"><Info size={13} aria-hidden="true" className="shrink-0" /> No email is sent. The decision is recorded for you only; the authors are told when you notify them.</p>}
      <button type="button" onClick={() => setConfirming(true)} disabled={!picked} style={{ background: picked ? "var(--primary)" : "var(--muted)", color: picked ? "#FFFFFF" : "var(--ink-faint)" }} className="w-full cursor-pointer rounded-lg py-2.5 text-sm font-bold transition-colors disabled:cursor-not-allowed">Apply</button>
    </Modal>
  );
}
