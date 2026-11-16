// One-off edit helper (part 4): Email Templates edits one email on a page of its own (the prototype's editor), not in a dialog.
import fs from "node:fs";
const f = "../src/features/chair/components/email-templates-page.tsx";
let s = fs.readFileSync(f, "utf8"); let n = 0;
const rep = (a, b) => { if (!s.includes(a)) { console.log("MISSING:", a.slice(0, 80)); return; } s = s.replace(a, () => b); n += 1; };

// 1. the editor page replaces the list while an email is being edited
rep("  return (\n    <>\n      {error && !edit && !del &&", `  if (edit) {
    const def = edit.def;
    return (
      <>
        <EmailTemplateEditor edit={edit} setEdit={setEdit} moduleLabel={MODULES.find(([k]) => k === def?.module)?.[1] ?? ""} sendLabel={SEND_TYPES[def?.sendType ?? ""]?.label ?? ""} conferenceName={conferenceName} acronym={conferenceAcronym} back={back ?? null} busy={busy} error={error} onSave={() => void save()} onReset={() => void reset()} onClose={() => { if (!busy) { setEdit(null); setError(""); } }} />
        <FlowToast toast={toast} onClose={closeToast} />
      </>
    );
  }
  return (
    <>
      {error && !edit && !del &&`);
// 2. the dialog goes
const d0 = s.indexOf("      <Dialog open={edit !== null}");
const d1 = s.indexOf("      </Dialog>\n", d0) + "      </Dialog>\n".length;
if (d0 < 0 || d1 < d0) console.log("MISSING dialog"); else { s = s.slice(0, d0) + s.slice(d1); n += 1; }
// 3. what only the dialog used
const i0 = s.indexOf("  const insert = (f: string) => {");
const i1 = s.indexOf("\n  };\n", i0) + "\n  };\n".length;
if (i0 < 0) console.log("MISSING insert"); else { s = s.slice(0, i0) + s.slice(i1); n += 1; }
s = s.replace(/ ?setMode\("edit"\);/g, "");
const p0 = s.indexOf("  const preview = useMemo(");
if (p0 >= 0) { const p1 = s.indexOf("\n", p0); s = s.slice(0, p0) + s.slice(p1 + 1); n += 1; }
s = s.replace(/  const \[mode, setMode\] = useState<"edit" \| "preview">\("edit"\);\n/, "");
s = s.replace(/  const area = useRef<HTMLTextAreaElement>\(null\);\n/, "");
rep('import { emailPreviewDoc } from "../email-preview";\n', '');
rep('import { useEmailTemplates } from "../use-email-templates";', 'import { useEmailTemplates } from "../use-email-templates";\nimport { EmailTemplateEditor } from "./email-template-editor";');
// 4. where "Back" leads is the editor's business now
rep("authorOnly?: boolean; /** A template to open", "authorOnly?: boolean; /** Where \"Back to …\" leads (the page whose \"Edit template\" opened this). */ back?: { href: string; label: string } | null; /** A template to open");
rep("reload, authorOnly = false, openKey }", "reload, authorOnly = false, openKey, back }");
rep('{backOk && <Link href={back} className="mb-4 inline-flex items-center gap-1 text-[13px] font-bold text-primary hover:underline">← Back to {backLabel}</Link>}', '');
rep('openKey={asked.get("template") ?? undefined} />', 'openKey={asked.get("template") ?? undefined} back={backOk ? { href: back, label: backLabel } : null} />');
rep('import Link from "next/link";\n', '');
fs.writeFileSync(f, s); console.log("applied", n);
