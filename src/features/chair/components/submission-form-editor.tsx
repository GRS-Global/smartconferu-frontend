"use client";

import { ArrowDown, ArrowUp, ClipboardList, Lock, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { INPUT_CLASS } from "@/components/ui/field";
import type { SubmissionExtra } from "@/types/author-submission";

/* The submission form's editor (Peer Review's twin, for authors): the form's own fields — the paper file, title, abstract, keywords,
   authors, submission type, track and the two declarations — are fixed (they are what the database, the screening and the emails
   are built on); the chair adds extra questions after them: short text, long text, a choice, or a consent tick, each optional or
   required. Answers are kept with the paper (`details.responses`). Saved in `conference_forms` (kind \`submission\`, migration 0028). */

const CARD = { border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" } as const;
const TYPES: Array<[SubmissionExtra["type"], string]> = [["short_text", "Short text"], ["long_text", "Long text"], ["single_choice", "Single choice"], ["consent", "Consent tick"]];
const FIXED = ["Paper file", "Title", "Abstract", "Keywords", "Author names, emails, affiliations, country", "Submission type", "Track", "Originality declaration", "Submission terms"];
let uid = 0;
interface Draft extends SubmissionExtra { key: number; optionsText: string }
const toDraft = (l: SubmissionExtra[]): Draft[] => l.map((f) => ({ ...f, key: ++uid, optionsText: (f.options ?? []).join(", ") }));

export function SubmissionFormEditor({ initial, stored, onSave, busy }: { initial: SubmissionExtra[]; stored: boolean; onSave: (l: SubmissionExtra[]) => void; busy: boolean }) {
  const [rows, setRows] = useState(() => toDraft(initial));
  const patch = (k: number, p: Partial<Draft>) => setRows((l) => l.map((r) => (r.key === k ? { ...r, ...p } : r)));
  const move = (i: number, d: -1 | 1) => setRows((l) => { const n = [...l]; [n[i], n[i + d]] = [n[i + d], n[i]]; return n; });
  const optsOf = (r: Draft) => r.optionsText.split(",").map((o) => o.trim()).filter(Boolean);
  const serialize = (l: Draft[]): SubmissionExtra[] => l.map(({ key, optionsText, ...f }) => { void key; return { ...f, label: f.label.trim(), ...(f.type === "single_choice" ? { options: optionsText.split(",").map((o) => o.trim()).filter(Boolean) } : { options: undefined }) }; });
  // Saving is offered only when the questions differ from what was loaded (random keys are not part of the comparison).
  const [start] = useState(() => JSON.stringify(serialize(rows)));
  const changed = JSON.stringify(serialize(rows)) !== start;
  const bad = rows.some((r) => !r.label.trim() || (r.type === "single_choice" && optsOf(r).length < 2));
  const iconBtn = "flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-primary-soft hover:text-primary disabled:opacity-30";
  return (
    <section style={CARD} className="rounded-2xl bg-white p-6">
      <h2 className="flex items-center gap-2 text-base font-extrabold text-navy"><ClipboardList size={16} aria-hidden="true" className="text-primary" /> Submission form</h2>
      <p className="mb-4 mt-0.5 text-xs text-ink-faint">What authors fill in when they submit. The fields below are fixed; add your own questions after them.</p>
      <div className="mb-4 flex flex-wrap gap-1.5">{FIXED.map((f) => <span key={f} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-ink-soft"><Lock size={10} aria-hidden="true" /> {f}</span>)}</div>
      <h3 className="mb-2 text-sm font-extrabold text-navy">Your extra questions</h3>
      {rows.length === 0 && <p className="rounded-xl border-[1.5px] border-dashed border-line py-6 text-center text-sm text-ink-muted">No extra questions.</p>}
      <ul className="space-y-3">
        {rows.map((r, i) => (
          <li key={r.key} className="grid gap-2 rounded-lg bg-canvas p-3 sm:grid-cols-[minmax(0,1fr)_9rem_auto]">
            <div className="min-w-0">
              <input aria-label={`Question ${i + 1}`} value={r.label} maxLength={300} placeholder="Question" onChange={(e) => patch(r.key, { label: e.target.value })} className={INPUT_CLASS} />
              {r.type !== "consent" && <input aria-label={`Hint for question ${i + 1}`} value={r.description ?? ""} maxLength={300} placeholder="Hint (optional)" onChange={(e) => patch(r.key, { description: e.target.value })} className={`${INPUT_CLASS} mt-2`} />}
              {r.type === "single_choice" && <input aria-label={`Options for question ${i + 1}`} value={r.optionsText} placeholder="Options, separated by commas" onChange={(e) => patch(r.key, { optionsText: e.target.value })} className={`${INPUT_CLASS} mt-2`} />}
            </div>
            <div>
              <select aria-label={`Type of question ${i + 1}`} value={r.type} onChange={(e) => patch(r.key, { type: e.target.value as SubmissionExtra["type"] })} className={INPUT_CLASS}>{TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
              <label className="mt-2 flex items-center gap-2 text-xs font-semibold text-ink-soft"><input type="checkbox" checked={r.required} onChange={(e) => patch(r.key, { required: e.target.checked })} /> Required</label>
            </div>
            <div className="flex items-start gap-1">
              <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move question ${i + 1} up`} className={iconBtn}><ArrowUp size={14} aria-hidden="true" /></button>
              <button type="button" disabled={i === rows.length - 1} onClick={() => move(i, 1)} aria-label={`Move question ${i + 1} down`} className={iconBtn}><ArrowDown size={14} aria-hidden="true" /></button>
              <button type="button" onClick={() => setRows((l) => l.filter((x) => x.key !== r.key))} aria-label={`Delete question ${i + 1}`} className={`${iconBtn} hover:bg-danger-soft hover:text-danger-ink`}><Trash2 size={14} aria-hidden="true" /></button>
            </div>
          </li>
        ))}
      </ul>
      {bad && <p role="alert" className="mt-3 text-xs font-medium text-danger-ink">Every question needs a name, and a choice needs at least two options.</p>}
      <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
        {!stored && <span className="mr-auto text-xs font-semibold text-warning-ink">Run migration 0028_conference_settings.sql to save the form.</span>}
        {rows.length > 0 && <Button variant="ghost" onClick={() => setRows([])}><RotateCcw size={14} aria-hidden="true" /> Remove all</Button>}
        <Button variant="outline" disabled={rows.length >= 30} onClick={() => setRows((l) => [...l, { key: ++uid, id: `q-${Date.now().toString(36)}${uid}`, type: "short_text", label: "", required: false, optionsText: "" }])}><Plus size={14} aria-hidden="true" /> Add question</Button>
        <Button disabled={busy || !stored || bad || !changed} title={changed ? undefined : "No changes to save"} onClick={() => onSave(serialize(rows))}>{busy ? "Saving…" : "Save form"}</Button>
      </div>
    </section>
  );
}
