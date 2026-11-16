import { NEXT, PROTO, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
import fs from "node:fs"; import { PNG } from "pngjs";
const vp = VIEWPORTS.find((v) => v.name === (process.argv[2] || "d1440"));
const b = await launch();
// prototype: from the review settings (Edit template of the 1st recruitment email), as the user does
{ const ctx = await newContext(b, vp, true); const pg = await ctx.newPage();
  await openStable(pg, PROTO + "/prototype/chair/isbm2026/settings/review"); await pg.waitForTimeout(1500);
  await pg.getByText(/Edit template/).first().click(); await pg.waitForTimeout(5000);
  await pg.evaluate(() => window.scrollTo(0, 0)); await pg.screenshot({ path: "out/edit/e-proto.png", fullPage: true });
  console.log("proto", pg.url().replace(/^https?:\/\/[^/]+/, ""), await pg.evaluate(() => document.documentElement.scrollHeight)); await ctx.close(); }
{ const ctx = await newContext(b, vp, true); const pg = await ctx.newPage();
  await openStable(pg, NEXT + "/chair/isbm2026/settings/email-templates?template=reviewerActivateReminder&back=%2Fchair%2Fisbm2026%2Fsettings%2Freview&backLabel=Review%20settings"); await pg.waitForTimeout(4000);
  await pg.screenshot({ path: "out/edit/e-next.png", fullPage: true });
  console.log("next", await pg.evaluate(() => document.documentElement.scrollHeight)); await ctx.close(); }
await b.close();
const a = PNG.sync.read(fs.readFileSync("out/edit/e-proto.png")), c = PNG.sync.read(fs.readFileSync("out/edit/e-next.png"));
const H = Math.min(1500, Math.max(a.height, c.height)); const o = new PNG({ width: a.width + c.width + 10, height: H }); o.data.fill(255);
PNG.bitblt(a, o, 0, 0, a.width, Math.min(H, a.height), 0, 0); PNG.bitblt(c, o, 0, 0, c.width, Math.min(H, c.height), a.width + 10, 0); fs.writeFileSync("out/edit/e-sbs.png", PNG.sync.write(o));
