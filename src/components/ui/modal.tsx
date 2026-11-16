"use client";

import { X, type LucideIcon } from "lucide-react";
import { createContext, useContext, useId, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

const FootContext = createContext<HTMLElement | null>(null);
/** The footer band of the window around this component, when it asked for one (`footerSlot`): a form draws its Save / Cancel buttons into it (portal). */
export const useModalFoot = () => useContext(FootContext);

interface ModalProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  onClose: () => void;
  children: ReactNode;
  /** Buttons for the pinned footer band (laid out right-aligned, wrapping), as the prototype lifts a modal's last action row. */
  actions?: ReactNode;
  maxWidth?: string;
  /** The roomier header and body of the prototype's `roomy` modals (bigger icon tile and title, 28 px padding). */
  roomy?: boolean;
  /** Keep an empty footer band for the form inside to draw its buttons into (see `useModalFoot`). */
  footerSlot?: boolean;
}

/** The prototype's generic Modal (author-journey.jsx `Modal`): a backdrop (a click on it closes), a card with the accent hairline, a tinted
 *  header with an optional icon tile, title, subtitle and a close button, a scrolling body and a pinned footer band for the actions.
 *  Rendered into <body> so a parent's clipping can't box it in. */
export function Modal({ title, subtitle, icon: Icon, onClose, children, actions, maxWidth = "max-w-md", roomy = false, footerSlot = false }: ModalProps) {
  const uid = useId();
  // The window is drawn into <body>, which exists only in the browser: nothing is drawn while the page is rendered on the server.
  const inBrowser = useSyncExternalStore(() => () => undefined, () => true, () => false);
  const [foot, setFoot] = useState<HTMLElement | null>(null);
  if (!inBrowser) return null;
  return createPortal(
    <div onClick={onClose} style={{ background: "rgba(15,23,42,0.5)" }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        role="dialog" aria-modal="true" aria-labelledby={`${uid}-title`} data-modal=""
        onClick={(e) => e.stopPropagation()}
        style={{ border: "1px solid var(--border)" }}
        className={cn("ui-accent-card flex max-h-[90vh] w-full flex-col rounded-2xl bg-white shadow-2xl", maxWidth)}
      >
        <div className={cn("ui-modal-head flex shrink-0 items-start justify-between gap-3 py-5", roomy ? "px-7" : "px-6")}>
          <div className="flex min-w-0 items-center gap-3">
            {Icon && (
              <div style={{ border: "1px solid var(--primary-soft-border)", boxShadow: "0 1px 2px rgba(15,23,42,0.05)" }} className={cn("flex shrink-0 items-center justify-center rounded-xl bg-white text-primary", roomy ? "h-11 w-11" : "h-10 w-10")}>
                <Icon size={roomy ? 20 : 18} aria-hidden="true" />
              </div>
            )}
            <div className="min-w-0">
              <h3 id={`${uid}-title`} className={cn("font-bold leading-snug text-navy", roomy ? "text-lg" : "text-base")}>{title}</h3>
              {subtitle && <p className={cn("mt-0.5 text-ink-faint", roomy ? "text-[13px]" : "text-xs")}>{subtitle}</p>}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-white hover:text-slate-600"><X size={18} aria-hidden="true" /></button>
        </div>
        <FootContext.Provider value={foot}><div className={cn("min-h-0 overflow-y-auto overscroll-contain", roomy ? "p-7" : "p-6", (Boolean(actions) || footerSlot) && "flex-1")}>{children}</div></FootContext.Provider>
        {(actions || footerSlot) && <div className={cn("ui-modal-foot shrink-0 py-4", roomy ? "px-7" : "px-6")}><div ref={footerSlot ? setFoot : undefined} className="flex flex-wrap items-center justify-end gap-2">{actions}</div></div>}
      </div>
    </div>,
    document.body,
  );
}
