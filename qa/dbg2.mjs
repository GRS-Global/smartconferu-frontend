import { NEXT, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
const b = await launch(); const c = await newContext(b, VIEWPORTS[0], true); const pg = await c.newPage();
pg.on("console", (m) => { if (m.type() === "error") console.log("console.error:", m.text().slice(0, 200)); });
await openStable(pg, NEXT + "/chair/demo-dsai-2027/peer-review"); await pg.waitForTimeout(4000);
console.log(await pg.evaluate(() => document.body.innerText.replace(/\s+/g, " ").slice(0, 400)));
await b.close();
