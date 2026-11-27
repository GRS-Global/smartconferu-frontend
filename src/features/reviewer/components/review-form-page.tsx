"use client";

import { Calendar, Check, ChevronLeft, ChevronRight, Clock, EyeOff, FileCheck, Info, KeyRound, Send, Star } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { FlowToast, type FlowToastData } from "@/components/ui/flow-toast";
import { Modal } from "@/components/ui/modal";
import { TriggeredEmailNote } from "@/components/ui/triggered-email-note";
import { daysToISO, shiftIsoDate, toDate } from "@/features/author/format";
import { EnhanceReviewDialog } from "@/features/chair/components/enhance-review-dialog";
import { PaperSplit } from "@/features/chair/components/paper-split";
import { InstructionsPreview, ReviewFormBody } from "@/features/chair/components/review-form-preview";
import { AbstractCard, PaperHeader } from "@/features/chair/components/review-paper-parts";
import { ConferenceShell } from "@/features/workspace/components/conference-shell";
import { workspaceGate } from "@/features/workspace/components/workspace-gate";
import { sendActionEmails } from "@/services/action-emails";
import { getAuthorSubmissionService } from "@/services/author-submissions";
import { AuthRequiredError } from "@/services/errors";
import { getReviewerService } from "@/services/reviewer";
import type { Conference } from "@/types/conference";
import type { ReviewDetail, ReviewFile, ReviewValues, ReviewerPaper } from "@/types/reviewer";
import { isFieldAnswered, type ReviewField } from "../form-schema";
import { useReviewDetail } from "../use-review-detail";
import { AssignmentDialogs, type Respond } from "./assignment-dialogs";

/* A paper's review page (the prototype's ReviewerReviewFormPage): the paper (a PDF reader with the paper's chat) beside the review form. The form is the
   peer-review rubric; the answers save as a draft in the database as the reviewer types (so they are there on any device) and are sent with
   "Submit review", which the reviewer can repeat to change a sent review until the chair decides. Reviews are double-blind, so no author is shown.
   A paper that has a decision sent to the authors is locked. */

