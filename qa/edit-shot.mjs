import { NEXT, PROTO, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
import fs from "node:fs"; import { PNG } from "pngjs";
fs.mkdirSync("out/edit", { recursive: true });
const b = await launch();
for (const [n, u] of [["proto", PROTO + "/prototype/chair/isbm2026/peer-review/manage"], ["next", NEXT + "/chair/isbm2026/peer-review/manage"]]) {
  const ctx = await newContext(b, VIEWPORTS[0], true); const pg = await ctx.newPage();
  await openStable(pg, u); await pg.waitForTimeout(1200);
  await pg.getByRole("button", { name: "Settings", exact: true }).or(pg.getByRole("tab", { name: "Settings", exact: true })).first().click(); await pg.waitForTimeout(800);
  await pg.getByText(/Edit template/).nth(3).click(); await pg.waitForTimeout(2500);
  await pg.screenshot({ path: `out/edit/${n}.png` });
  console.log(n, pg.url().replace(/^https?:\/\/[^/]+/, ""), "|", (await pg.evaluate(() => document.querySelector("main")?.innerText ?? document.body.innerText)).replace(/\s+/g, " ").slice(0, 500));
  await ctx.close();
}
await b.close();
const a = PNG.sync.read(fs.readFileSync("out/edit/proto.png")), c = PNG.sync.read(fs.readFileSync("out/edit/next.png"));
const o = new PNG({ width: a.width + c.width + 10, height: Math.max(a.height, c.height) }); o.data.fill(255);
PNG.bitblt(a, o, 0, 0, a.width, a.height, 0, 0); PNG.bitblt(c, o, 0, 0, c.width, c.height, a.width + 10, 0); fs.writeFileSync("out/edit/sbs.png", PNG.sync.write(o));
