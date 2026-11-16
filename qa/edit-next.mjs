import { NEXT, PROTO, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
import fs from "node:fs"; import { PNG } from "pngjs";
const b = await launch();
for (const [n, u] of [["proto", PROTO + "/prototype/chair/isbm2026/peer-review/manage"], ["next", NEXT + "/chair/isbm2026/peer-review/manage"]]) {
  const ctx = await newContext(b, VIEWPORTS[0], true); const pg = await ctx.newPage();
  await openStable(pg, u); await pg.waitForTimeout(1200);
  await pg.getByRole("button", { name: "Settings", exact: true }).or(pg.getByRole("tab", { name: "Settings", exact: true })).first().click(); await pg.waitForTimeout(800);
  await pg.getByText(/Edit template/).nth(3).click(); await pg.waitForTimeout(4000);
  await pg.evaluate(() => window.scrollTo(0, 0)); await pg.waitForTimeout(400);
  await pg.screenshot({ path: `out/edit/${n}-full.png`, fullPage: true }); await ctx.close();
}
await b.close();
const a = PNG.sync.read(fs.readFileSync("out/edit/proto-full.png")), c = PNG.sync.read(fs.readFileSync("out/edit/next-full.png"));
const H = Math.min(1100, Math.max(a.height, c.height)); const o = new PNG({ width: a.width + c.width + 10, height: H }); o.data.fill(255);
PNG.bitblt(a, o, 0, 0, a.width, Math.min(H, a.height), 0, 0); PNG.bitblt(c, o, 0, 0, c.width, Math.min(H, c.height), a.width + 10, 0); fs.writeFileSync("out/edit/sbs2.png", PNG.sync.write(o));
