"use client";

import { AlertTriangle, Check, ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { INPUT_CLASS } from "@/components/ui/field";
import { DEFAULT_LANGUAGE, LANGUAGES } from "@/features/chair/languages";
import { getChairService } from "@/services/chair";
import { setupChanged, type ConferenceSetup, type SetupStatus, type SetupTask } from "./use-setup";
import { readTourState, writeTourState } from "./tour-state";

/* "Set up <conference>" (the prototype's SetupGuideModal + SetupTaskList): the required details before the Call for Papers can be published, each one answered
   right here when it is a single value (a date, the language, the description, the website) or opened on its own page when it needs more (research area and
   topics, tracks); then what is done, and the optional recommended settings. Whether a required item is done comes from what is saved. */

const STATUS: Record<SetupStatus, { label: string; bg: string; color: string }> = {
  not_started: { label: "Not started", bg: "var(--muted)", color: "var(--ink-muted)" },
  in_progress: { label: "In progress", bg: "var(--primary-soft)", color: "var(--primary)" },
  attention: { label: "Needs attention", bg: "var(--warning-soft)", color: "var(--warning)" },
  completed: { label: "Completed", bg: "var(--success-soft)", color: "var(--success)" },
};
const REC_STATUS = { not_started: STATUS.not_started, skipped: { label: "Skipped", bg: "var(--muted)", color: "var(--ink-muted)" }, reviewed: { label: "Reviewed", bg: "var(--primary-soft)", color: "var(--primary)" }, completed: STATUS.completed } as const;

interface RecItem { key: string; label: string; why: string; path: string; done: boolean }
const recommended = (setup: ConferenceSetup): RecItem[] => [
  { key: "submissionRules", label: "Review presentation types and guidelines", why: "What authors can submit, and the rules they read first.", path: "settings/submissions", done: false },
  { key: "screening", label: "Choose your paper screening steps", why: "Decide whether papers get an initial check and a plagiarism check before review.", path: "settings/submissions", done: false },
  { key: "reviewDeadline", label: "Set the review deadline", why: "The day reviewers' reviews are due.", path: "settings/review", done: Boolean(setup.info?.reviewDeadline) },
  { key: "reviewers", label: "Invite reviewers", why: "Build your reviewer pool before papers arrive.", path: "peer-review/reviewers", done: false },
  { key: "decisions", label: "Review decision types", why: "The outcomes you can give a paper, and what authors are told.", path: "settings/decision", done: false },
  { key: "emails", label: "Review email templates", why: "The emails authors and reviewers get from this conference.", path: "settings/email-templates", done: false },
  { key: "summary", label: "Add a short summary", why: "One line that describes the conference.", path: "settings", done: Boolean(setup.info?.summary?.trim()) },
];

function Check22({ done }: { done: boolean }) {
  return <span style={done ? { background: "var(--success)", borderColor: "var(--success)", color: "#FFFFFF" } : { borderColor: "var(--border-strong)" }} className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2">{done && <Check size={12} strokeWidth={3} aria-hidden="true" />}</span>;
}

function TaskList({ slug, setup, tasks, go, onShow, onDirty, openKey }: { slug: string; setup: ConferenceSetup & { reload: () => void }; tasks: SetupTask[]; go: (path: string) => void; onShow: (t: SetupTask) => void; onDirty: (d: boolean) => void; openKey: string | null }) {
  const [open, setOpen] = useState<string | null>(openKey);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const value = (t: SetupTask) => (t.key === "abstractDeadline" ? setup.info?.abstractDeadline : t.key === "submissionDeadline" ? setup.info?.submissionDeadline : t.key === "language" ? (setup.info?.language || DEFAULT_LANGUAGE) : t.key === "about" ? setup.info?.about : t.key === "webPage" ? setup.info?.webPage : "") ?? "";
  // "Complete required setup" asks the list to open the first editable task.
  useEffect(() => {
    const onOpen = (e: Event) => { const t = tasks.find((k) => k.key === (e as CustomEvent<string>).detail); if (t) { setOpen(t.key); setDraft(value(t)); setError(""); } };
    window.addEventListener("setup-open-task", onOpen);
    return () => window.removeEventListener("setup-open-task", onOpen);
  });
  const toggle = (t: SetupTask) => {
    if (!t.input || t.input === "topics") { go(t.at); return; }
    if (open === t.key) { setOpen(null); return; }
    setOpen(t.key); setDraft(value(t)); setError(""); onDirty(false);
  };
  const save = async (t: SetupTask) => {
    const info = setup.info;
    if (!info) return;
    const v = draft.trim();
    if (t.key === "abstractDeadline" && v && info.submissionDeadline && v > info.submissionDeadline) { setError("The abstract deadline must be on or before the submission deadline."); return; }
    if (t.key === "submissionDeadline" && v && info.abstractDeadline && info.abstractDeadline > v) { setError("The submission deadline must be on or after the abstract deadline."); return; }
    if (t.key === "webPage" && !/^https?:\/\/\S+\.\S+/i.test(v)) { setError("Enter a valid website address."); return; }
    setBusy(true); setError("");
    try { await (await getChairService()).saveInfo(slug, { ...info, [t.key]: v }); setOpen(null); onDirty(false); setupChanged(); setup.reload(); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't save."); } finally { setBusy(false); }
  };
  const where = (t: SetupTask) => (t.at === "settings" ? "Conference Details" : "Submission Settings");
  const cta = (t: SetupTask) => (t.done ? "Edit" : t.status === "in_progress" ? "Continue setup" : "Complete setup");
  return (
    <div className="mt-1">
      {tasks.map((t, i) => (
        <div key={t.key} style={{ borderTop: i === 0 ? "none" : "1px solid var(--muted)" }}>
          <div className="flex items-center gap-3 py-3">
            <Check22 done={t.done} />
            <div className="min-w-0 flex-1" data-setup-task={t.key}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-navy">{t.label}</span>
                {(t.status === "in_progress" || t.status === "attention") && <span style={{ background: STATUS[t.status].bg, color: STATUS[t.status].color }} className="whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-bold">{STATUS[t.status].label}</span>}
              </div>
              <div className="text-xs text-ink-muted">{t.why}</div>
              {t.issue && <div className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-warning"><AlertTriangle size={11} aria-hidden="true" /> {t.issue}</div>}
              {open !== t.key && <button type="button" onClick={() => onShow(t)} className="mt-0.5 cursor-pointer text-xs font-semibold text-primary hover:underline">Show me in {where(t)}</button>}
            </div>
            <button type="button" onClick={() => toggle(t)} title={t.input && t.input !== "topics" ? "Opens an editor right here" : `Opens ${where(t)}`} style={open === t.key ? { border: "1px solid var(--border)", color: "var(--navy)" } : t.done ? { color: "var(--ink-muted)" } : { background: "var(--primary)", color: "#FFFFFF" }} className={`${t.done && open !== t.key ? "px-1 text-xs font-semibold hover:underline" : "h-8 rounded-lg px-3.5 text-xs font-bold"} cursor-pointer whitespace-nowrap`}>{open === t.key ? "Close" : cta(t)}</button>
          </div>
          {open === t.key && (
            <div className="space-y-2.5 pb-4 pl-[34px]">
              {t.input === "date" && <input type="date" aria-label={t.label} value={draft} onChange={(e) => { setDraft(e.target.value); setError(""); onDirty(true); }} className={INPUT_CLASS} />}
              {t.input === "language" && <select aria-label={t.label} value={draft} onChange={(e) => { setDraft(e.target.value); setError(""); onDirty(true); }} className={INPUT_CLASS}><option value="">Select a language</option>{LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}</select>}
              {t.input === "text" && <textarea rows={5} aria-label={t.label} value={draft} onChange={(e) => { setDraft(e.target.value); setError(""); onDirty(true); }} placeholder="Scope, audience, what makes it worth submitting to." className={`${INPUT_CLASS} resize-y`} />}
              {t.input === "url" && <input type="url" aria-label={t.label} value={draft} onChange={(e) => { setDraft(e.target.value); setError(""); onDirty(true); }} placeholder="https://" className={INPUT_CLASS} />}
              {error && <p role="alert" className="flex items-center gap-1 text-xs font-medium text-danger"><AlertTriangle size={12} aria-hidden="true" /> {error}</p>}
              <button type="button" onClick={() => void save(t)} disabled={busy || !draft.trim()} className="h-8 cursor-pointer rounded-lg bg-primary px-4 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-45">{busy ? "Saving…" : "Save"}</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function SetupGuideModal({ slug, acronym, setup, go, onClose, onStartTour, onShow, openKey = null }: { slug: string; acronym: string; setup: ConferenceSetup & { reload: () => void }; go: (path: string) => void; onClose: () => void; onStartTour: () => void; onShow: (t: SetupTask) => void; openKey?: string | null }) {
  const [dirty, setDirty] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [showRec, setShowRec] = useState(false);
  const [, bump] = useState(0);
  const tour = readTourState(slug);
  const requiredDone = setup.left === 0;
  const recs = recommended(setup).map((it) => ({ ...it, status: it.done ? "completed" as const : tour.skipped[it.key] ? "skipped" as const : tour.reviewed[it.key] ? "reviewed" as const : "not_started" as const }));
  const recDone = recs.filter((r) => r.status === "completed" || r.status === "reviewed").length;
  const todo = setup.tasks.filter((t) => !t.done || t.status === "attention");
  const finished = setup.tasks.filter((t) => t.done && t.status !== "attention");
  const leave = () => { writeTourState(slug, { welcomed: true, finishLater: !requiredDone }); onClose(); };
  const requestClose = () => (dirty ? setConfirming(true) : leave());
  const configure = (key: string, path: string) => { writeTourState(slug, { welcomed: true, reviewed: { [key]: true } }); onClose(); go(path); };
  const ghost = "h-10 cursor-pointer whitespace-nowrap rounded-xl border border-line px-4 text-sm font-bold text-ink-soft hover:bg-canvas";
  const list = (tasks: SetupTask[]) => <TaskList slug={slug} setup={setup} tasks={tasks} go={(p) => { onClose(); go(p); }} onShow={(t) => { onClose(); onShow(t); }} onDirty={setDirty} openKey={openKey} />;
  const pct = Math.round((setup.done / setup.total) * 100);
  return (
    <Dialog open onClose={requestClose} title={`Set up ${acronym}`} description="Complete the required details before publishing your Call for Papers." icon={Sparkles} size="lg">
      <div>
        <div className="flex items-center justify-between text-sm font-bold"><span className="text-navy">Required setup</span><span style={{ color: requiredDone ? "var(--success)" : "var(--ink-muted)" }} className="tabular-nums">{setup.done} of {setup.total} completed</span></div>
        <span className="mt-2 block h-2 overflow-hidden rounded-full bg-muted"><span style={{ background: requiredDone ? "var(--success)" : "var(--primary)", width: `${pct}%` }} className="block h-full rounded-full transition-all" /></span>
      </div>
      {requiredDone && <div className="mt-4 rounded-xl bg-success-soft px-4 py-3 text-[13px] font-semibold text-success">Required setup is complete — your menu is unlocked. You can publish your Call for Papers when you&apos;re ready; it won&apos;t be published automatically.</div>}
      {todo.length > 0 && (
        <>
          <h4 className="mt-5 text-[13px] font-bold text-navy">{requiredDone ? "Worth a look" : "Still to do"} <span className="font-semibold text-ink-faint">— {requiredDone ? `${todo.length} needs attention` : `${todo.length} required`}</span></h4>
          {list(todo)}
        </>
      )}
      {finished.length > 0 && (
        <details className="mt-3 border-t border-dashed border-line pt-3">
          <summary className="cursor-pointer text-[13px] font-bold text-ink-soft">Completed · {finished.length}</summary>
          {list(finished)}
        </details>
      )}
      <div className="mt-4 border-t border-dashed border-line pt-3">
        <button type="button" onClick={() => setShowRec((v) => !v)} aria-expanded={showRec} className="flex w-full cursor-pointer items-center gap-2 text-left">
          {showRec ? <ChevronDown size={15} aria-hidden="true" className="text-ink-muted" /> : <ChevronRight size={15} aria-hidden="true" className="text-ink-muted" />}
          <span className="text-[13px] font-bold text-navy">Recommended settings <span className="font-semibold text-ink-faint">— optional</span></span>
          <span className="ml-auto text-xs tabular-nums text-ink-faint">{recDone} of {recs.length}</span>
        </button>
        {showRec && (
          <div className="mt-1">
            <p className="mt-1 text-xs text-ink-muted">Nice to set up before submissions open. None of these block publishing.</p>
            {recs.map((it, i) => {
              const st = REC_STATUS[it.status];
              const settled = it.status === "completed" || it.status === "reviewed";
              return (
                <div key={it.key} style={{ borderTop: i === 0 ? "none" : "1px solid var(--muted)" }} className="flex items-center gap-3 py-3">
                  <Check22 done={settled} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-bold text-navy">{it.label}</span>{it.status !== "not_started" && <span style={{ background: st.bg, color: st.color }} className="whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-bold">{st.label}</span>}</div>
                    <div className="text-xs text-ink-muted">{it.why}</div>
                  </div>
                  {it.status === "skipped" && <button type="button" onClick={() => { writeTourState(slug, { skipped: { [it.key]: false } }); bump((n) => n + 1); }} className="cursor-pointer whitespace-nowrap text-xs font-semibold text-ink-muted hover:underline">Undo</button>}
                  {it.status === "not_started" && <button type="button" onClick={() => { writeTourState(slug, { skipped: { [it.key]: true } }); bump((n) => n + 1); }} className="cursor-pointer whitespace-nowrap text-xs font-semibold text-ink-muted hover:underline">Skip for now</button>}
                  {it.status !== "completed" && <button type="button" onClick={() => configure(it.key, it.path)} className="h-8 cursor-pointer whitespace-nowrap rounded-lg border border-line px-3 text-xs font-bold text-navy hover:bg-canvas">Configure</button>}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4">
        {confirming ? (
          <>
            <span className="flex-1 text-xs text-ink-soft">You have an answer you haven&apos;t saved. Close without saving it?</span>
            <button type="button" onClick={() => setConfirming(false)} className={ghost}>Keep editing</button>
            <button type="button" onClick={() => { setConfirming(false); setDirty(false); leave(); }} className="h-10 cursor-pointer whitespace-nowrap rounded-xl bg-danger px-4 text-sm font-bold text-white">Discard and close</button>
          </>
        ) : (
          <>
            <button type="button" onClick={requestClose} className="mr-auto cursor-pointer whitespace-nowrap text-sm font-semibold text-ink-muted hover:underline">{requiredDone ? "Close" : "Finish later"}</button>
            <button type="button" onClick={onStartTour} className={ghost}>{tour.tourStep > 0 && !tour.tourDone ? "Resume guided tour" : "Take guided tour"}</button>
            {!requiredDone && <button type="button" onClick={() => { const t = todo.find((x) => x.input && x.input !== "topics") ?? todo[0]; if (t) window.dispatchEvent(new CustomEvent("setup-open-task", { detail: t.key })); }} className="h-10 cursor-pointer whitespace-nowrap rounded-xl bg-primary px-5 text-sm font-bold text-white hover:shadow-[0_0_24px_rgba(124,58,237,0.35)]">Complete required setup</button>}
          </>
        )}
      </div>
    </Dialog>
  );
}
