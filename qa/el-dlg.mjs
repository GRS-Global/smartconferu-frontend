import { PROTO, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
const b = await launch();
for (const [k, url] of [["proto", `${PROTO}/prototype/chair/isbm2026/settings/email-logs`], ["next", `http://localhost:3102/chair/isbm2026/settings/email-logs`]]) {
  const ctx = await newContext(b, VIEWPORTS[0], true); const pg = await ctx.newPage();
  await openStable(pg, url); await pg.waitForTimeout(2000);
  await pg.getByRole("button", { name: "View Details" }).first().click(); await pg.waitForTimeout(1000);
  await pg.screenshot({ path: `out/dd/el-dlg-${k}.png` });
}
await b.close();
