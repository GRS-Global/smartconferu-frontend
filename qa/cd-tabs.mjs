import { NEXT, PROTO, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
const b = await launch();
for (const [k, url] of [["proto", PROTO + "/prototype/chair/isbm2026/settings"], ["next", (process.env.NEXT_URL || NEXT) + "/chair/isbm2026/settings"]]) {
  const ctx = await newContext(b, VIEWPORTS[0], true); const pg = await ctx.newPage();
  await openStable(pg, url); await pg.waitForTimeout(3000);
  for (const t of ["Format & Venue", "Branding"]) {
    await pg.getByRole("tab", { name: t }).or(pg.getByRole("button", { name: t })).first().click(); await pg.waitForTimeout(900);
    await pg.screenshot({ path: `out/det/cd-${k}-${t.startsWith("Format") ? "venue" : "brand"}.png`, fullPage: true });
  }
}
await b.close();
