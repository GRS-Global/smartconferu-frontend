import { PROTO, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
const b = await launch();
for (const [k, url] of [["proto", `${PROTO}/prototype/author/isbm2026/activity-logs`], ["next", "http://localhost:3102/author/isbm2026/activity-logs"]]) {
  const ctx = await newContext(b, VIEWPORTS[0], true); const pg = await ctx.newPage();
  pg.on("pageerror", (e) => console.log(k, "pageerror", String(e).slice(0, 160)));
  await openStable(pg, url); await pg.waitForTimeout(3000);
  await pg.screenshot({ path: `out/dd/al-${k}.png`, fullPage: true });
  console.log(k, pg.url(), await pg.evaluate(() => document.querySelector("h1")?.textContent));
}
await b.close();
