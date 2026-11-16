import { PROTO, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
const b = await launch();
for (const [k, url] of [["proto", `${PROTO}/prototype/help`], ["next", "http://localhost:3102/help"]]) {
  const ctx = await newContext(b, VIEWPORTS[0], true); const pg = await ctx.newPage();
  pg.on("pageerror", (e) => console.log(k, "pageerror", String(e).slice(0, 160)));
  await openStable(pg, url); await pg.waitForTimeout(2500);
  await pg.screenshot({ path: `out/dd/help-${k}.png` });
  console.log(k, pg.url());
}
await b.close();
