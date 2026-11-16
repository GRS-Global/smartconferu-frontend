// One-off edit helper (part 2): the pane opens ?template=<key> straight in its editor; the page shows a "Back to …" link when it was opened from a settings page.
import fs from "node:fs";
const f = "../src/features/chair/components/email-templates-page.tsx";
let s = fs.readFileSync(f, "utf8"); let n = 0;
const rep = (a, b) => { if (!s.includes(a)) { console.log("MISSING:", a.slice(0, 80)); return; } s = s.replace(a, () => b); n += 1; };
rep("templates: EmailTemplates; reload: () => void; authorOnly?: boolean }) {", "templates: EmailTemplates; reload: () => void; authorOnly?: boolean; /** A template to open in its editor at once (from \"Edit template\" on the review settings). */ openKey?: string }) {");
// after openPlatform is defined: open the asked template once
const i = s.indexOf("  const openCustom = (t: ConferenceTemplate) =>");
if (i < 0) console.log("MISSING openCustom"); else {
  s = s.slice(0, i) + `  const opened = useRef("");
  useEffect(() => {
    if (!openKey || opened.current === openKey) return;
    const t = templates.platform.find((x) => x.key === openKey);
    opened.current = openKey;
    if (t) { openPlatform(t); requestAnimationFrame(() => document.getElementById(\`et-\${t.key}\`)?.scrollIntoView({ block: "center" })); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openKey, templates]);
` + s.slice(i); n += 1;
}
// the page
rep("  const { conference, roles, others, screening, templates } = state;\n  return (", `  const { conference, roles, others, screening, templates } = state;
  // Opened from a settings page's "Edit template": go straight to that email and offer the way back (only to a page of this app).
  const back = asked.get("back") ?? "";
  const backOk = back.startsWith("/chair/") && !back.startsWith("//");
  const backLabel = (asked.get("backLabel") ?? "").slice(0, 60) || "where you were";
  return (`);
rep("export function EmailTemplatesPage({ slug }: { slug: string }) {\n  const { state, retry, reload } = useEmailTemplates(slug);", "export function EmailTemplatesPage({ slug }: { slug: string }) {\n  const { state, retry, reload } = useEmailTemplates(slug);\n  const asked = useSearchParams();");
rep('<div className="hd-page p-8"><EmailTemplatesPane slug={slug} conferenceName={conference.name} conferenceAcronym={conference.acronym} templates={templates} reload={reload} /></div>', '<div className="hd-page p-8">{backOk && <Link href={back} className="mb-4 inline-flex items-center gap-1 text-[13px] font-bold text-primary hover:underline">← Back to {backLabel}</Link>}<EmailTemplatesPane slug={slug} conferenceName={conference.name} conferenceAcronym={conference.acronym} templates={templates} reload={reload} openKey={asked.get("template") ?? undefined} /></div>');
fs.writeFileSync(f, s); console.log("applied", n);
