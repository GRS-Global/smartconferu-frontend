import fs from "node:fs";
const f = "../src/features/chair/components/review-form-preview.tsx"; let s = fs.readFileSync(f, "utf8");
const a = `<div className="px-5 py-4 text-sm leading-[1.7] text-ink-soft"><Rich text={instructions.trim() ? instructions : STANDARD.join("\n\n")} /></div>`;
if (!s.includes(a)) throw new Error("missing");
s = s.replace(a, () => `<div className="space-y-3 px-5 py-4"><RichTextContent value={instructions.trim() ? instructions : standardInstructionsHtml()} /></div>`);
fs.writeFileSync(f, s); console.log("ok");
