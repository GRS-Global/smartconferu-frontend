import { PROTO, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
const sub = process.argv[2] || "settings/submissions";
const b = await launch();
for (const [k, url] of [["proto", `${PROTO}/prototype/chair/isbm2026/${sub}`], ["next", `${process.env.NEXT_URL || "http://localhost:3102"}/chair/isbm2026/${sub}`]]) {
  const ctx = await newContext(b, VIEWPORTS[0], true); const pg = await ctx.newPage();
  await openStable(pg, url); await pg.waitForTimeout(2500);
  console.log(k, JSON.stringify(await pg.evaluate(() => [...document.querySelectorAll("[role=switch],input[type=checkbox]")].map((s) => { const r = s.getBoundingClientRect(); const cs = getComputedStyle(s); return [(s.getAttribute("aria-label") || s.id || "").slice(0, 18), Math.round(r.width), Math.round(r.height), cs.backgroundColor]; }))));
}
await b.close();
