import { NEXT, PROTO, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
const b = await launch();
for (const [k, url] of [["proto", PROTO + "/prototype/chair/isbm2026/settings"], ["next", (process.env.NEXT_URL || NEXT) + "/chair/isbm2026/settings"]]) {
  const ctx = await newContext(b, VIEWPORTS[0], true); const pg = await ctx.newPage();
  await openStable(pg, url); await pg.waitForTimeout(3500);
  const card = pg.getByText(/Finish setup|Resume setup/);
  console.log(k, "lock card:", await card.count(), "welcome dialog:", await pg.getByRole("dialog").count(), "locked items:", await pg.locator("#conference-sidebar button[disabled]").count());
  await pg.screenshot({ path: `out/det/lock-${k}.png` });
  if (await card.count()) { await card.first().click(); await pg.waitForTimeout(1200); await pg.screenshot({ path: `out/det/checklist-${k}.png` }); console.log(k, "modal title:", await pg.getByRole("dialog").first().locator("h2").first().textContent().catch(() => "")); }
}
await b.close();
