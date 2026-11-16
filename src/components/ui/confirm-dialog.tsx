"use client";

import { AlertTriangle, X } from "lucide-react";
import { useId, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  /** "danger" for delete / clear, "warning" for disruptive-but-not-final actions (the prototype's two tones). */
  tone?: "danger" | "warning";
  onConfirm: () => void;
  onClose: () => void;
  children?: ReactNode;
}

/** The prototype's ConfirmDialog (src/shared/ConfirmDialog.jsx): a header band with the title and a close button, a tinted icon circle with
 *  the message, and a footer band with Cancel and the coloured confirm button. A click on the dark backdrop or on the close button is the
 *  same as Cancel. Rendered into <body> so a parent's clipping can't box it in. */
export function ConfirmDialog({ title, message, confirmLabel = "Delete", tone = "danger", onConfirm, onClose, children }: ConfirmDialogProps) {
  const uid = useId();
  const color = tone === "warning" ? "var(--warning)" : "var(--danger)";
  const soft = tone === "warning" ? "var(--warning-soft)" : "var(--danger-soft)";
  const hover = tone === "warning" ? "var(--warning)" : "var(--danger-hover)";
  return createPortal(
    <div onClick={onClose} style={{ background: "rgba(15,23,42,0.5)" }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        role="dialog" aria-modal="true" aria-labelledby={`${uid}-title`} data-modal=""
        onClick={(e) => e.stopPropagation()}
        style={{ border: "1px solid var(--border)" }}
        className={`w-full rounded-2xl bg-white shadow-2xl ${children ? "max-h-[90vh] max-w-xl overflow-y-auto" : "max-w-sm"}`}
      >
        <div className="ui-modal-head flex items-center justify-between rounded-t-2xl px-6 py-4">
          <h3 id={`${uid}-title`} className="text-base font-bold text-navy">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="cursor-pointer text-ink-faint transition-colors hover:text-slate-600"><X size={18} aria-hidden="true" /></button>
        </div>
        <div className="p-6">
          <div className="flex items-start gap-3">
            <div style={{ background: soft }} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"><AlertTriangle size={18} aria-hidden="true" style={{ color }} /></div>
            <p className="text-sm leading-relaxed text-ink-soft">{message}</p>
          </div>
          {children && <div className="mt-5">{children}</div>}
        </div>
        <div className="ui-modal-foot flex items-center justify-end gap-3 rounded-b-2xl px-6 py-4">
          <button type="button" onClick={onClose} className="cursor-pointer rounded-lg border-[1.5px] border-line px-4 py-2 text-sm font-semibold text-ink-muted transition-colors hover:bg-slate-50">Cancel</button>
          <button
            type="button" onClick={onConfirm}
            style={{ background: color }}
            onMouseEnter={(e) => { e.currentTarget.style.background = hover; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = color; }}
            className="cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors"
          >{confirmLabel}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
