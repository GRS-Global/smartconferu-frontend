import { NEXT, PROTO, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
const b = await launch(); const out = {};
for (const [k, base] of [["next", NEXT], ["proto", PROTO]]) {
  const ctx = await newContext(b, VIEWPORTS[0], true); const pg = await ctx.newPage();
  await openStable(pg, base + (k === "next" ? "/submissions/DSAI-6/chair/review/add" : "/prototype/submissions/ISBM-680/chair/review/add")); await pg.waitForTimeout(3500);
  out[k] = await pg.evaluate(() => { const r = (e) => { const x = e?.getBoundingClientRect(); return x ? [Math.round(x.left), Math.round(x.top), Math.round(x.width), Math.round(x.height)] : null; }; const h2 = [...document.querySelectorAll("h2")].find((e) => /Congestion|Study/.test(e.textContent)); const aside = document.querySelector("aside[aria-label='Paper preview']") || document.querySelector("[aria-label='Paper preview']"); return { aside: r(aside), hero: r(h2?.closest("section,div.ui-banner")), h2: r(h2), h2font: h2 && getComputedStyle(h2).fontSize, bar: r([...document.querySelectorAll("div")].find((d) => /required fields answered/.test(d.textContent) && getComputedStyle(d).position === "sticky")) }; });
  await pg.screenshot({ path: `out/det/par-${k}.png` });
}
console.log(JSON.stringify(out, null, 1)); await b.close();
