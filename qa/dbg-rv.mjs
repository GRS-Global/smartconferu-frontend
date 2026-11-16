import { NEXT, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
const b = await launch(); const ctx = await newContext(b, VIEWPORTS[0], true); const pg = await ctx.newPage();
for (const u of ["/reviewer/isbm2026/review/DSAI-1", "/reviewer/demo-nets-2026/review/NETS-121"]) {
  await openStable(pg, NEXT + u); await pg.waitForTimeout(2000);
  console.log(u, (await pg.evaluate(() => document.body.innerText)).replace(/\s+/g, " ").slice(0, 260));
}
await b.close();
