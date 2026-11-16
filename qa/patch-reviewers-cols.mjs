// One-off edit helper: Reviewers page — On-time rate and Helpful columns (with filters and sorting), and the Edit reviewer dialog with the Tracks picker.
import fs from "node:fs";
let n = 0;
function patch(file, pairs) {
  let s = fs.readFileSync(file, "utf8");
  for (const [a, b] of pairs) { if (!s.includes(a)) { console.log("MISSING:", a.slice(0, 90)); continue; } s = s.replace(a, () => b); n += 1; }
  fs.writeFileSync(file, s);
}
// ---- service: save a reviewer's tracks (same table and same right as renaming one)
patch("../src/services/chair.ts", [["  renameReviewer(memberId: string, name: string): Promise<void>;", "  renameReviewer(memberId: string, name: string): Promise<void>;\n  /** Sets the tracks a committee member is scoped to (`conference_members.expertise`, the column the invitation fills in). */\n  setReviewerTracks(memberId: string, tracks: string[]): Promise<void>;"]]);
patch("../src/mocks/chair.ts", [["  async renameReviewer() { /* mock mode keeps nothing */ },", "  async renameReviewer() { /* mock mode keeps nothing */ },\n  async setReviewerTracks() { /* mock mode keeps nothing */ },"]]);
patch("../src/services/supabase/chair.ts", [["  async renameReviewer(memberId, name) {", `  async setReviewerTracks(memberId, tracks) {
    if (!UUID.test(memberId)) throw new ServiceError("Couldn't edit this reviewer.");
    const db: SupabaseClient = getSupabase();
    await currentUser(db);
    const { error } = await db.from("conference_members").update({ expertise: tracks }).eq("id", memberId);
    if (error) fail(error, "edit reviewers");
  },
  async renameReviewer(memberId, name) {`]]);

