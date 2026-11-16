import { PROTO, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
const b = await launch();
for (const [k, url] of [["proto", `${PROTO}/prototype/chair/isbm2026/settings/review`], ["next", `http://localhost:3102/chair/isbm2026/settings/review`]]) {
  const ctx = await newContext(b, VIEWPORTS[0], true); const pg = await ctx.newPage();
  await openStable(pg, url); await pg.waitForTimeout(2000);
  console.log(k, JSON.stringify(await pg.evaluate(() => [...document.querySelectorAll("input[type=datetime-local]")].map((e) => { const r = e.getBoundingClientRect(); const c = getComputedStyle(e); return [Math.round(r.height), c.fontSize, c.lineHeight, c.padding, c.borderTopWidth]; }))));
}
await b.close();
