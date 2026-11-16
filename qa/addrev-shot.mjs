import { NEXT, PROTO, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
import fs from "node:fs"; import { PNG } from "pngjs";
const b = await launch();
for (const [n, u] of [["proto", PROTO + "/prototype/submissions/ISBM-680/chair/review/add"], ["next", NEXT + "/submissions/DSAI-7/chair/review/add"]]) {
  const ctx = await newContext(b, VIEWPORTS[0], true); const pg = await ctx.newPage();
  await openStable(pg, u); await pg.waitForTimeout(4500);
  await pg.screenshot({ path: `out/det/ar-${n}.png`, clip: { x: 0, y: 0, width: 1440, height: 900 } }); await ctx.close();
}
await b.close();
const a = PNG.sync.read(fs.readFileSync("out/det/ar-proto.png")), c = PNG.sync.read(fs.readFileSync("out/det/ar-next.png"));
const o = new PNG({ width: a.width + c.width + 10, height: Math.max(a.height, c.height) }); o.data.fill(255);
PNG.bitblt(a, o, 0, 0, a.width, a.height, 0, 0); PNG.bitblt(c, o, 0, 0, c.width, c.height, a.width + 10, 0); fs.writeFileSync("out/det/ar-sbs.png", PNG.sync.write(o));
