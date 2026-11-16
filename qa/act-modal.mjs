import { NEXT, PROTO, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
const b = await launch(); const out = {};
for (const [k, url] of [["proto", PROTO + "/prototype/chair/ictcs2026/settings/activity-logs"], ["next", (process.env.NEXT_URL || NEXT) + "/chair/isbm2026/settings/activity-logs"]]) {
  const ctx = await newContext(b, VIEWPORTS[0], true); const pg = await ctx.newPage();
  await openStable(pg, url); await pg.waitForTimeout(3000); const skip = pg.getByRole("button", { name: /Skip Tour/ }); if (await skip.count()) { await skip.first().click(); await pg.waitForTimeout(500); }
  await pg.getByRole("button", { name: /View Details/ }).nth(3).click(); await pg.waitForTimeout(600);
  const dlg = pg.locator("dialog[open], [role=dialog], div.fixed.inset-0.z-50").last();
  const text = await dlg.innerText();
  await pg.screenshot({ path: `out/det/actmodal-${k}.png` });
  await pg.keyboard.press("Escape"); await pg.waitForTimeout(300);
  await pg.getByLabel(/Search activity|^$/).first().fill("review").catch(async () => pg.getByPlaceholder("Search activity...").fill("review")); await pg.waitForTimeout(400);
  out[k] = { modal: text.replace(/\n+/g, " | "), afterSearch: await pg.locator("table tbody tr").count(), footer: (await pg.locator("body").innerText()).match(/Showing[^\n]*/)?.[0] };
}
console.log(JSON.stringify(out, null, 1)); await b.close();
