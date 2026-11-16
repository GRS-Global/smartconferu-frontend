"use client";

import { HelpCircle, Info, Lightbulb } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { SETTING_HELP } from "../setting-help";

/* A setting label with a help popover (the prototype's SettingLabel): hover or keyboard-focus the label (or tap it) to read what the setting does, a worked
   example and an optional tip. The popover is drawn on <body> below the label (above it when there is no room), so a card with hidden overflow never clips it. */

// The Submissions panel keys its rows by the policy field; the help text is filed under the prototype's own names.
const ALIAS: Record<string, string> = { accepting: "newSubmissionsAllowed", allowUpdates: "submissionUpdatesAllowed", allowMultiple: "allowMultipleSubmissions", editAfterAccept: "modifiableAfterAccepted", opensAt: "periodFrom", maxPerAuthor: "maxSubmissionsPerAuthor", types: "presentationTypes" };

export function HelpLabel({ help, children }: { help: string; children: ReactNode }) {
  const info = SETTING_HELP[ALIAS[help] ?? help];
  const triggerRef = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tipId = useId();
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number; arrow: number } | null>(null);
  useEffect(() => {
    if (!pos) return undefined;
    const close = () => setPos(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("scroll", close, true); window.addEventListener("resize", close); document.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close); document.removeEventListener("keydown", onKey); };
  }, [pos]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  if (!info) return <span>{children}</span>;
  const WIDTH = 320;
  const clear = () => { if (timer.current) clearTimeout(timer.current); };
  const show = () => {
    clear();
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    const left = Math.min(Math.max(12, r.left), window.innerWidth - WIDTH - 12);
    const below = window.innerHeight - r.bottom > 280 || r.top < 280;
    setPos(below ? { left, top: r.bottom + 8, arrow: r.left + 10 - left } : { left, bottom: window.innerHeight - r.top + 8, arrow: r.left + 10 - left });
  };
  const showSoon = () => { clear(); timer.current = setTimeout(show, 150); };
  const hideSoon = () => { clear(); timer.current = setTimeout(() => setPos(null), 120); };
  return (
    <>
      <span ref={triggerRef} tabIndex={0} aria-describedby={pos ? tipId : undefined} onMouseEnter={showSoon} onMouseLeave={hideSoon} onFocus={show} onBlur={hideSoon} onClick={(e) => { e.preventDefault(); if (pos) setPos(null); else show(); }} className="group/help inline-flex cursor-help items-center gap-1.5 rounded outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
        <span className="underline decoration-line-strong decoration-dotted underline-offset-[3px] group-hover/help:decoration-primary">{children}</span>
        <HelpCircle size={13} aria-hidden="true" style={{ color: pos ? "var(--primary)" : "var(--ink-faint)" }} className="shrink-0 transition-colors group-hover/help:text-primary" />
      </span>
      {pos && createPortal(
        <div id={tipId} role="tooltip" onMouseEnter={clear} onMouseLeave={hideSoon} style={{ position: "fixed", left: pos.left, top: pos.top, bottom: pos.bottom, width: WIDTH, zIndex: 80, border: "1px solid var(--border)", boxShadow: "var(--shadow-pop)" }} className="rounded-xl bg-white p-4 text-left font-normal normal-case tracking-normal">
          <span aria-hidden="true" style={{ left: Math.min(Math.max(pos.arrow, 12), WIDTH - 24), borderLeft: "1px solid var(--border)", borderTop: "1px solid var(--border)", ...(pos.top !== undefined ? { top: -6 } : { bottom: -6, transform: "rotate(225deg)" }) }} className={`absolute h-3 w-3 bg-white ${pos.top !== undefined ? "rotate-45" : ""}`} />
          <div className="text-[13px] font-bold leading-snug text-navy">{info.title}</div>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{info.what}</p>
          <div style={{ background: "#F5F7FF", border: "1px solid var(--primary-soft-border)" }} className="mt-3 rounded-lg px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-primary"><Lightbulb size={12} aria-hidden="true" /> Example</div>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink">{info.example}</p>
          </div>
          {info.tip && <p className="mt-2.5 flex items-start gap-1.5 text-xs leading-relaxed text-ink-muted"><Info size={12} aria-hidden="true" className="mt-0.5 shrink-0" /> {info.tip}</p>}
        </div>,
        document.body,
      )}
    </>
  );
}
