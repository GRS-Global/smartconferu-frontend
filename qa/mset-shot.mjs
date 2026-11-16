import { NEXT, PROTO, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
import fs from "node:fs";
import { PNG } from "pngjs";
fs.mkdirSync("out/mset", { recursive: true });
const vp = VIEWPORTS.find((v) => v.name === (process.argv[2] || "d1440"));
const b = await launch();
for (const [n, u] of [["proto", PROTO + "/prototype/chair/isbm2026/peer-review/manage"], ["next", NEXT + "/chair/isbm2026/peer-review/manage"]]) {
  const ctx = await newContext(b, vp, true); const pg = await ctx.newPage();
  await openStable(pg, u); await pg.waitForTimeout(1500);
  await pg.getByRole("button", { name: "Settings", exact: true }).or(pg.getByRole("tab", { name: "Settings", exact: true })).first().click(); await pg.waitForTimeout(1500);
  await pg.screenshot({ path: `out/mset/${n}.png`, fullPage: true });
  console.log(n, (await pg.evaluate(() => document.querySelector("main")?.innerText ?? document.body.innerText)).replace(/\s+/g, " ").slice(0, 700));
  await ctx.close();
}
await b.close();
const a = PNG.sync.read(fs.readFileSync("out/mset/proto.png")), c = PNG.sync.read(fs.readFileSync("out/mset/next.png"));
const H = Math.max(a.height, c.height), o = new PNG({ width: a.width + c.width + 10, height: H }); o.data.fill(255);
PNG.bitblt(a, o, 0, 0, a.width, a.height, 0, 0); PNG.bitblt(c, o, 0, 0, c.width, c.height, a.width + 10, 0);
fs.writeFileSync("out/mset/sbs.png", PNG.sync.write(o)); console.log(a.height, c.height);
