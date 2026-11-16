import { PROTO, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
const b = await launch(); const c = await newContext(b, VIEWPORTS[0], true); const pg = await c.newPage();
await openStable(pg, PROTO + "/prototype/chair/isbm2026/peer-review/reviewers"); await pg.waitForSelector("tbody tr", { timeout: 60000 }); await pg.waitForTimeout(800);
console.log("headers", JSON.stringify(await pg.evaluate(() => [...document.querySelectorAll("thead th")].map((t) => t.innerText.split("\n")[0]))));
console.log("rows", await pg.evaluate(() => document.querySelectorAll("tbody > tr").length));
console.log(JSON.stringify(await pg.evaluate(() => [...document.querySelectorAll("tbody > tr")].slice(0, 3).map((tr) => tr.innerText.replace(/\s+/g, " ").slice(0, 300)))));
await b.close();
