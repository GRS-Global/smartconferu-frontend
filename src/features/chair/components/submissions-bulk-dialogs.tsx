"use client";

import { AlertTriangle, Check, Info, Send } from "lucide-react";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { sendEmailEvent } from "@/services/action-emails";
import type { ChairPaper, DecisionType, PoolReviewer } from "@/types/chair";

/* The Submissions list's bulk-action dialogs (the prototype's ContactModal, AssignReviewersBulkModal, EditDecisionsModal and
   EditTrackModal): each one works on the papers ticked in the list. */

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const toHtml = (t: string) => t.split(/\n\n+/).filter((p) => p.trim()).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
const plural = (n: number) => (n === 1 ? "" : "s");
const BTN_GHOST = "rounded-lg border-[1.5px] border-line px-4 py-2.5 text-sm font-semibold text-ink-muted transition-colors hover:bg-slate-50";

/** One corresponding author per paper, each address once. */
const correspondingOf = (papers: ChairPaper[]) => Array.from(new Map(papers.flatMap((p) => { const a = p.authors.find((x) => x.corresponding) ?? p.authors[0]; return a && a.email ? [[a.email.toLowerCase(), a] as const] : []; })).values());

export function ContactDialog({ open, papers, onClose }: { open: boolean; papers: ChairPaper[]; onClose: () => void }) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<{ status: "idle" | "sending" | "sent"; count: number; error: string }>({ status: "idle", count: 0, error: "" });
  const recipients = correspondingOf(papers);
  const ready = subject.trim() && message.trim() && recipients.length > 0;

  const send = async () => {
    setState({ status: "sending", count: 0, error: "" });
    let sent = 0; let error = "";
    for (const p of papers) {
      const a = p.authors.find((x) => x.corresponding) ?? p.authors[0];
      if (!a?.email) continue;
      const res = await sendEmailEvent("paper_message", { submissionId: p.dbId, to: [a.email], subject: subject.trim(), body: toHtml(`Hi {{first_name}},\n\n${message.trim()}`) });
      sent += res.sent;
      if (res.error || res.failed) { error = res.error ?? `${res.failed} email${plural(res.failed)} couldn't be sent.`; break; }
    }
    setState({ status: error ? "idle" : "sent", count: sent, error });
  };
  const close = () => { onClose(); setTimeout(() => { setSubject(""); setMessage(""); setState({ status: "idle", count: 0, error: "" }); }, 200); };

  if (state.status === "sent") {
    return (
      <Dialog open={open} onClose={close} title="Message Sent" size="sm">
        <div className="py-4 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success-soft"><Check size={24} strokeWidth={2.5} aria-hidden="true" className="text-success" /></div>
          <p className="mb-1 text-sm font-semibold text-navy">Sent to {state.count} recipient{plural(state.count)}</p>
          <p className="mb-5 text-xs text-ink-faint">Every email is listed in Email Logs.</p>
          <button type="button" onClick={close} className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:brightness-95">Close</button>
        </div>
      </Dialog>
    );
  }
  return (
    <Dialog open={open} onClose={close} title="Contact Submitters" size="lg">
      <div className="mb-4 max-h-28 overflow-y-auto rounded-lg bg-canvas p-3">
        <div className="mb-1.5 text-xs font-semibold text-ink-faint">To</div>
        <div className="flex flex-wrap gap-1.5">
          {recipients.map((r) => <span key={r.email} className="rounded-md border border-line bg-white px-2 py-1 text-xs font-medium text-ink">{r.name} &lt;{r.email}&gt;</span>)}
        </div>
      </div>
      <div className="mb-5 space-y-3">
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" aria-label="Subject" className="w-full rounded-lg border border-line px-3 py-2.5 text-sm text-ink outline-none placeholder:text-slate-400 focus:border-primary" />
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Message…" aria-label="Message" rows={6} className="w-full resize-none rounded-lg border border-line px-3 py-2.5 text-sm text-ink outline-none placeholder:text-slate-400 focus:border-primary" />
      </div>
      {state.error && <p role="alert" className="mb-3 text-sm font-semibold text-danger">{state.error}</p>}
      <div className="flex items-center justify-end gap-3">
        <button type="button" onClick={close} className={BTN_GHOST}>Cancel</button>
        <button type="button" disabled={!ready || state.status === "sending"} onClick={() => { void send(); }} className={`flex items-center gap-1.5 rounded-lg px-5 py-2.5 text-sm font-bold transition-colors disabled:cursor-not-allowed ${ready ? "bg-primary text-white" : "bg-muted text-ink-faint"}`}><Send size={14} aria-hidden="true" /> {state.status === "sending" ? "Sending…" : "Send"}</button>
      </div>
    </Dialog>
  );
}

