"use client";

import { ArrowUp, BookOpen, MessageCircleQuestion, RotateCcw, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { DATA_SOURCE } from "@/lib/config";
import { askPaper, requestPaperIngest } from "@/services/paper-ai";

/* "Ask about this paper" (the prototype's PaperChatPanel): reviewers and chairs ask questions and get short answers drawn from the paper itself (the AI
   endpoint `paper-chat`, through this app's /api/ai proxy to the prototype's server: only the stored digest and the few matching parts of the paper are
   sent, never the whole PDF). Each answer names the sections it came from. A conversation is kept per paper while the app stays open. It opens as a panel
   that slides in from the right, over the form, so the whole paper stays in view beside it. In mock mode there
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

export function PaperChatPanel({ paper, onClose, onCount }: { paper: ChatPaper; onClose: () => void; onCount: (n: number) => void }) {
  const key = paper.dbId || paper.id;
  const [messages, setMessages] = useState<Msg[]>(() => CHATS.get(key) ?? []);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const prep = useRef(false);
  useEffect(() => {
    CHATS.set(key, messages);
    onCount(messages.filter((m) => m.role === "user").length);
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [messages, key, onCount]);
  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape" && !e.defaultPrevented) { e.preventDefault(); onClose(); } };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
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
  const sectionsOf = (m: Msg) => (Array.isArray(m.sources) ? [...new Set(m.sources.map((x) => (x as { section?: string }).section).filter((x): x is string => Boolean(x)))] : []);
  return (
    <aside role="dialog" aria-modal="false" aria-label="Ask about this paper" style={{ boxShadow: "-24px 0 48px -16px rgba(15,23,42,0.28)", animation: "chat-in .22s ease-out" }} className="fixed inset-y-0 right-0 z-[60] flex w-full flex-col bg-white sm:w-[460px]">
      <style>{"@keyframes chat-in{from{transform:translateX(24px);opacity:0}to{transform:none;opacity:1}}"}</style>
      <header style={{ background: "linear-gradient(135deg, var(--primary-soft), #FFFFFF 70%)" }} className="flex items-start gap-3 border-b border-line px-5 py-4">
        <span aria-hidden="true" style={{ background: "linear-gradient(135deg, var(--primary), var(--secondary))" }} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"><Sparkles size={18} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-extrabold text-navy">Ask about this paper</h2>
          <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11.5px] text-ink-muted"><span className="shrink-0 rounded-md bg-white px-1.5 py-0.5 font-bold text-primary" style={{ border: "1px solid var(--primary-soft-border)" }}>{paper.id}</span><span className="truncate">{paper.title}</span></p>
        </div>
        {messages.length > 0 && <button type="button" onClick={() => { setMessages([]); CHATS.delete(key); }} disabled={busy} title="Start a new conversation" aria-label="Clear the conversation" className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-ink-muted hover:bg-white disabled:opacity-40"><RotateCcw size={15} aria-hidden="true" /></button>}
        <button type="button" onClick={onClose} aria-label="Close" title="Close (Esc)" className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-ink-muted hover:bg-white"><X size={17} aria-hidden="true" /></button>
      </header>

      <div ref={list} className="min-h-0 flex-1 space-y-5 overflow-y-auto bg-canvas px-5 py-5">
        {messages.length === 0 && (
          <div className="flex flex-col items-center pt-6 text-center">
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary"><MessageCircleQuestion size={22} aria-hidden="true" /></span>
            <p className="text-sm font-bold text-navy">What would you like to know?</p>
            <p className="mx-auto mt-1 max-w-[340px] text-xs leading-relaxed text-ink-muted">Answers come only from this paper and name the section they&apos;re from. The assistant helps you understand the paper — it doesn&apos;t write your review or judge the work.</p>
            <div className="mt-5 grid w-full gap-2">
              {STARTERS.map((q) => (
                <button key={q} type="button" onClick={() => ask(q)} style={{ border: "1px solid var(--border)" }} className="group flex w-full cursor-pointer items-center gap-2.5 rounded-xl bg-white px-3.5 py-2.5 text-left text-[13px] font-semibold text-ink transition-colors hover:border-primary hover:text-primary">
                  <Sparkles size={13} aria-hidden="true" className="shrink-0 text-primary opacity-70 group-hover:opacity-100" /> {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => m.role === "user" ? (
          <div key={i} className="flex justify-end"><div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-[13.5px] leading-relaxed text-white shadow-sm">{m.content}</div></div>
        ) : (
          <div key={i} className="flex gap-2.5">
            <span aria-hidden="true" className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${m.error ? "bg-danger-soft text-danger" : "bg-primary-soft text-primary"}`}><Sparkles size={13} /></span>
            <div className="min-w-0 max-w-[88%]">
              <div style={m.error ? undefined : { border: "1px solid var(--border)" }} className={`whitespace-pre-wrap rounded-2xl rounded-tl-md px-4 py-3 text-[13.5px] leading-relaxed shadow-sm ${m.error ? "bg-danger-soft text-danger" : "bg-white text-ink"}`}>{m.content}</div>
              {sectionsOf(m).length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-faint">From</span>
                  {sectionsOf(m).map((sec) => <span key={sec} title={sec} style={{ border: "1px solid var(--primary-soft-border)" }} className="inline-flex max-w-[240px] items-center gap-1 truncate rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-primary"><BookOpen size={10} aria-hidden="true" className="shrink-0" /><span className="truncate">{sec}</span></span>)}
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && (
          <div role="status" className="flex items-center gap-2.5">
            <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-soft text-primary"><Sparkles size={13} /></span>
            <span style={{ border: "1px solid var(--border)" }} className="inline-flex items-center gap-1 rounded-2xl rounded-tl-md bg-white px-4 py-3">
              {[0, 1, 2].map((d) => <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" style={{ animationDelay: `${d * 120}ms` }} />)}
              <span className="sr-only">Reading the relevant parts of the paper…</span>
            </span>
          </div>
        )}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); ask(); }} className="border-t border-line bg-white px-4 pb-4 pt-3">
        <div style={{ border: "1.5px solid var(--border)" }} className="flex items-end gap-2 rounded-2xl bg-white p-1.5 pl-3.5 transition-colors focus-within:border-primary focus-within:shadow-[0_0_0_3px_var(--primary-soft)]">
          <textarea ref={input} value={draft} onChange={(e) => setDraft(e.target.value)} rows={1} maxLength={1000} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); } }} placeholder="Ask about the method, data, results…" aria-label="Your question" className="max-h-32 min-h-[36px] flex-1 resize-none bg-transparent py-2 text-sm text-ink outline-none placeholder:text-ink-faint [field-sizing:content]" />
          <button type="submit" disabled={busy || !draft.trim()} aria-label="Send" title="Send (Enter)" className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-primary text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"><ArrowUp size={17} aria-hidden="true" /></button>
        </div>
        <p className="mt-1.5 px-1 text-[10.5px] text-ink-faint">Enter to send · Shift + Enter for a new line</p>
      </form>
    </aside>
  );
}
