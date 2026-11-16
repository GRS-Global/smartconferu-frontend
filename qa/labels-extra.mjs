// Phase 3A: labels that are not <label> elements in one of the apps (headings of a button group, "Topics", "Reviewer confidence") and the
// "On" text beside switches. Finds the smallest element whose text starts with the given string and compares its computed style.
// Usage: node labels-extra.mjs <runLabel>  -> out/labels/<runLabel>/extra.json
import fs from "node:fs";
import path from "node:path";
import { PROTO, NEXT, PAGES, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";

const runLabel = process.argv[2] || "run";
const OUT = path.resolve("out/labels", runLabel);
fs.mkdirSync(OUT, { recursive: true });
const CASES = [
  ["submit", "Please choose your submission type"],
  ["submit", "Please choose your track"],
  ["chair-settings", "Topics & research areas"],
  ["chair-settings", "Conference dates"],
  ["chair-peer-review-manage", "Reviewer confidence"],
  ["chair-settings-submissions", "On"],
];
const PROPS = ["fontSize", "fontWeight", "color", "marginTop", "marginBottom", "display", "lineHeight", "visibility", "opacity", "position", "clip"];

function find({ text, props }) {
  const els = [...document.querySelectorAll("label,div,span,p,h3,h4")].filter((e) => e.textContent.replace(/\s+/g, " ").trim().replace(/\s*\*$/, "").startsWith(text));
  // a required label ends with "*": prefer those (a section title or an inner help span would otherwise win), then the deepest element
  const starred = els.filter((e) => /\*\s*$/.test(e.textContent.trim()));
  if (starred.length) { els.length = 0; els.push(...starred); }
  els.sort((a, b) => a.querySelectorAll("*").length - b.querySelectorAll("*").length);
  const el = text === "On" ? els.find((e) => e.textContent.trim() === "On") : els[0];
  if (!el) return null;
  const cs = getComputedStyle(el), r = el.getBoundingClientRect();
  const o = { tag: el.tagName.toLowerCase(), box: [Math.round(r.width), Math.round(r.height)] };
  for (const p of props) o[p] = cs[p];
  const star = [...el.querySelectorAll("*")].find((s) => s.textContent.trim() === "*");
  o.star = star ? getComputedStyle(star).color : /\*\s*$/.test(el.textContent.trim()) ? "inherits" : null;
  return o;
}

const browser = await launch();
const rows = [];
for (const vp of VIEWPORTS) {
  for (const [id, text] of CASES) {
    const page = PAGES.find((p) => p.id === id);
    const got = {};
    for (const [side, url] of [["prototype", PROTO + page.proto], ["next", (page.nextBase || NEXT) + page.next]]) {
      const ctx = await newContext(browser, vp, true);
      const pg = await ctx.newPage();
      await openStable(pg, url);
      got[side] = await pg.evaluate(find, { text, props: PROPS });
      await ctx.close();
    }
    const d = !got.prototype || !got.next ? ["missing on one side"] : PROPS.filter((k) => got.prototype[k] !== got.next[k]).map((k) => `${k}: ${got.prototype[k]} -> ${got.next[k]}`).concat(got.prototype.star !== got.next.star ? [`asterisk: ${got.prototype.star} -> ${got.next.star}`] : []);
    rows.push({ vp: vp.name, page: id, text, diffs: d, prototype: got.prototype, next: got.next });
    console.log(`${vp.name} ${id} "${text}": ${d.length ? d.join("; ") : "same"}`);
  }
}
await browser.close();
fs.writeFileSync(path.join(OUT, "extra.json"), JSON.stringify(rows, null, 1));
