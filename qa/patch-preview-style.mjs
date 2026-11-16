// One-off edit helper: Peer Review › Manage › Form vs the prototype (computed-style audit): textarea size, confidence buttons, Edit form button, aside width, hero spacing, "Try it on a real paper" wording.
import fs from "node:fs";
let n = 0;
function patch(file, pairs) {
  let s = fs.readFileSync(file, "utf8");
  for (const [a, b, all] of pairs) { if (!s.includes(a)) { console.log("MISSING:", a.slice(0, 90)); continue; } s = all ? s.split(a).join(b) : s.replace(a, () => b); n += 1; }
  fs.writeFileSync(file, s);
}
patch("../src/features/chair/components/review-form-preview.tsx", [
  // textareas: 8 rows of 22.75 px text, transparent background (prototype: 204 px high)
  ['rows={6} value={String(a[f.id] ?? "")}', 'rows={8} value={String(a[f.id] ?? "")}', true],
  ['<h2 className="mt-3 text-xl font-extrabold tracking-tight text-navy">', '<h2 className="mt-2 text-xl font-extrabold tracking-tight text-navy">'],
  ['xl:grid-cols-[minmax(0,1fr)_300px]', 'xl:grid-cols-[minmax(0,1fr)_272px]'],
  ['mt-4 flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-white hover:bg-primary-hover"><Pencil size={13} aria-hidden="true" /> Edit form</button>', 'mt-4 flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary text-xs font-bold text-white hover:bg-primary-hover"><Pencil size={13} aria-hidden="true" /> Edit form</button>'],
  ['className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-white hover:bg-primary-hover"><Pencil size={13} aria-hidden="true" /> Edit form</Link>', 'className="mt-4 flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-primary text-xs font-bold text-white hover:bg-primary-hover"><Pencil size={13} aria-hidden="true" /> Edit form</Link>'],
  ['<p className="mt-1 text-[11px] text-ink-faint">Opens {tryLabel} with the paper header and details.</p>', '<p className="mt-1 text-[11px] leading-relaxed text-ink-faint">Opens the full review page for {tryLabel}, with the paper header and details.</p>'],
  ['hover:bg-canvas">Open paper</Link>', 'gap-1 hover:bg-canvas">Open review page <ChevronRight size={13} aria-hidden="true" /></Link>'],
  ['import { ChevronUp, Eye,', 'import { ChevronRight, ChevronUp, Eye,'],
]);
console.log("applied", n);
