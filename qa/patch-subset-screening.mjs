// One-off edit helper: Submissions settings (Paper Screening card + header) as the prototype's.
import fs from "node:fs";
const f = "../src/features/chair/components/submission-settings-page.tsx"; let s = fs.readFileSync(f, "utf8"); let n = 0;
const rep = (a, b) => { if (!s.includes(a)) { console.log("MISSING", a.slice(0, 90)); return; } s = s.split(a).join(b); n++; };
rep(`once a paper is cleared.`, `once it's clear.`);
rep(`<Icon size={17} />`, `<Icon size={18} />`);
rep(`<span className="mt-1"><Switch label="Auto initial check" checked={false} onChange={() => undefined} disabled /></span>`,
  `<button type="button" role="switch" aria-checked={false} aria-label="Auto initial check" disabled style={{ background: "var(--border-strong)" }} className="relative mt-1 h-[22px] w-10 shrink-0 cursor-not-allowed rounded-full opacity-60 transition-colors"><span style={{ transform: "translateX(2px)" }} className="absolute left-0 top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow transition-transform" /></button>`);
rep(`import { Switch } from "@/components/ui/switch";\n`, ``);
rep(`import { INPUT_CLASS } from "@/components/ui/field";\n`, ``);
// the prototype's compact cell inputs: 36 px high, 12 px text, 6 px corners
rep(`const LABEL = "mb-1 block text-xs font-bold text-ink-soft";`, `const LABEL = "mb-1 block text-xs font-bold text-ink-soft";
const CELL = "h-9 w-full rounded-md border-[1.5px] border-line bg-white px-2 text-xs text-ink outline-none focus:border-primary disabled:bg-canvas disabled:text-ink-faint";`);
rep("className={`${INPUT_CLASS} !h-9 !py-0 !text-sm tabular-nums ${p ? \"border-danger\" : \"\"}`}", "className={`${CELL} tabular-nums ${p ? \"!border-danger\" : \"\"}`}");
rep(`onBlur={flush} className={INPUT_CLASS}><option value="single">`, `onBlur={flush} className={\`\${CELL} cursor-pointer disabled:cursor-not-allowed\`}><option value="single">`);
rep(`{ label: "Conference Settings" }]} />`, `{ label: "Conference Settings" }, { label: "Submissions" }]} />`);
fs.writeFileSync(f, s); console.log("applied", n);
