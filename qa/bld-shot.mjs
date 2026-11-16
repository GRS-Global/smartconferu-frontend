import { NEXT, PROTO, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
import fs from "node:fs"; import { PNG } from "pngjs";
const b = await launch();
for (const [n, u] of [["proto", PROTO + "/prototype/chair/isbm2026/peer-review/manage"], ["next", NEXT + "/chair/isbm2026/peer-review/manage"]]) {
  const ctx = await newContext(b, VIEWPORTS[0], true); const pg = await ctx.newPage();
  await openStable(pg, u); await pg.waitForTimeout(1500);
  await pg.getByRole("button", { name: /Edit form/ }).first().click(); await pg.waitForTimeout(1500);
  const f = pg.locator("[aria-label^='Edit '], h3:has-text('Review')").first();
  await pg.mouse.move(700, 520); await pg.waitForTimeout(300);
  await pg.screenshot({ path: `out/det/bld-${n}.png`, clip: { x: 0, y: 0, width: 1440, height: 900 } }); await ctx.close();
}
await b.close();
const a = PNG.sync.read(fs.readFileSync("out/det/bld-proto.png")), c = PNG.sync.read(fs.readFileSync("out/det/bld-next.png"));
const o = new PNG({ width: a.width + c.width + 10, height: Math.max(a.height, c.height) }); o.data.fill(255);
PNG.bitblt(a, o, 0, 0, a.width, a.height, 0, 0); PNG.bitblt(c, o, 0, 0, c.width, c.height, a.width + 10, 0); fs.writeFileSync("out/det/bld-sbs.png", PNG.sync.write(o));
