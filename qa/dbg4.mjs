import { PROTO, NEXT_SCREEN, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
const b = await launch();
for (const [side, url] of [["prototype", PROTO + "/prototype/chair/isbm2026/peer-review"], ["next", NEXT_SCREEN + "/chair/isbm2026/peer-review"]]) {
  const c = await newContext(b, VIEWPORTS[0], true); const pg = await c.newPage(); await openStable(pg, url); await pg.waitForSelector("tbody tr", { timeout: 90000 });
  console.log(side, "ui-accent-card elements with no dialog open:", await pg.locator(".ui-accent-card").count());
  await c.close();
}
await b.close();
