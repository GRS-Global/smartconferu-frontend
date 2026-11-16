// One-off edit helper: the chair's own-review page like the prototype's: a rich paper header (tile, chips, authors, keywords), the abstract with "Show full abstract", the form drawn as ReviewFormBody.
import fs from "node:fs";
const f = "../src/features/chair/components/chair-add-review-page.tsx";
let s = fs.readFileSync(f, "utf8"); let n = 0;
const rep = (a, b) => { if (!s.includes(a)) { console.log("MISSING:", a.slice(0, 90)); return; } s = s.replace(a, () => b); n += 1; };

// 1. header, abstract, form
const h0 = s.indexOf("              {open\n                ? (");
const h1 = s.indexOf("              <div style={{ background: \"var(--primary-soft)\"", h0);
if (h0 < 0 || h1 < 0) console.log("MISSING header"); else { s = s.slice(0, h0) + "              <PaperHeader paper={paper} acronym={conference.acronym} keywords={detail.keywords} compact={open} />\n" + s.slice(h1); n += 1; }
const a0 = s.indexOf("              {detail.abstract && <section");
const a1 = s.indexOf("\n", a0);
if (a0 < 0) console.log("MISSING abstract"); else { s = s.slice(0, a0) + "              {detail.abstract && <AbstractCard text={detail.abstract} compact={open} />}" + s.slice(a1); n += 1; }
const f0 = s.indexOf('              <div style={CARD} className="rounded-2xl bg-white px-6 pb-2 pt-2">');
const f1 = s.indexOf("              {error && <p role=\"alert\"", f0);
if (f0 < 0 || f1 < 0) console.log("MISSING form"); else { s = s.slice(0, f0) + "              <ReviewFormBody form={detail.form} values={values} onChange={change} disabled={busy} />\n" + s.slice(f1); n += 1; }

// 2. the components
rep("export function ChairAddReviewPage({ label }: { label: string }) {", `/** The paper at the top of the review form: the conference, ID, track and type, the title, the authors (the first, and "+n more" to see the rest) and the keywords. */
function PaperHeader({ paper, acronym, keywords, compact }: { paper: ChairPaper; acronym: string; keywords: string[]; compact: boolean }) {
  const [all, setAll] = useState(false);
  const chip = "rounded-full border border-[var(--primary-soft-border)] bg-white px-2.5 py-0.5 text-[11px] font-semibold text-primary";
  const shown = all ? paper.authors : paper.authors.slice(0, 1);
  const initials = (nm: string) => nm.split(/\\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  return (
    <section aria-label="Paper" style={CARD} className="ui-accent-card overflow-hidden rounded-2xl bg-gradient-to-r from-[#EEF2FF] via-[#F1ECFF] to-[#E6F6FB] p-5">
      <div className="flex items-start gap-4">
        <span aria-hidden="true" className={\`flex shrink-0 items-center justify-center rounded-2xl bg-white font-extrabold text-primary shadow-sm \${compact ? "h-12 w-12 text-base" : "h-14 w-14 text-lg"}\`}>{monogram(acronym)}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-1.5"><span className={chip}>{acronym}</span><span className={chip}>{paper.id}</span>{paper.track && <span className={chip}>{paper.track}</span>}{paper.presentationType && <span className={chip}>{paper.presentationType}</span>}</div>
          <h2 className={\`mt-2 font-extrabold leading-snug tracking-tight text-navy \${compact ? "text-lg" : "text-2xl"}\`}>{paper.title}</h2>
        </div>
      </div>
      <dl className="mt-4 space-y-3 text-xs">
        {paper.authors.length > 0 && (
          <div className="flex items-start gap-3"><dt className="flex w-[84px] shrink-0 items-center gap-1.5 pt-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-muted"><Users size={12} aria-hidden="true" /> Authors</dt>
            <dd className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              {shown.map((a) => <span key={\`\${a.email}-\${a.name}\`} className="inline-flex max-w-full items-center gap-2 rounded-full border border-line bg-white py-1 pl-1 pr-3"><span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-white">{initials(a.name)}</span><b className="shrink-0 text-[13px] text-navy">{a.name}</b>{a.affiliation && <span className="truncate text-ink-faint">· {a.affiliation}</span>}</span>)}
              {paper.authors.length > 1 && <button type="button" onClick={() => setAll((v) => !v)} aria-expanded={all} className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-line bg-white px-3 py-1.5 text-[12px] font-bold text-ink-soft hover:bg-canvas">{all ? "Show less" : \`+\${paper.authors.length - 1} more\`} <ChevronDown size={12} aria-hidden="true" className={all ? "rotate-180" : ""} /></button>}
            </dd></div>
        )}
        {keywords.length > 0 && (
          <div className="flex items-start gap-3"><dt className="flex w-[84px] shrink-0 items-center gap-1.5 pt-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-muted"><Tag size={12} aria-hidden="true" /> Keywords</dt>
            <dd className="flex min-w-0 flex-1 flex-wrap gap-2">{keywords.map((k) => <span key={k} className="rounded-lg border border-line bg-white px-2.5 py-1 text-[12px] font-medium text-ink-soft">{k}</span>)}</dd></div>
        )}
      </dl>
    </section>
  );
}

/** The abstract: a few lines with "Show full abstract" when it is long (fewer lines while the paper is beside the form). */
function AbstractCard({ text, compact }: { text: string; compact: boolean }) {
  const [open, setOpen] = useState(false);
  const long = text.length > (compact ? 200 : 420);
  return (
    <section aria-label="Abstract" style={CARD} className={\`rounded-2xl bg-white px-6 \${compact ? "py-3.5" : "py-5"}\`}>
      <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-faint"><BookOpen size={12} aria-hidden="true" /> Abstract</h3>
      <p style={long && !open ? { display: "-webkit-box", WebkitLineClamp: compact ? 2 : 4, WebkitBoxOrient: "vertical", overflow: "hidden" } : undefined} className="whitespace-pre-line text-[15px] leading-relaxed text-ink-soft">{text}</p>
      {long && <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="mt-2 inline-flex cursor-pointer items-center gap-1 text-xs font-bold text-primary hover:underline">{open ? "Show less" : "Show full abstract"} <ChevronDown size={12} aria-hidden="true" className={open ? "rotate-180" : ""} /></button>}
    </section>
  );
}

export function ChairAddReviewPage({ label }: { label: string }) {`);
rep('import { Check, ChevronLeft, FileCheck, Hash, Info, Tag } from "lucide-react";', 'import { BookOpen, Check, ChevronDown, ChevronLeft, FileCheck, Info, Tag, Users } from "lucide-react";');
rep('import { FieldRow } from "@/features/reviewer/components/review-form-page";\n', '');
rep('import { HeroChip, PageHero } from "@/features/workspace/components/hero";\n', '');
rep('import type { ChairReviewer } from "@/types/chair";', 'import type { ChairPaper, ChairReviewer } from "@/types/chair";');
rep('import { PaperSplit } from "./paper-split";', 'import { PaperSplit } from "./paper-split";\nimport { ReviewFormBody } from "./review-form-preview";');
fs.writeFileSync(f, s); console.log("applied", n);
