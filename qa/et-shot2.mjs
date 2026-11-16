import { PROTO, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
const b = await launch();
for (const [k, url, open] of [["proto", `${PROTO}/prototype/chair/isbm2026/settings/email-templates`, async (pg) => { await pg.getByText("Invitation to join organization").first().click(); }], ["next", "http://localhost:3102/chair/isbm2026/settings/email-templates", async (pg) => { await pg.getByText("Invitation to join organization").first().click(); }]]) {
  const ctx = await newContext(b, VIEWPORTS[0], true); const pg = await ctx.newPage();
  await openStable(pg, url); await pg.waitForTimeout(2500);
  try { await open(pg); } catch (e) { console.log(k, "open failed", String(e).slice(0, 100)); }
  await pg.waitForTimeout(1500);
  await pg.screenshot({ path: `out/dd/et-${k}.png` });
}
await b.close();
