"use client";

import { X, type LucideIcon } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  /** sm is the default; md fits short forms, lg the profile forms, xl (768px) the long lists. */
  size?: "sm" | "md" | "lg" | "xl";
  /** A 44px icon tile beside the title, as on the prototype's profile dialogs. */
  icon?: LucideIcon;
  children: ReactNode;
}

/** Modal on the native <dialog>: focus is trapped, Escape closes and focus returns to the opener. */
export function Dialog({ open, onClose, title, description, size = "sm", icon: Icon, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const uid = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      // showModal() focuses the first control, the close button, and the browser draws its focus ring on it at once. The prototype's dialogs open with
      // nothing ringed, so focus goes to the dialog itself (it stays inside it for the keyboard); a field that took focus on its own keeps it.
      if (el.querySelector("button[aria-label=\"Close\"]") === document.activeElement) { el.tabIndex = -1; el.focus({ preventScroll: true }); }
    }
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      // A nested dialog's close event bubbles through React to this one: only react to our own.
      onClose={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
      aria-labelledby={`${uid}-title`}
      aria-describedby={description ? `${uid}-desc` : undefined}
      className={cn("m-auto w-full rounded-2xl border-0 bg-white p-0 shadow-pop outline-none backdrop:bg-slate-900/50", size === "xl" ? "max-w-3xl" : size === "lg" ? "max-w-2xl" : size === "md" ? "max-w-md" : "max-w-sm")}
    >
      {open && (
        <div className="max-h-[85vh] overflow-y-auto p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            {Icon && <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-white text-primary shadow-sm"><Icon size={20} strokeWidth={1.9} /></span>}
            <div className="min-w-0 flex-1">
              <h2 id={`${uid}-title`} className="text-base font-extrabold text-navy">{title}</h2>
              {description && <p id={`${uid}-desc`} className="mt-0.5 text-[13px] text-ink-muted">{description}</p>}
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-canvas hover:text-ink-soft">
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
