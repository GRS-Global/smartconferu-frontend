// One-off edit helper: Conference Settings › Review as the prototype's (date boxes, switch rows, Fields visible box, reviewer instructions editor, rail text).
import fs from "node:fs";
let n = 0;
const edit = (file, pairs) => { let s = fs.readFileSync(file, "utf8"); for (const [a, b] of pairs) { if (!s.includes(a)) { console.log("MISSING", file.split("/").pop(), a.slice(0, 90)); continue; } s = s.replace(a, () => b); n++; } fs.writeFileSync(file, s); };
const d = "../src/features/chair/components/";

// ---- review-settings-page.tsx
edit(d + "review-settings-page.tsx", [
  [`import { AlertTriangle, CalendarDays, Clock, Users } from "lucide-react";`, `import { AlertTriangle, Calendar, Clock, Users } from "lucide-react";`],
  [`icon={CalendarDays} title="Reviewing period"`, `icon={Calendar} title="Reviewing period"`],
  [`type="datetime-local" value={tl.opensAt} onChange={(e) => onOpens(e.target.value)} className={INPUT_CLASS} />`, `type="datetime-local" value={tl.opensAt} onChange={(e) => onOpens(e.target.value)} className={DATE_BOX} />`],
  [`aria-invalid={Boolean(bad)} className={\`\${INPUT_CLASS} \${bad ? "border-danger" : ""}\`} />`, `aria-invalid={Boolean(bad)} className={\`\${DATE_BOX} \${bad ? "!border-danger" : ""}\`} />`],
  [`const PERIOD_LABEL =`, `const DATE_BOX = "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-primary";\nconst PERIOD_LABEL =`],
  [`meta: tl.opensAt || tl.closesAt ? \`\${tl.opensAt.replace("T", " ") || "—"} – \${tl.closesAt.replace("T", " ") || "—"}\` : "Not set"`, `meta: tl.opensAt || tl.closesAt ? \`\${when(tl.opensAt)} – \${when(tl.closesAt)}\` : "Not set"`],
  [`meta: \`\${tl.reviewDays} days · \${tl.reminder1Enabled ? \`reminder \${tl.reminder1Days} days before\` : "reminder 1 off"}\${tl.reminder2Enabled ? " and on the last day" : ""}\``, `meta: \`\${tl.reviewDays} days · reminders \${[tl.reminder1Enabled && reminderWhen(tl.reminder1Days), tl.reminder2Enabled && reminderWhen(tl.reminder2Days)].filter(Boolean).join(" and ") || "off"}\``],
  [`\`up to \${lim.maxPapersPerReviewer} papers each\``, `\`max \${lim.maxPapersPerReviewer} per reviewer\``],
  [`          <InstructionsEditor key={\`i-\${setup.instructions}-\${settings.stored}\`}`, `          <InstructionsEditor key={\`i-\${setup.instructions}-\${settings.stored}\`}`],
  [`          <div className="px-1 text-[10.5px] font-bold uppercase tracking-wider text-ink-faint">How reviewers see it</div>\n          <InstructionsPreview text={setup.instructions} />\n`, ``],
  [`import { InstructionsPreview } from "./review-form-preview";\n`, ``],
]);
{
  const f = d + "review-settings-page.tsx"; let s = fs.readFileSync(f, "utf8");
  s = s.replace(`const PERIOD_LABEL =`, () => `const when = (v: string) => (v ? new Date(v).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "—");\nconst reminderWhen = (days: number) => (Number(days) === 0 ? "on the last day" : \`\${days} day\${Number(days) === 1 ? "" : "s"} before\`);\nconst PERIOD_LABEL =`);
  fs.writeFileSync(f, s);
}

