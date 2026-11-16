import fs from "node:fs";
import { PNG } from "pngjs";
import { PROTO, NEXT_SCREEN, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
const b = await launch(); fs.mkdirSync("out/phase3b/peer-popup", { recursive: true });
for (const [side, url] of [["prototype", PROTO + "/prototype/chair/isbm2026/peer-review"], ["next", NEXT_SCREEN + "/chair/isbm2026/peer-review"]]) {
  const c = await newContext(b, VIEWPORTS[0], true); const pg = await c.newPage(); await openStable(pg, url);
  await pg.locator("tbody tr", { hasText: "ISBM-735" }).first().getByRole("button", { name: "View report" }).click(); await pg.waitForTimeout(500);
  await pg.screenshot({ path: `out/phase3b/peer-popup/${side}.png` }); await c.close();
}
await b.close();
const A = PNG.sync.read(fs.readFileSync("out/phase3b/peer-popup/prototype.png")), B = PNG.sync.read(fs.readFileSync("out/phase3b/peer-popup/next.png"));
const o = new PNG({ width: A.width + B.width, height: A.height }); PNG.bitblt(A, o, 0, 0, A.width, A.height, 0, 0); PNG.bitblt(B, o, 0, 0, B.width, B.height, A.width, 0);
fs.writeFileSync("out/phase3b/peer-popup/side-by-side.png", PNG.sync.write(o));
