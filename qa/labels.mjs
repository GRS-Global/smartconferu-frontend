// Phase 3A: label-style probe. For each page, collects every <label> (plus the visible text next to a control that acts as one)
// from the prototype and from Next.js and compares font size / weight / colour / margins / display and the required "*" marker.
// Local only; nothing is submitted. Usage: node labels.mjs <runLabel> [--page id,id] [--vp d1440,m390]  -> out/labels/<runLabel>/{results.json,REPORT.md}
import fs from "node:fs";
import path from "node:path";
import { PROTO, NEXT, PAGES, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";

const args = process.argv.slice(2);
const runLabel = args[0] && !args[0].startsWith("--") ? args[0] : "run";
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const only = opt("--page")?.split(",");
const vps = (opt("--vp")?.split(",") || ["d1440"]).map((n) => VIEWPORTS.find((v) => v.name === n)).filter(Boolean);
const IDS = only || ["submit", "chair-manage", "chair-email", "chair-peer-review-manage", "chair-submit-behalf", "chair-settings", "chair-settings-submissions", "chair-settings-review", "chair-settings-decision", "chair-settings-email-templates"];
const OUT = path.resolve("out/labels", runLabel);
fs.mkdirSync(OUT, { recursive: true });

const PROPS = ["fontSize", "fontWeight", "color", "marginTop", "marginBottom", "display", "lineHeight", "letterSpacing", "textTransform"];

/** Runs inside the page. Returns one record per label. */
function collect(props) {
  const norm = (s) => s.replace(/\s+/g, " ").replace(/\s*\*\s*$/, "").trim();
  const out = [];
  for (const el of document.querySelectorAll("label")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    // plain checkbox / radio rows are options, not field labels
    if (el.querySelector("input[type=checkbox],input[type=radio]") && !el.querySelector("input:not([type=checkbox]):not([type=radio])")) continue;
    const star = [...el.querySelectorAll("span,sup,b,strong")].find((s) => s.textContent.trim() === "*") || null;
    // text of the label without nested controls
    const clone = el.cloneNode(true);
    clone.querySelectorAll("input,select,textarea,button,svg").forEach((n) => n.remove());
    const text = norm(clone.textContent);
    if (!text) continue;
    const cs = getComputedStyle(el);
    const rec = { text, star: Boolean(star) || /\*\s*$/.test(clone.textContent.trim()), starColor: star ? getComputedStyle(star).color : null, w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 };
    for (const p of props) rec[p] = cs[p];
    out.push(rec);
  }
  return out;
}

const browser = await launch();
const results = {};
for (const id of IDS) {
  const page = PAGES.find((p) => p.id === id);
  if (!page) { console.log("unknown page", id); continue; }
  for (const vp of vps) {
    const got = {};
    for (const [side, url] of [["prototype", PROTO + page.proto], ["next", (page.nextBase || NEXT) + page.next]]) {
      const ctx = await newContext(browser, vp, true);
      const pg = await ctx.newPage();
      try { await openStable(pg, url); got[side] = await pg.evaluate(collect, PROPS); } catch (e) { got[side] = { error: String(e).slice(0, 200) }; }
      await ctx.close();
    }
    results[`${id}|${vp.name}`] = got;
    const P = got.prototype, N = got.next;
    if (!Array.isArray(P) || !Array.isArray(N)) { console.log(`${id} ${vp.name}: error`, !Array.isArray(P) ? P : N); continue; }
    console.log(`${id} ${vp.name}: prototype ${P.length} labels, next ${N.length}`);
  }
}
await browser.close();

// pair by text (nth occurrence), report property differences and asterisk differences
const lines = [`# Label comparison (${runLabel})`, "", "`P` = prototype, `N` = Next.js. Only labels present on both sides are compared; unmatched labels are listed at the end of each page.", ""];
let totalDiff = 0, totalPairs = 0;
for (const [key, got] of Object.entries(results)) {
  const P = got.prototype, N = got.next;
  if (!Array.isArray(P) || !Array.isArray(N)) continue;
  const used = new Set();
  const rows = [], unmatchedP = [];
  const seen = {};
  for (const p of P) {
    const n = (seen[p.text] = (seen[p.text] || 0) + 1);
    let idx = -1, c = 0;
    N.forEach((x, i) => { if (x.text === p.text && ++c === n && idx < 0) idx = i; });
    if (idx < 0) { unmatchedP.push(p.text); continue; }
    used.add(idx);
    const q = N[idx];
    const d = PROPS.filter((k) => p[k] !== q[k]).map((k) => `${k}: ${p[k]} -> ${q[k]}`);
    if (p.star !== q.star) d.push(`asterisk: ${p.star ? "yes" : "no"} -> ${q.star ? "yes" : "no"}`);
    else if (p.star && p.starColor !== q.starColor) d.push(`asterisk colour: ${p.starColor} -> ${q.starColor}`);
    totalPairs++;
    if (d.length) { totalDiff++; rows.push(`- **${p.text}**${p.star ? " *" : ""}: ${d.join("; ")}`); }
  }
  const unmatchedN = N.filter((_, i) => !used.has(i)).map((x) => x.text);
  lines.push(`## ${key}`, "", rows.length ? rows.join("\n") : "_no label differences_", "");
  if (unmatchedP.length) lines.push(`Only in prototype: ${unmatchedP.join(" | ")}`, "");
  if (unmatchedN.length) lines.push(`Only in Next.js: ${unmatchedN.join(" | ")}`, "");
}
lines.push(`**Pairs compared: ${totalPairs}; pairs with a difference: ${totalDiff}.**`);
fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 1));
fs.writeFileSync(path.join(OUT, "REPORT.md"), lines.join("\n"));
console.log(`pairs ${totalPairs}, differing ${totalDiff} -> ${path.join(OUT, "REPORT.md")}`);
