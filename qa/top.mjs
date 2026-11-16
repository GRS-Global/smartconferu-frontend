import { PROTO, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
const b = await launch();
for (const [k, url, sel] of [["proto", `${PROTO}/prototype/chair/isbm2026/settings/review`, "#rv-window"], ["next", `http://localhost:3102/chair/isbm2026/settings/review`, "#rs-period"]]) {
  const ctx = await newContext(b, VIEWPORTS[0], true); const pg = await ctx.newPage();
  await openStable(pg, url); await pg.waitForTimeout(2000);
  console.log(k, JSON.stringify(await pg.evaluate((sel) => { const e = document.querySelector(sel); const h1 = document.querySelector("h1").getBoundingClientRect(); const r = e.getBoundingClientRect(); const h = e.querySelector("h2,h3"); const hr = h.getBoundingClientRect(); const ic = e.querySelector("svg").getBoundingClientRect(); return { h1bottom: h1.bottom, cardTop: r.top + scrollY, cardH: r.height, headTop: hr.top + scrollY, headH: hr.height, fs: getComputedStyle(h).fontSize, fw: getComputedStyle(h).fontWeight, iconTile: e.querySelector("span,div").getBoundingClientRect().height }; }, sel)));
}
await b.close();
