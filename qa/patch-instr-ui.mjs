// One-off edit helper: the Reviewer instructions card with the "Upload PDF" tab, the preview and the reviewer's page showing the PDF.
import fs from "node:fs";
let n = 0;
const S = "../src/features/";
const edit = (file, pairs) => { let s = fs.readFileSync(file, "utf8"); for (const [a, b] of pairs) { if (!s.includes(a)) { console.log("MISSING", file.split("/").pop(), a.slice(0, 90)); continue; } s = s.split(a).join(b); n++; } fs.writeFileSync(file, s); };

// ---- preview: the PDF row (as the prototype's InstructionsCard)
edit(S + "chair/components/review-form-preview.tsx", [
  [`export function InstructionsPreview({ text }: { text: string }) {`, `export function InstructionsPreview({ text, pdf = null, mode = "html" }: { text: string; pdf?: InstructionsPdf | null; mode?: "html" | "pdf" }) {`],
  [`{show && <div className="space-y-3 px-5 py-4"><RichTextContent value={text.trim() ? text : standardInstructionsHtml()} /></div>}\n    </section>\n  );\n}\n\n/** The review form as`, `{show && <div className="space-y-3 px-5 py-4">{mode === "pdf" ? (pdf ? <InstructionsPdfRow pdf={pdf} /> : <p className="text-sm text-ink-faint">No PDF attached yet.</p>) : <RichTextContent value={text.trim() ? text : standardInstructionsHtml()} />}</div>}\n    </section>\n  );\n}\n\n/** The attached PDF of the instructions: a file row with Download (the prototype's). */\nexport function InstructionsPdfRow({ pdf }: { pdf: InstructionsPdf }) {\n  return (\n    <div className="flex items-center gap-3 rounded-xl border border-line bg-canvas px-3.5 py-2.5">\n      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-danger-soft text-[10px] font-extrabold text-danger">PDF</span>\n      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-ink">{pdf.name}</span><span className="block text-xs text-ink-faint">Attached document</span></span>\n      <a href={pdf.url} target="_blank" rel="noopener noreferrer" download={pdf.name} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-bold text-primary hover:bg-canvas"><Download size={13} aria-hidden="true" /> Download</a>\n    </div>\n  );\n}\n\n/** The review form as`],
  [`import { ChevronDown, ChevronRight, ChevronUp, Eye,`, `import type { InstructionsPdf } from "@/types/chair";\nimport { ChevronDown, ChevronRight, ChevronUp, Download, Eye,`],
]);

// ---- editor
{
  const f = S + "chair/components/review-form-editor.tsx"; let s = fs.readFileSync(f, "utf8");
  const a = s.indexOf("export function InstructionsEditor"); const b = s.indexOf("interface FieldDraft");
  const neu = `export function InstructionsEditor({ initial, stored, onSave, busy, mode: savedMode, pdf: savedPdf, onMode, onPdf }: { initial: string; stored: boolean; onSave: (text: string) => void; busy: boolean; mode: "html" | "pdf"; pdf: InstructionsPdf | null; onMode: (mode: "html" | "pdf") => void; onPdf: (file: File) => Promise<InstructionsPdf | undefined> }) {
  // Like the prototype the editor starts with the standard instructions; what is saved is what reviewers read.
  const [html, setHtml] = useState(initial.trim() ? richTextToHtml(initial) : standardInstructionsHtml());
  const [saved, setSaved] = useState(false);
  const [mode, setMode] = useState(savedMode);
  const [pdf, setPdf] = useState(savedPdf);
  const [drag, setDrag] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const save = () => { onSave(html); setSaved(true); setTimeout(() => setSaved(false), 2000); };
  const pick = (m: "html" | "pdf") => { if (m === mode) return; setMode(m); onMode(m); };
  const choose = async (file: File | undefined) => {
    if (!file) return;
    if (file.type !== "application/pdf" && !/\\.pdf$/i.test(file.name)) { setPdfError("Choose a PDF file."); return; }
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
          <button key={k} type="button" role="tab" aria-selected={mode === k} onClick={() => pick(k)} style={{ boxShadow: mode === k ? "0 1px 3px rgba(15,23,42,0.10)" : "none" }} className={\`flex cursor-pointer items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all \${mode === k ? "bg-white text-navy" : "bg-transparent text-ink-muted"}\`}><Icon size={13} aria-hidden="true" /> {label}</button>
        ))}
      </div>
      {mode === "pdf" ? (
        <>
          <label onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); void choose(e.dataTransfer.files?.[0]); }} style={{ border: \`1.5px dashed \${drag ? "var(--primary)" : "var(--border-strong)"}\`, background: drag ? "var(--primary-soft)" : "transparent" }} className="flex w-fit cursor-pointer items-center gap-2 rounded-lg px-3.5 py-2.5 transition-colors">
            <FileUp size={15} aria-hidden="true" className="text-primary" />
            <span className={\`text-xs font-medium \${pdf ? "text-ink" : "text-ink-faint"}\`}>{pdfBusy ? "Uploading…" : pdf?.name || "Choose a PDF"}</span>
            <span className="hidden text-[11px] text-ink-faint sm:inline">· or drag &amp; drop</span>
            <input type="file" accept="application/pdf,.pdf" className="hidden" aria-label="Choose a PDF" onChange={(e) => { void choose(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          {pdfError && <p role="alert" className="mt-2 text-xs font-semibold text-danger">{pdfError}</p>}
        </>
      ) : (
        <>
          <RichTextEditor value={html} onChange={setHtml} label="Reviewer instructions" placeholder="What reviewers should focus on, scoring guidance, conflicts of interest, deadlines…" />
          <div className="mt-3 flex items-center justify-end gap-3">
            {!stored && <span className="mr-auto text-xs font-semibold text-warning">Run migration 0028_conference_settings.sql to save this.</span>}
            {saved && !busy && <span className="flex items-center gap-1 text-xs font-semibold text-success"><Check size={13} aria-hidden="true" /> Saved</span>}
            <button type="button" onClick={save} disabled={busy} className="h-10 cursor-pointer rounded-xl bg-primary px-5 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-60">{busy ? "Saving…" : "Save instructions"}</button>
          </div>
        </>
      )}
      {(mode === "html" || pdf) && (
        <div className="mt-5 border-t border-muted pt-4">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-faint"><Eye size={12} aria-hidden="true" /> How reviewers see it</div>
          <InstructionsPreview key={\`\${mode}-\${pdf?.url ?? ""}\`} text={initial} mode={mode} pdf={pdf} />
        </div>
      )}
    </section>
  );
}

`;
  s = s.slice(0, a) + neu + s.slice(b);
  s = s.replace(`import { ArrowDown, ArrowUp, Check, ClipboardList, Eye, FileText, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";`, `import { ArrowDown, ArrowUp, Check, ClipboardList, Eye, FileText, FileUp, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";\nimport type { InstructionsPdf } from "@/types/chair";`);
  fs.writeFileSync(f, s); n++;
}

