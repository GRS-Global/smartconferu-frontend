import fs from "node:fs";
const f = "../src/features/chair/components/submission-settings-page.tsx"; let s = fs.readFileSync(f, "utf8");
const rep = (a, b) => { if (!s.includes(a)) { console.log("MISSING", a.slice(0, 60)); return; } s = s.replace(a, () => b); };
rep(`    sim: bad(c.sim) || n(c.sim) > 100, ai: bad(c.ai) || n(c.ai) > 100, cdays: bad(c.cdays, 1), rdays: bad(c.rdays, 1),\n`, ``);
rep(`Check the numbers: a minimum can&apos;t be above its maximum, percentages are 0–100 and the days are at least 1.`, `Check the numbers: a minimum can&apos;t be above its maximum.`);
fs.writeFileSync(f, s); console.log("ok");
