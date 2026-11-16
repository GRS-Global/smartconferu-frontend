// One-off edit helper: Conference Settings › Submissions › Paper Screening as the prototype's ScreeningSettingsCard: a full-width card above the page's two columns,
// toggles and fields saved as they change (no Save button), the "Auto initial check" paid-feature row, and no Paper Screening entry in the rail.
import fs from "node:fs";
const f = "../src/features/chair/components/submission-settings-page.tsx"; let s = fs.readFileSync(f, "utf8"); let n = 0;
const rep = (a, b) => { if (!s.includes(a)) { console.log("MISSING", a.slice(0, 80)); return; } s = s.replace(a, () => b); n++; };

// 1. the card: header, autosave, Auto initial check
const c0 = s.indexOf("  return (\n    <Card icon={ShieldCheck} title=\"Paper Screening\"");
const c1 = s.indexOf("      <div className=\"grid gap-3 md:grid-cols-2\">", c0);
if (c0 < 0 || c1 < 0) console.log("MISSING card head"); else {
  const save = s.slice(s.indexOf("onSave({", c0), s.indexOf("})", s.indexOf("onSave({", c0)) + 2);
  s = s.slice(0, c0) + `  // The prototype saves each change as it is made: the toggles at once, a number when its box is left.
  const payload = () => ({ initialCheck: on.initialCheck, plagiarism: on.plagiarism, criteria: { column: c.column as ScreeningCriteria["column"], minPages: n(c.min), maxPages: n(c.max), doubleMinPages: n(c.dmin), doubleMaxPages: n(c.dmax), similarityLimit: n(c.sim), aiLimit: n(c.ai), correctionDays: n(c.cdays), revisionDays: n(c.rdays) } });
  const saved = useRef(JSON.stringify(payload()));
  const flush = () => { const now = JSON.stringify(payload()); if (ok && now !== saved.current) { saved.current = now; onSave(payload()); } };
  const toggleStep = (k: "initialCheck" | "plagiarism", v: boolean) => { const next = { ...on, [k]: v }; setOn(next); saved.current = JSON.stringify({ ...payload(), initialCheck: next.initialCheck, plagiarism: next.plagiarism }); onSave({ ...payload(), initialCheck: next.initialCheck, plagiarism: next.plagiarism }); };
  return (
    <section style={CARD} className="rounded-2xl bg-white p-6">
      <h3 className="text-base font-extrabold text-navy">Paper Screening</h3>
      <p className="mb-4 mt-0.5 text-sm text-ink-muted">Each step you turn on gets its own menu in the sidebar. With both off, papers go straight to peer review.</p>
` + s.slice(c1); n++;
  void save;
}
rep('<Switch label={`${s.label} menu`} checked={on[s.key]} onChange={(v) => setOn({ ...on, [s.key]: v })} />', '<Switch label={`${s.label} menu`} checked={on[s.key]} onChange={(v) => toggleStep(s.key, v)} disabled={busy} />');
// Auto initial check row (a paid feature: shown off, as the prototype does when the plan does not include it)
rep(`      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">`, `      <div style={{ opacity: on.initialCheck ? 1 : 0.55 }} className="mt-3 rounded-xl border-[1.5px] border-line bg-white p-4">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-canvas text-ink-faint"><Sparkles size={18} /></span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-bold text-navy">Auto initial check</span><span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 text-[10.5px] font-bold text-warning"><Lock size={10} aria-hidden="true" /> Paid feature</span></div>
            <p className="mt-0.5 text-xs text-ink-muted">The system decides the initial check for every new paper, so you only handle the exceptions: a paper that meets every requirement passes by itself; one that doesn&apos;t is dealt with as chosen below. You can still change any decision.</p>
          </div>
          <span className="mt-1"><Switch label="Auto initial check" checked={false} onChange={() => undefined} disabled /></span>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">`);
// numbers saved when the box is left
s = s.replace(/<input id=\{id\} type="number" min=\{0\} value=\{c\[key\]\} disabled=\{disabled\} aria-invalid=\{p\} onChange=\{\(e\) => setC\(\{ \.\.\.c, \[key\]: e\.target\.value \}\)\}/, (m) => { n++; return m + " onBlur={flush}"; });
s = s.replace(/<select id="sc-col" value=\{c\.column\} disabled=\{!on\.initialCheck\} onChange=\{\(e\) => setC\(\{ \.\.\.c, column: e\.target\.value as ScreeningCriteria\["column"\] \}\)\}/, (m) => { n++; return m + " onBlur={flush}"; });
rep('    </Card>\n  );\n}\n\nexport function SubmissionSettingsPage', '    </section>\n  );\n}\n\nexport function SubmissionSettingsPage');

// 2. the card sits above the two columns; no rail entry
rep('<div id="ss-screening" className="scroll-mt-24"><Screening ', '<div id="ss-screening" className="mb-6 scroll-mt-24"><Screening ');
fs.writeFileSync(f, s); console.log("applied", n);
