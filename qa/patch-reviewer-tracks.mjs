// One-off edit helper: Add / Edit reviewer — the Tracks picker (a dropdown with checkboxes, as in the prototype) in both dialogs; Edit saves the tracks too.
import fs from "node:fs";
const file = "../src/features/chair/components/reviewers-page.tsx";
let s = fs.readFileSync(file, "utf8"); let n = 0;
const rep = (a, b) => { if (!s.includes(a)) { console.log("MISSING:", a.slice(0, 90)); return; } s = s.replace(a, () => b); n += 1; };

rep('function ReviewerForm(', `/** The Tracks picker (the prototype's Fourwaves-style multi-select): a trigger that shows the chosen tracks and a checkbox list to pick more than one. */
function TrackPicker({ tracks, picked, onChange }: { tracks: string[]; picked: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex w-full cursor-pointer items-center gap-2 rounded-xl border-[1.5px] border-line bg-white px-3.5 py-2.5 text-left text-sm outline-none focus:border-primary">
        <span className={\`min-w-0 flex-1 truncate \${picked.length ? "text-ink" : "text-slate-400"}\`}>{picked.length ? picked.join(", ") : "Select one or more tracks"}</span>
        <ChevronDown size={16} aria-hidden="true" className="shrink-0 text-ink-faint" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden="true" />
          <div role="listbox" aria-multiselectable="true" style={{ border: "1px solid var(--border)", boxShadow: "0 12px 28px rgba(11,16,32,0.12)" }} className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-xl bg-white p-1.5">
            {tracks.map((t) => (
              <label key={t} className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-ink hover:bg-canvas">
                <input type="checkbox" className="cursor-pointer accent-primary" checked={picked.includes(t)} onChange={() => onChange(picked.includes(t) ? picked.filter((x) => x !== t) : [...picked, t])} /> {t}
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ReviewerForm(`);
// both modes show the Tracks field
rep('        {mode === "add" && (\n          <div>\n            <div className="mb-1 text-xs font-semibold text-ink-soft">Tracks</div>', '        {(\n          <div>\n            <div className="mb-1 text-xs font-semibold text-ink-soft">Tracks</div>');
rep('              <div className="flex flex-wrap gap-2">{tracks.map((t) => <label key={t} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-xs font-semibold text-ink-soft"><input type="checkbox" checked={picked.includes(t)} onChange={() => setPicked((l) => (l.includes(t) ? l.filter((x) => x !== t) : [...l, t]))} /> {t}</label>)}</div>', '              <TrackPicker tracks={tracks} picked={picked} onChange={setPicked} />');
fs.writeFileSync(file, s);
console.log("applied", n);
