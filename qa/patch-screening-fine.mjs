import fs from "node:fs";
const f = "../src/features/chair/components/submission-settings-page.tsx"; let s = fs.readFileSync(f, "utf8"); let n = 0;
const rep = (a, b, all = false) => { if (!s.includes(a)) { console.log("MISSING", a.slice(0, 70)); return; } s = all ? s.split(a).join(b) : s.replace(a, () => b); n++; };
rep(">Required layout</label>", ">Required Layout</label>");
for (const [a, b] of [["Single column · min pages", "Single Column · Min Pages"], ["Single column · max pages", "Single Column · Max Pages"], ["Double column · min pages", "Double Column · Min Pages"], ["Double column · max pages", "Double Column · Max Pages"]]) rep(`"${a}"`, `"${b}"`);
// the prototype's compact 36 px boxes
s = s.replace(/className=\{`\$\{INPUT_CLASS\} tabular-nums/, () => { n++; return "className={`${INPUT_CLASS} !h-9 !py-0 !text-sm tabular-nums"; });
s = s.replace(/(id="sc-col"[^>]*?)className=\{INPUT_CLASS\}/, (_, a) => { n++; return a + 'className={`${INPUT_CLASS} !h-9 !py-0 !text-sm`}'; });
// green switches, as the prototype's screening toggles
rep('<span className="mt-1"><Switch label={`${s.label} menu`} checked={on[s.key]} onChange={(v) => toggleStep(s.key, v)} disabled={busy} /></span>', '<button type="button" role="switch" aria-checked={on[s.key]} aria-label={`${s.label} menu`} disabled={busy} onClick={() => toggleStep(s.key, !on[s.key])} style={{ background: on[s.key] ? "var(--success)" : "var(--border-strong)" }} className="relative mt-1 h-[22px] w-10 shrink-0 cursor-pointer rounded-full transition-colors disabled:opacity-60"><span style={{ transform: `translateX(${on[s.key] ? 20 : 2}px)` }} className="absolute left-0 top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow transition-transform" /></button>');
fs.writeFileSync(f, s); console.log("applied", n);
