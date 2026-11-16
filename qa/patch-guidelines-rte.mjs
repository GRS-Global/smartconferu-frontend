import fs from "node:fs";
let n = 0;
const edit = (file, pairs) => { let s = fs.readFileSync(file, "utf8"); for (const [a, b] of pairs) { if (!s.includes(a)) { console.log("MISSING", file.split("/").pop(), a.slice(0, 80)); continue; } s = s.split(a).join(b); n++; } fs.writeFileSync(file, s); };
const d = "../src/features/";
edit(d + "chair/components/submission-settings-panel.tsx", [
  [`<textarea value={guideDraft} onChange={(e) => setGuideDraft(e.target.value)} rows={10} placeholder="e.g. formatting requirements, page limits, anonymisation policy and templates…" aria-label="Submission guidelines" className={\`\${inputCls(false)} min-h-[220px] resize-y leading-relaxed\`} />`,
   `<RichTextEditor value={settings.submission.guidelines} onChange={setGuideDraft} placeholder="e.g. formatting requirements, page limits, anonymisation policy and templates…" label="Submission guidelines" />`],
  [`const hasGuidelines = Boolean(policy.guidelines.trim());`, `const hasGuidelines = hasRichText(policy.guidelines);`],
]);
edit(d + "author/components/submit-paper-page.tsx", [
  [`{showGuide && <div className="space-y-3 px-5 py-4 text-[13px] leading-relaxed text-ink-soft">{info.guidelines.split(/\n{2,}/).map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}</div>}`, `{showGuide && <RichTextContent value={info.guidelines} className="px-5 py-4" />}`],
  [`{info.guidelines.trim() && (`, `{hasRichText(info.guidelines) && (`],
]);
edit(d + "chair/components/submission-form-preview.tsx", [
  [`{showGuide && <div className="space-y-3 px-5 py-4 text-[13px] leading-relaxed text-ink-soft">{guidelines.trim() ? guidelines.split(/\n{2,}/).map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>) : <p className="text-ink-faint">No guidelines written yet — add them under Conference Settings › Submissions.</p>}</div>}`,
   `{showGuide && (hasRichText(guidelines) ? <RichTextContent value={guidelines} className="px-5 py-4" /> : <div className="px-5 py-4 text-[13px] leading-relaxed"><p className="text-ink-faint">No guidelines written yet — add them under Conference Settings › Submissions.</p></div>)}`],
  [`useState(() => guidelines.trim() !== "")`, `useState(() => hasRichText(guidelines))`],
]);
console.log("applied", n);
