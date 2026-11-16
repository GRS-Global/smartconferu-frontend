// One-off edit helper (Chair Peer Review slice 3): Manage › Reviews table: the prototype's ID sort (three states, highest first, the table's own order),
// shift-click / drag range selection, and its status wording and colours (PR_REVIEW_STATUS).
import fs from "node:fs";
const file = "../src/features/chair/components/peer-review-manage-page.tsx";
let s = fs.readFileSync(file, "utf8");
let n = 0;
const rep = (a, b) => { if (!s.includes(a)) { console.log("MISSING:", a.slice(0, 80)); return; } s = s.replace(a, b); n += 1; };

rep('import { workspaceGate } from "@/features/workspace/components/workspace-gate";', 'import { workspaceGate } from "@/features/workspace/components/workspace-gate";\nimport { useIdSort } from "@/lib/use-id-sort";\nimport { useRangeSelect } from "@/lib/use-range-select";');
rep('import { useChairConference } from "../use-chair-conference";', 'import { useChairConference } from "../use-chair-conference";\nimport { IdSortLabel } from "./screening-ui";');
rep('const csvCell =', `/** The prototype's review-status wording and colours for this table (PR_REVIEW_STATUS). */
const REVIEW_STATUS: Record<ReviewerState, { label: string; color: string; bg: string }> = {
  done: { label: "Submitted", color: "var(--success)", bg: "var(--success-soft)" },
  active: { label: "Reviewing", color: "var(--primary)", bg: "var(--primary-soft)" },
  overdue: { label: "Overdue", color: "var(--danger)", bg: "var(--danger-soft)" },
  waiting: { label: "Not accepted yet", color: "#B45309", bg: "var(--warning-soft)" },
  invite: { label: "Invitation pending", color: "#B45309", bg: "var(--warning-soft)" },
};
const csvCell =`);
rep('  const [dir, setDir] = useState<"asc" | "desc">("asc");', "  const idSort = useIdSort();\n  const range = useRangeSelect();");
rep("  const filtered = rows.filter(", "  const filtered = idSort.sort(rows.filter(");
rep("    .sort((a, b) => (dir === \"asc\" ? 1 : -1) * a.paper.id.localeCompare(b.paper.id, undefined, { numeric: true }));", "  , (r) => r.paper.id);\n  const pick = range({ ids: filtered.map((r) => r.key), isSelected: (k) => selected.includes(k), setMany: (ids, on) => setSelected((l) => (on ? [...new Set([...l, ...ids])] : l.filter((x) => !ids.includes(x)))) });");
rep('REVIEWER_STATE[r.state].word, r.review?.submittedAt', 'REVIEW_STATUS[r.state].label, r.review?.submittedAt');
rep("{(Object.keys(REVIEWER_STATE) as ReviewerState[]).map((k) => <option key={k} value={k}>{REVIEWER_STATE[k].word}</option>)}", "{(Object.keys(REVIEW_STATUS) as ReviewerState[]).map((k) => <option key={k} value={k}>{REVIEW_STATUS[k].label}</option>)}");
rep('<th aria-sort={dir === "asc" ? "ascending" : "descending"} className="whitespace-nowrap px-5 py-3 text-left"><button type="button" onClick={() => setDir((d) => (d === "asc" ? "desc" : "asc"))} className="font-semibold hover:text-navy">Submission number {dir === "asc" ? "▲" : "▼"}</button></th>', '<th className="whitespace-nowrap px-5 py-3 text-left"><IdSortLabel label="Submission number" dir={idSort.dir} onToggle={idSort.toggle} /></th>');
rep('<tr key={r.key} onClick={() => router.push(`/submissions/${encodeURIComponent(r.paper.id)}/chair/review`)} className=', '<tr key={r.key} {...pick.row(r.key)} onClick={() => router.push(`/submissions/${encodeURIComponent(r.paper.id)}/chair/review`)} className=');
rep('<input type="checkbox" checked={on} aria-label={`Select ${r.paper.title}`} onChange={() => setSelected((l) => (l.includes(r.key) ? l.filter((x) => x !== r.key) : [...l, r.key]))} />', '<input type="checkbox" checked={on} aria-label={`Select ${r.paper.title}`} {...pick.box(r.key)} />');
rep("const m = REVIEWER_STATE[r.state];", "const m = REVIEW_STATUS[r.state];");
rep('<span style={{ color: m.color, background: `color-mix(in srgb, ${m.color} 12%, white)` }} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold">{r.state === "done" && <Check size={11} strokeWidth={2.5} aria-hidden="true" />} {m.word}</span>', '<span style={{ color: m.color, background: m.bg }} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold">{r.state === "done" && <Check size={11} strokeWidth={2.5} aria-hidden="true" />} {m.label}</span>');
fs.writeFileSync(file, s);
console.log("applied", n, "of 12");
