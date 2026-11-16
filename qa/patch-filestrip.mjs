// One-off edit helper: the paper's file strip (name + View / Download) under the header while the paper panel is hidden.
import fs from "node:fs";
const f = "../src/features/chair/components/chair-add-review-page.tsx"; let s = fs.readFileSync(f, "utf8"); let n = 0;
const rep = (a, b) => { if (!s.includes(a)) { console.log("MISSING", a.slice(0, 70)); return; } s = s.replace(a, () => b); n++; };
rep('function PaperHeader({ paper, acronym, keywords, compact }: { paper: ChairPaper; acronym: string; keywords: string[]; compact: boolean }) {',
`/** One round icon button of the file strip (the prototype's FileIconAction), with a tooltip on hover / focus. */
function FileIconAction({ icon: Icon, label, onClick, primary = false }: { icon: LucideIcon; label: string; onClick: () => void; primary?: boolean }) {
  return (
    <span className="group/fa relative inline-flex">
      <button type="button" onClick={onClick} aria-label={label} style={primary ? { background: "var(--primary)", color: "#FFFFFF" } : { background: "#FFFFFF", color: "var(--primary)", border: "1px solid var(--border)" }} className={\`inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg transition-colors \${primary ? "hover:bg-primary-hover" : "hover:border-[var(--primary-soft-border)] hover:bg-primary-soft"}\`}><Icon size={15} aria-hidden="true" /></button>
      <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 -translate-x-1/2 translate-y-1 whitespace-nowrap rounded-md bg-navy px-2 py-1 text-[11px] font-semibold text-white opacity-0 transition-all duration-150 group-focus-within/fa:translate-y-0 group-focus-within/fa:opacity-100 group-hover/fa:translate-y-0 group-hover/fa:opacity-100">{label}<span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-navy" /></span>
    </span>
  );
}

function PaperHeader({ paper, acronym, keywords, compact, file, onFile }: { paper: ChairPaper; acronym: string; keywords: string[]; compact: boolean; file: { name: string } | null; onFile: (download: boolean) => void }) {`);
rep(`        </div>
      </section>
      {all && (`, `        </div>
        {!compact && file && (
          <div style={{ borderTop: "1px solid var(--banner-border)", background: "rgba(255,255,255,0.6)" }} className="flex flex-wrap items-center gap-3 px-6 py-3">
            <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-danger-soft text-[10px] font-extrabold tracking-wide text-danger">PDF</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-ink">{file.name}</span><span className="block text-[11px] text-ink-faint">Submitted paper{paper.submittedAt ? \` · \${paper.submittedAt}\` : ""}</span></span>
            <span className="inline-flex shrink-0 items-center gap-1.5"><FileIconAction icon={Eye} label="View" onClick={() => onFile(false)} /><FileIconAction icon={Download} label="Download" onClick={() => onFile(true)} primary /></span>
          </div>
        )}
      </section>
      {all && (`);
rep('compact={open} />\n              <div style={{ background: "var(--primary-soft)"', 'compact={open} file={paperFile ?? null} onFile={(download) => void openFile(download)} />\n              <div style={{ background: "var(--primary-soft)"');
rep('  const loadUrl = useCallback(', `  const openFile = async (download: boolean) => {
    if (!paperFile?.storagePath) { setError("The paper's file isn't available."); return; }
    try { window.open(await (await getChairService()).fileUrl(paperFile.storagePath, download ? paperFile.name : undefined), "_blank", "noopener"); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't open the file."); }
  };
  const loadUrl = useCallback(`);
rep('import { BookOpen, Check, ChevronDown, ChevronLeft, FileCheck, Info, Tag, Users } from "lucide-react";', 'import { BookOpen, Check, ChevronDown, ChevronLeft, Download, Eye, FileCheck, Info, Tag, Users, type LucideIcon } from "lucide-react";');
fs.writeFileSync(f, s); console.log("applied", n);
