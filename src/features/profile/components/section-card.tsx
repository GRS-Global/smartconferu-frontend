import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useModalFoot } from "@/components/ui/modal";
import { AuthMessage } from "@/components/ui/auth-message";
import type { SectionSave } from "../use-section-save";

interface SectionCardProps {
  id: string;
  title: string;
  description?: string;
  save: SectionSave;
  /** Disables Save while there is nothing to save or the form is invalid. */
  canSave: boolean;
  onSave: () => void;
  /** Hide Save (a card whose controls save immediately). */
  noSave?: boolean;
  /** Inside a dialog: no card chrome or title (the dialog has them) and Save sits in a footer row. */
  inDialog?: boolean;
  /** Inside a dialog: adds a Cancel button beside Save. */
  onCancel?: () => void;
  /** Inside a dialog the dialog's own subtitle usually says it; keep this card's description when it says more. */
  keepDescription?: boolean;
  /** Label of the Save button inside a dialog. */
  saveLabel?: string;
  children: ReactNode;
}

/** `formId`: the buttons are drawn in a window's footer band, outside the form, and point at it; they get the prototype's larger look. */
function SaveStatus({ save, canSave, onCancel, label = "Save", formId }: { save: SectionSave; canSave: boolean; onCancel?: () => void; label?: string; formId?: string }) {
  if (formId) {
    return (
      <>
        {save.saved && <span role="status" className="mr-auto inline-flex items-center gap-1 text-xs font-semibold text-success"><Check size={13} strokeWidth={3} aria-hidden="true" /> Saved</span>}
        {onCancel && <button type="button" onClick={onCancel} className="h-10 cursor-pointer rounded-lg px-4 text-sm font-semibold text-ink-soft transition-colors hover:bg-muted hover:text-navy">Cancel</button>}
        <button type="submit" form={formId} disabled={!canSave || save.busy} className="h-10 cursor-pointer rounded-lg bg-primary px-[22px] text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-ink-faint disabled:hover:bg-ink-faint">{save.busy ? "Saving…" : label}</button>
      </>
    );
  }
  return (
    <div className="flex items-center gap-2.5">
      {save.saved && <span role="status" className="inline-flex items-center gap-1 text-xs font-semibold text-success"><Check size={13} strokeWidth={3} aria-hidden="true" /> Saved</span>}
      {onCancel && <button type="button" onClick={onCancel} className="h-8 rounded-lg px-3.5 text-xs font-semibold text-ink-soft hover:bg-muted hover:text-navy">Cancel</button>}
      <button type="submit" disabled={!canSave || save.busy} className="h-8 rounded-lg bg-primary px-4 text-xs font-bold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50">
        {save.busy ? "Saving…" : label}
      </button>
    </div>
  );
}

/** One My Profile form: its own fields and its own Save, with loading, error and "Saved" feedback. */
export function SectionCard({ id, title, description, save, canSave, onSave, noSave, inDialog, onCancel, saveLabel, keepDescription, children }: SectionCardProps) {
  const submit = (e: React.FormEvent) => { e.preventDefault(); if (canSave && !save.busy) onSave(); };
  const foot = useModalFoot();
  if (inDialog) {
    return (
      <>
      <form id={`${id}-form`} noValidate onSubmit={submit} aria-labelledby={`${id}-title`}>
        <h2 id={`${id}-title`} className="sr-only">{title}</h2>
        {description && keepDescription && <p className="mb-3 text-xs text-ink-muted">{description}</p>}
        {save.error && <AuthMessage tone="error">{save.error}</AuthMessage>}
        <div className="space-y-3">{children}</div>
        {!noSave && !foot && <div className="mt-5 flex justify-end border-t border-muted pt-4"><SaveStatus save={save} canSave={canSave} onCancel={onCancel} label={saveLabel} /></div>}
      </form>
      {!noSave && foot && createPortal(<SaveStatus save={save} canSave={canSave} onCancel={onCancel} label={saveLabel} formId={`${id}-form`} />, foot)}
      </>
    );
  }
  return (
    <section aria-labelledby={`${id}-title`} className="rounded-2xl border border-line bg-white p-6 shadow-card">
      <form noValidate onSubmit={submit}>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id={`${id}-title`} className="text-[15px] font-extrabold text-navy">{title}</h2>
            {description && <p className="mt-0.5 text-xs text-ink-muted">{description}</p>}
          </div>
          {!noSave && <SaveStatus save={save} canSave={canSave} />}
        </div>
        {save.error && <AuthMessage tone="error">{save.error}</AuthMessage>}
        <div className="space-y-3">{children}</div>
      </form>
    </section>
  );
}
