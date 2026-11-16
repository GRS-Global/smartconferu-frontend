// One-off edit helper: the form builder keeps the page's layout like the prototype's editor: the hero with an "Editing" pill, the instructions card, the form, and on the right
// "Editing form" (save state, Back to preview), "Sections" (with Add section) and the note about the locked fields; Cancel / Done at the bottom.
import fs from "node:fs";
const f = "../src/features/chair/components/review-form-builder.tsx";
let s = fs.readFileSync(f, "utf8"); let n = 0;
const rep = (a, b) => { if (!s.includes(a)) { console.log("MISSING:", a.slice(0, 90)); return; } s = s.replace(a, () => b); n += 1; };

rep('import { ArrowDown, ArrowUp, Check, Copy, Lock, Pencil, Plus, Star, Trash2, X } from "lucide-react";', 'import { ArrowDown, ArrowUp, Check, Copy, Eye, GripVertical, Lock, Pencil, Plus, Star, Trash2, X } from "lucide-react";');
rep('import { PROTECTED_FIELD_IDS, type FieldType, type ReviewField, type ReviewSection } from "@/features/reviewer/form-schema";', 'import { PROTECTED_FIELD_IDS, type FieldType, type ReviewField, type ReviewSection } from "@/features/reviewer/form-schema";\nimport { InstructionsPreview } from "./review-form-preview";');
rep("export function ReviewFormBuilder({ initial, hiddenFields, custom, onSave, onReset, onDone }: { initial: ReviewSection[]; hiddenFields: string[]; custom: boolean;", "export function ReviewFormBuilder({ initial, acronym, instructions, hiddenFields, custom, onSave, onReset, onDone }: { initial: ReviewSection[]; acronym: string; instructions: string; hiddenFields: string[]; custom: boolean;");

// 1. the top bar becomes the hero and the grid opens
const a = s.indexOf('  return (\n    <div>\n      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-white px-5 py-3.5" style={CARD}>');
const b = s.indexOf('      <div className="space-y-5">\n        {secs.map((s, si) => (');
if (a < 0 || b < 0) { console.log("MISSING top"); process.exit(1); }
const locks = 'secs.flatMap((x) => x.fields).filter(locked).length';
s = s.slice(0, a) + `  const total = secs.flatMap((x) => x.fields).length;
  const required = secs.flatMap((x) => x.fields).filter((x) => x.required).length;
  const lockedCount = ${locks};
  const status = state === "failed" ? <span className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-2.5 py-1 text-[11px] font-bold text-danger">{failure || "Couldn't save"}</span>
    : state === "saving" ? <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold text-ink-muted">Saving…</span>
      : <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-1 text-[11px] font-bold text-success"><Check size={11} aria-hidden="true" /> All changes saved</span>;
  return (
    <div className="mx-auto max-w-[1064px]">
      <div style={CARD} className="ui-accent-card mb-5 overflow-hidden rounded-2xl bg-gradient-to-r from-[#EEF2FF] via-[#F1ECFF] to-[#E6F6FB] px-6 py-5">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold text-white"><Pencil size={11} aria-hidden="true" /> Editing</span>
        <h2 className="mt-2 text-xl font-extrabold tracking-tight text-navy">Review a {acronym} paper</h2>
        <p className="mt-1 text-xs text-ink-muted">This is the form reviewers fill in for each paper. Hover any field to edit it right where it sits.</p>
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_272px]">
      <div className="min-w-0 space-y-5">
      <InstructionsPreview text={instructions} />
` + s.slice(b);

// 2. the sections list ends, the bottom bar, the aside
const c = s.indexOf('        <button type="button" onClick={() => { const id = newId("s"); commit([...secs, { id, name: "New section", fields: [] }]); setRenaming(id); }}');
const d = s.indexOf("      </div>\n\n      {undo && (", c);
if (c < 0 || d < 0) { console.log("MISSING bottom", c, d); process.exit(1); }
s = s.slice(0, c) + `      </div>
      <div style={{ border: "1px solid var(--border)" }} className="flex flex-wrap items-center gap-3 rounded-2xl bg-white px-5 py-3.5">
        <span className="text-[11px] text-ink-faint">Changes apply to new reviews right away.</span>
        <span className="flex-1" />
        {custom && <button type="button" onClick={() => { void onReset().then(() => onDone()); }} className="cursor-pointer text-xs font-semibold text-ink-muted hover:text-primary hover:underline">Use the standard form</button>}
        <button type="button" onClick={cancel} className="h-9 cursor-pointer rounded-lg border border-line bg-white px-4 text-xs font-semibold text-ink-soft hover:bg-canvas">Cancel</button>
        <button type="button" onClick={done} className="h-9 cursor-pointer rounded-lg bg-primary px-5 text-xs font-bold text-white hover:bg-primary-hover">Done</button>
      </div>
      </div>
      <aside className="space-y-4 xl:sticky xl:top-6" aria-label="Editing the form">
        <div style={CARD} className="rounded-2xl bg-white p-5">
          <div className="flex items-center gap-2.5"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white"><Pencil size={14} aria-hidden="true" /></span><div><div className="text-sm font-bold text-navy">Editing form</div><div className="text-[11px] text-ink-faint">Changes save automatically</div></div></div>
          <div aria-live="polite" className="mt-3">{status}</div>
          <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">Hover a field to edit, duplicate or delete it. Use the arrows to reorder. Changes save automatically.</p>
          <button type="button" onClick={done} className="mt-3 flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-[var(--primary-soft-border)] bg-white text-xs font-bold text-primary hover:bg-primary-soft"><Eye size={13} aria-hidden="true" /> Back to preview</button>
        </div>
        <nav style={CARD} className="rounded-2xl bg-white p-5" aria-label="Sections">
          <div className="mb-2 flex items-center justify-between text-[10.5px] font-bold uppercase tracking-wider text-ink-faint"><span>Sections</span><span className="normal-case tracking-normal">{total} fields · {required} required</span></div>
          <ul className="space-y-0.5">{secs.map((x, i) => <li key={x.id}><button type="button" onClick={() => document.getElementById(\`fb-sec-\${x.id}\`)?.scrollIntoView({ behavior: "smooth", block: "start" })} className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1.5 text-left text-xs font-semibold text-ink hover:bg-canvas"><GripVertical size={12} aria-hidden="true" className="shrink-0 text-line-strong" /><span className="min-w-0 flex-1 truncate">{i + 1}. {x.name || "Untitled section"}</span><span className="shrink-0 text-[11px] font-semibold text-ink-faint">{x.fields.length}</span></button></li>)}</ul>
          <button type="button" onClick={() => { const id = newId("s"); commit([...secs, { id, name: "New section", fields: [] }]); setRenaming(id); setTimeout(() => document.getElementById(\`fb-sec-\${id}\`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 60); }} className="mt-2 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-dashed border-[var(--primary-soft-border)] py-2 text-xs font-bold text-primary hover:bg-primary-soft"><Plus size={13} aria-hidden="true" /> Add section</button>
          {lockedCount > 0 && <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-ink-faint"><Lock size={11} aria-hidden="true" className="mt-0.5 shrink-0" /> {lockedCount} locked fields — can be relabelled, not removed.</p>}
        </nav>
      </aside>
      </div>
` + s.slice(d + "      </div>\n".length);
rep('<section key={s.id} aria-label={s.name} style={CARD} className="rounded-2xl bg-white p-6">', '<section key={s.id} id={`fb-sec-${s.id}`} aria-label={s.name} style={CARD} className="scroll-mt-24 rounded-2xl bg-white p-6">');
fs.writeFileSync(f, s); console.log("applied", n);
