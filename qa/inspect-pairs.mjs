// Read-only evidence for the "probe artefact" findings: for each flagged (page, role|text) key, list EVERY element on both sides that the
// probe would give that key, with its tag, HTML, what it labels, and the computed styles that differed, in the order the probe numbers them.
// Usage: node inspect-pairs.mjs   -> out/probe-inspection.json (+ a compact printout)
import fs from "node:fs";
import { PAGES, PROTO, NEXT, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";

const TARGETS = [
  ["submit", "label", "title"],
  ["chair-manage", "label", "title"],
  ["chair-manage", "label", "abstract"],
  ["chair-peer-review-manage", "label", "review of the submission"],
  ["chair-settings", "label", "website"],
  ["chair-settings", "label", "conference title"],
  ["chair-settings", "label", "primary area"],
  ["chair-settings", "input:text", "conference title"],
  ["chair-settings-review", "label", "from"],
];

// Mirrors collectInPage's role / key rules (probe.mjs) but returns richer detail for the elements that share one key.
function inspect({ role, text }) {
  const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
  const visible = (el) => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none"; };
  const roleOf = (el) => { const t = el.tagName.toLowerCase(); if (/^h[1-6]$/.test(t)) return "heading"; if (t === "button" || el.getAttribute("role") === "button") return "button"; if (t === "a") return "link"; if (t === "input" || t === "select" || t === "textarea") return t === "input" ? `input:${el.type}` : t; if (t === "label") return "label"; if (t === "th") return "th"; return null; };
  const labelOf = (el) => { const aria = el.getAttribute("aria-label"); if (aria) return norm(aria); if (el.id) { const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`); if (l) return norm(l.textContent); } const w = el.closest("label"); return w ? norm(w.textContent) : ""; };
  const out = []; let order = 0;
  for (const el of document.querySelectorAll("h1,h2,h3,h4,button,[role=button],a,input,select,textarea,label,th")) {
    if (!visible(el)) continue;
    const r = roleOf(el);
    const t = norm(el.getAttribute("aria-label") || el.textContent || el.getAttribute("placeholder") || labelOf(el)).replace(/\s*\*/g, "").slice(0, 48).toLowerCase();
    if (!r || !t) continue;
    if (r === role && t === text) {
      const cs = getComputedStyle(el);
      const target = el.tagName === "LABEL" ? (el.htmlFor && document.getElementById(el.htmlFor)) || el.querySelector("input,select,textarea") : null;
      out.push({
        order: ++order, tag: el.tagName.toLowerCase(), html: el.outerHTML.replace(/\s+/g, " ").slice(0, 150),
        visibleText: norm(el.textContent).slice(0, 60),
        labels: target ? `${target.tagName.toLowerCase()}#${target.id || "(no id)"}[type=${target.type || ""}]${target.placeholder ? ` placeholder="${target.placeholder}"` : ""}` : (el.tagName === "LABEL" ? "(labels nothing: no for= / no nested control)" : ""),
        parent: `${el.parentElement?.tagName.toLowerCase()}.${(el.parentElement?.className || "").toString().slice(0, 50)}`,
        y: Math.round(el.getBoundingClientRect().top + scrollY),
        style: { fontWeight: cs.fontWeight, fontSize: cs.fontSize, width: cs.width, height: cs.height, marginBottom: cs.marginBottom, color: cs.color, display: cs.display, backgroundColor: cs.backgroundColor },
      });
    }
  }
  return out;
}

const b = await launch();
const result = [];
for (const [id, role, text] of TARGETS) {
  const pg = PAGES.find((p) => p.id === id);
  const row = { page: id, key: `${role}|${text}` };
  for (const [side, base, key] of [["prototype", PROTO, "proto"], ["next", pg.nextBase || NEXT, "next"]]) {
    const ctx = await newContext(b, VIEWPORTS[0], pg.auth); const page = await ctx.newPage();
    await openStable(page, base + pg[key]);
    row[side] = await page.evaluate(inspect, { role, text });
    await ctx.close();
  }
  result.push(row);
  console.log(`\n=== ${id}  ${row.key}   (prototype ${row.prototype.length} element(s), next ${row.next.length})`);
  for (const side of ["prototype", "next"]) for (const e of row[side]) console.log(`  [${side}#${e.order}] <${e.tag}> y=${e.y} labels: ${e.labels} | text "${e.visibleText}" | fw ${e.style.fontWeight} fs ${e.style.fontSize} w ${e.style.width} h ${e.style.height} mb ${e.style.marginBottom} c ${e.style.color}\n      ${e.html.slice(0, 140)}`);
}
await b.close();
fs.writeFileSync("out/probe-inspection.json", JSON.stringify(result, null, 2));
