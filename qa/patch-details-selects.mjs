// One-off edit helper: Conference Details' selects as the prototype's (12 px side padding, a light chevron, the placeholder in the faint colour until a value is chosen),
// the timezone picker, and the topics row (the small Add button and a working "Suggest with AI").
import fs from "node:fs";
const f = "../src/features/chair/components/conference-details-page.tsx"; let s = fs.readFileSync(f, "utf8"); let n = 0;
const rep = (a, b) => { if (!s.includes(a)) { console.log("MISSING", a.slice(0, 90)); return; } s = s.replace(a, () => b); n++; };

rep('const MIN_TOPICS = 4;', `const MIN_TOPICS = 4;
const AI_TOPICS = 5;
// The prototype's selects: 12 px side padding, a light chevron, and the placeholder in the faint colour until a value is chosen.
const CHEVRON = { backgroundImage: "url(\\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center" } as const;
const selectCls = (value: string) => cn("w-full appearance-none rounded-lg border-[1.5px] border-line bg-white px-3 py-2.5 pr-9 text-sm outline-none focus:border-primary disabled:bg-canvas disabled:text-ink-muted", value ? "text-ink" : "text-ink-faint");`);

// the selects
rep('<select id="cd-a1" value={f.primaryArea} onChange={(ev) => setF((s) => ({ ...s, primaryArea: ev.target.value, secondaryArea: "" }))} className={INPUT_CLASS}>', '<select id="cd-a1" value={f.primaryArea} onChange={(ev) => setF((s) => ({ ...s, primaryArea: ev.target.value, secondaryArea: "" }))} style={CHEVRON} className={selectCls(f.primaryArea)}>');
rep('<select id="cd-a2" value={f.secondaryArea} disabled={!f.primaryArea} onChange={(ev) => set("secondaryArea", ev.target.value)} className={INPUT_CLASS}>', '<select id="cd-a2" value={f.secondaryArea} disabled={!f.primaryArea} onChange={(ev) => set("secondaryArea", ev.target.value)} style={CHEVRON} className={selectCls(f.secondaryArea)}>');
rep('<select id="cd-lang" value={f.language} onChange={(ev) => set("language", ev.target.value)} className={INPUT_CLASS}>', '<select id="cd-lang" value={f.language} onChange={(ev) => set("language", ev.target.value)} style={CHEVRON} className={selectCls(f.language)}>');
rep('<select id="cd-status" disabled value={f.status} className={INPUT_CLASS}>', '<select id="cd-status" disabled value={f.status} style={CHEVRON} className={selectCls(f.status)}>');
rep('<select id="cd-country" value={f.country} onChange={(ev) => set("country", ev.target.value)} className={INPUT_CLASS}>', '<select id="cd-country" value={f.country} onChange={(ev) => set("country", ev.target.value)} style={CHEVRON} className={selectCls(f.country)}>');

// the timezone picker (the same searchable list as Create Conference)
const t0 = s.indexOf('<select id="cd-tz"'); const t1 = s.indexOf("</select>", t0) + "</select>".length;
if (t0 < 0) console.log("MISSING tz"); else { s = s.slice(0, t0) + '<TimezoneSelect id="cd-tz" value={f.timezone} onChange={(v) => set("timezone", v)} />' + s.slice(t1); n++; }

// the topics row
const a0 = s.indexOf('<div className="flex gap-2"><input aria-label="Add a topic"'); const a1 = s.indexOf("</div>", s.indexOf("Suggest with AI", a0)) + "</div>".length;
if (a0 < 0) console.log("MISSING topics row"); else {
  s = s.slice(0, a0) + `<div className="flex flex-wrap items-center gap-2"><input aria-label="Add a topic" value={topic} onChange={(ev) => setTopic(ev.target.value)} onKeyDown={(ev) => { if (ev.key === "Enter") { ev.preventDefault(); addTopic(); } }} placeholder="Add a topic and press Enter…" className={cn(INPUT_CLASS, "min-w-[12rem] flex-1 !px-3 !py-2")} /><button type="button" onClick={addTopic} className="shrink-0 cursor-pointer rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink-muted hover:bg-canvas">Add</button><button type="button" onClick={() => void suggest()} disabled={ai.status === "loading"} className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--primary-soft-border)] bg-primary-soft px-3 text-xs font-bold text-primary disabled:opacity-60"><Sparkles size={13} aria-hidden="true" /> {ai.status === "loading" ? "Suggesting…" : "Suggest with AI"}</button></div>` + s.slice(a1); n++;
}
rep('{f.topics.length} topic{f.topics.length === 1 ? "" : "s"} · at least {MIN_TOPICS} required</p>', '{f.topics.length} topic{f.topics.length === 1 ? "" : "s"} · at least {MIN_TOPICS} required{ai.status === "done" && ai.added > 0 && <span className="font-normal text-ink-muted"> — AI added {ai.added}; please check them.</span>}</p>\n                {ai.status === "error" && <p role="alert" className="mt-1 flex items-center gap-1 text-xs font-semibold text-danger"><AlertTriangle size={12} aria-hidden="true" /> {ai.message}</p>}');

// the suggest handler
rep('  const e = encodeURIComponent(slug);\n  const tabBtn', `  const [ai, setAi] = useState<{ status: "idle" | "loading" | "done" | "error"; added?: number; message?: string }>({ status: "idle" });
  const suggest = async () => {
    setAi({ status: "loading" });
    try {
      const found = await suggestTopics({ title: f.name, about: f.about, primaryArea: f.primaryArea, secondaryArea: f.secondaryArea, existing: f.topics, count: Math.max(1, AI_TOPICS - f.topics.length) });
      const next = [...f.topics]; found.forEach((t) => { if (!next.some((x) => x.toLowerCase() === t.toLowerCase())) next.push(t); });
      set("topics", next); setAi({ status: "done", added: next.length - f.topics.length });
    } catch (err) { setAi({ status: "error", message: err instanceof Error ? err.message : "Couldn't suggest topics." }); }
  };
  const e = encodeURIComponent(slug);
  const tabBtn`);

// imports
rep('import { Sparkles, X } from "lucide-react";', 'import { AlertTriangle, Sparkles, X } from "lucide-react";');
rep('import { INPUT_CLASS } from "@/components/ui/field";', 'import { INPUT_CLASS } from "@/components/ui/field";\nimport { TimezoneSelect } from "@/components/ui/timezone-select";');
rep('import { AuthRequiredError } from "@/services/errors";', 'import { AuthRequiredError } from "@/services/errors";\nimport { suggestTopics } from "@/services/paper-ai";');
fs.writeFileSync(f, s); console.log("applied", n);