// ---- page
patch("../src/features/chair/components/reviewers-page.tsx", [
  ['import { Check, ChevronDown, ChevronsUpDown, ChevronUp, Pencil, Plus, Search, Trash2, X } from "lucide-react";', 'import { Check, ChevronDown, ChevronsUpDown, ChevronUp, Clock, Pencil, Plus, Search, ThumbsUp, Trash2, X } from "lucide-react";'],
  // row type + track record
  ['interface Row { rev: PoolReviewer; papers: Array<{ row: PrRow; state: ReviewerState; due: string }>; assigned: number; done: number; status: ReviewStatus }',
   `/** The prototype shows an on-time rate only from this many reviews. */
const TRACK_RECORD_MIN = 3;
interface Row { rev: PoolReviewer; papers: Array<{ row: PrRow; state: ReviewerState; due: string; submittedAt: string }>; assigned: number; done: number; status: ReviewStatus; sent: number; onTime: number; rate: number | null; helpful: number; overdueNow: number }
const isoOf = (label: string) => { const t = Date.parse(label); if (Number.isNaN(t)) return ""; const d = new Date(t); return \`\${d.getFullYear()}-\${String(d.getMonth() + 1).padStart(2, "0")}-\${String(d.getDate()).padStart(2, "0")}\`; };
const ONTIME_FILTER: Record<string, (r: Row) => boolean> = { high: (r) => r.rate != null && r.rate >= 0.9, mid: (r) => r.rate != null && r.rate >= 0.7 && r.rate < 0.9, low: (r) => r.rate != null && r.rate < 0.7, new: (r) => r.rate == null, overdue: (r) => r.overdueNow > 0 };
const ONTIME_OPTS: Array<[string, string]> = [["all", "All"], ["high", "90% and above"], ["mid", "70–89%"], ["low", "Below 70%"], ["new", "New reviewer"], ["overdue", "Overdue now"]];`],
  ['return x ? [{ row, state: x.state, due: x.r.due }] : []; })', 'return x ? [{ row, state: x.state, due: x.r.due, submittedAt: x.r.review?.submittedAt ?? "" }] : []; })'],
  ['    return { rev, papers, assigned: papers.length, done, status: papers.length === 0 || done === 0 ? "not_started" : done >= papers.length ? "completed" : "in_progress" };',
   `    // Their track record in THIS conference (the prototype counts every conference, which the database does not let a chair read): reviews sent by their due date.
    const sentOnes = papers.filter((p) => p.state === "done");
    const onTime = sentOnes.filter((p) => !p.due || (isoOf(p.submittedAt) || "0000") <= p.due).length;
    const overdueNow = papers.filter((p) => p.state === "overdue" && !p.row.decided).length;
    return { rev, papers, assigned: papers.length, done, status: papers.length === 0 || done === 0 ? "not_started" : done >= papers.length ? "completed" : "in_progress", sent: sentOnes.length, onTime, rate: sentOnes.length >= TRACK_RECORD_MIN ? onTime / sentOnes.length : null, helpful: 0, overdueNow };`],
  // state
  ['  const [f, setF] = useState({ search: "", track: "all", load: "all", status: "all" });', '  const [f, setF] = useState({ search: "", track: "all", load: "all", status: "all", ontime: "all", helpful: "all" });'],
  ['useState<{ key: "name" | "assigned" | null; dir: "asc" | "desc" }>', 'useState<{ key: "name" | "assigned" | "ontime" | "helpful" | null; dir: "asc" | "desc" }>'],
  // filters + sort
  ['    .filter((r) => f.status === "all" || (f.status === "invited" || f.status === "declined" ? r.rev.status === f.status : r.status === f.status));', '    .filter((r) => f.ontime === "all" || ONTIME_FILTER[f.ontime]?.(r))\n    .filter((r) => f.helpful === "all" || (f.helpful === "yes" ? r.helpful > 0 : r.helpful === 0))\n    .filter((r) => f.status === "all" || (f.status === "invited" || f.status === "declined" ? r.rev.status === f.status : r.status === f.status));'],
  ['    rows.sort((a, b) => sign * (sort.key === "name" ? a.rev.name.toLowerCase().localeCompare(b.rev.name.toLowerCase()) : a.assigned - b.assigned));', `    const val = (r: Row): number | string | null => (sort.key === "name" ? r.rev.name.toLowerCase() : sort.key === "assigned" ? r.assigned : sort.key === "ontime" ? r.rate : r.helpful);
    // A reviewer without a value (a new reviewer has no on-time rate) always sorts last.
    rows.sort((a, b) => { const av = val(a), bv = val(b); if (av == null || bv == null) return av == null ? (bv == null ? 0 : 1) : -1; return sign * (typeof av === "string" ? av.localeCompare(String(bv)) : av - Number(bv)); });`],
  ['const filtersOn = Boolean(q) || f.track !== "all" || f.load !== "all" || f.status !== "all";', 'const filtersOn = Boolean(q) || f.track !== "all" || f.load !== "all" || f.status !== "all" || f.ontime !== "all" || f.helpful !== "all";'],
  ['const toggleSort = (key: "name" | "assigned") => setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "name" ? "asc" : "desc" }));', 'const toggleSort = (key: "name" | "assigned" | "ontime" | "helpful") => setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "name" ? "asc" : "desc" }));'],
  ['const th = (label: string, o: { sortKey?: "name" | "assigned"; filter?: ReactNode; className?: string } = {}) => {', 'const th = (label: string, o: { sortKey?: "name" | "assigned" | "ontime" | "helpful"; filter?: ReactNode; className?: string; title?: string } = {}) => {'],
  ['      <th aria-sort={o.sortKey ?', '      <th title={o.title} aria-sort={o.sortKey ?'],
  ['onClick={() => setF({ search: "", track: "all", load: "all", status: "all" })}', 'onClick={() => setF({ search: "", track: "all", load: "all", status: "all", ontime: "all", helpful: "all" })}'],
  // headers
  ['                {th("Review status", { className: "min-w-[150px]",', `                {th("On-time rate", { sortKey: "ontime", className: "min-w-[130px]", title: "Reviews sent by their deadline (shown from 3 reviews). Counts this conference only for now.", filter: sel("On-time rate", f.ontime, set("ontime"), ONTIME_OPTS) })}
                {th("Helpful", { sortKey: "helpful", className: "min-w-[100px]", title: "Reviews marked Helpful by chairs", filter: sel("Helpful", f.helpful, set("helpful"), [["all", "All"], ["yes", "Has helpful"], ["no", "None"]]) })}
                {th("Review status", { className: "min-w-[150px]",`],
  // cells
  ['                      <td className="px-5 py-3"><span style={{ color: cfg.color, background: cfg.bg }} className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold">{cfg.label}</span></td>', `                      <td className="whitespace-nowrap px-5 py-3">
                        {r.rate == null
                          ? <span title={\`\${r.sent} sent so far\`} className="text-xs font-semibold text-ink-faint">New reviewer</span>
                          : <span title={\`\${r.onTime} of \${r.sent} on time\`} style={{ color: r.rate >= 0.9 ? "var(--success)" : r.rate >= 0.7 ? "#B45309" : "var(--danger)" }} className="font-bold tabular-nums">{Math.round(r.rate * 100)}%</span>}
                        {r.overdueNow > 0 && <div className="text-[11px] font-semibold text-danger">{r.overdueNow} overdue now</div>}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3">{r.helpful ? <span style={{ color: "#8A6212" }} className="inline-flex items-center gap-1 font-bold"><ThumbsUp size={12} aria-hidden="true" /> {r.helpful}</span> : <span className="text-line-strong">—</span>}</td>
                      <td className="px-5 py-3"><span style={{ color: cfg.color, background: cfg.bg }} className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold">{cfg.label}</span></td>`],
  ['<tr className="bg-canvas"><td colSpan={6}', '<tr className="bg-canvas"><td colSpan={8}'],
  ['<tr><td colSpan={6} className="py-8 text-center text-ink-faint">', '<tr><td colSpan={8} className="py-8 text-center text-ink-faint">'],
]);
console.log("applied", n);
