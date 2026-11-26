"use client";

import { FileText, RefreshCw, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { loadPaperSummary, writePaperSummary, type PaperSummary } from "@/services/paper-ai";
import type { ChatPaper } from "./paper-chat";

/* "Summary" of the paper (own backend): what the AI wrote when the paper was given to a reviewer, read from the database. It names no author (the review may be
   blind) and only says what the paper itself states. When it has not been written yet, or the authors uploaded a newer version, the reviewer can have it written
   now. It opens as a popup over the page (Esc, the close button or a click outside closes it). */

const SECTIONS: Array<{ key: "claims" | "methods" | "datasets" | "limitations"; title: string }> = [
  { key: "claims", title: "Main claims" },
  { key: "methods", title: "Methods" },
  { key: "datasets", title: "Data" },
  { key: "limitations", title: "Limitations the authors state" },
];

type State = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: PaperSummary };

export function PaperSummaryPanel({ paper, onClose }: { paper: ChatPaper; onClose: () => void }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  useEffect(() => {
    const ctrl = new AbortController();
    loadPaperSummary(paper.dbId, ctrl.signal)
      .then((data) => setState({ status: "ready", data }))
      .catch((e: unknown) => { if (!ctrl.signal.aborted) setState({ status: "error", message: e instanceof Error ? e.message : "Couldn't load the summary." }); });
    return () => ctrl.abort();
  }, [paper.dbId]);
  const write = useCallback(async () => {
    setBusy(true); setProblem("");
    try { setState({ status: "ready", data: await writePaperSummary(paper.dbId) }); }
    catch (e) { setProblem(e instanceof Error ? e.message : "Couldn't write the summary."); }
    finally { setBusy(false); }
  }, [paper.dbId]);
  const data = state.status === "ready" ? state.data : null;
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape" && !e.defaultPrevented) { e.preventDefault(); onClose(); } };
    window.addEventListener("keydown", esc);
    const was = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", esc); document.body.style.overflow = was; };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(11,16,32,0.5)", backdropFilter: "blur(2px)" }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-label="Summary of this paper" style={{ boxShadow: "0 24px 64px rgba(11,16,32,0.35)" }} className="flex max-h-[86vh] w-full max-w-[760px] flex-col overflow-hidden rounded-2xl bg-white">
      <div style={{ background: "linear-gradient(135deg, var(--primary-soft), #FFFFFF 70%)" }} className="flex items-start gap-3 border-b border-line px-6 py-4">
        <span aria-hidden="true" style={{ background: "linear-gradient(135deg, var(--primary), var(--secondary))" }} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"><FileText size={18} /></span>
        <div className="min-w-0 flex-1"><h2 className="text-[15px] font-extrabold text-navy">Summary of this paper</h2><p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11.5px] text-ink-muted"><span className="shrink-0 rounded-md bg-white px-1.5 py-0.5 font-bold text-primary" style={{ border: "1px solid var(--primary-soft-border)" }}>{paper.id}</span><span className="truncate">{paper.title}</span></p></div>
        <button type="button" onClick={onClose} aria-label="Close" title="Close (Esc)" className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-ink-muted hover:bg-white"><X size={17} aria-hidden="true" /></button>
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
        {state.status === "loading" && <div role="status" className="text-xs text-ink-muted">Loading the summary…</div>}
        {state.status === "error" && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-xs font-semibold text-danger">{state.message}</p>}
        {data && data.status === "none" && (
          <div className="rounded-xl border border-line bg-canvas p-4">
            <p className="text-sm font-semibold text-navy">The summary isn&apos;t ready yet</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">It is written automatically when the paper is given to a reviewer. If it is missing, it can be written now (it takes a few seconds).</p>
            <button type="button" onClick={() => void write()} disabled={busy} className="mt-3 inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-4 text-xs font-bold text-white disabled:opacity-60"><Sparkles size={13} aria-hidden="true" /> {busy ? "Writing the summary…" : "Write the summary now"}</button>
          </div>
        )}
        {data && data.status === "ready" && (
          <>
            {!data.upToDate && (
              <div className="flex flex-wrap items-center gap-3 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">
                <span className="min-w-0 flex-1 font-semibold">The authors uploaded a newer version after this summary was written.</span>
                <button type="button" onClick={() => void write()} disabled={busy} className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-warning bg-white px-3 text-xs font-bold text-warning disabled:opacity-60"><RefreshCw size={12} aria-hidden="true" /> {busy ? "Updating…" : "Update the summary"}</button>
              </div>
            )}
            <p style={{ borderLeft: "3px solid var(--primary)" }} className="whitespace-pre-wrap rounded-r-xl bg-canvas py-3 pl-4 pr-4 text-[14px] leading-relaxed text-ink">{data.summary}</p>
            {SECTIONS.map(({ key, title }) => data[key].length > 0 && (
              <div key={key}>
                <h4 className="mb-1 text-[11px] font-bold uppercase tracking-wide text-ink-faint">{title}</h4>
                <ul className="list-disc space-y-0.5 pl-5 text-sm text-ink">{data[key].map((x, i) => <li key={`${key}-${i}`}>{x}</li>)}</ul>
              </div>
            ))}
            <p className="text-[11px] leading-relaxed text-ink-faint">Written by AI from the paper&apos;s text{data.updatedAt ? ` · ${new Date(data.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}. It only repeats what the paper states and names no author — check it against the paper itself.</p>
          </>
        )}
        {problem && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-xs font-semibold text-danger">{problem}</p>}
      </div>
    </section>
    </div>
  );
}
