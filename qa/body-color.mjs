import { PROTO, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
const b = await launch();
for (const [k, url] of [["proto", `${PROTO}/prototype/chair/isbm2026/settings/submissions`], ["next", `${process.env.NEXT_URL || "http://localhost:3102"}/chair/isbm2026/settings/submissions`]]) {
  const ctx = await newContext(b, VIEWPORTS[0], true); const pg = await ctx.newPage();
  await openStable(pg, url); await pg.waitForTimeout(2000);
  console.log(k, await pg.evaluate(() => [getComputedStyle(document.body).color, getComputedStyle(document.querySelector("input[type=number]")).color, getComputedStyle(document.querySelector("select")).color].join(" | ")));
}
await b.close();
