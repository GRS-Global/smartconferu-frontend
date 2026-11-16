// One-off edit helper: the review form as the prototype's ReviewFormBody draws it (numbered sections, ratings table, confidence buttons) becomes a controlled component, used by the Manage preview and by the chair's own-review page.
import fs from "node:fs";
const f = "../src/features/chair/components/review-form-preview.tsx";
let s = fs.readFileSync(f, "utf8");
const h0 = s.indexOf('  const conf = (f: ReviewField, gap = "ml-2")');
const h1 = s.indexOf('  return (\n    <div className="mx-auto max-w-[1064px]">');
const m0 = s.indexOf("          {form.map((s, si) => {");
const m1 = s.indexOf("          })}\n        </div>\n        <aside", m0) + "          })}\n".length;
if (h0 < 0 || h1 < 0 || m0 < 0 || m1 < m0) { console.log("MISSING", h0, h1, m0, m1); process.exit(1); }
let helpers = s.slice(h0, h1);
let map = s.slice(m0, m1);
const conv = (t) => t
  .replace(/a\[f\.id\]/g, "values[f.id]")
  .replace(/setA\(\{ \.\.\.a, \[f\.id\]: ([^}]+?) \}\)/g, "onChange(f.id, $1)")
  .replace("<textarea id={`rfp-${f.id}`}", "<textarea id={`rfp-${f.id}`} disabled={disabled}")
  .replace('<button key={i} type="button" role="radio"', '<button key={i} type="button" role="radio" disabled={disabled}')
  .replace('<button key={o} type="button" aria-pressed', '<button key={o} type="button" disabled={disabled} aria-pressed');
helpers = conv(helpers); map = conv(map);
const body = `/** The review form as the reviewer sees it: numbered sections, the long answers, the ratings table and the confidence buttons. Controlled: \`values\` / \`onChange\`. */
export function ReviewFormBody({ form, hiddenFields = [], values, onChange, disabled = false }: { form: ReviewSection[]; hiddenFields?: string[]; values: Record<string, string | number | string[] | undefined>; onChange: (id: string, v: string | number) => void; disabled?: boolean }) {
${helpers}  return (
    <>
${map}    </>
  );
}

`;
// the preview uses it
s = s.slice(0, m0) + "          <ReviewFormBody form={form} hiddenFields={hiddenFields} values={a} onChange={(id, v) => setA((x) => ({ ...x, [id]: v }))} />\n" + s.slice(m1);
s = s.slice(0, h0) + s.slice(h1);
const at = s.indexOf("export function ReviewFormPreview(");
s = s.slice(0, at) + body + s.slice(at);
fs.writeFileSync(f, s); console.log("ok");
