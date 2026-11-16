import { NEXT, PROTO, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
import fs from "node:fs";
fs.mkdirSync("out/mrev", { recursive: true });
const b = await launch();
for (const [n, u] of [["proto", PROTO + "/prototype/chair/isbm2026/peer-review/manage"], ["next", NEXT + "/chair/isbm2026/peer-review/manage"]]) {
  const ctx = await newContext(b, VIEWPORTS[0], true); const pg = await ctx.newPage();
  await openStable(pg, u); await pg.waitForTimeout(1500);
  await pg.getByRole("button", { name: "Reviews", exact: true }).first().click().catch(async () => pg.getByRole("tab", { name: "Reviews" }).click()); await pg.waitForTimeout(1500);
  await pg.screenshot({ path: `out/mrev/${n}.png`, fullPage: true });
  await ctx.close();
}
await b.close();
