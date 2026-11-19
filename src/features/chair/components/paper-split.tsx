"use client";

import { BookOpen, ExternalLink, FileText, Maximize2, Minimize2, Sparkles, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { SUMMARY_AVAILABLE } from "@/services/paper-ai";
import { chatAvailable, PaperChatPanel, type ChatPaper } from "./paper-chat";
import { PaperSummaryPanel } from "./paper-summary";

/* The paper beside a form (the prototype's ReviewSplit and ReviewPaperPreview): the paper's file on the left, the form on the right, 60 / 40 by default. The
   paper's header has "Ask a question" (the chat about the paper opens as a panel along the bottom of the preview, its height can be dragged), Open in a new
   tab, Full screen (Esc goes back) and Hide (the form takes the whole width; "Show paper" brings the paper back). The divider between the two can be dragged,
   double-clicked to reset, or moved with the arrow keys. The file is drawn by our own light PDF reader (pdf.js: page number, zoom, search). */

// pdf.js is loaded only here, when a paper is shown.
const PdfViewer = dynamic(() => import("@/components/ui/pdf-viewer").then((m) => m.PdfViewer), { ssr: false, loading: () => <div className="flex h-[40vh] items-center justify-center text-sm text-ink-faint">Loading the paper…</div> });
const CARD = { border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" } as const;
const ICON_BTN = "flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-line bg-white text-ink-soft hover:bg-canvas";
const CHAT_KEY = "smartconferu.paperChatHeight";
const CHAT_RANGE: [number, number] = [25, 75];
const clamp = (v: number) => Math.min(CHAT_RANGE[1], Math.max(CHAT_RANGE[0], v));
const savedChat = (): number => { try { const v = Number(window.localStorage.getItem(CHAT_KEY)); return Number.isFinite(v) && v > 0 ? clamp(v) : 56; } catch { return 56; } };

export function PaperSplit({ file, loadUrl, chat = null, blind = false, children }: { title?: string; blind?: boolean; file: { name: string; storagePath: string | null } | null; loadUrl: (storagePath: string) => Promise<string>; chat?: ChatPaper | null; children: (open: boolean) => ReactNode }) {
  const [open, setOpen] = useState(true);
  const [full, setFull] = useState(false);
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);
  const [pct, setPct] = useState(60);
  const [dragging, setDragging] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatPct, setChatPct] = useState(56);
  const [chatCount, setChatCount] = useState(0);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const grid = useRef<HTMLDivElement>(null);
  const aside = useRef<HTMLElement>(null);
  const chatRef = useRef(56);
  const path = file?.storagePath ?? null;
  const canChat = Boolean(chat && chatAvailable(chat));
  const canSummary = Boolean(chat && SUMMARY_AVAILABLE && chat.dbId);
  const onCount = useCallback((n: number) => setChatCount(n), []);
  useEffect(() => {
    if (!path || !open) return undefined;
    let cancelled = false;
    loadUrl(path).then((u) => { if (!cancelled) setUrl(u); }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [path, open, loadUrl]);
  useEffect(() => {
    if (!full) return undefined;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape" && !e.defaultPrevented) setFull(false); };
    const was = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", esc);
    return () => { window.removeEventListener("keydown", esc); document.body.style.overflow = was; };
  }, [full]);
  const drag = (e: React.PointerEvent) => {
    e.preventDefault();
    const move = (ev: PointerEvent) => { const r = grid.current?.getBoundingClientRect(); if (r) setPct(Math.min(65, Math.max(35, ((ev.clientX - r.left) / r.width) * 100))); };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); setDragging(false); };
    setDragging(true); window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };
  const setChatHeight = (v: number) => { const next = clamp(v); chatRef.current = next; setChatPct(next); };
  const saveChat = () => { try { window.localStorage.setItem(CHAT_KEY, String(chatRef.current)); } catch { /* storage off */ } };
  const dragChat = (e: React.PointerEvent) => {
    e.preventDefault();
    const move = (ev: PointerEvent) => { const r = aside.current?.getBoundingClientRect(); if (r) setChatHeight(((r.bottom - ev.clientY) / r.height) * 100); };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); saveChat(); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };
  return (
    <>
      <div ref={grid} style={open ? ({ "--split": `minmax(0,${pct}fr) 24px minmax(0,${100 - pct}fr)` } as CSSProperties) : undefined} className={open ? "mx-auto max-w-[1760px] grid grid-cols-1 gap-6 lg:h-[calc(100vh-14rem)] lg:min-h-[560px] lg:items-stretch lg:gap-0 lg:[grid-template-columns:var(--split)]" : "mx-auto max-w-[980px]"}>
        {open && (
          <div className="h-[70vh] min-w-0 lg:h-full">
            {full && <div onClick={() => setFull(false)} aria-hidden="true" style={{ background: "rgba(11,16,32,0.6)" }} className="fixed inset-0 z-40" />}
            <aside ref={aside} aria-label="Paper preview" style={{ ...CARD, boxShadow: full ? "0 24px 64px rgba(11,16,32,0.35)" : CARD.boxShadow }} className={`flex flex-col overflow-hidden rounded-2xl bg-white ${full ? "fixed inset-2 z-50 sm:inset-5 lg:inset-x-[6vw] lg:inset-y-5" : "h-full"}`}>
              <div className="flex items-center gap-3 border-b border-line bg-canvas px-4 py-2.5">
                <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-danger-soft text-[9.5px] font-extrabold tracking-wide text-danger">PDF</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-semibold text-ink">{file?.name ?? "The paper"}</span><span className="block text-[11px] text-ink-faint">{full ? "Full screen · press Esc to go back" : "Paper preview"}{blind ? " · authors hidden" : ""}</span></span>
                {canSummary && (
                  <button type="button" onClick={() => { setChatOpen(false); if (!summaryOpen) { const v = savedChat(); chatRef.current = v; setChatPct(v); } setSummaryOpen((o) => !o); }} aria-pressed={summaryOpen} title={summaryOpen ? "Close the summary" : "Read the summary of this paper"} style={summaryOpen ? { background: "var(--primary)", color: "#FFFFFF", borderColor: "var(--primary)" } : { background: "#FFFFFF", color: "var(--primary)", borderColor: "var(--primary-soft-border)" }} className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-xs font-bold"><FileText size={13} aria-hidden="true" /> Summary</button>
                )}
                {canChat && (
                  <button type="button" onClick={() => { setSummaryOpen(false); if (!chatOpen) { const v = savedChat(); chatRef.current = v; setChatPct(v); } setChatOpen((o) => !o); }} aria-pressed={chatOpen} title={chatOpen ? "Close the chat" : "Ask a question about this paper"} style={chatOpen ? { background: "var(--primary)", color: "#FFFFFF", borderColor: "var(--primary)" } : { background: "var(--primary-soft)", color: "var(--primary)", borderColor: "var(--primary-soft-border)" }} className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-xs font-bold"><Sparkles size={13} aria-hidden="true" /> Ask a question{chatCount ? ` (${chatCount})` : ""}</button>
                )}
                <button type="button" aria-label="Open the paper in a new tab" title="Open in a new tab" disabled={!url} onClick={() => window.open(url, "_blank", "noopener")} className={`${ICON_BTN} disabled:opacity-40`}><ExternalLink size={14} aria-hidden="true" /></button>
                <button type="button" aria-label={full ? "Exit full screen" : "Full screen"} aria-pressed={full} title={full ? "Exit full screen (Esc)" : "Full screen"} onClick={() => setFull((v) => !v)} style={full ? { background: "var(--primary)", color: "#FFFFFF", borderColor: "var(--primary)" } : undefined} className={ICON_BTN}>{full ? <Minimize2 size={14} aria-hidden="true" /> : <Maximize2 size={14} aria-hidden="true" />}</button>
                {!full && <button type="button" aria-label="Hide the paper preview" title="Hide the paper — the form takes the full width" onClick={() => setOpen(false)} className={ICON_BTN}><X size={14} aria-hidden="true" /></button>}
              </div>
              <div className="relative min-h-0 flex-1 bg-canvas">
                {url
                  ? <PdfViewer url={url} onOpenExternal={() => window.open(url, "_blank", "noopener")} />
                  : <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-ink-faint">{!path ? "The paper's file isn't available." : failed ? "Couldn't open the paper here. Use “View submission” to open it in a new tab." : "Loading the paper…"}</div>}
              </div>
              {(chatOpen || summaryOpen) && chat && (
                <>
                  <div role="separator" aria-orientation="horizontal" aria-label="Resize the chat" aria-valuemin={CHAT_RANGE[0]} aria-valuemax={CHAT_RANGE[1]} aria-valuenow={Math.round(chatPct)} tabIndex={0} onPointerDown={dragChat} onDoubleClick={() => { setChatHeight(56); saveChat(); }}
                    onKeyDown={(e) => { if (e.key === "ArrowUp") { setChatHeight(chatRef.current + 3); saveChat(); } if (e.key === "ArrowDown") { setChatHeight(chatRef.current - 3); saveChat(); } }}
                    className="group flex h-2 shrink-0 cursor-row-resize items-center justify-center bg-white outline-none"><span className="h-1 w-12 rounded-full bg-line-strong transition-colors group-hover:bg-primary group-focus-visible:bg-primary" /></div>
                  {chatOpen ? <PaperChatPanel paper={chat} heightPct={chatPct} onClose={() => setChatOpen(false)} onCount={onCount} /> : <PaperSummaryPanel paper={chat} heightPct={chatPct} onClose={() => setSummaryOpen(false)} />}
                </>
              )}
            </aside>
          </div>
        )}
        {open && (
          <div role="separator" aria-orientation="vertical" aria-label="Resize the paper and the form" aria-valuemin={35} aria-valuemax={65} aria-valuenow={Math.round(pct)} tabIndex={0}
            onPointerDown={drag} onDoubleClick={() => setPct(60)}
            onKeyDown={(e) => { if (e.key === "ArrowLeft") setPct((v) => Math.max(35, v - 2)); if (e.key === "ArrowRight") setPct((v) => Math.min(65, v + 2)); }}
            className="group hidden cursor-col-resize items-center justify-center outline-none lg:flex">
            <span className={`h-12 w-1 rounded-full transition-colors group-hover:bg-primary group-focus-visible:bg-primary ${dragging ? "bg-primary" : "bg-line-strong"}`} />
          </div>
        )}
        <div className={`min-w-0 ${open ? "lg:h-full lg:min-h-0 lg:overflow-y-auto lg:pr-2" : ""} ${dragging ? "select-none" : ""}`}>{!open && <button type="button" onClick={() => setOpen(true)} style={{ border: "1px solid var(--primary-soft-border)", color: "var(--primary)", background: "var(--primary-soft)" }} className="mb-4 inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-3.5 text-xs font-bold"><BookOpen size={14} aria-hidden="true" /> Show the paper beside the form</button>}{children(open)}</div>
      </div>
    </>
  );
}
