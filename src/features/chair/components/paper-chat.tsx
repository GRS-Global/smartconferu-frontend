"use client";

import { Send, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/ui/load-more";
import { DATA_SOURCE } from "@/lib/config";
import { askPaper, requestPaperIngest } from "@/services/paper-ai";

/* "Ask about this paper" (the prototype's PaperChatPanel): reviewers and chairs ask questions and get short answers drawn from the paper itself (the AI
   endpoint `paper-chat`, through this app's /api/ai proxy to the prototype's server: only the stored digest and the few matching parts of the paper are
   sent, never the whole PDF). Each answer names the sections it came from. A conversation is kept per paper while the app stays open. In mock mode there
   is no paper text or AI behind it, so it answers from the paper's own title, abstract and keywords, in the same shape as the real answer. */

export interface ChatPaper { id: string; dbId: string; title: string; abstract: string; keywords: string[]; track: string }
interface Msg { role: "user" | "assistant"; content: string; error?: boolean; sources?: unknown[] }

const CHATS = new Map<string, Msg[]>();
const STARTERS = ["What is the main contribution?", "Which datasets and baselines are used?", "How is the method evaluated?", "What limitations do the authors mention?"];

function sampleAnswer(p: ChatPaper, question: string): Promise<{ answer: string; sources: Array<{ section: string }> }> {
  const q = question.toLowerCase();
  const abstract = p.abstract.trim();
  const topic = p.keywords.join(", ") || p.track || "the topic";
  const first = abstract.split(/(?<=\.)\s/)[0] || `The paper "${p.title}".`;
  let answer: string; let sections: string[];
  if (/contribut|novel|main idea|what is this paper|summar/.test(q)) { answer = `${first} The contribution is framed around ${topic}.`; sections = ["1 Introduction", "Abstract"]; }
  else if (/data|baseline|compar/.test(q)) { answer = `The paper positions its work against standard approaches in ${topic}. In this sample the exact datasets and baseline list aren't available — check the experiment setup before relying on a comparison.`; sections = ["3 Data and Baselines"]; }
  else if (/evaluat|metric|result|measure|method/.test(q)) { answer = `${abstract || "The abstract doesn't describe the evaluation."} The paper doesn't spell out the evaluation here, so look at the results section for the metrics used.`; sections = ["4 Evaluation", "Abstract"]; }
  else if (/limit|weak|future|threat|gap/.test(q)) { answer = "The excerpts available here don't contain a limitations discussion. It is worth checking the closing section for what the authors say about scope and generalisation."; sections = ["6 Limitations and Future Work"]; }
  else { answer = "I couldn't find that in the paper. I only answer from the paper itself — try asking about its contribution, data, method or limitations."; sections = []; }
  return new Promise((resolve) => setTimeout(() => resolve({ answer, sources: sections.map((section) => ({ section })) }), 700));
}

/** Whether the question box is offered: the sample answers in mock mode, the AI for a paper in the database. */
export const chatAvailable = (p: ChatPaper) => DATA_SOURCE === "mock" || Boolean(p.dbId);

export function PaperChatPanel({ paper, heightPct, onClose, onCount }: { paper: ChatPaper; heightPct: number; onClose: () => void; onCount: (n: number) => void }) {
  const key = paper.dbId || paper.id;
  const [messages, setMessages] = useState<Msg[]>(() => CHATS.get(key) ?? []);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const prep = useRef(false);
  useEffect(() => {
    CHATS.set(key, messages);
    onCount(messages.filter((m) => m.role === "user").length);
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [messages, key, onCount]);
  const ask = (text?: string) => {
    const question = String(text ?? draft).trim();
    if (!question || busy) return;
    // Earlier turns go back as plain question / answer text (failed answers are left out).
    const history = messages.filter((m) => !m.error).map((m) => ({ role: m.role, content: m.content }));
    setMessages((all) => [...all, { role: "user", content: question }]);
    setDraft(""); setBusy(true);
    (DATA_SOURCE === "mock" ? sampleAnswer(paper, question) : askPaper(key, question, history))
      .then((r) => setMessages((all) => [...all, { role: "assistant", content: r.answer, sources: r.sources }]))
      .catch((e: unknown) => {
        if (DATA_SOURCE !== "mock" && (e as { notReady?: boolean })?.notReady && !prep.current) { prep.current = true; void requestPaperIngest(key); }
        setMessages((all) => [...all, { role: "assistant", error: true, content: e instanceof Error && e.message ? e.message : "The assistant couldn't answer." }]);
      })
      .finally(() => setBusy(false));
  };
  return (
    <section aria-label="Ask about this paper" onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); } }} style={{ borderTop: "1px solid var(--border)", boxShadow: "0 -12px 28px rgba(15,23,42,0.10)", height: `${heightPct}%` }} className="flex min-h-0 shrink-0 flex-col bg-white">
      <div className="flex items-start gap-3 border-b border-line px-4 py-3">
        <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary"><Sparkles size={15} /></span>
        <div className="min-w-0 flex-1"><h3 className="text-sm font-bold text-navy">Ask about this paper</h3><p className="truncate text-[11px] text-ink-muted">{paper.id} · {paper.title}</p></div>
        <button type="button" onClick={onClose} aria-label="Close" className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-ink-muted hover:bg-canvas"><X size={16} aria-hidden="true" /></button>
      </div>
      <div ref={list} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {messages.length === 0 && (
          <div>
            <p className="mb-3 text-xs leading-relaxed text-ink-soft">Answers come only from this paper and name the section they&apos;re from. The assistant helps you understand the paper — it doesn&apos;t write your review or judge the work for you.</p>
            <div className="flex flex-wrap gap-2">{STARTERS.map((q) => <button key={q} type="button" onClick={() => ask(q)} className="cursor-pointer rounded-full border border-[var(--primary-soft-border)] px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary-soft">{q}</button>)}</div>
          </div>
        )}
        {messages.map((m, i) => m.role === "user" ? (
          <div key={i} className="flex justify-end"><div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm text-white">{m.content}</div></div>
        ) : (
          <div key={i} className="max-w-[92%]">
            <div className={`whitespace-pre-wrap rounded-2xl rounded-bl-md px-3.5 py-2.5 text-sm ${m.error ? "bg-danger-soft text-danger" : "border border-line bg-canvas text-ink"}`}>{m.content}</div>
            {Array.isArray(m.sources) && m.sources.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1">{[...new Set(m.sources.map((s) => (s as { section?: string }).section).filter(Boolean))].map((s) => <span key={s} className="max-w-full truncate rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-ink-muted">{s}</span>)}</div>}
          </div>
        ))}
        {busy && <div role="status" className="flex items-center gap-2 text-xs text-ink-muted"><Spinner size={14} /> <span>Reading the relevant parts of the paper…</span></div>}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); ask(); }} className="flex items-end gap-2 border-t border-line p-4">
        <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} maxLength={1000} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); } }} placeholder="Ask about the method, data, results…" aria-label="Your question" className="flex-1 resize-none rounded-xl border-[1.5px] border-line px-3 py-2 text-sm text-ink outline-none placeholder:text-slate-400 focus:border-primary" />
        <button type="submit" disabled={busy || !draft.trim()} aria-label="Send" className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-primary text-white disabled:cursor-not-allowed disabled:opacity-45"><Send size={15} aria-hidden="true" /></button>
      </form>
    </section>
  );
}
