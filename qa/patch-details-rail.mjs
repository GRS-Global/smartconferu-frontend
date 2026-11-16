// One-off edit helper: Conference Details' rail link "Presentation types" shows the real list and the prototype's status ("Incomplete" until the chair has set them, then "✓ Done").
import fs from "node:fs";
let n = 0;
const edit = (file, pairs) => { let s = fs.readFileSync(file, "utf8"); for (const [a, b] of pairs) { if (!s.includes(a)) { console.log("MISSING", file.split("/").pop(), a.slice(0, 80)); continue; } s = s.replace(a, () => b); n++; } fs.writeFileSync(file, s); };
const d = "../src/features/chair/";
edit(d + "use-conference-info.ts", [
  ['screening: Screening; info: ConferenceInfo }', 'screening: Screening; info: ConferenceInfo; settings: ConferenceSettings }'],
  ['const [data, info] = await Promise.all([chair.loadConference(slug), chair.loadInfo(slug)]);', 'const [data, info, settings] = await Promise.all([chair.loadConference(slug), chair.loadInfo(slug), chair.loadSettings(slug)]);'],
  ['screening: data.screening, info };', 'screening: data.screening, info, settings };'],
  ['import type { ConferenceInfo } from "@/types/chair";', 'import type { ConferenceInfo, ConferenceSettings } from "@/types/chair";'],
]);
edit(d + "components/sections-rail.tsx", [
  ['export interface RailLink { label: string; desc: string; href?: string; onClick?: () => void }', 'export interface RailLink { label: string; desc: string; href?: string; onClick?: () => void; /** A word on the right instead of nothing: "Incomplete", or "Done" with a tick (the prototype\'s status). */ status?: { label: string; done?: boolean } }'],
]);
// the two link renderings: a status before the arrow
let r = fs.readFileSync(d + "components/sections-rail.tsx", "utf8");
const arrow = '<ChevronRight size={14} aria-hidden="true" className="shrink-0 text-line-strong" />';
const status = '{l.status && <span className={`flex shrink-0 items-center gap-1 text-[11.5px] font-bold ${l.status.done ? "text-success" : "text-ink-muted"}`}>{l.status.done && <Check size={12} strokeWidth={3} aria-hidden="true" />}{l.status.label}</span>}\n                ';
if (r.split(arrow).length - 1 >= 2) { r = r.split("<span className=\"min-w-0 flex-1\"><span className=\"block text-[13px] font-bold text-navy\">{l.label}</span><span className=\"block text-[11.5px] text-ink-faint\">{l.desc}</span></span>\n                " + arrow).join("<span className=\"min-w-0 flex-1\"><span className=\"block text-[13px] font-bold text-navy\">{l.label}</span><span className=\"block text-[11.5px] text-ink-faint\">{l.desc}</span></span>\n                " + status + arrow); n++; } else console.log("MISSING arrows");
if (!/import \{[^}]*\bCheck\b[^}]*\} from "lucide-react"/.test(r)) r = r.replace(/import \{([^}]*)\} from "lucide-react";/, (m, g) => `import {${g.trimEnd()}, Check } from "lucide-react";`);
fs.writeFileSync(d + "components/sections-rail.tsx", r);
edit(d + "components/conference-details-page.tsx", [
  ['function Form({ initial, slug, typesCount, onSave, busy, tab, setTab }: { initial: ConferenceInfo; slug: string; typesCount: number;', 'function Form({ initial, slug, types, typesSet, onSave, busy, tab, setTab }: { initial: ConferenceInfo; slug: string; types: string[]; typesSet: boolean;'],
  ['links={[{ label: "Presentation types", desc: typesCount ? `${typesCount} set up` : "Incomplete", href:', 'links={[{ label: "Presentation types", desc: types.join(", ") || "None yet", status: typesSet ? { label: "Done", done: true } : { label: "Incomplete" }, href:'],
  ['typesCount={3} busy={busy}', 'types={state.settings.presentationTypes} typesSet={state.settings.stored} busy={busy}'],
]);
console.log("applied", n);
