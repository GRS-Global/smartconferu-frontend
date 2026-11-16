import { NEXT, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
const b = await launch(); const ctx = await newContext(b, VIEWPORTS[0], true); const pg = await ctx.newPage();
await openStable(pg, (process.env.NEXT_URL || NEXT) + "/chair/isbm2026/settings/activity-logs"); await pg.waitForTimeout(3500);
const rows = pg.locator("table tbody tr");
const n = await rows.count(); let hit = -1;
for (let i = 0; i < n; i++) { const t = await rows.nth(i).innerText(); if (/Track changed|Final decision updated/.test(t)) { hit = i; break; } }
await rows.nth(hit < 0 ? 0 : hit).getByRole("button", { name: /View Details/ }).click(); await pg.waitForTimeout(700);
console.log("row", hit, (await pg.locator("dialog[open]").innerText()).replace(/\n+/g, " | "));
await pg.screenshot({ path: "out/det/act-detail.png" }); await b.close();
