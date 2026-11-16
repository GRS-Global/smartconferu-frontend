"use client";

import { AlertTriangle, Check, Loader2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { enhanceReview, type ReviewEnhancement } from "@/services/paper-ai";

/* "Polish with Smart Assist" on the review text (the prototype's EnhanceReviewDialog): asks the AI (the `enhance-review` endpoint, through this app's /api/ai
   proxy) for better-worded versions of the reviewer's own draft and shows them beside the original. Nothing changes until one is picked and "Use this version"
   is pressed — it can be edited first, or the original kept. The AI never changes the judgment and never writes the review. */

type State = { status: "loading" } | { status: "error"; message: string } | ({ status: "done" } & ReviewEnhancement);
export interface EnhanceInput { review: string; title: string; abstract: string; ratings: Array<{ label: string; value: number }>; submissionId?: string }

export function EnhanceReviewDialog({ open, input, onApply, onClose }: { open: boolean; input: EnhanceInput; onApply: (text: string) => void; onClose: () => void }) {
  const [run, setRun] = useState(0); // bumped by "Try again"
  const [state, setState] = useState<State>({ status: "loading" });
  const [texts, setTexts] = useState<string[]>([]);
  const [pick, setPick] = useState(0);
  useEffect(() => {
    if (!open) return undefined;
    const ctrl = new AbortController();
    enhanceReview(input, ctrl.signal)
      .then((r) => { setTexts(r.versions.map((v) => v.text)); setPick(0); setState({ status: "done", ...r }); })
      .catch((e: unknown) => { if (!ctrl.signal.aborted) setState({ status: "error", message: e instanceof Error && e.message ? e.message : "Couldn't reach Smart Assist." }); });
    return () => ctrl.abort();
    // The draft and ratings are fixed while the dialog is open; only "Try again" re-runs it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, run]);
  const done = state.status === "done";
  const text = texts[pick] ?? "";
  const unchanged = done && text.trim() === input.review.trim();
  return (
    <Dialog open={open} onClose={onClose} title="Polish with Smart Assist" description="Your wording, polished — you decide what to keep" icon={Sparkles} size="xl">
      {state.status === "loading" && (
        <div role="status" aria-live="polite" className="flex flex-col items-center gap-3 py-10 text-center">
          <Loader2 size={40} aria-hidden="true" className="animate-spin text-primary" />
          <p className="text-sm font-bold text-navy">Improving your review…</p>
          <p className="max-w-sm text-xs text-ink-muted">Fixing grammar, clarity and tone while keeping your meaning and your judgment. This takes a few seconds.</p>
        </div>
      )}
      {state.status === "error" && <div role="alert" className="flex items-start gap-2 rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger"><AlertTriangle size={16} aria-hidden="true" className="mt-0.5 shrink-0" /><span>{state.message} Your review is untouched.</span></div>}
      {state.status === "done" && (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-muted">Your review</div>
              <div className="max-h-[360px] min-h-[180px] overflow-y-auto whitespace-pre-wrap rounded-xl border border-line bg-canvas px-3.5 py-3 text-sm leading-relaxed text-ink-soft">{input.review}</div>
            </div>
            <div>
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-primary"><Sparkles size={11} aria-hidden="true" /> Enhanced — you can edit it</div>
                {state.versions.length > 1 && (
                  <div role="tablist" aria-label="Versions" className="inline-flex rounded-lg border border-line bg-canvas p-0.5">
                    {state.versions.map((v, i) => <button key={v.style + i} type="button" role="tab" aria-selected={pick === i} onClick={() => setPick(i)} style={pick === i ? { boxShadow: "0 1px 2px rgba(15,23,42,0.08)" } : undefined} className={`cursor-pointer rounded-md px-2.5 py-1 text-[11px] font-bold ${pick === i ? "bg-white text-primary" : "text-ink-muted"}`}>{v.style}</button>)}
                  </div>
                )}
              </div>
              <textarea value={text} onChange={(e) => setTexts((all) => all.map((t, i) => (i === pick ? e.target.value : t)))} aria-label="Enhanced review" className="max-h-[360px] min-h-[180px] w-full resize-y rounded-xl border-[1.5px] border-[var(--primary-soft-border)] px-3.5 py-3 text-sm leading-relaxed text-ink outline-none focus:border-primary" />
            </div>
          </div>
          {state.improvements.length > 0 && (
            <div><div className="mb-1.5 text-xs font-bold text-navy">What was improved</div><ul className="space-y-1">{state.improvements.map((t, i) => <li key={i} className="flex items-start gap-2 text-[13px] text-ink-soft"><Check size={13} aria-hidden="true" className="mt-1 shrink-0 text-success" /> {t}</li>)}</ul></div>
          )}
          {state.suggestions.length > 0 && (
            <div className="rounded-xl border border-[var(--primary-soft-border)] bg-primary-soft px-4 py-3"><div className="mb-1 text-xs font-bold text-navy">You may want to say more about <span className="font-medium text-ink-muted">(not added to your review)</span></div><ul className="space-y-1">{state.suggestions.map((t, i) => <li key={i} className="flex items-start gap-2 text-[13px] text-ink-soft"><span aria-hidden="true">•</span> {t}</li>)}</ul></div>
          )}
        </div>
      )}
      <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4">
        <span className="mr-auto hidden text-xs text-ink-faint sm:block">Nothing changes until you press “Use this version”.</span>
        <button type="button" onClick={onClose} className="h-10 cursor-pointer rounded-xl px-3 text-sm font-semibold text-ink-muted hover:bg-canvas">Keep my original</button>
        {state.status === "error" && <button type="button" onClick={() => { setState({ status: "loading" }); setRun((n) => n + 1); }} className="h-10 cursor-pointer rounded-xl bg-primary px-5 text-sm font-semibold text-white">Try again</button>}
        {done && <button type="button" onClick={() => onApply(text.trim())} disabled={!text.trim() || unchanged} className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"><Check size={15} aria-hidden="true" /> Use this version</button>}
      </div>
    </Dialog>
  );
}
