import { NEXT, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
const b = await launch(); const ctx = await newContext(b, VIEWPORTS[0], true); const pg = await ctx.newPage(); const r = {};
await openStable(pg, (process.env.NEXT_URL || NEXT) + "/chair/isbm2026/settings"); await pg.waitForTimeout(3500);
r.pill = await pg.getByText("Active", { exact: true }).count(); r.archiveBtn = await pg.getByRole("button", { name: "Archive conference" }).count();
await pg.getByRole("button", { name: "Archive conference" }).click(); await pg.waitForTimeout(500);
r.dialog = await pg.getByText("Archive this conference?").count();
await pg.screenshot({ path: "out/det/archive-dialog.png", clip: { x: 300, y: 380, width: 800, height: 520 } });
console.log(JSON.stringify(r)); await b.close();
