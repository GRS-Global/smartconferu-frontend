// One-off edit helper: the Sections rail's type and colours as the prototype's (measured with Playwright on both): header 12 px bold + 11 px muted, items 12.5 px
// semibold with 11 px muted notes, a 10 px status pill, and link cards 12 px semibold (slate) with 11 px faint text and 11 px status.
import fs from "node:fs";
const f = "../src/features/chair/components/sections-rail.tsx"; let s = fs.readFileSync(f, "utf8"); let n = 0;
const rep = (a, b, all = false) => { if (!s.includes(a)) { console.log("MISSING", a.slice(0, 80)); return; } s = all ? s.split(a).join(b) : s.replace(a, () => b); n++; };
rep('<div className="border-b border-muted px-5 py-3.5"><div className="text-sm font-bold text-navy">{title}</div><div className="text-xs text-ink-faint">{sub}</div></div>', '<div className="border-b border-muted px-4 py-3.5"><div className="text-xs font-bold text-navy">{title}</div><div className="text-[11px] text-ink-muted">{sub}</div></div>');
rep('<span className={`block text-[13px] font-bold ${on ? "text-primary" : "text-navy"}`}>{s.label}</span>{s.meta && <span className="mt-0.5 block text-[11px] leading-snug text-ink-faint">{s.meta}</span>}', '<span className={`block text-[12.5px] font-semibold ${on ? "text-primary" : "text-navy"}`}>{s.label}</span>{s.meta && <span className="mt-0.5 block text-[11px] leading-snug text-ink-muted">{s.meta}</span>}');
rep('className="mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold">{s.tone.label}', 'className="mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold">{s.tone.label}');
rep('<span className="min-w-0 flex-1"><span className="block text-[13px] font-bold text-navy">{l.label}</span><span className="block text-[11.5px] text-ink-faint">{l.desc}</span></span>', '<span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-ink-soft">{l.label}</span><span className="block text-[11px] text-ink-faint">{l.desc}</span></span>', true);
rep('text-[11.5px] font-bold ${l.status.done ? "text-success" : "text-ink-muted"}', 'text-[11px] font-semibold ${l.status.done ? "text-success" : "text-ink-faint"}', true);
rep('gap-2 px-5 py-3 text-left transition-colors hover:bg-canvas', 'gap-2 px-4 py-3.5 text-left transition-colors hover:bg-canvas');
rep('gap-2 px-5 py-3 transition-colors hover:bg-canvas', 'gap-2 px-4 py-3.5 transition-colors hover:bg-canvas');
fs.writeFileSync(f, s); console.log("applied", n);