// ---- policy-cards.tsx: switch rows and the Fields visible box
edit(d + "policy-cards.tsx", [
  [`function Tile({ title, help, checked, onChange, className }: { title: string; help: string; checked: boolean; onChange: (v: boolean) => void; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 rounded-xl border border-line bg-white p-4", className)}>
      <div className="min-w-0"><div className="text-[13.5px] font-bold text-navy">{title}</div><div className="mt-0.5 text-xs text-ink-faint">{help}</div></div>`,
   `function Tile({ title, help, helpKey, checked, onChange, className }: { title: string; help: string; helpKey: string; checked: boolean; onChange: (v: boolean) => void; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-4 rounded-xl border border-line px-4 py-3", className)}>
      <div className="min-w-0"><div className="text-sm font-semibold text-ink"><HelpLabel help={helpKey}>{title}</HelpLabel></div><div className="mt-0.5 text-xs text-ink-faint">{help}</div></div>`],
  [`<div className="grid gap-3 sm:grid-cols-2">\n        <Tile title="Double-blind review"`, `<div className="grid gap-3 lg:grid-cols-2">\n        <Tile helpKey="doubleBlind" title="Double-blind review"`],
  [`<Tile title="Reviewer Access to Unassigned Submissions"`, `<Tile helpKey="nonChairsSeeUnassigned" title="Reviewer Access to Unassigned Submissions"`],
  [`<Tile title="Allow Abstract Pre-Submission"`, `<Tile helpKey="preSubmissionAbstracts" title="Allow Abstract Pre-Submission"`],
  [`<Tile title="Require Presenter Selection"`, `<Tile helpKey="authorsSelectPresenter" title="Require Presenter Selection"`],
  [`<Tile title="Share Results to Authors"`, `<Tile helpKey="shareResultsToAuthors" title="Share Results to Authors"`],
  [`      <div className="mt-5">
        <div className="text-[13.5px] font-bold text-navy"><HelpLabel help="fieldsVisibleToReviewers">Fields visible to reviewers</HelpLabel></div>
        <button type="button" aria-expanded={openList} onClick={() => setOpenList(!openList)} className="mt-1.5 flex h-10 w-full max-w-xs items-center justify-between rounded-lg border-[1.5px] border-line bg-white px-3.5 text-sm text-ink hover:border-line-strong">{shown} selected<span aria-hidden="true">▾</span></button>
        {openList && (
          <ul className="mt-2 max-w-xs space-y-1 rounded-xl border border-line bg-white p-2">
            {fields.map((f) => <li key={f.id}><label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-canvas"><input type="checkbox" checked={!p.hiddenFields.includes(f.id)} onChange={() => toggle(f.id)} className="accent-[var(--primary)]" />{f.label}</label></li>)}
          </ul>
        )}
        <p className="mt-1.5 text-xs text-ink-faint">`,
   `      <div className="mt-4 border-t border-muted pt-4">
        <div className="mb-1.5 block text-sm font-semibold text-ink"><HelpLabel help="fieldsVisibleToReviewers">Fields visible to reviewers</HelpLabel></div>
        <div ref={listRef} className="relative max-w-md">
          <button type="button" aria-expanded={openList} onClick={() => setOpenList(!openList)} className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none">{shown} selected<ChevronDown size={15} aria-hidden="true" className="text-ink-faint" /></button>
          {openList && (
            <div className="absolute z-20 mt-1.5 max-h-72 w-full overflow-y-auto overflow-hidden rounded-lg border border-line bg-white shadow-lg">
              {fields.map((f) => <label key={f.id} className="flex cursor-pointer items-center gap-2.5 px-3.5 py-2 text-sm text-ink hover:bg-canvas"><input type="checkbox" checked={!p.hiddenFields.includes(f.id)} onChange={() => toggle(f.id)} className="cursor-pointer accent-[var(--primary)]" /><span className="flex-1">{f.label}</span></label>)}
            </div>
          )}
        </div>
        <p className="mt-2 text-xs text-ink-faint">`],
  [`  const [openList, setOpenList] = useState(false);\n`, `  const [openList, setOpenList] = useState(false);\n  const listRef = useRef<HTMLDivElement>(null);\n  // A click outside closes the list (the prototype's dropdown).\n  useEffect(() => {\n    if (!openList) return undefined;\n    const down = (e: MouseEvent) => { if (listRef.current && !listRef.current.contains(e.target as Node)) setOpenList(false); };\n    document.addEventListener("mousedown", down);\n    return () => document.removeEventListener("mousedown", down);\n  }, [openList]);\n`],
  [`import { Clock, Eye, EyeOff, FileText, Hash, Mail, Pencil, Send } from "lucide-react";`, `import { ChevronDown, Clock, Eye, EyeOff, FileText, Hash, Mail, Pencil, Send } from "lucide-react";`],
]);
console.log("applied", n);
