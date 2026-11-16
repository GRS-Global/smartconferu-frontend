import fs from "node:fs";
const f = "../src/features/chair/components/review-settings-page.tsx"; let s = fs.readFileSync(f, "utf8");
const a = `meta: setup.instructions.trim() ? "Written" : "Standard text"`;
if (!s.includes(a)) throw new Error("x");
fs.writeFileSync(f, s.replace(a, () => `meta: setup.instructionsMode === "pdf" ? (setup.instructionsPdf ? "PDF uploaded" : "Not set") : setup.instructions.trim() ? "Written" : "Standard text"`)); console.log("ok");
