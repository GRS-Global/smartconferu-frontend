// Turns out/audit.json + out/page-state.json into out/SUMMARY.md: one row per page, with a verdict class that
// separates real mismatches from fixture/mode-blocked results. Run after run-audit.mjs.
import fs from "node:fs";
import { BLOCKED } from "./pages.mjs";

const audit = JSON.parse(fs.readFileSync("out/audit.json", "utf8")).audit;
const state = fs.existsSync("out/page-state.json") ? JSON.parse(fs.readFileSync("out/page-state.json", "utf8")) : [];
const st = (id) => state.find((s) => s.page === id)?.next?.text || "";

// A page's Next.js side is "starved" if it renders a placeholder instead of the page (mock mode / fixture missing).
const STARVED = [/aren't available in mock data mode/i, /couldn't find that conference/i, /not used in mock data mode/i];
const rows = audit.map((r) => {
  const d = r.viewports?.d1440, m = r.viewports?.m390;
  const text = st(r.page);
  const starved = STARVED.some((re) => re.test(text));
  const crit = d ? d.fields.filter((f) => f.severity === "critical").length : 0;
  const high = d ? d.styles.diffs.filter((x) => x.severity === "high").length : 0;
  const med = d ? d.styles.diffs.filter((x) => x.severity === "medium").length : 0;
  const stateDiffs = Object.entries(r.states || {}).filter(([, s]) => !s.behaviourEqual).map(([n]) => n);
  const overflow = {};
  return { page: r.page, data: r.data, starved, ctrlP: d?.counts.prototypeControls, ctrlN: d?.counts.nextControls, missing: d?.styles.onlyProto.length, extra: d?.styles.onlyNext.length, crit, fieldIssues: d?.fields.length, high, med, m390High: m ? m.styles.diffs.filter((x) => x.severity === "high").length : null, stateDiffs, states: Object.keys(r.states || {}).length };
});
const L = ["# Audit summary", "", `Generated ${new Date().toISOString()}. **Verdict**: BLOCKED = Next.js side shows a mock-mode/fixture placeholder, so its numbers are not a design result. DATA = control counts differ mainly because rows differ (sample data vs fixtures). Everything else is compared as-is.`, "",
  "| Page | Verdict | Controls proto/next | Missing elements | Extra | Field issues (critical) | Style diffs high/med | State behaviours that differ |", "|---|---|---|---|---|---|---|---|",
  ...rows.map((x) => `| ${x.page} | ${x.starved ? "BLOCKED" : x.data === "sample" ? "DATA+layout" : "compared"} | ${x.ctrlP}/${x.ctrlN} | ${x.missing} | ${x.extra} | ${x.fieldIssues} (${x.crit}) | ${x.high}/${x.med} | ${x.stateDiffs.join(", ") || "none"} (of ${x.states}) |`), "",
  "## Blocked or not comparable (route-level)", ...BLOCKED.map((b) => `- \`${b.next}\`: ${b.reason}`), ""];
fs.writeFileSync("out/SUMMARY.md", L.join("\n"));
console.log(L.slice(4, 4 + rows.length + 1).join("\n"));
