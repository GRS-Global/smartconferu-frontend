import fs from "node:fs";
let f = "../src/features/chair/components/review-form-preview.tsx"; let s = fs.readFileSync(f, "utf8");
const a = s.indexOf("export function InstructionsPreview"); const sec = s.indexOf("    <section", a); const end = s.indexOf("</section>", sec) + "</section>".length;
if (a < 0 || sec < 0) throw new Error("preview");
const neu = `    <section style={{ border: "1px solid var(--primary-soft-border)", boxShadow: "var(--shadow-card)" }} className="overflow-hidden rounded-2xl bg-white">
      <button type="button" onClick={() => setShow(!show)} aria-expanded={show} className="flex w-full cursor-pointer items-center gap-3 bg-primary-soft px-5 py-3.5 text-left">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-primary"><FileText size={15} aria-hidden="true" /></span>
        <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-navy">Reviewer instructions</span><span className="block text-xs text-ink-muted">Please read before you start your review</span></span>
        <span className="shrink-0 text-xs font-semibold text-primary">{show ? "Hide" : "Show"}</span>
        <ChevronDown size={16} aria-hidden="true" className={\`shrink-0 text-ink-muted transition-transform \${show ? "rotate-180" : ""}\`} />
      </button>
      {show && <div className="space-y-3 px-5 py-4"><RichTextContent value={text.trim() ? text : standardInstructionsHtml()} /></div>}
    </section>`;
s = s.slice(0, sec) + neu + s.slice(end); fs.writeFileSync(f, s);
f = "../src/features/reviewer/components/review-form-page.tsx"; s = fs.readFileSync(f, "utf8");
const re = /\{open && text\.trim\(\) && \(\n\s*<div className="space-y-2 border-t[^\n]*\n\s*\)\}/;
if (!re.test(s)) throw new Error("reviewer");
s = s.replace(re, () => `{open && text.trim() && <RichTextContent value={text} className="border-t border-muted px-5 pb-5 pt-3" />}`);
s = s.replace(`import { ConferenceShell }`, () => `import { RichTextContent } from "@/components/ui/rich-text";\nimport { ConferenceShell }`);
fs.writeFileSync(f, s); console.log("ok");
