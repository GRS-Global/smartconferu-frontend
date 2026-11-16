import { PROTO, NEXT, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
import fs from "node:fs";
fs.mkdirSync("out/apme", { recursive: true });
const b = await launch();
for (const [n, u] of [["proto", PROTO + "/prototype/chair/apme2026/peer-review"], ["next", NEXT + "/chair/apme2026/peer-review"]]) {
  const ctx = await newContext(b, VIEWPORTS[0], true); const pg = await ctx.newPage();
  await openStable(pg, u); await pg.waitForTimeout(2500);
  await pg.screenshot({ path: `out/apme/${n}.png` });
  console.log(n, (await pg.evaluate(() => document.body.innerText)).replace(/\s+/g, " ").slice(0, 900));
  console.log(n, "heads", await pg.evaluate(() => [...document.querySelectorAll("thead th")].map((t) => t.innerText.split("\n")[0].trim())));
  await ctx.close();
}
await b.close();
