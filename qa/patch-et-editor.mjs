import fs from "node:fs";
const f = "../src/features/chair/components/email-template-editor.tsx"; let s = fs.readFileSync(f, "utf8"); let n = 0;
const rep = (a, b) => { if (!s.includes(a)) { console.log("MISSING", a.slice(0, 90)); return; } s = s.replace(a, () => b); n++; };
// categories as the prototype's EMAIL_AUDIENCE_META
const a = s.indexOf("const ROLE_TONE:"); const b = s.indexOf("};", a) + 2;
s = s.slice(0, a) + `const ROLE_TONE: Record<string, { color: string; bg: string; label: string }> = {
  author: { color: "var(--primary)", bg: "var(--primary-soft)", label: "Author" },
  reviewer: { color: "var(--success)", bg: "var(--success-soft)", label: "Reviewer" },
  chair: { color: "var(--secondary)", bg: "var(--secondary-soft)", label: "Program Chair" },
  roles: { color: "var(--cat-virtual)", bg: "var(--cat-virtual-soft)", label: "Team & Roles" },
  registration: { color: "var(--warning)", bg: "var(--warning-soft)", label: "Registration" },
  account: { color: "var(--navy)", bg: "var(--muted)", label: "Any user" },
  custom: { color: "var(--ink-muted)", bg: "var(--muted)", label: "Custom" },
};` + s.slice(b); n++;
rep(`<div className="mb-4 flex flex-wrap items-center gap-4 text-xs font-bold">`, `<div className="mb-3.5 flex flex-wrap items-center gap-4 text-xs font-bold">`);
rep(`<button type="button" onClick={onClose} disabled={busy} className="cursor-pointer text-ink-muted hover:text-primary hover:underline">All email templates</button>`, `<button type="button" onClick={onClose} disabled={busy} className="flex cursor-pointer items-center gap-1.5 text-ink-muted transition-colors hover:text-primary">{back ? "All email templates" : <><ChevronLeft size={14} aria-hidden="true" /> Email Templates</>}</button>`);
rep(`{!edit.custom && edit.hasCopy && <button`, `{!edit.custom && edited && <button`);
rep(`  const tone = ROLE_TONE[`, `  // "Reset to default" is only for an email whose text differs from the platform's (the prototype's isEdited).\n  const edited = Boolean(edit.def && (edit.subject !== edit.def.subject || edit.body.trim() !== edit.def.body.trim()));\n  const tone = ROLE_TONE[`);
rep(`              {!edit.custom && info("Main recipient", (edit.def?.recipients ?? "").split(" · ")[0])}`, `              {!edit.custom && info("Main recipient", (edit.def?.recipients ?? "").split(" · ")[0])}\n              {!edit.custom && info("Also sent to", (edit.def?.recipients ?? "").split(" · ").slice(1).join(" · "))}\n              {!edit.custom && info("Contains", EMAIL_SUMMARIES[edit.key] ?? "")}`);
rep(`import { `, `import { EMAIL_SUMMARIES } from "../email-summaries";\nimport { `);
fs.writeFileSync(f, s); console.log("applied", n);