const CARD = { border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" } as const;
const AUTOSAVE_MS = 600;
const relDay = (n: number | null) => (n == null ? "—" : n < 0 ? `${-n} day${n === -1 ? "" : "s"} ago` : n === 0 ? "today" : `in ${n} day${n === 1 ? "" : "s"}`);

/* ---------------- fields ---------------- */

function ScoreField({ field, value, onChange, disabled }: { field: ReviewField; value: ReviewValues[string]; onChange: (v: number) => void; disabled: boolean }) {
  const max = field.max ?? 5;
  const n = Number(value) || 0;
  return (
    <div role="radiogroup" aria-label={field.label} className="flex items-center gap-1">
      {Array.from({ length: max }, (_, i) => i + 1).map((i) => (
        <button key={i} type="button" role="radio" aria-checked={n === i} aria-label={`${i} of ${max}`} disabled={disabled} onClick={() => onChange(i)} className="rounded p-0.5 disabled:cursor-not-allowed">
          <Star size={22} aria-hidden="true" strokeWidth={1.8} style={{ color: i <= n ? "#F59E0B" : "var(--border-strong)", fill: i <= n ? "#F59E0B" : "transparent" }} />
        </button>
      ))}
      <span className="ml-2 text-xs font-bold text-ink-muted">{n ? `${n} / ${max}` : "Not rated"}</span>
    </div>
  );
}

export function FieldRow({ field, value, onChange, disabled }: { field: ReviewField; value: ReviewValues[string]; onChange: (v: string | number) => void; disabled: boolean }) {
  const id = `review-${field.id}`;
  return (
    <div className="py-4">
      <label htmlFor={field.type === "long_text" ? id : undefined} className="block text-[13.5px] font-bold text-navy">{field.label}{field.required && <span className="text-danger-ink" aria-hidden="true"> *</span>}</label>
      {field.description && <p className="mt-0.5 text-xs text-ink-muted">{field.description}</p>}
      <div className="mt-2.5">
        {field.type === "long_text" && <textarea id={id} value={typeof value === "string" ? value : ""} rows={6} maxLength={20000} disabled={disabled} onChange={(e) => onChange(e.target.value)} className="w-full resize-y rounded-xl border-[1.5px] border-line bg-white px-3.5 py-2.5 text-sm leading-relaxed text-ink outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary-soft disabled:bg-canvas disabled:text-ink-muted" />}
        {field.type === "score" && <ScoreField field={field} value={value} onChange={onChange} disabled={disabled} />}
        {field.type === "single_choice" && (
          <div role="radiogroup" aria-label={field.label} className="flex flex-wrap gap-2">
            {(field.options ?? []).map((o) => {
              const on = value === o;
              return <button key={o} type="button" role="radio" aria-checked={on} disabled={disabled} onClick={() => onChange(o)} style={{ border: `1.5px solid ${on ? "var(--primary)" : "var(--border)"}`, background: on ? "var(--primary-soft)" : "#FFFFFF", color: on ? "var(--primary)" : "var(--ink)" }} className="rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60">{o}</button>;
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- small pieces ---------------- */

/** "Oct 15, 2026" (the prototype's formatDisplayDate). */
const dayText = (iso: string) => toDate(iso).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
/** "a moment ago", "5 min ago", "2 hours ago" (the prototype's draftAge). */
const draftAge = (ts: number) => {
  const mins = Math.round((Date.now() - ts) / 60000);
  if (!ts || mins < 1) return "a moment ago";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? "s" : ""} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
};

/** "Ask for more time" (the prototype's RequestExtensionModal). Sending asks the chair (migration 0043); a failure stays in the dialog so nothing is lost. */
function ExtensionModal({ due, onClose, onSend }: { due: string; onClose: () => void; onSend: (date: string, reason: string) => Promise<void> }) {
  const minISO = shiftIsoDate(due || new Date().toISOString().slice(0, 10), 1);
  const [date, setDate] = useState(() => (due ? shiftIsoDate(due, 7) : minISO));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const bad = !date || date < minISO || busy;
  const send = async () => {
    setBusy(true); setError("");
    try { await onSend(date, reason.trim()); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't send your request."); setBusy(false); }
  };
  return (
    <Modal title="Ask for more time" subtitle={due ? `Currently due ${dayText(due)}` : "Ask the chair to move your review deadline"} icon={Clock} onClose={onClose} maxWidth="max-w-md"
      actions={<>
        <button type="button" onClick={onClose} className="ml-auto h-10 cursor-pointer rounded-xl px-3 text-sm font-semibold text-ink-muted transition-colors hover:bg-canvas">Cancel</button>
        <button type="button" disabled={bad} onClick={() => { void send(); }} className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"><Send size={14} aria-hidden="true" /> {busy ? "Sending…" : "Send request"}</button>
      </>}
    >
      <label htmlFor="ext-date" className="mb-1.5 block text-[13px] font-semibold text-ink-soft">New deadline <span className="text-danger-ink">*</span></label>
      <div className="mb-2 flex gap-1.5">
        {[3, 7, 14].map((d) => {
          const v = shiftIsoDate(due || minISO, d);
          const on = date === v;
          return <button key={d} type="button" onClick={() => setDate(v)} aria-pressed={on} style={{ border: `1px solid ${on ? "var(--primary)" : "var(--border)"}`, background: on ? "var(--primary-soft)" : "#FFFFFF", color: on ? "var(--primary)" : "var(--ink-soft)" }} className="h-8 cursor-pointer rounded-full px-3 text-xs font-bold">+{d} days</button>;
        })}
      </div>
      <input id="ext-date" type="date" min={minISO} value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-xl border-[1.5px] border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary-soft" />
      <label htmlFor="ext-reason" className="mb-1.5 mt-4 block text-[13px] font-semibold text-ink-soft">Reason <span className="font-normal text-ink-faint">(optional)</span></label>
      <textarea id="ext-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Travelling for a week — I'll finish right after." className="w-full resize-y rounded-xl border-[1.5px] border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary-soft" />
      <p className="mt-3 text-[11px] text-ink-faint">The chair approves or declines; you&apos;ll get a notification either way.</p>
      {error && <p role="alert" className="mt-3 rounded-lg bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger-ink">{error}</p>}
    </Modal>
  );
}

/** A paper waiting for the reviewer's answer (the prototype's PendingAssignmentCard): accept it (with the conflict-of-interest confirmation) or decline. */
function PendingCard({ paper, onRespond }: { paper: ReviewerPaper; onRespond: (kind: "accept" | "decline") => void }) {
  return (
    <div style={{ border: "1.5px solid var(--primary-soft-border)" }} className="flex flex-wrap items-start gap-4 rounded-xl bg-white p-4">
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold text-ink-faint">{paper.id}</span>
          <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[10.5px] font-bold text-warning-ink">Waiting for your response</span>
          {paper.track && <span className="text-[11px] text-ink-faint">{paper.track}</span>}
        </div>
        <span className="block text-left text-sm font-semibold leading-snug text-ink">{paper.title}</span>
        <p className="mt-1 line-clamp-2 text-xs text-ink-muted">{paper.abstract}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-ink-faint">
          {paper.assignedOn && <span>Assigned {paper.assignedOn}</span>}
          {paper.due && <span className="inline-flex items-center gap-1"><Calendar size={11} aria-hidden="true" /> Review due {dayText(paper.due)}</span>}
          <span className="inline-flex items-center gap-1"><EyeOff size={11} aria-hidden="true" /> Authors hidden (double-blind)</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button type="button" onClick={() => onRespond("decline")} className="h-9 cursor-pointer rounded-lg border border-line bg-white px-3.5 text-xs font-bold text-ink-soft transition-colors hover:bg-canvas">Decline</button>
        <button type="button" onClick={() => onRespond("accept")} className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3.5 text-xs font-bold text-white transition-shadow hover:shadow-[0_0_24px_rgba(124,58,237,0.35)]"><Check size={13} aria-hidden="true" /> Accept</button>
      </div>
    </div>
  );
}

/* ---------------- the workspace: paper | form ---------------- */

function Workspace({ detail, conference, due, onChanged, onToast, onSessionEnded }: { detail: ReviewDetail; conference: Conference; due: string; onChanged: () => void; onToast: (t: FlowToastData) => void; onSessionEnded: () => void }) {
  const { paper } = detail;
  const conferenceId = conference.id;
  const awaitingResponse = paper.response === "pending";
  const submitted = detail.state === "submitted";
  const locked = Boolean(detail.decision); // a decided paper's review is locked (the database refuses a draft too, not only a sent review)
  const [values, setValues] = useState<ReviewValues>(detail.values);
  const router = useRouter();
  // What was loaded (or last sent): the form only autosaves when it differs from this.
  const [baseline, setBaseline] = useState(() => JSON.stringify(detail.values));
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saveError, setSaveError] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [fileError, setFileError] = useState("");
  const [respond, setRespond] = useState<Respond>(null);
  const [extOpen, setExtOpen] = useState(false);
  const [polish, setPolish] = useState(false);
  const [instructionsKey] = useState(() => Math.random());

  const file: ReviewFile | undefined = detail.files.at(-1);
  const loadUrl = useCallback(async (path: string) => (await getAuthorSubmissionService()).fileUrl(path), []);
  const change = (id: string, v: string | number) => setValues((cur) => ({ ...cur, [id]: v }));

  // Autosave: a draft is kept in the database on every change (skipped while nothing differs from what was loaded, and once a review is sent).
  useEffect(() => {
    if (awaitingResponse || submitted || locked) return undefined;
    if (JSON.stringify(values) === baseline || !Object.keys(values).length) return undefined;
    const t = setTimeout(async () => {
      try {
        await (await getReviewerService()).saveReview(paper.assignmentId, paper.dbId, values, false);
        setSavedAt(Date.now()); setSaveError("");
      } catch (e) {
        if (e instanceof AuthRequiredError) onSessionEnded(); else setSaveError(e instanceof Error ? e.message : "Couldn't save your draft.");
      }
    }, AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [values, baseline, awaitingResponse, submitted, locked, paper.assignmentId, paper.dbId, onSessionEnded]);

  const fields = detail.form.flatMap((s) => s.fields);
  const required = fields.filter((f) => f.required);
  const answered = required.filter((f) => isFieldAnswered(values[f.id])).length;
  const complete = answered === required.length;
  const pct = required.length ? Math.round((answered / required.length) * 100) : 100;
  const dueDays = due ? daysToISO(due) : null;
  const recommendation = typeof values["f-decision"] === "string" ? values["f-decision"] : "";
  const confidence = typeof values["f-confidence"] === "string" ? values["f-confidence"] : "";
  const overview = `/reviewer/${encodeURIComponent(conferenceId)}/overview`;

  const send = async () => {
    if (sending || !complete) return;
    setSending(true); setSendError("");
    try {
      const { firstSubmit } = await (await getReviewerService()).saveReview(paper.assignmentId, paper.dbId, values, true);
      // The first time a review is sent the chair is told (the server rings their bell).
      const notice = firstSubmit ? await sendActionEmails("review_submitted", { submissionId: paper.dbId }) : null;
      onToast({ title: submitted ? "Review updated" : "Review submitted", text: notice ?? `${paper.id} · the chair can see it with the paper's other reviews.` });
      setBaseline(JSON.stringify(values));
      setSavedAt(null);
      onChanged();
    } catch (e) {
      if (e instanceof AuthRequiredError) onSessionEnded(); else setSendError(e instanceof Error ? e.message : "Couldn't send your review.");
    } finally { setSending(false); }
  };

  const openFile = async (download: boolean) => {
    if (!file?.storagePath) { setFileError("The paper's file isn't available."); return; }
    setFileError("");
    const tab = download ? null : window.open("", "_blank");
    try {
      const url = await (await getAuthorSubmissionService()).fileUrl(file.storagePath, download ? file.name : undefined);
      if (download) { const a = document.createElement("a"); a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove(); } else if (tab) tab.location.href = url;
    } catch (e) { tab?.close(); setFileError(e instanceof Error ? e.message : "Couldn't open this file."); }
  };

  const jumpTo = (id: string) => document.getElementById(`rfp-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const sections = detail.form.filter((s) => s.fields.length > 0);
  // Double-blind: the banner (and the paper it opens) carries no author identity.
  const bannerPaper = { id: paper.id, title: paper.title, track: paper.track, presentationType: paper.presentationType, authors: [] };

  return (
    <>
      <PaperSplit title={paper.id} blind file={file ? { name: file.name, storagePath: file.storagePath } : null} loadUrl={loadUrl} chat={awaitingResponse ? null : { id: paper.id, dbId: paper.dbId, title: paper.title, abstract: paper.abstract, keywords: paper.keywords, track: paper.track }}>
        {(open) => (
          <div>
            <PaperHeader paper={bannerPaper} acronym={conference.acronym} keywords={paper.keywords} compact={open} file={file ? { name: file.name } : null} onFile={(download) => { void openFile(download); }} />
            {fileError && <div role="alert" className="mb-4 rounded-lg bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger-ink">{fileError}</div>}

            {/* One slim strip: the review's due date (and "ask for more time") and how far the form is. */}
            <div style={CARD} className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl bg-white px-4 py-3">
              {!awaitingResponse && due && (
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <Calendar size={14} aria-hidden="true" className="shrink-0 text-primary" />
                  <span className="text-xs font-bold text-ink-muted">Review due</span>
                  <span className="text-sm font-semibold text-ink">{dayText(due)}</span>
                  <span style={{ color: submitted ? "var(--success-ink)" : dueDays != null && dueDays < 0 ? "var(--danger-ink)" : dueDays != null && dueDays <= 3 ? "var(--warning-ink)" : "var(--ink-muted)" }} className="text-xs font-bold">{submitted ? "Submitted" : dueDays != null && dueDays < 0 ? `Overdue · ${relDay(dueDays)}` : relDay(dueDays)}</span>
                  {paper.extension?.status === "pending" && <span className="rounded-md bg-warning-soft px-2 py-0.5 text-[11px] font-medium text-warning-ink">Asked for more time until {dayText(paper.extension.date)} — waiting for the chair</span>}
                  {paper.extension?.status === "declined" && <span className="rounded-md bg-canvas px-2 py-0.5 text-[11px] font-medium text-ink-muted">More time declined — deadline unchanged</span>}
                  {!submitted && !detail.decision && paper.extension?.status !== "pending" && <button type="button" onClick={() => setExtOpen(true)} className="inline-flex cursor-pointer items-center gap-1 text-xs font-bold text-primary hover:underline"><Clock size={12} aria-hidden="true" /> Ask for more time</button>}
                </div>
              )}
              <div className="flex min-w-[280px] flex-1 flex-wrap items-center gap-x-3 gap-y-2">
                <span className="text-xs font-bold text-navy">Your review</span>
                <span className="h-2 w-24 overflow-hidden rounded-full bg-muted"><span style={{ background: complete ? "var(--success)" : "var(--primary)", width: `${pct}%` }} className="block h-full rounded-full transition-all" /></span>
                <span style={{ color: complete ? "var(--success-ink)" : "var(--ink-muted)" }} className="text-xs font-bold">{pct}%</span>
                {sections.map((s) => {
                  const req = s.fields.filter((f) => f.required);
                  const done = req.filter((f) => isFieldAnswered(values[f.id])).length;
                  return (
                    <button key={s.id} type="button" onClick={() => jumpTo(s.id)} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line px-2 py-1 text-left transition-colors hover:bg-canvas">
                      {req.length > 0 && done === req.length ? <Check size={13} aria-hidden="true" className="shrink-0 text-success-ink" /> : <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full border-[1.5px] border-line-strong" />}
                      <span className="truncate text-xs font-medium text-ink-soft">{s.name}</span>
                      {req.length > 0 && <span className="shrink-0 text-[11px] font-semibold text-ink-faint">{done}/{req.length}</span>}
                    </button>
                  );
                })}
                {recommendation && <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-bold text-primary">Recommends: {recommendation}</span>}
                {confidence && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-ink-muted">{confidence} confidence</span>}
              </div>
            </div>

            {paper.abstract && <AbstractCard text={paper.abstract} compact={open} />}
            <InstructionsPreview key={`${instructionsKey}-${submitted || awaitingResponse ? "collapsed" : "open"}${open ? "-beside" : ""}`} text={detail.instructions} mode={detail.instructionsMode} pdf={detail.instructionsPdf} defaultOpen={!submitted && !awaitingResponse && !open} className="mb-5" />

            {awaitingResponse ? (
              <>
                <div style={{ background: "var(--primary-soft)", border: "1px solid var(--primary-soft-border)" }} className="mb-3 flex items-start gap-2 rounded-xl p-3.5">
                  <Info size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-primary" />
                  <span className="text-xs leading-relaxed text-navy"><b>Accept this paper to start your review.</b> Read the title and abstract above, then confirm you have no conflict of interest — or decline so the chair can reassign it.</span>
                </div>
                <PendingCard paper={paper} onRespond={(kind) => setRespond({ paper, kind })} />
              </>
            ) : (
              <>
                {submitted && !locked && (
                  <div className="mb-5 flex items-start gap-2 rounded-xl border border-success bg-success-soft p-3.5">
                    <Check size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-success-ink" />
                    <span className="text-xs font-semibold leading-relaxed text-success-ink">Your review has been submitted — the chair can see it with the paper&apos;s other reviews. You can still update it until the paper is decided.</span>
                  </div>
                )}
                {detail.decision && (
                  <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-white p-3.5">
                    <span className="text-xs font-semibold text-ink-muted">Final decision</span>
                    <span style={{ background: detail.decision.color || "var(--ink-muted)" }} className="rounded-full px-2.5 py-1 text-[11px] font-bold text-white">{detail.decision.label}</span>
                    <span className="text-[11px] text-ink-faint">Thanks for reviewing — the chair has decided this paper.</span>
                    {locked && (
                      <span className="mt-1.5 flex w-full flex-col gap-1 border-t border-muted pt-2">
                        <span className="flex items-center gap-1.5 text-[11px] text-ink-soft"><KeyRound size={11} aria-hidden="true" /> Your review is locked now that the paper is decided. Contact the chair if something needs correcting.</span>
                      </span>
                    )}
                  </div>
                )}

                <div className="mb-4 flex items-start gap-1.5 text-ink-faint">
                  <KeyRound size={12} aria-hidden="true" className="mt-0.5 shrink-0" />
                  <span className="min-w-0 text-[11px] font-medium">Fields marked <span className="font-bold">confidential</span> are shown only to the chair. Your comments to the authors may be shared with them — anonymously — when the chair sends the decision.</span>
                </div>

                {/* Locked: every field (and button) inside is disabled. */}
                <fieldset disabled={locked} className={`min-w-0 border-0 p-0 ${locked ? "opacity-80" : ""}`}>
                  <div className="space-y-5"><ReviewFormBody form={detail.form} values={values} onChange={change} disabled={locked} onPolish={() => setPolish(true)} /></div>
                </fieldset>
                <EnhanceReviewDialog open={polish} input={{ review: String(values["f-summary"] ?? ""), title: paper.title, abstract: paper.abstract, ratings: fields.filter((f) => f.type === "score" && Number(values[f.id]) > 0).map((f) => ({ label: f.label, value: Number(values[f.id]) })), submissionId: paper.dbId || undefined }} onApply={(t) => { change("f-summary", t); setPolish(false); }} onClose={() => setPolish(false)} />

                {sendError && <p role="alert" className="mt-3 rounded-lg bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger-ink">{sendError}</p>}
                {/* Sticky submit bar — floats above the form while scrolling. */}
                {!locked && (
                  <>
                    <div style={{ border: "1px solid var(--border)", boxShadow: "0 4px 16px rgba(15,23,42,0.08)" }} className="sticky bottom-4 mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-white px-4 py-3">
                      <span className="flex flex-col">
                        <span style={{ color: complete ? "var(--success-ink)" : "var(--ink-muted)" }} className="text-xs font-semibold">{complete ? "All required fields answered" : `${answered} of ${required.length} required fields answered`}</span>
                        {saveError ? <span role="alert" className="mt-0.5 text-[11px] font-semibold text-danger-ink">{saveError}</span> : savedAt && <span className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-faint"><Check size={11} aria-hidden="true" /> Draft saved {draftAge(savedAt)}</span>}
                      </span>
                      <div className="flex items-center gap-3">
                        <Link href={overview} className="cursor-pointer text-sm font-semibold text-ink-muted transition-colors hover:text-navy">{savedAt ? "Save & close" : "Cancel"}</Link>
                        <button type="button" onClick={() => { void send(); }} disabled={!complete || sending} style={{ background: complete ? "var(--primary)" : "var(--muted)", color: complete ? "#FFFFFF" : "var(--ink-faint)" }} className="flex cursor-pointer items-center gap-1.5 rounded-lg px-5 py-2.5 text-sm font-bold transition-colors disabled:cursor-not-allowed"><FileCheck size={15} aria-hidden="true" /> {sending ? "Sending…" : submitted ? "Update review" : "Submit review"}</button>
                      </div>
                    </div>
                    <TriggeredEmailNote
                      conference={conference}
                      emails={[
                        { key: "reviewThanks", recipientName: "Reviewer", values: { paper_title: paper.title, review_copy: [values["f-score"] ? `Score ${values["f-score"]} / 5` : "", typeof values["f-to-author"] === "string" ? values["f-to-author"] : ""].filter(Boolean).join(" · ") || undefined } },
                        { key: "reviewSubmittedChair", to: "Conference Chair", also: [paper.track ? `Track Chair · ${paper.track}` : "Track Chair"], values: { paper_title: paper.title, score: values["f-score"] ? `${values["f-score"]} / 5` : undefined } },
                      ]}
                    />
                  </>
                )}
              </>
            )}
          </div>
        )}
      </PaperSplit>
      {extOpen && <ExtensionModal due={due} onClose={() => setExtOpen(false)} onSend={async (date, reason) => {
        try { await (await getReviewerService()).requestExtension(paper.assignmentId, date, reason); } catch (e) { if (e instanceof AuthRequiredError) { onSessionEnded(); return; } throw e; }
        setExtOpen(false);
        onToast({ title: "Request sent", text: `The chair has been asked to move your deadline to ${dayText(date)}.` });
        onChanged();
      }} />}
      <AssignmentDialogs respond={respond} onClose={() => setRespond(null)} onDone={(_p, result) => { if (result === "declined") router.push(`/reviewer/${encodeURIComponent(conferenceId)}`); else { onToast({ title: "Paper accepted", text: "You can start your review now — it saves as a draft as you go." }); onChanged(); } }} onSessionEnded={onSessionEnded} />
    </>
  );
}

export function ReviewFormPage({ slug, label }: { slug: string; label: string }) {
  const { state, retry, reload } = useReviewDetail(slug, label);
  // The toast belongs to the page, not to the form: reading the review again after a save rebuilds the form.
  const [toast, setToast] = useState<FlowToastData | null>(null);
  const closeToast = useCallback(() => setToast(null), []);
  const gate = workspaceGate(state, retry, { title: `Review — ${label}`, loadingLabel: "Loading this review", missingTitle: "We couldn't find that paper.", missingText: "It isn't assigned to you in this conference. Open one from your dashboard.", errorTitle: "Couldn't load this review." });
  if (gate || state.status !== "ready") return gate;
  const { conference, roles, others, detail, queue } = state;
  const i = queue.findIndex((p: ReviewerPaper) => p.id === detail.paper.id);
  const prev = i > 0 ? queue[i - 1] : null;
  const next = i >= 0 && i < queue.length - 1 ? queue[i + 1] : null;
  const nav = "inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-line bg-white px-2.5 text-xs font-semibold text-ink-soft transition-colors hover:bg-canvas";
  const off = "inline-flex h-8 cursor-not-allowed items-center gap-1 rounded-lg border border-line bg-white px-2.5 text-xs font-semibold text-ink-soft opacity-40";
  return (
    <ConferenceShell role="reviewer" conference={conference} roles={roles} others={others} active="overview" foldMenu>
      <PageHeader
        title={`Review — ${detail.paper.id}`}
        breadcrumbs={[{ label: "My Conferences", href: "/dashboard" }, { label: "Dashboard", href: `/reviewer/${encodeURIComponent(conference.id)}/overview` }, { label: detail.paper.id }]}
        actions={queue.length >= 2 && i >= 0 ? (
          <div className="flex items-center gap-1.5" aria-label="Paper navigation">
            {prev ? <Link href={`/reviewer/${encodeURIComponent(conference.id)}/review/${encodeURIComponent(prev.id)}`} title={`Previous: ${prev.id}`} className={nav}><ChevronLeft size={14} aria-hidden="true" /> Previous</Link> : <span aria-disabled="true" title="This is the first paper" className={off}><ChevronLeft size={14} aria-hidden="true" /> Previous</span>}
            <span className="px-1 text-xs font-semibold tabular-nums text-ink-muted">{i + 1} of {queue.length}</span>
            {next ? <Link href={`/reviewer/${encodeURIComponent(conference.id)}/review/${encodeURIComponent(next.id)}`} title={`Next: ${next.id}`} className={nav}>Next <ChevronRight size={14} aria-hidden="true" /></Link> : <span aria-disabled="true" title="This is the last paper" className={off}>Next <ChevronRight size={14} aria-hidden="true" /></span>}
          </div>
        ) : undefined}
      />
      <div className="p-6 lg:p-8">
        <Workspace key={`${detail.paper.assignmentId}-${detail.state}-${detail.paper.response}`} detail={detail} conference={conference} due={detail.paper.due} onChanged={reload} onToast={setToast} onSessionEnded={retry} />
      </div>
      <FlowToast toast={toast} onClose={closeToast} />
    </ConferenceShell>
  );
}
