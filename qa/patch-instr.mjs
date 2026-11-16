import fs from "node:fs";
let n = 0;
const edit = (file, pairs) => { let s = fs.readFileSync(file, "utf8"); for (const [a, b] of pairs) { if (!s.includes(a)) { console.log("MISSING", file.split("/").pop(), a.slice(0, 90)); continue; } s = s.replace(a, () => b); n++; } fs.writeFileSync(file, s); };
const d = "../src/features/";
// ---- preview + standard text as HTML
edit(d + "chair/components/review-form-preview.tsx", [
  [`const STANDARD = [`, `export const STANDARD = [`],
  [`/** **bold** and "- " bullets of the instructions text, as the reviewer sees them. */`, `const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const boldHtml = (s: string) => esc(s).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
/** The standard instructions as HTML (what the editor starts with, and what reviewers read until the chair writes their own). */
export function standardInstructionsHtml(): string {
  return STANDARD.map((block) => {
    const lines = block.split("\n");
    const head = lines.filter((l) => !l.startsWith("- ")); const bullets = lines.filter((l) => l.startsWith("- "));
    return (head.length ? \`<p>\${boldHtml(head.join(" "))}</p>\` : "") + (bullets.length ? \`<ul>\${bullets.map((b) => \`<li>\${boldHtml(b.slice(2))}</li>\`).join("")}</ul>\` : "");
  }).join("");
}

/** **bold** and "- " bullets of the instructions text, as the reviewer sees them. */`],
  [`    <section style={CARD} className="overflow-hidden rounded-2xl bg-white">
      <div className="flex items-center gap-3 bg-primary-soft/60 px-5 py-3.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-primary"><FileText size={15} aria-hidden="true" /></span>
        <div className="flex-1"><div className="text-sm font-bold text-navy">Reviewer instructions</div><div className="text-[11px] text-ink-faint">Please read before you start your review</div></div>
        <button type="button" onClick={() => setShow(!show)} aria-expanded={show} className="inline-flex items-center gap-1 text-xs font-bold text-primary">{show ? "Hide" : "Show"} <ChevronUp size={13} aria-hidden="true" className={show ? "" : "rotate-180"} /></button>
      </div>
      {show && <div className="px-5 py-4 text-sm leading-[1.7] text-ink-soft"><Rich text={text.trim() ? text : STANDARD.join("\n\n")} /></div>}
    </section>`,
   `    <section style={{ border: "1px solid var(--primary-soft-border)", boxShadow: "var(--shadow-card)" }} className="overflow-hidden rounded-2xl bg-white">
      <button type="button" onClick={() => setShow(!show)} aria-expanded={show} className="flex w-full cursor-pointer items-center gap-3 bg-primary-soft px-5 py-3.5 text-left">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-primary"><FileText size={15} aria-hidden="true" /></span>
        <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-navy">Reviewer instructions</span><span className="block text-xs text-ink-muted">Please read before you start your review</span></span>
        <span className="shrink-0 text-xs font-semibold text-primary">{show ? "Hide" : "Show"}</span>
        <ChevronDown size={16} aria-hidden="true" className={\`shrink-0 text-ink-muted transition-transform \${show ? "rotate-180" : ""}\`} />
      </button>
      {show && <div className="space-y-3 px-5 py-4"><RichTextContent value={text.trim() ? text : standardInstructionsHtml()} /></div>}
    </section>`],
  [`import { ChevronRight, ChevronUp, Eye,`, `import { RichTextContent } from "@/components/ui/rich-text";\nimport { ChevronDown, ChevronRight, ChevronUp, Eye,`],
]);
// ---- editor
{
  const f = d + "chair/components/review-form-editor.tsx"; let s = fs.readFileSync(f, "utf8");
  const a = s.indexOf("export function InstructionsEditor"); const b = s.indexOf("interface FieldDraft");
  const neu = `export function InstructionsEditor({ initial, stored, onSave, busy }: { initial: string; stored: boolean; onSave: (text: string) => void; busy: boolean }) {
  // Like the prototype the editor starts with the standard instructions; what is saved is what reviewers read.
  const [html, setHtml] = useState(initial.trim() ? richTextToHtml(initial) : standardInstructionsHtml());
  const [saved, setSaved] = useState(false);
  const save = () => { onSave(html); setSaved(true); setTimeout(() => setSaved(false), 2000); };
  return (
    <section style={CARD} className="rounded-2xl bg-white p-6">
      <div className="mb-4 flex items-center justify-between gap-3"><div className="flex items-center gap-2.5"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary"><FileText size={15} aria-hidden="true" /></span><h3 className="text-sm font-bold text-navy"><HelpLabel help="reviewerInstructions">Reviewer instructions</HelpLabel></h3></div></div>
      <p className="-mt-1 mb-4 text-xs text-ink-faint">Shown at the top of every review form, before reviewers start. Write them here.</p>
      <div className="mb-4 inline-flex items-center gap-1 rounded-xl bg-muted p-1"><span className="flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-1.5 text-xs font-bold text-navy shadow-[0_1px_3px_rgba(15,23,42,0.10)]"><Pencil size={13} aria-hidden="true" /> Write instructions</span></div>
      <RichTextEditor value={html} onChange={setHtml} label="Reviewer instructions" placeholder="What reviewers should focus on, scoring guidance, conflicts of interest, deadlines…" />
      <div className="mt-3 flex items-center justify-end gap-3">
        {!stored && <span className="mr-auto text-xs font-semibold text-warning">Run migration 0028_conference_settings.sql to save this.</span>}
        {saved && !busy && <span className="flex items-center gap-1 text-xs font-semibold text-success"><Check size={13} aria-hidden="true" /> Saved</span>}
        <button type="button" onClick={save} disabled={busy} className="h-10 cursor-pointer rounded-xl bg-primary px-5 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-60">{busy ? "Saving…" : "Save instructions"}</button>
      </div>
      <div className="mt-5 border-t border-muted pt-4">
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-faint"><Eye size={12} aria-hidden="true" /> How reviewers see it</div>
        <InstructionsPreview text={initial} />
      </div>
    </section>
  );
}

`;
  s = s.slice(0, a) + neu + s.slice(b);
  s = s.replace(`import { ArrowDown, ArrowUp, ClipboardList, FileText, Plus, RotateCcw, Trash2 } from "lucide-react";`, () => `import { ArrowDown, ArrowUp, Check, ClipboardList, Eye, FileText, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";\nimport { RichTextEditor, richTextToHtml } from "@/components/ui/rich-text";\nimport { HelpLabel } from "./setting-label";\nimport { InstructionsPreview, standardInstructionsHtml } from "./review-form-preview";`);
  fs.writeFileSync(f, s); n++;
}
// ---- reviewer page
edit(d + "reviewer/components/review-form-page.tsx", [
  [`<div className="space-y-2 border-t border-muted px-5 pb-5 pt-3 text-[13px] leading-relaxed text-ink-soft">{text.split(/\n\n+/).filter((p) => p.trim()).map((p, i) => <p key={i} className="whitespace-pre-wrap">{p}</p>)}</div>`, `<RichTextContent value={text} className="border-t border-muted px-5 pb-5 pt-3" />`],
]);
console.log("applied", n);
