// One-off edit helper: Settings › Decision's Add / Edit and Delete windows as the prototype's (Modal, S.No., colour picker, preview, footer).
import fs from "node:fs";
let n = 0;
const S = "../src/";
// ---- Modal: the prototype's "roomy" size
{
  const f = S + "components/ui/modal.tsx"; let s = fs.readFileSync(f, "utf8");
  const rep = (a, b) => { if (!s.includes(a)) { console.log("MISSING modal", a.slice(0, 70)); return; } s = s.replace(a, () => b); n++; };
  rep(`  maxWidth?: string;\n}`, `  maxWidth?: string;\n  /** The roomier header and body of the prototype's \`roomy\` modals (bigger icon tile and title, 28 px padding). */\n  roomy?: boolean;\n}`);
  rep(`actions, maxWidth = "max-w-md" }: ModalProps)`, `actions, maxWidth = "max-w-md", roomy = false }: ModalProps)`);
  rep(`<div className="ui-modal-head flex shrink-0 items-start justify-between gap-3 px-6 py-5">`, `<div className={cn("ui-modal-head flex shrink-0 items-start justify-between gap-3 py-5", roomy ? "px-7" : "px-6")}>`);
  rep(`className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-primary">\n                <Icon size={18} aria-hidden="true" />`, `className={cn("flex shrink-0 items-center justify-center rounded-xl bg-white text-primary", roomy ? "h-11 w-11" : "h-10 w-10")}>\n                <Icon size={roomy ? 20 : 18} aria-hidden="true" />`);
  rep(`<h3 id={\`\${uid}-title\`} className="text-base font-bold leading-snug text-navy">{title}</h3>\n              {subtitle && <p className="mt-0.5 text-xs text-ink-faint">{subtitle}</p>}`, `<h3 id={\`\${uid}-title\`} className={cn("font-bold leading-snug text-navy", roomy ? "text-lg" : "text-base")}>{title}</h3>\n              {subtitle && <p className={cn("mt-0.5 text-ink-faint", roomy ? "text-[13px]" : "text-xs")}>{subtitle}</p>}`);
  rep(`className={cn("min-h-0 overflow-y-auto overscroll-contain p-6", Boolean(actions) && "flex-1")}`, `className={cn("min-h-0 overflow-y-auto overscroll-contain", roomy ? "p-7" : "p-6", Boolean(actions) && "flex-1")}`);
  rep(`<div className="ui-modal-foot shrink-0 px-6 py-4">`, `<div className={cn("ui-modal-foot shrink-0 py-4", roomy ? "px-7" : "px-6")}>`);
  fs.writeFileSync(f, s);
}
// ---- the page
{
  const f = S + "features/chair/components/decision-settings-page.tsx"; let s = fs.readFileSync(f, "utf8");
  const a = s.indexOf("      <Dialog open={editor !== null}"); const b = s.indexOf("      <FlowToast toast={toast} onClose={closeToast} />");
  if (a < 0 || b < 0) throw new Error("dialogs");
  const neu = `      {editor && (
        <Modal title={editor.id ? "Edit decision" : "Add decision"} subtitle="Chairs pick from these when recording a decision on a submission." icon={Check} onClose={() => { if (!busy) setEditor(null); }} maxWidth="max-w-xl" roomy
          actions={<>
            <button type="button" onClick={() => setEditor(null)} disabled={busy} className="h-10 cursor-pointer rounded-xl px-3 text-sm font-semibold text-ink-muted transition-colors hover:bg-canvas">Cancel</button>
            <button type="button" onClick={() => void save()} disabled={busy || Boolean(errs.label || errs.hex)} className="h-10 cursor-pointer rounded-xl bg-primary px-5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Saving…" : editor.id ? "Save changes" : "Add decision"}</button>
          </>}>
          <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-4">
            <div><label htmlFor="dc-serial" className="mb-1.5 block text-[13px] font-semibold text-ink-soft"><HelpLabel help="decisionSerial">S.No.</HelpLabel> <span className="text-danger">*</span></label><input id="dc-serial" type="number" min={1} max={maxSerial} value={editor.serial} onChange={(e) => setEditor({ ...editor, serial: e.target.value === "" ? 0 : Number(e.target.value) })} onBlur={() => setEditor({ ...editor, serial: Math.min(Math.max(Number(editor.serial) || maxSerial, 1), maxSerial) })} className={\`\${FIELD()} tabular-nums\`} /></div>
            <div><label htmlFor="dc-label" className="mb-1.5 block text-[13px] font-semibold text-ink-soft"><HelpLabel help="decisionLabel">Decision</HelpLabel> <span className="text-danger">*</span></label><input id="dc-label" autoFocus maxLength={80} value={editor.label} onChange={(e) => { setEditor({ ...editor, label: e.target.value }); setTouched(true); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void save(); } }} placeholder="e.g. Accept with Shepherding" aria-invalid={touched && Boolean(errs.label)} className={FIELD(touched && Boolean(errs.label))} /></div>
          </div>
          <p className="mt-1.5 text-xs text-ink-faint">Position 1–{maxSerial}{!editor.id && " · defaults to the end"}. Other decisions shift to make room.</p>
          {touched && errs.label && <p role="alert" className="mt-1.5 flex items-center gap-1 text-xs font-medium text-danger"><AlertTriangle size={12} aria-hidden="true" /> {errs.label}</p>}
          <div className="mt-5"><label htmlFor="dc-desc" className="mb-1.5 block text-[13px] font-semibold text-ink-soft"><HelpLabel help="decisionDescription">Description</HelpLabel></label><textarea id="dc-desc" rows={3} maxLength={1000} value={editor.description} onChange={(e) => setEditor({ ...editor, description: e.target.value })} placeholder="What this decision means for the author — e.g. what they need to do next." className={\`\${FIELD()} resize-none\`} /></div>
          <div className="mt-5">
            <span className="mb-1.5 block text-[13px] font-semibold text-ink-soft"><HelpLabel help="decisionColor">Color code</HelpLabel> <span className="text-danger">*</span></span>
            <div className="rounded-2xl border border-line bg-canvas p-4">
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_148px]">
                <ColorPicker value={editor.color} onChange={(c) => setEditor({ ...editor, color: c, hex: c })} />
                <div className="flex flex-col gap-2.5">
                  <div style={{ background: editor.color, boxShadow: "inset 0 0 0 1px rgba(15,23,42,0.12)" }} className="h-14 rounded-xl" aria-hidden="true" />
                  <div>
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Hex code</span>
                    <input value={editor.hex} maxLength={7} spellCheck={false} placeholder="#16A34A" aria-label="Hex color code" onChange={(e) => { let v = e.target.value.trim().toUpperCase(); if (v && !v.startsWith("#")) v = \`#\${v}\`; setEditor({ ...editor, hex: v, color: HEX.test(v) ? v : editor.color }); }} className={\`\${FIELD(Boolean(errs.hex) && editor.hex.length >= 7)} font-mono uppercase\`} />
                  </div>
                  {eyedropper && <button type="button" onClick={() => { void eyedropper().open().then((r) => setEditor({ ...editor, color: r.sRGBHex.toUpperCase(), hex: r.sRGBHex.toUpperCase() })).catch(() => undefined); }} style={{ border: "1.5px solid var(--border)" }} className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-white text-xs font-semibold text-ink-soft transition-colors hover:border-primary hover:text-primary"><Pipette size={13} aria-hidden="true" /> Pick from screen</button>}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-3">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Quick picks</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {PRESETS.map((c, i) => { const active = editor.color.toUpperCase() === c; return (
                    <button key={\`\${c}-\${i}\`} type="button" onClick={() => setEditor({ ...editor, color: c, hex: c })} aria-label={\`Use \${c}\`} aria-pressed={active} title={c} style={{ background: c, boxShadow: active ? \`0 0 0 2px #FFFFFF, 0 0 0 4px \${c}\` : "inset 0 0 0 1px rgba(15,23,42,0.12)" }} className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full transition-transform hover:scale-110">{active && <Check size={12} strokeWidth={3} color="#FFFFFF" aria-hidden="true" />}</button>
                  ); })}
                </div>
              </div>
            </div>
            {errs.hex && editor.hex.length >= 7 && <p role="alert" className="mt-1.5 flex items-center gap-1 text-xs font-medium text-danger"><AlertTriangle size={12} aria-hidden="true" /> {errs.hex}</p>}
          </div>
          <div className="mt-5 flex items-center gap-3 rounded-xl border border-line bg-canvas px-4 py-3">
            <span className="shrink-0 text-[11px] font-bold uppercase tracking-wide text-ink-faint">Preview</span>
            <span className="text-sm font-bold tabular-nums text-ink-muted">{Math.min(Math.max(Number(editor.serial) || maxSerial, 1), maxSerial)}</span>
            <span style={pill(editor.color)} className="inline-flex min-w-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold"><span style={{ background: editor.color }} className="h-1.5 w-1.5 shrink-0 rounded-full" aria-hidden="true" /><span className="truncate">{labelTrim || "Decision name"}</span></span>
          </div>
          {error && <p role="alert" className="mt-3 text-sm font-semibold text-danger">{error}</p>}
        </Modal>
      )}
      {del && (
        <Modal title={\`Delete "\${del.label}"?\`} subtitle="Chairs won't be able to pick this decision any more." icon={Trash2} onClose={() => { if (!busy) setDel(null); }} maxWidth="max-w-md"
          actions={<>
            <button type="button" onClick={() => setDel(null)} disabled={busy} className="h-10 cursor-pointer rounded-xl px-3 text-sm font-semibold text-ink-muted transition-colors hover:bg-canvas">Cancel</button>
            <button type="button" onClick={() => void remove()} disabled={busy} className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-xl bg-danger px-5 text-sm font-semibold text-white disabled:opacity-60"><Trash2 size={14} aria-hidden="true" /> {busy ? "Deleting…" : "Delete"}</button>
          </>}>
          <p className="text-sm leading-relaxed text-ink-soft">Decisions already recorded with it stay on their submissions. The remaining decisions are renumbered.</p>
          {error && <p role="alert" className="mt-3 text-sm font-semibold text-danger">{error}</p>}
        </Modal>
      )}
`;
  s = s.slice(0, a) + neu + s.slice(b); n++;
  const rep = (x, y) => { if (!s.includes(x)) { console.log("MISSING page", x.slice(0, 70)); return; } s = s.replace(x, () => y); n++; };
  rep(`const PRESETS = ["#16A34A", "#DC2626", "#F59E0B", "#8B5CF6", "#0EA5E9", "#0D9488", "#EC4899", "#64748B", "#F97316", "#84CC16", "#6366F1", "#14B8A6"];`, `// The prototype's quick picks (its list names #7C3AED twice).\nconst PRESETS = ["#16A34A", "#0D9488", "#2563EB", "#7C3AED", "#7C3AED", "#DB2777", "#DC2626", "#EA580C", "#F59E0B", "#64748B"];\nconst FIELD = (bad = false) => \`w-full rounded-xl border-[1.5px] bg-white px-3.5 py-2.5 text-sm outline-none transition-all placeholder:text-slate-400 focus:ring-4 \${bad ? "border-danger focus:ring-danger-soft" : "border-line focus:border-primary focus:ring-primary-soft"}\`;\ntype EyeDropperCtor = new () => { open: () => Promise<{ sRGBHex: string }> };\nconst eyedropper = typeof window !== "undefined" && "EyeDropper" in window ? () => new (window as unknown as { EyeDropper: EyeDropperCtor }).EyeDropper() : null;`);
  rep(`import { Check, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";`, `import { AlertTriangle, Check, GripVertical, Pencil, Pipette, Plus, Trash2 } from "lucide-react";`);
  rep(`import { Dialog } from "@/components/ui/dialog";`, `import { ColorPicker } from "@/components/ui/color-picker";\nimport { Modal } from "@/components/ui/modal";`);
  rep(`import { INPUT_CLASS } from "@/components/ui/field";\n`, ``);
  fs.writeFileSync(f, s);
}
console.log("applied", n);
