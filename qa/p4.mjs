import fs from "node:fs";
const f = "../src/features/chair/components/submission-settings-page.tsx"; let s = fs.readFileSync(f, "utf8");
const a = s.indexOf('        <div id="ss-screening"'); const b = s.indexOf("\n", a);
const line = s.slice(a, b); s = s.slice(0, a) + s.slice(b + 1);
s = s.replace("        <SubmissionSettingsPanel\n", line + "\n        <SubmissionSettingsPanel\n");
s = s.replace(/\n          leadSections=\{\[\{ id: "ss-screening"[^\n]*\n/, "\n");
s = s.replace(/\n            \{ label: "Conference Details"[^\n]*\n            \{ label: "Review"[^\n]*\n/, "\n");
fs.writeFileSync(f, s);
