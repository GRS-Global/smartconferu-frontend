import { NEXT, PROTO, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
import fs from "node:fs"; import { PNG } from "pngjs";
fs.mkdirSync("out/det", { recursive: true });
const b = await launch();
for (const [n, u] of [["proto", PROTO + "/prototype/submissions/ISBM-680/chair"], ["next", NEXT + "/submissions/DSAI-7/chair"]]) {
  const ctx = await newContext(b, VIEWPORTS[0], true); const pg = await ctx.newPage();
  await openStable(pg, u); await pg.waitForTimeout(3000);
  await pg.screenshot({ path: `out/det/${n}.png`, fullPage: true });
  console.log("==", n, (await pg.evaluate(() => document.querySelector("main,#root")?.innerText ?? "")).replace(/\s+/g, " ").slice(560, 2400));
  await ctx.close();
}
await b.close();
const a = PNG.sync.read(fs.readFileSync("out/det/proto.png")), c = PNG.sync.read(fs.readFileSync("out/det/next.png"));
const o = new PNG({ width: a.width + c.width + 10, height: Math.max(a.height, c.height) }); o.data.fill(255);
PNG.bitblt(a, o, 0, 0, a.width, a.height, 0, 0); PNG.bitblt(c, o, 0, 0, c.width, c.height, a.width + 10, 0); fs.writeFileSync("out/det/sbs.png", PNG.sync.write(o)); console.log(a.height, c.height);
