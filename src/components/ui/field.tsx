import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** The look without a width, for controls that size themselves (a calling-code select beside a number). */
export const INPUT_BASE =
  "rounded-lg border-[1.5px] border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none placeholder:text-slate-400 focus:border-primary disabled:bg-canvas disabled:text-ink-muted aria-[invalid=true]:border-danger";

export const INPUT_CLASS = `w-full ${INPUT_BASE}`;

interface FieldProps {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** A labelled form control with an optional hint and an error announced to screen readers. */
export function Field({ label, htmlFor, required, error, hint, className, children }: FieldProps) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1 block text-xs font-bold text-ink-soft">
        {label}{required && <span className="text-danger" aria-hidden="true"> *</span>}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="mt-1 text-[11.5px] text-danger">{error}</p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="mt-1 text-[11px] text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export const describedBy = (id: string, error?: string, hint?: ReactNode) => (error ? `${id}-error` : hint ? `${id}-hint` : undefined);

export function FormSection({ title, description, children, className }: { title: string; description?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-line bg-white p-6 shadow-card", className)}>
      <h2 className="text-[15px] font-extrabold text-navy">{title}</h2>
      {description && <p className="mt-0.5 text-xs text-ink-muted">{description}</p>}
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}
