// One-off edit helper: the own-review page's spacing, sticky bar and abstract text as the prototype's.
import fs from "node:fs";
const f = "../src/features/chair/components/chair-add-review-page.tsx"; let s = fs.readFileSync(f, "utf8"); let n = 0;
const rep = (a, b) => { if (!s.includes(a)) { console.log("MISSING", a.slice(0, 70)); return; } s = s.replace(a, () => b); n++; };
rep('<div className="space-y-4">\n              <PaperHeader', '<div>\n              <PaperHeader');
rep('className="flex items-start gap-2 rounded-xl px-3.5 py-2.5">\n                <Info', 'className="mb-4 flex items-start gap-2 rounded-xl px-3.5 py-2.5">\n                <Info');
rep('<ReviewFormBody form={detail.form}', '<div className="space-y-5"><ReviewFormBody form={detail.form}');
rep('onPolish={() => setPolish(true)} />', 'onPolish={() => setPolish(true)} /></div>');
rep('sticky bottom-0 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-white px-4 py-3 lg:bottom-0', 'sticky bottom-4 mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-white px-4 py-3');
rep('className={`rounded-2xl bg-white px-6 ${compact ? "py-3.5" : "py-5"}`}', 'className={`rounded-2xl bg-white px-6 ${compact ? "mb-4 py-3.5" : "mb-5 py-5"}`}');
rep('text-[15px] leading-relaxed text-ink-soft">{text}', 'text-sm leading-relaxed text-ink-soft">{text}');
fs.writeFileSync(f, s); console.log("applied", n);
