import fs from "node:fs";
const f = "../src/features/chair/components/decision-settings-page.tsx"; let s = fs.readFileSync(f, "utf8"); let n = 0;
const rep = (a, b) => { if (!s.includes(a)) { console.log("MISSING", a.slice(0, 80)); return; } s = s.replace(a, () => b); n++; };
rep(`interface Draft { id?: string; serial: number; label: string; color: string; hex: string; outcome: Outcome | ""; description: string }`, `interface Draft { id?: string; serial: number; label: string; color: string; hex: string; outcome: Outcome | ""; description: string; authorLabel: string }`);
rep(`setEditor({ serial: types.length + 1, label: "", color, hex: color, outcome: "", description: "" });`, `setEditor({ serial: types.length + 1, label: "", color, hex: color, outcome: "", description: "", authorLabel: "" });`);
rep(`outcome: t.outcome, description: t.description }); setTouched(false); setError(""); };`, `outcome: t.outcome, description: t.description, authorLabel: t.authorLabel ?? "" }); setTouched(false); setError(""); };`);
rep(`outcome, description: editor.description.trim() };`, `outcome, description: editor.description.trim(), authorLabel: editor.authorLabel.trim() || (editor.id ? "" : labelTrim) };`);
rep(`{AUTHOR_SEES[t.outcome] ?? t.label}</span>`, `{t.authorLabel?.trim() || AUTHOR_SEES[t.outcome] || t.label}</span>`);
rep(`          <div className="mt-5"><label htmlFor="dc-desc"`, `          <div className="mt-5">
            <span className="mb-1.5 block text-[13px] font-semibold text-ink-soft"><label htmlFor="dc-author">Author sees</label></span>
            <input id="dc-author" maxLength={120} value={editor.authorLabel} onChange={(e) => setEditor({ ...editor, authorLabel: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void save(); } }} placeholder={editor.id ? AUTHOR_SEES[editor.outcome as string] ?? "" : labelTrim || "Same as the decision name"} className={FIELD()} />
            <p className="mt-1.5 text-xs text-ink-faint">The exact status text the author sees on their paper. Leave blank to use {editor.id ? "the standard wording" : "the decision name"}.</p>
          </div>
          <div className="mt-5"><label htmlFor="dc-desc"`);
fs.writeFileSync(f, s); console.log("applied", n);