// ---- the page(s) that hold the editor: one shared set of props
{
  const f = S + "chair/components/review-settings-page.tsx"; let s = fs.readFileSync(f, "utf8");
  const call = (indent) => `${indent}<InstructionsEditor key={\`i-\${setup.instructions}-\${settings.stored}\`} initial={setup.instructions} stored={settings.stored} busy={busy === "instructions"} onSave={(t) => void run("instructions", () => getChairService().then((x) => x.saveReviewInstructions(slug, t)), { title: "Instructions saved", text: t.trim() ? "Reviewers read your text." : "Reviewers read the standard text." })} />`;
  const rep = (indent) => {
    const old = call(indent);
    if (!s.includes(old)) { console.log("MISSING call", indent.length); return; }
    s = s.replace(old, () => `${indent}<InstructionsEditor key={\`i-\${setup.instructions}-\${settings.stored}\`} initial={setup.instructions} stored={settings.stored} busy={busy === "instructions"} mode={setup.instructionsMode} pdf={setup.instructionsPdf} onSave={(t) => void run("instructions", () => getChairService().then((x) => x.saveReviewInstructions(slug, t)), { title: "Instructions saved", text: t.trim() ? "Reviewers read your text." : "Reviewers read the standard text." })} onMode={(m) => void run("instructions", () => getChairService().then((x) => x.saveReviewInstructionsMode(slug, m)), { title: "Instructions saved", text: m === "pdf" ? "Reviewers read the attached PDF." : "Reviewers read your written instructions." })} onPdf={async (file) => { let out: InstructionsPdf | undefined; await run("instructions", async () => { out = await (await getChairService()).saveReviewInstructionsPdf(slug, file); }, { title: "PDF attached", text: "Reviewers can download it from their review page." }); return out; }} />`);
    n++;
  };
  rep("          "); rep("      ");
  if (!s.includes("InstructionsPdf }") && !s.includes("InstructionsPdf,")) s = s.replace("import type { ConferenceSettings,", "import type { InstructionsPdf, ConferenceSettings,");
  fs.writeFileSync(f, s);
}

// ---- the reviewer's page
edit(S + "reviewer/components/review-form-page.tsx", [
  [`function Instructions({ defaultOpen, text }: { defaultOpen: boolean; text: string }) {`, `function Instructions({ defaultOpen, text, mode, pdf }: { defaultOpen: boolean; text: string; mode: "html" | "pdf"; pdf: InstructionsPdf | null }) {`],
  [`{open && text.trim() && <RichTextContent value={text} className="border-t border-muted px-5 pb-5 pt-3" />}`, `{open && mode === "pdf" && pdf && <div className="border-t border-muted px-5 pb-5 pt-3"><InstructionsPdfRow pdf={pdf} /></div>}\n      {open && mode !== "pdf" && text.trim() && <RichTextContent value={text} className="border-t border-muted px-5 pb-5 pt-3" />}`],
  [`{open && !text.trim() && (`, `{open && mode !== "pdf" && !text.trim() && (`],
  [`<Instructions text={detail.instructions} key=`, `<Instructions text={detail.instructions} mode={detail.instructionsMode} pdf={detail.instructionsPdf} key=`],
  [`import { RichTextContent } from "@/components/ui/rich-text";`, `import { RichTextContent } from "@/components/ui/rich-text";\nimport { InstructionsPdfRow } from "@/features/chair/components/review-form-preview";\nimport type { InstructionsPdf } from "@/types/chair";`],
]);
console.log("applied", n);
