// Usage: node run-audit.mjs [--page id[,id]] [--workers 4] [--offline]
// Per page: computed-style probe + field-level comparison at 1440 and 390, plus scripted states at 1440.
// Raw collected data is saved to out/raw/ so comparison rules can be changed and re-applied with --offline (no browser).
// Output: out/audit.json (everything; partial runs merge by page id) and out/AUDIT.md. State screenshots in out/states/.
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { PAGES, PROTO, NEXT, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
import { collectInPage, compareStyles, compareControls } from "./probe.mjs";
import { STATES, FORM_STATES, VIEW_STATES } from "./states.mjs";

const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : null; };
const only = arg("page")?.split(",");
const WORKERS = Number(arg("workers") || 4);
const OFFLINE = process.argv.includes("--offline");
const OUT = path.resolve("out");
fs.mkdirSync(path.join(OUT, "states"), { recursive: true });
fs.mkdirSync(path.join(OUT, "raw"), { recursive: true });
const sidesFor = (pg) => [["prototype", PROTO, "proto"], ["next", pg.nextBase || NEXT, "next"]];
const rawFile = (id, vp) => path.join(OUT, "raw", `${id}-${vp}.json`);
const prevFile = path.join(OUT, "audit.json");
const prevAudit = fs.existsSync(prevFile) ? JSON.parse(fs.readFileSync(prevFile, "utf8")).audit : [];

async function auditPage(browser, pg) {
  const rec = { page: pg.id, data: pg.data, note: pg.note || null, viewports: {}, states: {} };
  try {
    for (const vp of [VIEWPORTS[0], VIEWPORTS[2]]) {
      let got;
      if (OFFLINE) got = JSON.parse(fs.readFileSync(rawFile(pg.id, vp.name), "utf8"));
      else {
        got = {};
        for (const [side, base, key] of sidesFor(pg)) {
          const ctx = await newContext(browser, vp, pg.auth); const page = await ctx.newPage();
          await openStable(page, base + pg[key]);
          got[side] = await page.evaluate(collectInPage);
          got[side + "Url"] = page.url().replace(base, "");
          await ctx.close();
        }
        fs.writeFileSync(rawFile(pg.id, vp.name), JSON.stringify(got));
      }
      rec.viewports[vp.name] = { finalUrls: [got.prototypeUrl, got.nextUrl], styles: compareStyles(got.prototype, got.next), fields: compareControls(got.prototype, got.next, { ignore: pg.ignoreFields }), counts: { prototypeControls: got.prototype.controls.length, nextControls: got.next.controls.length } };
    }
    if (OFFLINE) { rec.states = prevAudit.find((a) => a.page === pg.id)?.states || {}; return rec; } // states need a browser
    const vp = VIEWPORTS[0];
    const d = rec.viewports.d1440.counts;
    const hasForm = d.prototypeControls > 2 || d.nextControls > 2;
    for (const name of (pg.states || (hasForm ? FORM_STATES : VIEW_STATES))) {
      const r = {}, png = {};
      for (const [side, base, key] of sidesFor(pg)) {
        const ctx = await newContext(browser, vp, pg.auth); const page = await ctx.newPage();
        await openStable(page, base + pg[key]);
        r[side] = await STATES[name](page);
        const dir = path.join(OUT, "states", pg.id); fs.mkdirSync(dir, { recursive: true });
        const f = path.join(dir, `${name}-${side}.png`);
        await page.screenshot({ path: f }); // viewport only: deterministic size
        png[side] = PNG.sync.read(fs.readFileSync(f));
        await ctx.close();
      }
      const { width: w, height: h } = png.prototype;
      const df = new PNG({ width: w, height: h });
      const n = pixelmatch(png.prototype.data, png.next.data, df.data, w, h, { threshold: 0.1, includeAA: false });
      fs.writeFileSync(path.join(OUT, "states", pg.id, `${name}-diff.png`), PNG.sync.write(df));
      rec.states[name] = { diffPercent: +(100 * n / (w * h)).toFixed(2), prototype: r.prototype, next: r.next, behaviourEqual: JSON.stringify(r.prototype) === JSON.stringify(r.next) };
    }
  } catch (e) { rec.error = String(e).slice(0, 300); }
  return rec;
}

