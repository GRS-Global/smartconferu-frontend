import fs from "node:fs";
const f = "../src/features/chair/components/submission-settings-page.tsx"; let s = fs.readFileSync(f, "utf8");
const a = s.indexOf(`      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">`);
const end = `      </div>\n`; const b = s.indexOf(end, a) + end.length;
if (a < 0) throw new Error("block");
s = s.slice(0, a) + s.slice(b);
fs.writeFileSync(f, s); console.log("ok");
