import fs from "node:fs";
const f = "../src/features/chair/components/policy-cards.tsx"; let s = fs.readFileSync(f, "utf8");
const a = `<div className="mb-4 flex items-start gap-3">\n        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-warning-soft`;
if (!s.includes(a)) throw new Error("x");
fs.writeFileSync(f, s.replace(a, () => a.replace("mb-4", "mb-3.5"))); console.log("ok");
