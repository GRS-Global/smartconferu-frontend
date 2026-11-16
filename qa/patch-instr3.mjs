import fs from "node:fs";
let f = "../src/features/chair/components/review-form-preview.tsx"; let s = fs.readFileSync(f, "utf8");
const a = s.indexOf("/** **bold** and \"- \" bullets"); const b = s.indexOf("\n}\n", s.indexOf("function Rich")) + 3;
if (a > 0 && b > a) s = s.slice(0, a) + s.slice(b).replace(/^\n/, "");
fs.writeFileSync(f, s);
f = "../src/features/chair/components/review-settings-page.tsx"; s = fs.readFileSync(f, "utf8");
s = s.replace(`import { INPUT_CLASS } from "@/components/ui/field";\n`, ""); fs.writeFileSync(f, s); console.log("ok");
