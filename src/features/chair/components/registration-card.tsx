"use client";

import { Ticket } from "lucide-react";
import { useId, useState } from "react";
import { ATTENDANCE_LABELS, PAYMENT_LABELS, type AttendanceMode, type ChairPaper, type PaperRegistration, type PaymentStatus } from "@/types/chair";

/* The chair's "Registration & attendance" card on an accepted paper's page: payment (Not paid / Paid / Waived), how the paper is presented
   (Physical / Virtual / not known yet), the presenting author and a private note, saved by hand with Save (no email goes to the authors).
   Until the conference has a registration module, this is where the chair keeps track of who paid and who comes. */

const CARD = { border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" } as const;
const PAYMENTS: PaymentStatus[] = ["not_paid", "paid", "waived"];
const PAYMENT_TONE: Record<PaymentStatus, string> = { not_paid: "var(--warning-ink)", paid: "var(--success-ink)", waived: "#0369A1" };
const ATTENDANCE: Array<AttendanceMode | null> = ["physical", "virtual", null];
const LABEL = "mb-1.5 block text-[11px] font-extrabold uppercase tracking-wider text-ink-faint";

export interface RegistrationValues { payment: PaymentStatus; attendance: AttendanceMode | null; presenterEmail: string | null; note: string | null }

const valuesOf = (r: PaperRegistration): RegistrationValues => ({ payment: r.payment, attendance: r.attendance, presenterEmail: r.presenterEmail, note: r.note });
const same = (a: RegistrationValues, b: RegistrationValues) =>
  a.payment === b.payment && a.attendance === b.attendance && (a.presenterEmail ?? "").toLowerCase() === (b.presenterEmail ?? "").toLowerCase() && (a.note ?? "").trim() === (b.note ?? "").trim();

function Segmented<T extends string | null>({ label, options, value, onChange, labelOf, toneOf, disabled }: { label: string; options: T[]; value: T; onChange: (v: T) => void; labelOf: (v: T) => string; toneOf?: (v: T) => string; disabled: boolean }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-lg border border-line bg-canvas p-0.5">
      {options.map((o) => {
        const on = o === value;
        const tone = toneOf?.(o) ?? "var(--primary)";
        return (
          <button key={o ?? "none"} type="button" role="radio" aria-checked={on} disabled={disabled} onClick={() => onChange(o)}
            style={on ? { background: "#FFFFFF", color: tone, boxShadow: "0 1px 2px rgba(15,23,42,0.08)" } : undefined}
            className={`flex-1 rounded-md px-2 py-1.5 text-xs font-bold transition-colors disabled:opacity-60 ${on ? "" : "text-ink-muted hover:text-ink"}`}>
            {labelOf(o)}
          </button>
        );
      })}
    </div>
  );
}

/** Give it `key={paper.registration?.updatedAt}` so a reload after saving starts the form again from what is stored. */
export function RegistrationCard({ paper, busy, onSave }: { paper: ChairPaper; busy: boolean; onSave: (values: RegistrationValues) => Promise<boolean> }) {
  const saved = paper.registration;
  const [form, setForm] = useState<RegistrationValues | null>(saved ? valuesOf(saved) : null);
  const ids = { presenter: useId(), note: useId() };
  if (!saved || !form) return null;

  const dirty = !same(form, valuesOf(saved));
  const set = <K extends keyof RegistrationValues>(key: K, value: RegistrationValues[K]) => setForm((f) => (f ? { ...f, [key]: value } : f));
  const presenterGone = Boolean(form.presenterEmail) && !paper.authors.some((a) => a.email.toLowerCase() === form.presenterEmail!.toLowerCase());
  const updated = saved.updatedAt ? new Date(saved.updatedAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "";

  return (
    <section style={CARD} className="rounded-2xl bg-white p-5" aria-labelledby="registration-title">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 id="registration-title" className="flex items-center gap-2 text-[15px] font-extrabold text-navy"><Ticket size={16} aria-hidden="true" className="text-primary" /> Registration &amp; attendance</h2>
        <span style={{ color: PAYMENT_TONE[saved.payment], background: `color-mix(in srgb, ${PAYMENT_TONE[saved.payment]} 7%, white)` }} className="rounded-full px-2.5 py-0.5 text-[11px] font-bold">{PAYMENT_LABELS[saved.payment]}</span>
      </div>
      <p className="mb-4 text-[11.5px] leading-relaxed text-ink-muted">Recorded by you. Authors see the payment and attendance on their paper; the note stays private. No email is sent.</p>

      <div className="space-y-4">
        <div>
          <span className={LABEL}>Payment</span>
          <Segmented label="Payment" options={PAYMENTS} value={form.payment} onChange={(v) => set("payment", v)} labelOf={(v) => PAYMENT_LABELS[v]} toneOf={(v) => PAYMENT_TONE[v]} disabled={busy} />
        </div>
        <div>
          <span className={LABEL}>Attending</span>
          <Segmented label="Attending" options={ATTENDANCE} value={form.attendance} onChange={(v) => set("attendance", v)} labelOf={(v) => (v ? ATTENDANCE_LABELS[v] : "Not known")} disabled={busy} />
        </div>
        <div>
          <label htmlFor={ids.presenter} className={LABEL}>Presenting author</label>
          <select id={ids.presenter} value={form.presenterEmail?.toLowerCase() ?? ""} disabled={busy} onChange={(e) => set("presenterEmail", e.target.value || null)} className="h-9 w-full cursor-pointer rounded-lg border-[1.5px] border-line bg-white px-2 text-sm text-ink outline-none focus:border-primary disabled:opacity-60">
            <option value="">Not chosen yet</option>
            {paper.authors.filter((a) => a.email).map((a) => <option key={a.email} value={a.email.toLowerCase()}>{a.name}{a.corresponding ? " (corresponding)" : ""}</option>)}
            {presenterGone && <option value={form.presenterEmail!.toLowerCase()}>{form.presenterEmail} (no longer an author)</option>}
          </select>
          {presenterGone && <p className="mt-1 text-[11px] font-semibold text-warning-ink">This person is no longer on the author list. Pick another presenter.</p>}
        </div>
        <div>
          <label htmlFor={ids.note} className={LABEL}>Note <span className="font-semibold normal-case tracking-normal">(private)</span></label>
          <textarea id={ids.note} value={form.note ?? ""} maxLength={1000} rows={2} disabled={busy} onChange={(e) => set("note", e.target.value)} placeholder="Receipt number, amount, bank reference…" className="w-full resize-y rounded-lg border-[1.5px] border-line bg-white px-2.5 py-2 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-primary disabled:opacity-60" />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-[11px] text-ink-faint">{updated ? `Last saved ${updated}` : "Nothing recorded yet"}</span>
        <div className="flex items-center gap-2">
          {dirty && <button type="button" disabled={busy} onClick={() => setForm(valuesOf(saved))} className="text-xs font-semibold text-ink-muted hover:underline disabled:opacity-60">Undo</button>}
          <button type="button" disabled={busy || !dirty || presenterGone} onClick={() => { void onSave({ ...form, note: form.note?.trim() ? form.note.trim() : null }); }} className="h-9 rounded-lg bg-primary px-4 text-xs font-bold text-white transition-colors hover:bg-primary-hover disabled:opacity-50">{busy ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </section>
  );
}