export function AssignReviewersDialog({ open, count, reviewers, defaultDue, busy, error, onAssign, onClose }: { open: boolean; count: number; reviewers: PoolReviewer[]; defaultDue: string; busy: boolean; error: string; onAssign: (members: PoolReviewer[], due: string) => void; onClose: () => void }) {
  const [picked, setPicked] = useState<string[]>([]);
  const [due, setDue] = useState(defaultDue);
  const toggle = (id: string) => setPicked((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  return (
    <Dialog open={open} onClose={onClose} title="Assign Reviewers" size="lg">
      <p className="mb-4 text-sm text-ink-muted">Assign to {count} selected submission{plural(count)}.</p>
      <div className="mb-5 max-h-64 space-y-1 overflow-y-auto rounded-xl border border-line px-3 py-1.5">
        {reviewers.length === 0 && <p className="text-xs text-ink-faint">No reviewers invited yet — add some from Reviewers first.</p>}
        {reviewers.map((r) => (
          <label key={r.memberId} className="flex cursor-pointer items-start gap-2.5 py-2 text-sm text-ink">
            <input type="checkbox" checked={picked.includes(r.memberId)} onChange={() => toggle(r.memberId)} style={{ accentColor: "var(--primary)" }} className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded" />
            <span className="font-medium">{r.name}</span>
          </label>
        ))}
      </div>
      <div className="mb-3 rounded-xl border border-line bg-canvas px-3.5 py-3">
        <label className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-ink-soft">Review deadline
          <input type="date" value={due} onChange={(e) => setDue(e.target.value || defaultDue)} aria-label="Review deadline" className="h-8 rounded-lg border border-line bg-white px-2 text-[12.5px] font-semibold outline-none focus:border-primary" />
        </label>
      </div>
      {error && <p role="alert" className="mb-3 text-sm font-semibold text-danger">{error}</p>}
      <button type="button" disabled={picked.length === 0 || busy} onClick={() => onAssign(reviewers.filter((r) => picked.includes(r.memberId)), due)} className={`w-full rounded-lg py-2.5 text-sm font-bold transition-colors disabled:cursor-not-allowed ${picked.length ? "bg-primary text-white" : "bg-muted text-ink-faint"}`}>{busy ? "Assigning…" : "Assign"}</button>
    </Dialog>
  );
}

export function EditDecisionsDialog({ open, papers, types, busy, error, onApply, onClose }: { open: boolean; papers: ChairPaper[]; types: DecisionType[]; busy: boolean; error: string; onApply: (type: DecisionType) => void; onClose: () => void }) {
  const [typeId, setTypeId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const picked = types.find((t) => t.id === typeId) ?? null;
  const count = papers.length;
  const stageOnly = picked ? ["upload_pending", "no_decision", "plagiarism_clear"].includes(picked.outcome) : false;
  if (confirming && picked) {
    const already = papers.filter((p) => p.decisionTypeId === picked.id).length;
    return (
      <Dialog open={open} onClose={onClose} title="Confirm decision change" icon={AlertTriangle} size="lg">
        <p className="text-sm leading-relaxed text-ink">Do you really want to change the decision of <b>{count} submission{plural(count)}</b> to <span style={{ color: picked.color, background: `${picked.color}18` }} className="whitespace-nowrap rounded-full px-2 py-0.5 font-bold">{picked.label}</span>?</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-ink-soft">
          {stageOnly ? <li>This only moves the papers to “{picked.label}”. No email is sent.</li> : <li>This records the decision. The authors are told when you notify them from Peer Review.</li>}
          {already > 0 && <li>{already} already {already === 1 ? "has" : "have"} this decision.</li>}
        </ul>
        <p className="mt-3 max-h-24 overflow-y-auto text-xs text-ink-faint">{papers.map((p) => p.id).join(", ")}</p>
        {error && <p role="alert" className="mt-3 text-sm font-semibold text-danger">{error}</p>}
        <div className="mt-5 flex items-center justify-end gap-3">
          <button type="button" disabled={busy} onClick={() => setConfirming(false)} className={BTN_GHOST}>Back</button>
          <button type="button" disabled={busy} onClick={() => onApply(picked)} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white hover:brightness-95 disabled:opacity-50">{busy ? "Saving…" : `Yes, change ${count} decision${plural(count)}`}</button>
        </div>
      </Dialog>
    );
  }
  return (
    <Dialog open={open} onClose={onClose} title="Edit Decisions" size="lg">
      <p className="mb-4 text-sm text-ink-muted">Apply to {count} selected submission{plural(count)}.</p>
      <div className="mb-5 grid gap-1.5 sm:grid-cols-2">
        {types.map((t) => (
          <button key={t.id} type="button" aria-pressed={typeId === t.id} onClick={() => setTypeId(t.id)} style={typeId === t.id ? { borderColor: t.color, background: `${t.color}12` } : undefined} className="flex items-center gap-2 rounded-xl border-[1.5px] border-line px-3 py-2 text-left text-[13px] font-bold text-navy transition-colors hover:bg-canvas">
            <span style={{ background: t.color }} className="h-2.5 w-2.5 shrink-0 rounded-full" />{t.label}
          </button>
        ))}
        {types.length === 0 && <p className="text-xs text-ink-faint">This conference has no decision types yet — add them in Conference Settings › Decision.</p>}
      </div>
      {picked && stageOnly && <p className="mb-4 flex items-center gap-1.5 rounded-lg bg-canvas px-3 py-2.5 text-xs text-ink-muted"><Info size={13} aria-hidden="true" className="shrink-0" /> This only moves the selected papers to “{picked.label}”. No email is sent.</p>}
      <button type="button" disabled={!picked} onClick={() => setConfirming(true)} className={`w-full rounded-lg py-2.5 text-sm font-bold transition-colors disabled:cursor-not-allowed ${picked ? "bg-primary text-white" : "bg-muted text-ink-faint"}`}>Apply</button>
    </Dialog>
  );
}

export function EditTrackDialog({ open, count, tracks, busy, error, onApply, onClose }: { open: boolean; count: number; tracks: string[]; busy: boolean; error: string; onApply: (track: string) => void; onClose: () => void }) {
  const [track, setTrack] = useState(tracks[0] ?? "");
  return (
    <Dialog open={open} onClose={onClose} title="Edit Track" size="sm">
      <p className="mb-4 text-sm text-ink-muted">Reassign the track for {count} selected submission{plural(count)}.</p>
      <select value={track} onChange={(e) => setTrack(e.target.value)} aria-label="Track" className="mb-6 w-full cursor-pointer rounded-lg border border-line px-3 py-2.5 text-sm text-ink outline-none">
        {tracks.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      {error && <p role="alert" className="mb-3 text-sm font-semibold text-danger">{error}</p>}
      <button type="button" disabled={!track || busy} onClick={() => onApply(track)} className="w-full rounded-lg bg-primary py-2.5 text-sm font-bold text-white hover:brightness-95 disabled:opacity-50">{busy ? "Saving…" : "Apply"}</button>
    </Dialog>
  );
}
