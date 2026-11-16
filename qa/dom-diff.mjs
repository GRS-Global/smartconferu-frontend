// Usage: node dom-diff.mjs <path-after-slug e.g. settings/submissions> [click text,...]
// Walks every visible text-bearing element / form control on the prototype page and the Next.js page, lines them up in order by text and reports
// every difference in text, font size / weight / colour / family, box size and position. Also saves full-page screenshots to out/dd/.
import fs from "node:fs";
import { PROTO, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
const sub = process.argv[2] || "settings/submissions";
const clicks = (process.argv[3] || "").split("|").filter(Boolean);
const tag = sub.replace(/\W+/g, "_") + (clicks.length ? "_" + clicks.join("_").replace(/\W+/g, "") : "");
fs.mkdirSync("out/dd", { recursive: true });
const collect = () => {
  const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
  const out = [];
  const root = document.querySelector("main") || document.body;
  for (const el of root.querySelectorAll("*")) {
    const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || cs.visibility === "hidden" || cs.display === "none") continue;
    const own = norm([...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(" "));
    const isCtl = /^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(el.tagName);
    if (!own && !isCtl) continue;
    const text = (own || norm(el.value) || el.getAttribute("placeholder") || el.getAttribute("aria-label") || el.tagName).slice(0, 60);
    out.push({ tag: el.tagName.toLowerCase(), text, fs: cs.fontSize, fw: cs.fontWeight, color: cs.color, ff: cs.fontFamily.split(",")[0].replace(/["']/g, ""), lh: cs.lineHeight, bg: cs.backgroundColor, bd: cs.borderTopWidth + " " + cs.borderTopColor, rad: cs.borderTopLeftRadius, x: Math.round(r.x), y: Math.round(r.y + window.scrollY), w: Math.round(r.width), h: Math.round(r.height) });
  }
  return out;
};
const b = await launch();
const res = {};
for (const [k, url] of [["proto", `${PROTO}/prototype/chair/isbm2026/${sub}`], ["next", `${process.env.NEXT_URL || "http://localhost:3102"}/chair/isbm2026/${sub}`]]) {
  const ctx = await newContext(b, VIEWPORTS[0], true); const pg = await ctx.newPage();
  await openStable(pg, url); await pg.waitForTimeout(2500);
  for (const c of clicks) { await pg.getByText(c, { exact: true }).first().click(); await pg.waitForTimeout(700); }
  await pg.screenshot({ path: `out/dd/${tag}-${k}.png`, fullPage: true });
  res[k] = await pg.evaluate(collect);
}
await b.close();
fs.writeFileSync(`out/dd/${tag}.json`, JSON.stringify(res));
// align by text, in order
const P = res.proto, N = res.next; let j = 0; const lines = [];
const used = new Set();
for (const p of P) {
  let m = -1; for (let i = j; i < Math.min(N.length, j + 40); i++) if (!used.has(i) && N[i].text === p.text) { m = i; break; }
  if (m < 0) { lines.push(`ONLY PROTO  ${p.tag} "${p.text}" ${p.fs}/${p.fw} @${p.x},${p.y}`); continue; }
  used.add(m); j = m + 1; const n = N[m]; const d = [];
  for (const f of ["fs", "fw", "color", "ff", "lh", "bg", "bd", "rad"]) if (p[f] !== n[f]) d.push(`${f}: ${p[f]} → ${n[f]}`);
  for (const f of ["w", "h"]) if (Math.abs(p[f] - n[f]) > 1) d.push(`${f}: ${p[f]} → ${n[f]}`);
  if (Math.abs(p.x - n.x) > 1) d.push(`x: ${p.x} → ${n.x}`);
  if (d.length) lines.push(`DIFF ${p.tag} "${p.text}" @${p.y}/${n.y}  ${d.join("; ")}`);
}
N.forEach((n, i) => { if (!used.has(i)) lines.push(`ONLY NEXT   ${n.tag} "${n.text}" ${n.fs}/${n.fw} @${n.x},${n.y}`); });
console.log(`proto ${P.length} items, next ${N.length} items, ${lines.length} differences`);
console.log(lines.join("\n"));
