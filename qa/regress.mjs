// Phase 3B regression: compares two audit files (qa/out/<before>.json and qa/out/<after>.json) page by page: new / fixed computed-style differences
// (element + property), changed control counts, new missing controls, and the per-state pixel difference. Pages present in only one file are listed.
// Usage: node regress.mjs before-phase3b-audit.json audit.json [page,page]
import fs from "node:fs";
const [a, b, only] = process.argv.slice(2);
const load = (f) => new Map(JSON.parse(fs.readFileSync(`out/${f}`, "utf8")).audit.map((e) => [e.page, e]));
const A = load(a), B = load(b);
const filter = only ? only.split(",") : null;
const keyOf = (d) => `${d.element}|${d.property}`;
let newDiffs = 0, fixed = 0, countChanges = 0, newMissing = 0, pagesCompared = 0, worse = 0;
const lines = [];
for (const [id, before] of A) {
  if (filter && !filter.includes(id)) continue;
  const after = B.get(id);
  if (!after) { lines.push(`- ${id}: missing in the new run`); continue; }
  pagesCompared++;
  const row = [];
  for (const vp of Object.keys(before.viewports || {})) {
    const x = before.viewports[vp], y = after.viewports?.[vp];
    if (!x || !y) continue;
    const sx = new Set((x.styles?.diffs ?? []).filter((d) => d.severity !== "low").map(keyOf));
    const sy = new Map((y.styles?.diffs ?? []).filter((d) => d.severity !== "low").map((d) => [keyOf(d), d]));
    const added = [...sy.keys()].filter((k) => !sx.has(k));
    const gone = [...sx].filter((k) => !sy.has(k));
    newDiffs += added.length; fixed += gone.length;
    if (added.length) row.push(`${vp}: ${added.length} NEW style diff(s): ${added.slice(0, 4).join("; ")}`);
    if (gone.length) row.push(`${vp}: ${gone.length} fixed`);
    const cx = (x.fields ?? []).filter((f) => f.kind === "count").map((f) => `${f.prototype}/${f.next}`).join(","), cy = (y.fields ?? []).filter((f) => f.kind === "count").map((f) => `${f.prototype}/${f.next}`).join(",");
    if (cx !== cy) { countChanges++; row.push(`${vp}: control count ${cx || "equal"} -> ${cy || "equal"}`); }
    const mx = (x.fields ?? []).filter((f) => f.kind === "missing-in-next").length, my = (y.fields ?? []).filter((f) => f.kind === "missing-in-next").length;
    if (my > mx) { newMissing += my - mx; row.push(`${vp}: ${my - mx} more control(s) missing in Next.js`); }
  }
  for (const [st, sb] of Object.entries(before.states ?? {})) {
    const sa = after.states?.[st];
    if (!sa || typeof sb.diffPercent !== "number" || typeof sa.diffPercent !== "number") continue;
    if (sa.diffPercent - sb.diffPercent > 0.5) { worse++; row.push(`state ${st}: pixel diff ${sb.diffPercent}% -> ${sa.diffPercent}%`); }
    if (sb.behaviourEqual === true && sa.behaviourEqual === false) row.push(`state ${st}: behaviour now differs`);
  }
  if (row.length) lines.push(`- **${id}**: ${row.join(" | ")}`);
}
for (const id of B.keys()) if (!A.has(id) && (!filter || filter.includes(id))) lines.push(`- ${id}: new page in this run (no baseline)`);
const out = `# Regression ${a} -> ${b}\n\nPages compared: ${pagesCompared}. New non-low style differences: ${newDiffs}. Fixed: ${fixed}. Changed control counts: ${countChanges}. More missing controls: ${newMissing}. States with a pixel diff up by >0.5 points: ${worse}.\n\n${lines.join("\n") || "_no changes_"}\n`;
fs.mkdirSync("out/phase3b", { recursive: true });
fs.writeFileSync("out/phase3b/REGRESSION.md", out);
console.log(out.slice(0, 6000));
