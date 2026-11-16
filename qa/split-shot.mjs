import { NEXT, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
const b = await launch(); const ctx = await newContext(b, VIEWPORTS[0], true); const pg = await ctx.newPage();
await openStable(pg, NEXT + "/submissions/DSAI-6/chair/review/add"); await pg.waitForTimeout(4000);
await pg.screenshot({ path: "out/det/split.png" });
console.log("sep", await pg.getByRole("separator").count(), "iframe", await pg.locator("iframe").count());
await pg.getByRole("button", { name: /Hide paper/ }).click(); await pg.waitForTimeout(500);
console.log("after hide: iframe", await pg.locator("iframe").count(), "show btn", await pg.getByRole("button", { name: /Show paper/ }).count());
await b.close();
