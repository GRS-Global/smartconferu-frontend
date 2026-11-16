// One-off edit helper: Conference Settings › Decision as the prototype's (grid table, pills with a border, subtitle, button weight).
import fs from "node:fs";
const f = "../src/features/chair/components/decision-settings-page.tsx"; let s = fs.readFileSync(f, "utf8"); let n = 0;
const rep = (a, b) => { if (!s.includes(a)) { console.log("MISSING", a.slice(0, 80)); return; } s = s.replace(a, () => b); n++; };
rep("const pill = (color: string) => ({ color: `color-mix(in srgb, ${color} 78%, #000000)`, background: `${color}1A` });", "const pill = (color: string) => ({ color, background: `${color}1A`, border: `1px solid ${color}33` });\nconst COLS = \"grid grid-cols-[28px_44px_128px_minmax(120px,180px)_minmax(120px,180px)_minmax(0,1fr)_72px] items-center gap-3\";");
rep(`Drag <GripVertical size={11} aria-hidden="true" className="-mt-0.5 inline" /> to reorder (or focus it and use the arrow keys) — S.No.`, `Drag <GripVertical size={11} aria-hidden="true" className="-mt-0.5 inline" /> to reorder — S.No.`);
rep(`<Button size="sm" data-tour="dc-add" className="!px-4 !text-sm"`, `<Button size="sm" data-tour="dc-add" className="!px-4 !text-sm !font-semibold"`);

const a = s.indexOf(`            <div className="overflow-x-auto rounded-xl border border-line">`);
const endMark = `              </table>\n            </div>\n`;
const b = s.indexOf(endMark, a) + endMark.length;
if (a < 0 || b < endMark.length) throw new Error("table block");
const block = `            <div className="overflow-x-auto rounded-xl border border-line">
              <div className="min-w-[820px]">
                <div className={\`\${COLS} border-b border-line bg-canvas px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-ink-faint\`}><span /><span>S.No.</span><span>Color code</span><span>Chair decision</span><span>Author sees</span><span>Description</span><span className="pr-1 text-right">Actions</span></div>
                {types.map((t, i) => (
                  <div key={t.id} draggable onDragStart={(ev) => { if (!grab.current) { ev.preventDefault(); return; } setDragIndex(i); ev.dataTransfer.effectAllowed = "move"; ev.dataTransfer.setData("text/plain", String(i)); }} onDragOver={(ev) => { if (dragIndex === null) return; ev.preventDefault(); if (overIndex !== i) setOverIndex(i); }} onDrop={(ev) => { ev.preventDefault(); if (dragIndex !== null && dragIndex !== i) move(dragIndex, i); setDragIndex(null); setOverIndex(null); }} onDragEnd={() => { grab.current = false; setDragIndex(null); setOverIndex(null); }} style={{ borderTop: i === 0 ? "none" : "1px solid var(--muted)", boxShadow: overIndex === i && dragIndex !== null && dragIndex !== i ? \`inset 0 \${dragIndex < i ? "-2px" : "2px"} 0 var(--primary)\` : "none", opacity: dragIndex === i ? 0.45 : 1, background: dragIndex === i ? "var(--primary-soft)" : "#FFFFFF" }} className={\`\${COLS} group px-3 py-3 transition-colors hover:bg-canvas\`}>
                    <button type="button" disabled={busy} onMouseDown={() => { grab.current = true; }} onMouseUp={() => { grab.current = false; }} onKeyDown={(ev) => { if (ev.key === "ArrowUp") { ev.preventDefault(); move(i, i - 1); } if (ev.key === "ArrowDown") { ev.preventDefault(); move(i, i + 1); } }} aria-label={\`Reorder \${t.label} — drag, or use arrow keys\`} title="Drag to reorder (or focus and use ↑ ↓)" className="flex h-7 w-7 cursor-grab items-center justify-center rounded-lg text-ink-faint outline-none hover:bg-white hover:text-ink-muted focus-visible:ring-2 focus-visible:ring-primary active:cursor-grabbing disabled:opacity-30"><GripVertical size={15} aria-hidden="true" /></button>
                    <span className="text-sm font-bold tabular-nums text-ink-muted">{i + 1}</span>
                    <span className="flex min-w-0 items-center gap-2"><span style={{ background: t.color, boxShadow: "inset 0 0 0 1px rgba(15,23,42,0.12)" }} className="h-5 w-5 shrink-0 rounded-md" aria-hidden="true" /><code className="text-xs text-ink-soft [font-family:inherit]">{t.color.toUpperCase()}</code></span>
                    <span className="min-w-0"><span style={pill(t.color)} className="inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold"><span style={{ background: t.color }} className="h-1.5 w-1.5 shrink-0 rounded-full" aria-hidden="true" /><span className="truncate">{t.label}</span></span><span className="mt-1 block pl-1 text-[10px] font-semibold text-ink-faint">→ {OUTCOMES.find((o) => o.key === t.outcome)?.label ?? "No outcome set"}</span></span>
                    <span className="min-w-0 text-[12.5px] font-bold leading-snug text-navy" title={STAGES.includes(t.outcome) ? "Stage — the author never sees the chair's name for it" : "Exactly what the author sees on their paper"}>{AUTHOR_SEES[t.outcome] ?? t.label}</span>
                    <span className={\`line-clamp-2 text-xs leading-relaxed \${t.description ? "text-ink-soft" : "text-line-strong"}\`} title={t.description || undefined}>{t.description || "No description"}</span>
                    <span className="flex items-center justify-end gap-1"><button type="button" onClick={() => openEdit(t, i)} aria-label={\`Edit \${t.label}\`} title="Edit" className={\`\${iconBtn} cursor-pointer hover:bg-primary-soft hover:text-primary\`}><Pencil size={13} aria-hidden="true" /></button><button type="button" onClick={() => { setError(""); setDel(t); }} aria-label={\`Delete \${t.label}\`} title="Delete" className={\`\${iconBtn} cursor-pointer hover:bg-danger-soft hover:text-danger\`}><Trash2 size={13} aria-hidden="true" /></button></span>
                  </div>
                ))}
              </div>
            </div>
`;
s = s.slice(0, a) + block + s.slice(b); n++;
rep(`const AUTHOR_SEES:`, `const STAGES = ["upload_pending", "no_decision", "plagiarism_clear"];\nconst AUTHOR_SEES:`);
fs.writeFileSync(f, s); console.log("applied", n);
