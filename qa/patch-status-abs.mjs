import fs from "node:fs";
const f = "../src/features/chair/components/review-settings-page.tsx"; let s = fs.readFileSync(f, "utf8");
const a = `<div aria-live="polite" className="-mb-3 h-4 text-right text-[11px] font-semibold text-ink-faint">`;
const b = `<div aria-live="polite" className="pointer-events-none absolute -top-5 right-0 h-4 text-right text-[11px] font-semibold text-ink-faint">`;
if (!s.includes(a)) throw new Error("a");
s = s.replace(a, () => b).replace(`        <div className="min-w-0 space-y-5">\n        {(error || problem)`, () => `        <div className="relative min-w-0 space-y-5">\n        {(error || problem)`);
fs.writeFileSync(f, s); console.log("ok");
