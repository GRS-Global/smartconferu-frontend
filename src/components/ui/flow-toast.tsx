"use client";

import { Check, TriangleAlert, X } from "lucide-react";
import { useEffect } from "react";

/** `tone`: "success" (the default) or "warning" — something the person can't do here, said kindly; a warning stays a little longer to be read. */
export interface FlowToastData { title: string; text: string; tone?: "success" | "warning" }

/** The small toast the reviewer and chair flows use (the prototype's FlowToast): bottom right, closes itself after a few seconds. */
export function FlowToast({ toast, onClose }: { toast: FlowToastData | null; onClose: () => void }) {
  const warning = toast?.tone === "warning";
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(onClose, toast.tone === "warning" ? 6000 : 3500);
    return () => clearTimeout(t);
  }, [toast, onClose]);
  if (!toast) return null;
  return (
    <div role={warning ? "alert" : "status"} aria-live={warning ? "assertive" : "polite"} className="fixed bottom-6 right-6 z-[60] flex w-[22rem] max-w-[calc(100vw-2rem)] items-start gap-3 rounded-2xl border border-line bg-white p-4 shadow-2xl" data-no-scroll-error>
      <span aria-hidden="true" className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${warning ? "bg-warning-soft text-warning-ink" : "bg-success-soft text-success-ink"}`}>{warning ? <TriangleAlert size={18} strokeWidth={2.5} /> : <Check size={18} strokeWidth={2.5} />}</span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold text-navy">{toast.title}</div>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{toast.text}</p>
      </div>
      <button type="button" onClick={onClose} aria-label="Dismiss" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-faint hover:bg-canvas"><X size={14} aria-hidden="true" /></button>
    </div>
  );
}
