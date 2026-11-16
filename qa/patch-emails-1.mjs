// One-off edit helper (part 1): Email Templates opens a given template (?template=<key>) with a way back (?back=<path>&backLabel=<text>), and uses the shared preview.
import fs from "node:fs";
const f = "../src/features/chair/components/email-templates-page.tsx";
let s = fs.readFileSync(f, "utf8"); let n = 0;
const rep = (a, b) => { if (!s.includes(a)) { console.log("MISSING:", a.slice(0, 80)); return; } s = s.replace(a, () => b); n += 1; };

// shared preview
const a0 = s.indexOf("  const preview = useMemo(() => {");
const a1 = s.indexOf("  }, [edit, conferenceName, conferenceAcronym]);") + "  }, [edit, conferenceName, conferenceAcronym]);".length;
if (a0 < 0 || a1 < a0) console.log("MISSING preview block"); else { s = s.slice(0, a0) + '  const preview = useMemo(() => (edit ? emailPreviewDoc(edit.subject, edit.body, conferenceName, conferenceAcronym) : ""), [edit, conferenceName, conferenceAcronym]);' + s.slice(a1); n += 1; }
rep('const CSP = "default-src \'none\'; img-src \'self\' https: data:; style-src \'unsafe-inline\'";\n', '');
const sm0 = s.indexOf("const SAMPLE: Record<string, string> = {");
const sm1 = s.indexOf("\n", sm0);
if (sm0 < 0) console.log("MISSING SAMPLE"); else { s = s.slice(0, sm0) + s.slice(sm1 + 1); n += 1; }
const e0 = s.indexOf("const esc = (s: string) =>");
const e1 = s.indexOf("\n", e0);
if (e0 < 0) console.log("MISSING esc"); else { s = s.slice(0, e0) + s.slice(e1 + 1); n += 1; }
rep('import { frameEmailHtml } from "@/lib/email-frame";\n', '');
rep('import { useEmailTemplates } from "../use-email-templates";', 'import { emailPreviewDoc } from "../email-preview";\nimport { useEmailTemplates } from "../use-email-templates";');

// open a template by key + back link
rep('import { useCallback, useMemo, useRef, useState } from "react";', 'import Link from "next/link";\nimport { useSearchParams } from "next/navigation";\nimport { useCallback, useEffect, useMemo, useRef, useState } from "react";');
rep('export function EmailTemplatesPane({ slug, conferenceName, conferenceAcronym, templates, reload, authorOnly = false }: {', 'export function EmailTemplatesPane({ slug, conferenceName, conferenceAcronym, templates, reload, authorOnly = false, openKey }: {');
fs.writeFileSync(f, s); console.log("applied", n);
