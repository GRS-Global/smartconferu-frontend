// One-off edit helper: drag to reorder fields (inside a section) and sections (from the Sections list), as the prototype's form editor.
import fs from "node:fs";
const f = "../src/features/chair/components/review-form-builder.tsx"; let s = fs.readFileSync(f, "utf8"); let n = 0;
const rep = (a, b) => { if (!s.includes(a)) { console.log("MISSING", a.slice(0, 70)); return; } s = s.replace(a, () => b); n++; };
rep('  const insert = (sid: string, at: number, type: FieldType) => {', `  // Drag to reorder (the prototype's dropField / dropSection): a field moves inside its own section, a section moves in the Sections list.
  const dragField = useRef<{ sid: string; fid: string } | null>(null);
  const dragSection = useRef<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const dropField = (sid: string, target: string) => {
    const from = dragField.current; dragField.current = null; setOver(null);
    if (!from || from.sid !== sid || from.fid === target) return;
    commit(secs.map((x) => {
      if (x.id !== sid) return x;
      const fields = [...x.fields]; const a = fields.findIndex((y) => y.id === from.fid); const b = fields.findIndex((y) => y.id === target);
      if (a < 0 || b < 0) return x;
      const [moved] = fields.splice(a, 1); fields.splice(b, 0, moved); return { ...x, fields };
    }));
  };
  const dropSection = (target: string) => {
    const from = dragSection.current; dragSection.current = null; setOver(null);
    if (!from || from === target) return;
    const list = [...secs]; const a = list.findIndex((x) => x.id === from); const b = list.findIndex((x) => x.id === target);
    if (a < 0 || b < 0) return;
    const [moved] = list.splice(a, 1); list.splice(b, 0, moved); commit(list);
  };
  const insert = (sid: string, at: number, type: FieldType) => {`);
rep('<div className={`group/f rounded-xl border border-transparent px-3 py-3 transition-colors hover:border-line hover:bg-canvas/60 ${open === f.id ? "border-[var(--primary-soft-border)] bg-canvas/60" : ""} ${hiddenFields.includes(f.id) ? "opacity-50" : ""}`}>',
  '<div draggable={!locked(f) && open !== f.id} onDragStart={() => { dragField.current = { sid: s.id, fid: f.id }; }} onDragEnd={() => setOver(null)} onDragOver={(e) => { if (dragField.current?.sid === s.id) { e.preventDefault(); setOver(f.id); } }} onDrop={() => dropField(s.id, f.id)} className={`group/f rounded-xl border border-transparent px-3 py-3 transition-colors hover:border-line hover:bg-canvas/60 ${open === f.id ? "border-[var(--primary-soft-border)] bg-canvas/60" : ""} ${over === f.id && dragField.current && dragField.current.fid !== f.id ? "!border-primary" : ""} ${hiddenFields.includes(f.id) ? "opacity-50" : ""}`}>');
rep('<Hover label={`Edit ${f.label}`}', '<span title={locked(f) ? "Locked field — can’t be reordered" : "Drag to reorder"} aria-hidden="true" className={`px-1.5 ${locked(f) ? "cursor-not-allowed text-line-strong" : "cursor-grab text-ink-faint active:cursor-grabbing"}`}><GripVertical size={13} /></span>\n                      <Hover label={`Edit ${f.label}`}');
rep('<li key={x.id}><button type="button" onClick={() => document.getElementById(`fb-sec-${x.id}`)', '<li key={x.id} draggable title="Drag to reorder sections" onDragStart={() => { dragSection.current = x.id; }} onDragEnd={() => setOver(null)} onDragOver={(e) => { if (dragSection.current) { e.preventDefault(); setOver(`s:${x.id}`); } }} onDrop={() => dropSection(x.id)} className={`cursor-grab rounded-lg ${over === `s:${x.id}` && dragSection.current !== x.id ? "ring-1 ring-primary" : ""}`}><button type="button" onClick={() => document.getElementById(`fb-sec-${x.id}`)');
rep('Use the arrows to reorder.', 'Drag a field (or a section in the list on the right) to reorder, or use the arrows.');
fs.writeFileSync(f, s); console.log("applied", n);
