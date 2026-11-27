"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/** Copies `text` to the clipboard. The copy icon turns into a green tick and the label into "Copied!" for two seconds, and a screen reader hears it
 *  too. `iconOnly` makes the small square version (the label is then the tooltip). If the browser refuses the clipboard it says "Couldn't copy". */
export function CopyButton({ text, label = "Copy", iconOnly = false, className }: { text: string; label?: string; iconOnly?: boolean; className?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setState("copied"); } catch { setState("failed"); }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2000);
  };
  const copied = state === "copied";
  const text_ = copied ? "Copied!" : state === "failed" ? "Couldn't copy" : label;
  return (
    <button
      type="button"
      onClick={() => void copy()}
      title={iconOnly ? text_ : undefined}
      aria-label={iconOnly ? `${label}: ${text}` : undefined}
      style={{ border: `1.5px solid ${copied ? "var(--success)" : "var(--border)"}`, color: copied ? "var(--success-ink)" : "var(--ink-muted)", background: copied ? "var(--success-soft)" : "#FFFFFF" }}
      className={cn("inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition-colors hover:bg-canvas", iconOnly ? "h-8 w-8" : "px-3.5 py-2", className)}
    >
      {copied ? <Check size={14} strokeWidth={2.75} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      {!iconOnly && text_}
      <span role="status" aria-live="polite" className="sr-only">{copied ? "Copied to the clipboard" : state === "failed" ? "Couldn't copy" : ""}</span>
    </button>
  );
}
