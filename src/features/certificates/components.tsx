"use client";

import type { ReactNode } from "react";
import { X, type LucideIcon } from "lucide-react";
import type { ToneKey } from "./data";

// Status / semantic tone lookup shared by the module's components and pages.
const TONES: Record<ToneKey, { bg: string; fg: string }> = {
  primary: { bg: "var(--primary-soft)", fg: "var(--primary)" },
  secondary: { bg: "var(--secondary-soft)", fg: "var(--secondary)" },
  accent: { bg: "#ECFEFF", fg: "#0E7490" }, // cyan-tinted surface; --accent itself is too light behind text
  success: { bg: "var(--success-soft)", fg: "var(--success)" },
  warning: { bg: "var(--warning-soft)", fg: "var(--warning)" },
  danger: { bg: "var(--danger-soft)", fg: "var(--danger)" },
  muted: { bg: "var(--muted)", fg: "var(--ink-muted)" },
};
export const toneOf = (key: string | undefined) => TONES[key as ToneKey] || TONES.primary;

/* Same card chrome as chair-programme / chair-analytics — duplicated rather than imported so the
   three chair modules stay decoupled from each other, as they are from the monolith. */
export function CertCard({ title, subtitle, action, children, className = "", padded = true }: { title?: string; subtitle?: string; action?: ReactNode; children?: ReactNode; className?: string; padded?: boolean }) {
  return (
    <div style={{ border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }} className={`bg-white rounded-2xl ${padded ? "p-5" : ""} ${className}`}>
      {(title || subtitle || action) && (
        <div className={`flex items-start justify-between gap-3 mb-3 ${padded ? "" : "px-5 pt-5"}`}>
          <div className="min-w-0">
            {title && <h2 style={{ color: "var(--navy)" }} className="text-sm font-bold">{title}</h2>}
            {subtitle && <p style={{ color: "var(--ink-muted)" }} className="text-xs mt-0.5 leading-relaxed">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function CertStat({ value, label, sublabel, tone = "primary" }: { value: ReactNode; label: string; sublabel?: string; tone?: string }) {
  const t = toneOf(tone);
  return (
    <div style={{ borderTop: `3px solid ${t.fg}`, borderRight: "1px solid var(--border)", borderBottom: "1px solid var(--border)", borderLeft: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }} className="bg-white rounded-2xl p-4">
      <div style={{ color: "var(--ink-muted)" }} className="text-[11px] font-bold uppercase tracking-wide">{label}</div>
      <div className="flex items-baseline gap-2 mt-1">
        <span style={{ color: t.fg }} className="text-2xl font-extrabold leading-none">{value}</span>
        {sublabel && <span style={{ color: "var(--ink-muted)" }} className="text-[11px] font-medium">{sublabel}</span>}
      </div>
    </div>
  );
}

export function Pill({ tone = "muted", children, className = "" }: { tone?: string; children: ReactNode; className?: string }) {
  const t = toneOf(tone);
  return (
    <span style={{ background: t.bg, color: t.fg }} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap ${className}`}>
      {children}
    </span>
  );
}

export function CertModal({ title, subtitle, onClose, children, footer, maxWidth = "max-w-2xl" }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode; footer?: ReactNode; maxWidth?: string }) {
  return (
    <div onClick={onClose} style={{ background: "rgba(15,23,42,0.5)" }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ border: "1px solid var(--border)" }}
        className={`bg-white rounded-2xl w-full ${maxWidth} shadow-2xl max-h-[92vh] flex flex-col`}
      >
        <div className="ui-modal-head flex items-start justify-between gap-4 px-6 py-4 shrink-0 rounded-t-2xl">
          <div className="min-w-0">
            <h3 style={{ color: "var(--navy)" }} className="text-base font-bold">{title}</h3>
            {subtitle && <p style={{ color: "var(--ink-muted)" }} className="text-xs mt-1 leading-relaxed">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" style={{ color: "var(--ink-faint)" }} className="hover:text-slate-600 transition-colors shrink-0 mt-0.5 cursor-pointer">
            <X size={18} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto min-h-0">{children}</div>
        {footer && <div className="ui-modal-foot px-6 py-4 shrink-0 flex items-center gap-3 rounded-b-2xl">{footer}</div>}
      </div>
    </div>
  );
}


/* An inline notice — the module's one way of saying "here is what's wrong and here is the fix",
   used for missing emails, bounces and blocked audiences alike. */
export function Notice({ tone = "warning", icon: Icon, children, action }: { tone?: string; icon?: LucideIcon; children: ReactNode; action?: ReactNode }) {
  const t = toneOf(tone);
  const border = tone === "danger" ? "var(--danger-border)" : tone === "warning" ? "var(--warning-border)" : "var(--border)";
  return (
    <div style={{ background: t.bg, border: `1px solid ${border}` }} className="rounded-xl px-4 py-3 flex items-start gap-3">
      {Icon && <Icon size={16} style={{ color: t.fg }} className="shrink-0 mt-0.5" />}
      <div style={{ color: t.fg }} className="text-xs leading-relaxed flex-1 min-w-0">{children}</div>
      {action}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children, action }: { icon?: LucideIcon; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div style={{ border: "1.5px dashed var(--border-strong)", background: "var(--row-hover)" }} className="rounded-2xl p-10 text-center">
      {Icon && <Icon size={26} style={{ color: "var(--ink-faint)" }} className="mx-auto mb-3" />}
      <h3 style={{ color: "var(--navy)" }} className="text-sm font-bold mb-1">{title}</h3>
      {children && <p style={{ color: "var(--ink-muted)" }} className="text-sm max-w-md mx-auto leading-relaxed">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
