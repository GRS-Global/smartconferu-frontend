import fs from "node:fs";
const f = "src/features/chair/components/review-form-preview.tsx"; let s = fs.readFileSync(f, "utf8");
const a = s.indexOf("export function ReviewFormBody"); const b = s.indexOf("/** The review form as the reviewer sees it");
s = s.slice(0, a) + fs.readFileSync("qa/rfb.txt", "utf8") + s.slice(b);
s = s.replace(`import { ChevronDown, ChevronRight, ChevronUp, Download,`, `import { Check, ChevronDown, ChevronRight, ChevronUp, Download,`);
fs.writeFileSync(f, s);
