"use client";

import { ArrowDown, ArrowUp, Check, Copy, Eye, GripVertical, Lock, Pencil, Plus, Star, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { INPUT_CLASS } from "@/components/ui/field";
import { Spinner } from "@/components/ui/load-more";
import { PROTECTED_FIELD_IDS, type FieldType, type ReviewField, type ReviewSection } from "@/features/reviewer/form-schema";
import { InstructionsPreview } from "./review-form-preview";

/* The review form edited where it sits (the prototype's InlineFormEditor): the form as the reviewer sees it, and on hover each field offers edit (label, hint,
   required, type, scale, options), duplicate, move and delete; a thin "insert field here" opens between fields; sections can be renamed, moved, added and
   deleted. Every change is saved on its own after a short pause (Saving… / Saved) and a delete can be undone for a few seconds. The overall score, the
   reviewer's confidence and the two comment fields stay (the pages that average, filter and send comments read them) but can be reworded. "Cancel" puts
   the form back as it was when the editor opened. */

const CARD = { border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" } as const;
const TYPES: Array<[FieldType, string]> = [["long_text", "Long text"], ["score", "Score"], ["single_choice", "Single choice"]];
const SAVE_MS = 800;
let uid = 0;
const newId = (p: string) => `${p}-${Date.now().toString(36)}${(uid += 1)}`;
const locked = (f: ReviewField) => PROTECTED_FIELD_IDS.includes(f.id);
const problemOf = (s: ReviewSection[]): string => {
  if (s.length === 0) return "The form needs at least one section.";
  if (s.some((x) => !x.name.trim())) return "Every section needs a name.";
  const f = s.flatMap((x) => x.fields);
  if (f.some((x) => !x.label.trim())) return "Every field needs a name.";
  if (f.some((x) => x.type === "single_choice" && (x.options ?? []).map((o) => o.trim()).filter(Boolean).length < 2)) return "A single choice needs at least two options.";
  return "";
};
const clean = (s: ReviewSection[]): ReviewSection[] => s.map((x) => ({ ...x, name: x.name.trim(), fields: x.fields.map((f) => ({ ...f, label: f.label.trim(), options: f.type === "single_choice" ? (f.options ?? []).map((o) => o.trim()).filter(Boolean) : undefined, max: f.type === "score" ? (f.max ?? 5) : undefined })) }));

function Hover({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} className={`flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-ink-muted hover:bg-white disabled:cursor-not-allowed disabled:opacity-30 ${danger ? "hover:text-danger" : "hover:text-primary"}`}>{children}</button>;
}

/** What a field looks like to the reviewer (not interactive here). */
function Sample({ f }: { f: ReviewField }) {
  if (f.type === "score") return <div className="flex items-center gap-0.5" aria-hidden="true">{Array.from({ length: f.max ?? 5 }, (_, i) => <Star key={i} size={18} strokeWidth={1.8} className="text-line-strong" />)}<span className="ml-2 text-xs text-ink-faint">/{f.max ?? 5}</span></div>;
  if (f.type === "single_choice") return <div className="grid gap-2 sm:grid-cols-3" aria-hidden="true">{(f.options ?? []).map((o) => <span key={o} className="rounded-lg border border-line px-3 py-2 text-center text-sm font-semibold text-ink-soft">{o || "—"}</span>)}</div>;
  return <div aria-hidden="true" className="h-16 rounded-xl border border-line bg-canvas" />;
}

function FieldEditor({ f, onChange }: { f: ReviewField; onChange: (patch: Partial<ReviewField>) => void }) {
  const lock = locked(f);
  return (
    <div className="mt-3 space-y-3 rounded-xl border border-[var(--primary-soft-border)] bg-primary-soft/40 p-3.5">
      <div><label className="mb-1 block text-xs font-bold text-ink-soft" htmlFor={`fb-l-${f.id}`}>Field name</label><input id={`fb-l-${f.id}`} autoFocus value={f.label} maxLength={200} onChange={(e) => onChange({ label: e.target.value })} className={INPUT_CLASS} /></div>
      <div><label className="mb-1 block text-xs font-bold text-ink-soft" htmlFor={`fb-d-${f.id}`}>Hint <span className="font-normal text-ink-faint">(optional)</span></label><input id={`fb-d-${f.id}`} value={f.description ?? ""} maxLength={300} onChange={(e) => onChange({ description: e.target.value })} className={INPUT_CLASS} /></div>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-xs font-semibold text-ink-soft"><input type="checkbox" checked={f.required} disabled={f.id === "f-score"} onChange={(e) => onChange({ required: e.target.checked })} className="accent-primary" /> Required</label>
        <label className="flex items-center gap-2 text-xs font-semibold text-ink-soft">Type
          <select aria-label="Type" value={f.type} disabled={lock} onChange={(e) => onChange({ type: e.target.value as FieldType, ...(e.target.value === "single_choice" && !(f.options ?? []).length ? { options: ["Option A", "Option B"] } : {}), ...(e.target.value === "score" ? { max: f.max ?? 5 } : {}) })} className="rounded-lg border border-line bg-white px-2 py-1">{TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          {lock && <span className="inline-flex items-center gap-1 font-normal text-ink-faint"><Lock size={11} aria-hidden="true" /> this field stays</span>}
        </label>
        {f.type === "score" && <label className="flex items-center gap-2 text-xs font-semibold text-ink-soft">Out of <select aria-label="Scale" value={f.max ?? 5} disabled={f.id === "f-score"} onChange={(e) => onChange({ max: Number(e.target.value) })} className="rounded-lg border border-line bg-white px-2 py-1">{[3, 4, 5, 6, 7, 8, 9, 10].map((n) => <option key={n} value={n}>{n}</option>)}</select>{f.id === "f-score" && <span className="font-normal text-ink-faint">(the overall score is always out of 5)</span>}</label>}
      </div>
      {f.type === "single_choice" && (
        <div>
          <div className="mb-1 text-xs font-bold text-ink-soft">Options</div>
          <ul className="space-y-1.5">
            {(f.options ?? []).map((o, i) => (
              <li key={i} className="flex items-center gap-1.5">
                <input aria-label={`Option ${i + 1}`} value={o} maxLength={100} onChange={(e) => onChange({ options: (f.options ?? []).map((x, j) => (j === i ? e.target.value : x)) })} className={INPUT_CLASS} />
                <button type="button" aria-label={`Remove option ${i + 1}`} disabled={(f.options ?? []).length <= 2} onClick={() => onChange({ options: (f.options ?? []).filter((_, j) => j !== i) })} className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-ink-muted hover:bg-white hover:text-danger disabled:opacity-30"><X size={14} aria-hidden="true" /></button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => onChange({ options: [...(f.options ?? []), `Option ${(f.options ?? []).length + 1}`] })} className="mt-2 inline-flex cursor-pointer items-center gap-1 text-xs font-bold text-primary hover:underline"><Plus size={12} aria-hidden="true" /> Add option</button>
        </div>
      )}
    </div>
  );
}

function Inserter({ onPick }: { onPick: (t: FieldType) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <div className={`${open ? "" : "opacity-0 focus-within:opacity-100 hover:opacity-100"} flex items-center gap-2 py-1 transition-opacity`}>
        <span className="h-px flex-1 bg-line" aria-hidden="true" />
        <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex cursor-pointer items-center gap-1 rounded-full border border-[var(--primary-soft-border)] bg-primary-soft px-2.5 py-1 text-[11px] font-bold text-primary hover:bg-white"><Plus size={11} aria-hidden="true" /> insert field here</button>
        <span className="h-px flex-1 bg-line" aria-hidden="true" />
      </div>
      {open && (
        <div role="menu" style={{ border: "1px solid var(--border)", boxShadow: "0 12px 28px rgba(11,16,32,0.12)" }} className="absolute left-1/2 top-8 z-20 w-44 -translate-x-1/2 rounded-xl bg-white p-1.5">
          {TYPES.map(([k, l]) => <button key={k} type="button" role="menuitem" onClick={() => { setOpen(false); onPick(k); }} className="block w-full cursor-pointer rounded-lg px-3 py-2 text-left text-sm font-semibold text-ink hover:bg-canvas">{l}</button>)}
        </div>
      )}
    </div>
  );
}

export function ReviewFormBuilder({ initial, acronym, instructions, hiddenFields, custom, onSave, onReset, onDone }: { initial: ReviewSection[]; acronym: string; instructions: string; hiddenFields: string[]; custom: boolean; onSave: (s: ReviewSection[]) => Promise<void>; onReset: () => Promise<void>; onDone: () => void }) {
  const [secs, setSecs] = useState<ReviewSection[]>(initial);
  const [open, setOpen] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [state, setState] = useState<"" | "saving" | "saved" | "failed">("");
  const [failure, setFailure] = useState("");
  const [undo, setUndo] = useState<{ label: string; sections: ReviewSection[] } | null>(null);
  const snapshot = useRef(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(initial);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); if (undoTimer.current) clearTimeout(undoTimer.current); }, []);

  const persist = (next: ReviewSection[]) => {
    latest.current = next;
    if (timer.current) clearTimeout(timer.current);
    if (problemOf(next)) { setState("failed"); setFailure(problemOf(next)); return; }
    setFailure(""); setState("saving");
    timer.current = setTimeout(() => { onSave(clean(latest.current)).then(() => setState("saved"), (e: unknown) => { setState("failed"); setFailure(e instanceof Error ? e.message : "Couldn't save the form."); }); }, SAVE_MS);
  };
  const commit = (next: ReviewSection[], undoLabel?: string) => {
    if (undoLabel) { if (undoTimer.current) clearTimeout(undoTimer.current); setUndo({ label: undoLabel, sections: secs }); undoTimer.current = setTimeout(() => setUndo(null), 7000); }
    setSecs(next); persist(next);
  };
  const patchField = (sid: string, fid: string, patch: Partial<ReviewField>) => commit(secs.map((s) => (s.id !== sid ? s : { ...s, fields: s.fields.map((f) => (f.id === fid ? { ...f, ...patch } : f)) })));
  const move = <T,>(list: T[], i: number, d: -1 | 1) => { const a = [...list]; [a[i], a[i + d]] = [a[i + d], a[i]]; return a; };
  // Drag to reorder (the prototype's dropField / dropSection): a field moves inside its own section, a section moves in the Sections list.
  const dragField = useRef<{ sid: string; fid: string } | null>(null);
  const dragSection = useRef<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [drag, setDrag] = useState<string | null>(null);
  const dropField = (sid: string, target: string) => {
    const from = dragField.current; dragField.current = null; setOver(null); setDrag(null);
    if (!from || from.sid !== sid || from.fid === target) return;
    commit(secs.map((x) => {
      if (x.id !== sid) return x;
      const fields = [...x.fields]; const a = fields.findIndex((y) => y.id === from.fid); const b = fields.findIndex((y) => y.id === target);
      if (a < 0 || b < 0) return x;
      const [moved] = fields.splice(a, 1); fields.splice(b, 0, moved); return { ...x, fields };
    }));
  };
  const dropSection = (target: string) => {
    const from = dragSection.current; dragSection.current = null; setOver(null); setDrag(null);
    if (!from || from === target) return;
    const list = [...secs]; const a = list.findIndex((x) => x.id === from); const b = list.findIndex((x) => x.id === target);
    if (a < 0 || b < 0) return;
    const [moved] = list.splice(a, 1); list.splice(b, 0, moved); commit(list);
  };
  const insert = (sid: string, at: number, type: FieldType) => {
    const f: ReviewField = { id: newId("f"), type, label: type === "score" ? "Rating" : type === "single_choice" ? "Choose one" : "New question", required: false, ...(type === "score" ? { max: 5 } : {}), ...(type === "single_choice" ? { options: ["Option A", "Option B"] } : {}) };
    commit(secs.map((s) => (s.id !== sid ? s : { ...s, fields: [...s.fields.slice(0, at), f, ...s.fields.slice(at)] })));
    setOpen(f.id);
  };
  const duplicate = (sid: string, f: ReviewField) => commit(secs.map((s) => { if (s.id !== sid) return s; const i = s.fields.findIndex((x) => x.id === f.id); return { ...s, fields: [...s.fields.slice(0, i + 1), { ...f, id: newId("f"), label: `${f.label} (copy)` }, ...s.fields.slice(i + 1)] }; }));
  const cancel = () => { if (timer.current) clearTimeout(timer.current); setSecs(snapshot.current); if (JSON.stringify(latest.current) !== JSON.stringify(snapshot.current)) void onSave(snapshot.current).catch(() => undefined); onDone(); };
  const done = () => { if (timer.current) { clearTimeout(timer.current); if (!problemOf(latest.current)) void onSave(clean(latest.current)).catch(() => undefined); } onDone(); };

  const total = secs.flatMap((x) => x.fields).length;
  const required = secs.flatMap((x) => x.fields).filter((x) => x.required).length;
  const lockedCount = secs.flatMap((x) => x.fields).filter(locked).length;
  const status = state === "failed" ? <span className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-2.5 py-1 text-[11px] font-bold text-danger">{failure || "Couldn't save"}</span>
    : state === "saving" ? <span className="fe-pulse inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold text-ink-muted"><Spinner size={12} tone="current" /> Saving…</span>
      : <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-1 text-[11px] font-bold text-success"><Check size={11} aria-hidden="true" /> All changes saved</span>;
  return (
    <div className="mx-auto max-w-[1064px]">
      <div style={CARD} className="ui-accent-card mb-5 overflow-hidden rounded-2xl bg-gradient-to-r from-[#EEF2FF] via-[#F1ECFF] to-[#E6F6FB] px-6 py-5">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold text-white"><Pencil size={11} aria-hidden="true" /> Editing</span>
        <h2 className="mt-2 text-xl font-extrabold tracking-tight text-navy">Review a {acronym} paper</h2>
        <p className="mt-1 text-xs text-ink-muted">This is the form reviewers fill in for each paper. Hover any field to edit it right where it sits.</p>
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,48rem)_17rem]">
      <div className="min-w-0 space-y-5">
      <InstructionsPreview text={instructions} />
      <div className="space-y-5">
        {secs.map((s, si) => (
          <section key={s.id} id={`fb-sec-${s.id}`} aria-label={s.name} style={CARD} className="scroll-mt-24 rounded-2xl bg-white p-6">
            <div className="group/sec mb-4 flex items-center gap-2.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy text-[11px] font-bold text-white">{si + 1}</span>
              {renaming === s.id
                ? <input aria-label="Section name" autoFocus value={s.name} maxLength={80} onChange={(e) => commit(secs.map((x) => (x.id === s.id ? { ...x, name: e.target.value } : x)))} onBlur={() => setRenaming(null)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") setRenaming(null); }} className={`${INPUT_CLASS} max-w-xs font-bold`} />
                : <h3 className="text-sm font-bold text-navy">{s.name || "Untitled section"}</h3>}
              <span className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover/sec:opacity-100">
                <Hover label="Rename section" onClick={() => setRenaming(s.id)}><Pencil size={13} aria-hidden="true" /></Hover>
                <Hover label="Move section up" disabled={si === 0} onClick={() => commit(move(secs, si, -1))}><ArrowUp size={13} aria-hidden="true" /></Hover>
                <Hover label="Move section down" disabled={si === secs.length - 1} onClick={() => commit(move(secs, si, 1))}><ArrowDown size={13} aria-hidden="true" /></Hover>
                <Hover label="Delete section" danger disabled={s.fields.some(locked) || secs.length === 1} onClick={() => commit(secs.filter((x) => x.id !== s.id), `“${s.name || "Section"}” deleted`)}><Trash2 size={13} aria-hidden="true" /></Hover>
              </span>
            </div>
            <Inserter onPick={(t) => insert(s.id, 0, t)} />
            {s.fields.map((f, fi) => (
              <div key={f.id}>
                <div draggable={!locked(f) && open !== f.id} onDragStart={() => { dragField.current = { sid: s.id, fid: f.id }; setDrag(f.id); }} onDragEnd={() => { setOver(null); setDrag(null); }} onDragOver={(e) => { if (dragField.current?.sid === s.id) { e.preventDefault(); setOver(f.id); } }} onDrop={() => dropField(s.id, f.id)} className={`group/f rounded-xl border border-transparent px-3 py-3 transition-colors hover:border-line hover:bg-canvas/60 ${open === f.id ? "border-[var(--primary-soft-border)] bg-canvas/60" : ""} ${over === f.id && drag !== f.id ? "!border-primary" : ""} ${hiddenFields.includes(f.id) ? "opacity-50" : ""}`}>
                  <div className="mb-1.5 flex items-start justify-between gap-2">
                    <div className="min-w-0"><div className="text-sm font-semibold text-ink">{f.label || "Untitled field"}{f.required && <span className="text-danger"> *</span>}{locked(f) && <Lock size={11} aria-label="This field stays" className="ml-1.5 inline text-ink-faint" />}</div>{f.description && <div className="text-xs text-ink-faint">{f.description}</div>}</div>
                    <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover/f:opacity-100">
                      <span title={locked(f) ? "Locked field — can’t be reordered" : "Drag to reorder"} aria-hidden="true" className={`px-1.5 ${locked(f) ? "cursor-not-allowed text-line-strong" : "cursor-grab text-ink-faint active:cursor-grabbing"}`}><GripVertical size={13} /></span>
                      <Hover label={`Edit ${f.label}`} onClick={() => setOpen(open === f.id ? null : f.id)}><Pencil size={13} aria-hidden="true" /></Hover>
                      <Hover label={`Duplicate ${f.label}`} disabled={locked(f)} onClick={() => duplicate(s.id, f)}><Copy size={13} aria-hidden="true" /></Hover>
                      <Hover label={`Move ${f.label} up`} disabled={fi === 0} onClick={() => commit(secs.map((x) => (x.id === s.id ? { ...x, fields: move(x.fields, fi, -1) } : x)))}><ArrowUp size={13} aria-hidden="true" /></Hover>
                      <Hover label={`Move ${f.label} down`} disabled={fi === s.fields.length - 1} onClick={() => commit(secs.map((x) => (x.id === s.id ? { ...x, fields: move(x.fields, fi, 1) } : x)))}><ArrowDown size={13} aria-hidden="true" /></Hover>
                      <Hover label={`Delete ${f.label}`} danger disabled={locked(f)} onClick={() => commit(secs.map((x) => (x.id === s.id ? { ...x, fields: x.fields.filter((y) => y.id !== f.id) } : x)), `“${f.label}” deleted`)}><Trash2 size={13} aria-hidden="true" /></Hover>
                    </span>
                  </div>
                  <Sample f={f} />
                  {open === f.id && <FieldEditor f={f} onChange={(patch) => patchField(s.id, f.id, patch)} />}
                </div>
                <Inserter onPick={(t) => insert(s.id, fi + 1, t)} />
              </div>
            ))}
            {s.fields.length === 0 && <p className="py-4 text-center text-xs text-ink-faint">No fields in this section yet — use “insert field here”.</p>}
          </section>
        ))}
      </div>
      <div style={{ border: "1px solid var(--border)" }} className="flex flex-wrap items-center gap-3 rounded-2xl bg-white px-5 py-3.5">
        <span className="text-[11px] text-ink-faint">Changes apply to new reviews right away.</span>
        <span className="flex-1" />
        {custom && <button type="button" onClick={() => { void onReset().then(() => onDone()); }} className="cursor-pointer text-xs font-semibold text-ink-muted hover:text-primary hover:underline">Use the standard form</button>}
        <button type="button" onClick={cancel} className="h-9 cursor-pointer rounded-lg border border-line bg-white px-4 text-xs font-semibold text-ink-soft hover:bg-canvas">Cancel</button>
        <button type="button" onClick={done} className="h-9 cursor-pointer rounded-lg bg-primary px-5 text-xs font-bold text-white hover:bg-primary-hover">Done</button>
      </div>
      </div>
      <aside className="space-y-4 xl:sticky xl:top-6" aria-label="Editing the form">
        <div style={CARD} className="rounded-2xl bg-white px-[18px] py-5">
          <div className="flex items-center gap-2.5"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white"><Pencil size={14} aria-hidden="true" /></span><div><div className="text-sm font-bold text-navy">Editing form</div><div className="text-[11px] text-ink-faint">Changes save automatically</div></div></div>
          <div aria-live="polite" className="mt-3">{status}</div>
          <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">Hover a field to edit, duplicate or delete it. Drag a field (or a section in the list on the right) to reorder, or use the arrows. Changes save automatically.</p>
          <button type="button" onClick={done} className="mt-3 flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-[var(--primary-soft-border)] bg-white text-xs font-bold text-primary hover:bg-primary-soft"><Eye size={13} aria-hidden="true" /> Back to preview</button>
        </div>
        <nav style={CARD} className="rounded-2xl bg-white p-5" aria-label="Sections">
          <div className="mb-2 flex items-center justify-between text-[10.5px] font-bold uppercase tracking-wider text-ink-faint"><span>Sections</span><span className="normal-case tracking-normal">{total} fields · {required} required</span></div>
          <ul className="space-y-0.5">{secs.map((x, i) => <li key={x.id} draggable title="Drag to reorder sections" onDragStart={() => { dragSection.current = x.id; setDrag(`s:${x.id}`); }} onDragEnd={() => { setOver(null); setDrag(null); }} onDragOver={(e) => { if (dragSection.current) { e.preventDefault(); setOver(`s:${x.id}`); } }} onDrop={() => dropSection(x.id)} className={`cursor-grab rounded-lg ${over === `s:${x.id}` && drag !== `s:${x.id}` ? "ring-1 ring-primary" : ""}`}><button type="button" onClick={() => document.getElementById(`fb-sec-${x.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })} className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1.5 text-left text-xs font-semibold text-ink hover:bg-canvas"><GripVertical size={12} aria-hidden="true" className="shrink-0 text-line-strong" /><span className="min-w-0 flex-1 truncate">{i + 1}. {x.name || "Untitled section"}</span><span className="shrink-0 text-[11px] font-semibold text-ink-faint">{x.fields.length}</span></button></li>)}</ul>
          <button type="button" onClick={() => { const id = newId("s"); commit([...secs, { id, name: "New section", fields: [] }]); setRenaming(id); setTimeout(() => document.getElementById(`fb-sec-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 60); }} className="mt-2 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-dashed border-[var(--primary-soft-border)] py-2 text-xs font-bold text-primary hover:bg-primary-soft"><Plus size={13} aria-hidden="true" /> Add section</button>
          {lockedCount > 0 && <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-ink-faint"><Lock size={11} aria-hidden="true" className="mt-0.5 shrink-0" /> {lockedCount} locked fields — can be relabelled, not removed.</p>}
        </nav>
      </aside>
      </div>

      {undo && (
        <div role="status" className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-xl bg-navy px-4 py-2.5 text-sm text-white shadow-lg">
          <span>{undo.label}</span>
          <button type="button" onClick={() => { if (undoTimer.current) clearTimeout(undoTimer.current); setSecs(undo.sections); persist(undo.sections); setUndo(null); }} className="cursor-pointer font-bold text-[#C4B5FD] hover:underline">Undo</button>
        </div>
      )}
    </div>
  );
}
