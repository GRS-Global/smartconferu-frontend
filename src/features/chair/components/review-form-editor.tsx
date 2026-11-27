"use client";

import { ArrowDown, ArrowUp, Check, ClipboardList, Eye, FileText, FileUp, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import type { InstructionsPdf } from "@/types/chair";
import { RichTextEditor, richTextToHtml } from "@/components/ui/rich-text";
import { HelpLabel } from "./setting-label";
import { InstructionsPreview, standardInstructionsHtml } from "./review-form-preview";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { INPUT_CLASS } from "@/components/ui/field";
import { PROTECTED_FIELD_IDS, type FieldType, type ReviewField, type ReviewSection } from "@/features/reviewer/form-schema";

/* The editors on Conference Settings › Review for what reviewers see: the instructions they read before they start (plain text, a blank
   line starts a paragraph) and the review form itself — sections with long-text, score and single-choice fields. The overall score, the
   reviewer's confidence and the two comment fields stay (the pages that average, filter and send comments read them), but can be reworded.
   Both are saved in migration 0028's tables; nothing here changes reviews already written. */

const CARD = { border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" } as const;
const TYPES: Array<[FieldType, string]> = [["long_text", "Long text"], ["score", "Score"], ["single_choice", "Single choice"]];
let uid = 0;

function Card({ icon: Icon, title, desc, children, footer }: { icon: typeof FileText; title: string; desc: string; children: ReactNode; footer: ReactNode }) {
  return (
    <section style={CARD} className="rounded-2xl bg-white p-6">
      <h2 className="flex items-center gap-2 text-base font-extrabold text-navy"><Icon size={16} aria-hidden="true" className="text-primary" /> {title}</h2>
      <p className="mb-4 mt-0.5 text-xs text-ink-faint">{desc}</p>
      {children}
      <div className="mt-5 flex flex-wrap items-center justify-end gap-3">{footer}</div>
    </section>
  );
}

export function InstructionsEditor({ initial, stored, onSave, busy, mode: savedMode, pdf: savedPdf, onMode, onPdf }: { initial: string; stored: boolean; onSave: (text: string) => void; busy: boolean; mode: "html" | "pdf"; pdf: InstructionsPdf | null; onMode: (mode: "html" | "pdf") => void; onPdf: (file: File) => Promise<InstructionsPdf | undefined> }) {
  // Like the prototype the editor starts with the standard instructions; what is saved is what reviewers read.
  const [html, setHtml] = useState(initial.trim() ? richTextToHtml(initial) : standardInstructionsHtml());
  const [saved, setSaved] = useState(false);
  const [mode, setMode] = useState(savedMode);
  const [pdf, setPdf] = useState(savedPdf);
  const [drag, setDrag] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const [start] = useState(() => JSON.stringify([html, mode, pdf]));
  const changed = JSON.stringify([html, mode, pdf]) !== start;
  const save = () => { onSave(html); setSaved(true); setTimeout(() => setSaved(false), 2000); };
  const pick = (m: "html" | "pdf") => { if (m === mode) return; setMode(m); onMode(m); };
  const choose = async (file: File | undefined) => {
    if (!file) return;
    if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) { setPdfError("Choose a PDF file."); return; }
    if (file.size > 5 * 1024 * 1024) { setPdfError("The PDF is over 5 MB. Choose a smaller file."); return; }
    setPdfError(""); setPdfBusy(true);
    const done = await onPdf(file);
    setPdfBusy(false);
    if (done) setPdf(done);
  };
  return (
    <section style={CARD} className="rounded-2xl bg-white p-6">
      <div className="mb-4 flex items-center justify-between gap-3"><div className="flex items-center gap-2.5"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary"><FileText size={15} aria-hidden="true" /></span><h3 className="text-sm font-bold text-navy"><HelpLabel help="reviewerInstructions">Reviewer instructions</HelpLabel></h3></div></div>
      <p className="-mt-1 mb-4 text-xs text-ink-faint">Shown at the top of every review form, before reviewers start. Write them here, or attach a PDF.</p>
      <div role="tablist" aria-label="How the instructions are given" className="mb-4 inline-flex items-center gap-1 rounded-xl bg-muted p-1">
        {([["html", "Write instructions", Pencil], ["pdf", "Upload PDF", FileUp]] as const).map(([k, label, Icon]) => (
          <button key={k} type="button" role="tab" aria-selected={mode === k} onClick={() => pick(k)} style={{ boxShadow: mode === k ? "0 1px 3px rgba(15,23,42,0.10)" : "none" }} className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${mode === k ? "bg-white text-navy" : "bg-transparent text-ink-muted"}`}><Icon size={13} aria-hidden="true" /> {label}</button>
        ))}
      </div>
      {mode === "pdf" ? (
        <>
          <label onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); void choose(e.dataTransfer.files?.[0]); }} style={{ border: `1.5px dashed ${drag ? "var(--primary)" : "var(--border-strong)"}`, background: drag ? "var(--primary-soft)" : "transparent" }} className="flex w-fit cursor-pointer items-center gap-2 rounded-lg px-3.5 py-2.5 transition-colors">
            <FileUp size={15} aria-hidden="true" className="text-primary" />
            <span className={`text-xs font-medium ${pdf ? "text-ink" : "text-ink-faint"}`}>{pdfBusy ? "Uploading…" : pdf?.name || "Choose a PDF"}</span>
            <span className="hidden text-[11px] text-ink-faint sm:inline">· or drag &amp; drop</span>
            <input type="file" accept="application/pdf,.pdf" className="hidden" aria-label="Choose a PDF" onChange={(e) => { void choose(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          {pdfError && <p role="alert" className="mt-2 text-xs font-semibold text-danger-ink">{pdfError}</p>}
        </>
      ) : (
        <>
          <RichTextEditor value={html} onChange={setHtml} label="Reviewer instructions" placeholder="What reviewers should focus on, scoring guidance, conflicts of interest, deadlines…" maxHeight={360} />
          <div className="mt-3 flex items-center justify-end gap-3">
            {!stored && <span className="mr-auto text-xs font-semibold text-warning-ink">Run migration 0028_conference_settings.sql to save this.</span>}
            {saved && !busy && <span className="flex items-center gap-1 text-xs font-semibold text-success-ink"><Check size={13} aria-hidden="true" /> Saved</span>}
            <button type="button" onClick={save} disabled={busy || !changed} title={changed ? undefined : "No changes to save"} className="h-10 cursor-pointer rounded-xl bg-primary px-5 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-60">{busy ? "Saving…" : "Save instructions"}</button>
          </div>
        </>
      )}
      {(mode === "html" || pdf) && (
        <div className="mt-5 border-t border-muted pt-4">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-faint"><Eye size={12} aria-hidden="true" /> How reviewers see it</div>
          <InstructionsPreview key={`${mode}-${pdf?.url ?? ""}`} text={initial} mode={mode} pdf={pdf} />
        </div>
      )}
    </section>
  );
}

interface FieldDraft extends ReviewField { key: number; optionsText: string }
interface SectionDraft { key: number; id: string; name: string; fields: FieldDraft[] }
const toDraft = (sections: ReviewSection[]): SectionDraft[] => sections.map((s) => ({ key: ++uid, id: s.id, name: s.name, fields: s.fields.map((f) => ({ ...f, key: ++uid, optionsText: (f.options ?? []).join(", ") })) }));

const serialize = (secs: SectionDraft[]): ReviewSection[] => secs.map((s) => ({ id: s.id, name: s.name.trim(), fields: s.fields.map(({ key, optionsText, ...f }) => { void key; return { ...f, label: f.label.trim(), ...(f.type === "single_choice" ? { options: optionsText.split(",").map((o) => o.trim()).filter(Boolean) } : { options: undefined }), ...(f.type === "score" ? { max: f.max ?? 5 } : { max: undefined }) }; }) }));

export function FormEditor({ initial, custom, stored, onSave, onReset, busy }: { initial: ReviewSection[]; custom: boolean; stored: boolean; onSave: (s: ReviewSection[]) => void; onReset: () => void; busy: boolean }) {
  const [secs, setSecs] = useState(() => toDraft(initial));
  const patchField = (sk: number, fk: number, patch: Partial<FieldDraft>) => setSecs((l) => l.map((s) => (s.key === sk ? { ...s, fields: s.fields.map((f) => (f.key === fk ? { ...f, ...patch } : f)) } : s)));
  const moveField = (sk: number, i: number, d: -1 | 1) => setSecs((l) => l.map((s) => { if (s.key !== sk) return s; const fs = [...s.fields]; [fs[i], fs[i + d]] = [fs[i + d], fs[i]]; return { ...s, fields: fs }; }));
  const toSections = (): ReviewSection[] => serialize(secs);
  // Saving is offered only when the form differs from what was loaded (random keys are not part of the comparison).
  const [start] = useState(() => JSON.stringify(serialize(secs)));
  const changed = JSON.stringify(toSections()) !== start;
  const flat = secs.flatMap((s) => s.fields);
  const problems = secs.some((s) => !s.name.trim()) || flat.some((f) => !f.label.trim() || (f.type === "single_choice" && f.optionsText.split(",").map((o) => o.trim()).filter(Boolean).length < 2)) || secs.length === 0;
  const iconBtn = "flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-primary-soft hover:text-primary disabled:opacity-30";
  return (
    <Card icon={ClipboardList} title="Review form" desc={custom ? "The form reviewers fill in for this conference." : "The standard form. Change it and it becomes this conference's own."}
      footer={<>{!stored && <span className="mr-auto text-xs font-semibold text-warning-ink">Run migration 0028_conference_settings.sql to save the form.</span>}{custom && <Button variant="ghost" disabled={busy || !stored} onClick={onReset}><RotateCcw size={14} aria-hidden="true" /> Use the standard form</Button>}<Button disabled={busy || !stored || problems || !changed} title={changed ? undefined : "No changes to save"} onClick={() => onSave(toSections())}>{busy ? "Saving…" : "Save form"}</Button></>}>
      <div className="space-y-5">
        {secs.map((s, si) => (
          <div key={s.key} className="rounded-xl border border-line p-4">
            <div className="mb-3 flex items-center gap-2">
              <input aria-label={`Section ${si + 1} name`} value={s.name} maxLength={80} onChange={(e) => setSecs((l) => l.map((x) => (x.key === s.key ? { ...x, name: e.target.value } : x)))} className={`${INPUT_CLASS} max-w-xs font-bold`} />
              <button type="button" disabled={s.fields.some((f) => PROTECTED_FIELD_IDS.includes(f.id)) || secs.length === 1} onClick={() => setSecs((l) => l.filter((x) => x.key !== s.key))} aria-label={`Delete section ${s.name || si + 1}`} title={s.fields.some((f) => PROTECTED_FIELD_IDS.includes(f.id)) ? "This section holds fields that stay" : undefined} className={`${iconBtn} hover:bg-danger-soft hover:text-danger-ink`}><Trash2 size={14} aria-hidden="true" /></button>
            </div>
            <ul className="space-y-3">
              {s.fields.map((f, fi) => {
                const locked = PROTECTED_FIELD_IDS.includes(f.id);
                return (
                  <li key={f.key} className="grid gap-2 rounded-lg bg-canvas p-3 sm:grid-cols-[minmax(0,1fr)_9rem_auto]">
                    <div className="min-w-0">
                      <label className="sr-only" htmlFor={`ff-${f.key}`}>Field name</label>
                      <input id={`ff-${f.key}`} value={f.label} maxLength={200} placeholder="Field name" onChange={(e) => patchField(s.key, f.key, { label: e.target.value })} className={INPUT_CLASS} />
                      <input aria-label={`Hint for ${f.label || "field"}`} value={f.description ?? ""} maxLength={300} placeholder="Hint (optional)" onChange={(e) => patchField(s.key, f.key, { description: e.target.value })} className={`${INPUT_CLASS} mt-2`} />
                      {f.type === "single_choice" && <input aria-label={`Options for ${f.label || "field"}`} value={f.optionsText} placeholder="Options, separated by commas" onChange={(e) => patchField(s.key, f.key, { optionsText: e.target.value })} className={`${INPUT_CLASS} mt-2`} />}
                      {f.type === "score" && <label className="mt-2 flex items-center gap-2 text-xs font-semibold text-ink-soft">Out of <select aria-label={`Scale for ${f.label || "field"}`} value={f.max ?? 5} disabled={f.id === "f-score"} onChange={(e) => patchField(s.key, f.key, { max: Number(e.target.value) })} className="rounded-lg border border-line bg-white px-2 py-1">{[3, 4, 5, 6, 7, 8, 9, 10].map((n) => <option key={n} value={n}>{n}</option>)}</select>{f.id === "f-score" && <span className="font-normal text-ink-faint">(the overall score is always out of 5)</span>}</label>}
                    </div>
                    <div>
                      <select aria-label={`Type of ${f.label || "field"}`} value={f.type} disabled={locked} onChange={(e) => patchField(s.key, f.key, { type: e.target.value as FieldType })} className={INPUT_CLASS}>{TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                      <label className="mt-2 flex items-center gap-2 text-xs font-semibold text-ink-soft"><input type="checkbox" checked={f.required} disabled={f.id === "f-score"} onChange={(e) => patchField(s.key, f.key, { required: e.target.checked })} /> Required</label>
                    </div>
                    <div className="flex items-start gap-1">
                      <button type="button" disabled={fi === 0} onClick={() => moveField(s.key, fi, -1)} aria-label={`Move ${f.label || "field"} up`} className={iconBtn}><ArrowUp size={14} aria-hidden="true" /></button>
                      <button type="button" disabled={fi === s.fields.length - 1} onClick={() => moveField(s.key, fi, 1)} aria-label={`Move ${f.label || "field"} down`} className={iconBtn}><ArrowDown size={14} aria-hidden="true" /></button>
                      <button type="button" disabled={locked} onClick={() => setSecs((l) => l.map((x) => (x.key === s.key ? { ...x, fields: x.fields.filter((y) => y.key !== f.key) } : x)))} aria-label={`Delete ${f.label || "field"}`} title={locked ? "This field stays" : undefined} className={`${iconBtn} hover:bg-danger-soft hover:text-danger-ink`}><Trash2 size={14} aria-hidden="true" /></button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <button type="button" onClick={() => setSecs((l) => l.map((x) => (x.key === s.key ? { ...x, fields: [...x.fields, { key: ++uid, id: `f-${Date.now().toString(36)}${uid}`, type: "score" as FieldType, label: "", required: false, max: 5, optionsText: "" }] } : x)))} className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"><Plus size={13} aria-hidden="true" /> Add field</button>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => setSecs((l) => [...l, { key: ++uid, id: `s-${Date.now().toString(36)}`, name: "", fields: [] }])} className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline"><Plus size={14} aria-hidden="true" /> Add section</button>
      {problems && <p role="alert" className="mt-3 text-xs font-medium text-danger-ink">Every section and field needs a name, and a single choice needs at least two options.</p>}
    </Card>
  );
}
