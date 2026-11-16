import { PROTO, NEXT_SCREEN, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
import fs from "node:fs";
fs.mkdirSync("out/revpage", { recursive: true });
const id = process.argv[2] || "ISBM-680";
const b = await launch();
for (const [n, u] of [["proto", PROTO + `/prototype/submissions/${id}/chair/review`], ["next", (process.env.NX || NEXT_SCREEN) + `/submissions/${process.env.NID || id}/chair/review`]]) {
  const ctx = await newContext(b, VIEWPORTS[0], true); const pg = await ctx.newPage();
  await openStable(pg, u); await pg.waitForTimeout(3000);
  await pg.screenshot({ path: `out/revpage/${n}.png`, fullPage: true });
  const t = (await pg.evaluate(() => document.querySelector("main,#root")?.innerText ?? document.body.innerText)).replace(/\s+/g, " ");
  console.log("\n==", n, t.length, "\n", t.slice(0, 2600));
  await ctx.close();
}
await b.close();
