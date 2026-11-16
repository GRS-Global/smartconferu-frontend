"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { isFieldAnswered, type ReviewSection } from "@/features/reviewer/form-schema";
import { FieldRow } from "@/features/reviewer/components/review-form-page";
import type { ReviewValues } from "@/types/reviewer";

/* The chair's two review dialogs on a paper's page: correcting a review the reviewer sent ("Edit review") and writing the chair's own
   review ("Review this paper"), both in the peer-review form every reviewer uses; and "Desk reject". */


function ReviewForm({ form, initial, confirm, onClose, onSave, busy, error }: { form: ReviewSection[]; initial: ReviewValues; confirm: string; onClose: () => void; onSave: (v: ReviewValues) => void; busy: boolean; error: string }) {
  const [values, setValues] = useState<ReviewValues>(initial);
  const missing = form.flatMap((s) => s.fields).filter((f) => f.required && !isFieldAnswered(values[f.id]));
  return (
    <>
      <div className="max-h-[60vh] divide-y divide-muted overflow-y-auto pr-1">
        {form.map((s) => (
          <section key={s.id}>
            <h3 className="pt-3 text-[11px] font-extrabold uppercase tracking-wider text-ink-faint">{s.name}</h3>
            {s.fields.map((f) => <FieldRow key={f.id} field={f} value={values[f.id]} disabled={busy} onChange={(v) => setValues((cur) => ({ ...cur, [f.id]: v }))} />)}
          </section>
        ))}
      </div>
      {error && <p role="alert" className="mt-3 text-sm font-semibold text-danger">{error}</p>}
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        {missing.length > 0 && <span className="mr-auto text-xs text-ink-muted">Still to fill in: {missing.map((f) => f.label).join(", ")}</span>}
        <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button disabled={busy || missing.length > 0} onClick={() => onSave(values)}>{busy ? "Saving…" : confirm}</Button>
      </div>
    </>
  );
}

export function ReviewDialog({ open, form, title, description, initial, confirm, onClose, onSave, busy, error }: { open: boolean; form: ReviewSection[]; title: string; description?: string; initial: ReviewValues; confirm: string; onClose: () => void; onSave: (v: ReviewValues) => void; busy: boolean; error: string }) {
  return (
    <Dialog open={open} onClose={onClose} title={title} description={description} size="xl">
      {open && <ReviewForm form={form} initial={initial} confirm={confirm} onClose={onClose} onSave={onSave} busy={busy} error={error} />}
    </Dialog>
  );
}

const DESK_REASONS = [
  "The paper is outside the scope of the conference tracks.",
  "The paper does not follow the submission template or page limit.",
  "The paper is not anonymised for double-blind review.",
  "The paper was already published or is under review elsewhere.",
];

export function DeskRejectDialog({ open, paperLabel, onClose, onConfirm, busy, error }: { open: boolean; paperLabel: string; onClose: () => void; onConfirm: (reason: string) => void; busy: boolean; error: string }) {
  const [reason, setReason] = useState(DESK_REASONS[0]);
  return (
    <Dialog open={open} onClose={onClose} title="Desk reject" description={`${paperLabel} · reject without review (scope or rules)`} size="md">
      {open && (
        <>
          <fieldset>
            <legend className="mb-2 text-xs font-bold text-navy">Reason shared with the authors</legend>
            <div className="space-y-2">
              {DESK_REASONS.map((r) => <label key={r} className="flex items-start gap-2 text-[13px] text-ink-soft"><input type="radio" name="desk-reason" checked={reason === r} onChange={() => setReason(r)} className="mt-0.5" /> {r}</label>)}
            </div>
          </fieldset>
          <textarea aria-label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={2000} className="mt-3 w-full rounded-xl border-[1.5px] border-line p-2.5 text-[13px] outline-none focus:border-primary" />
          <p className="mt-2 text-xs text-ink-faint">This records a Reject decision with the reason as the note. The authors are told when you press Notify authors.</p>
          {error && <p role="alert" className="mt-3 text-sm font-semibold text-danger">{error}</p>}
          <div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button><Button className="bg-danger hover:bg-danger" disabled={busy || !reason.trim()} onClick={() => onConfirm(reason.trim())}>{busy ? "Saving…" : "Desk reject paper"}</Button></div>
        </>
      )}
    </Dialog>
  );
}