const browser = OFFLINE ? null : await launch();
const queue = PAGES.filter((p) => !only || only.includes(p.id));
const results = [];
await Promise.all(Array.from({ length: Math.min(WORKERS, queue.length) }, async () => {
  while (queue.length) {
    const pg = queue.shift();
    const rec = await auditPage(browser, pg);
    results.push(rec);
    const d = rec.viewports.d1440;
    console.log(pg.id.padEnd(30), rec.error ? "ERROR " + rec.error : `matched ${d.styles.matched} | style diffs ${d.styles.diffs.length} (high ${d.styles.diffs.filter((x) => x.severity === "high").length}) | only-proto ${d.styles.onlyProto.length} | only-next ${d.styles.onlyNext.length} | field issues ${d.fields.length} (critical ${d.fields.filter((f) => f.severity === "critical").length}) | controls ${d.counts.prototypeControls}/${d.counts.nextControls}`);
  }
}));
await browser?.close();

// A partial run replaces only the pages it ran; everything else from earlier runs is kept.
const ran = new Set(results.map((a) => a.page));
const audit = [...results, ...prevAudit.filter((a) => !ran.has(a.page))];
const order = new Map(PAGES.map((p, i) => [p.id, i]));
audit.sort((a, b) => (order.get(a.page) ?? 999) - (order.get(b.page) ?? 999));
fs.writeFileSync(prevFile, JSON.stringify({ generatedAt: new Date().toISOString(), audit }, null, 2));

const L = [`# Audit report (generated ${new Date().toISOString()})`, "", "Prototype = reference. `only-proto` = element present in the prototype but not found (by role + text) in Next.js.", ""];
for (const r of audit) {
  L.push(`## ${r.page}  (data: ${r.data})${r.note ? ` - ${r.note}` : ""}`);
  if (r.error) { L.push(`ERROR: ${r.error}`, ""); continue; }
  for (const [vp, v] of Object.entries(r.viewports)) {
    L.push(`### ${vp}: controls ${v.counts.prototypeControls} (prototype) vs ${v.counts.nextControls} (Next.js); final URLs ${v.finalUrls.join(" vs ")}`);
    if (v.fields.length) { L.push("Field-level differences:", "| # | Kind | Control | Prototype | Next.js | Severity |", "|---|---|---|---|---|---|"); v.fields.slice(0, 40).forEach((f, i) => L.push(`| ${i + 1} | ${f.kind} | ${f.control ?? f.index ?? ""} | ${JSON.stringify(f.prototype)} | ${JSON.stringify(f.next)} | ${f.severity} |`)); if (v.fields.length > 40) L.push(`(+${v.fields.length - 40} more in audit.json)`); }
    else L.push("Field-level: no differences.");
    L.push("", `Missing in Next.js (prototype only): ${v.styles.onlyProto.slice(0, 25).map((k) => "`" + k + "`").join(", ") || "none"}${v.styles.onlyProto.length > 25 ? ` (+${v.styles.onlyProto.length - 25})` : ""}`);
    L.push(`Extra in Next.js: ${v.styles.onlyNext.slice(0, 25).map((k) => "`" + k + "`").join(", ") || "none"}${v.styles.onlyNext.length > 25 ? ` (+${v.styles.onlyNext.length - 25})` : ""}`, "");
    const hi = v.styles.diffs.filter((d) => d.severity !== "low");
    L.push(`Computed-style differences on ${v.styles.matched} matched elements: ${v.styles.diffs.length} (${hi.length} high/medium)`);
    if (hi.length) { L.push("| Element | Property | Prototype | Next.js | Severity |", "|---|---|---|---|---|"); hi.slice(0, 30).forEach((d) => L.push(`| ${d.element} | ${d.property} | ${d.prototype} | ${d.next} | ${d.severity} |`)); if (hi.length > 30) L.push(`(+${hi.length - 30} more in audit.json)`); }
    L.push("");
  }
  L.push("### Scripted states (1440)", "| State | Screenshot diff | Behaviour equal | Prototype result | Next.js result |", "|---|---|---|---|---|");
  for (const [n, s] of Object.entries(r.states)) L.push(`| ${n} | ${s.diffPercent}% | ${s.behaviourEqual ? "yes" : "NO"} | ${JSON.stringify(s.prototype).slice(0, 140)} | ${JSON.stringify(s.next).slice(0, 140)} |`);
  L.push("");
}
fs.writeFileSync(path.join(OUT, "AUDIT.md"), L.join("\n"));
