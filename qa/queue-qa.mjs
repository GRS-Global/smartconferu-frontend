import { NEXT, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
const b = await launch(); const ctx = await newContext(b, VIEWPORTS[0], true); const pg = await ctx.newPage();
await openStable(pg, NEXT + "/chair/isbm2026/peer-review"); await pg.waitForSelector("tbody tr"); await pg.waitForTimeout(800);
const ids = await pg.evaluate(() => [...document.querySelectorAll("tbody tr")].map((r) => r.children[1].innerText.trim()));
await pg.locator("tbody tr").nth(3).locator("td").nth(2).click({ position: { x: 8, y: 20 } }); await pg.waitForTimeout(2500);
console.log(ids.slice(0, 6), pg.url().replace(/^https?:\/\/[^/]+/, ""));
console.log("queue:", await pg.evaluate(() => (document.body.innerText.match(/Paper \d+ of \d+[^\n]*/) || [null])[0]));
const next = pg.getByRole("link", { name: /^Next/ }); console.log("next link", await next.count());
if (await next.count()) { await next.first().click(); await pg.waitForTimeout(2000); console.log("after next", pg.url().replace(/^https?:\/\/[^/]+/, ""), await pg.evaluate(() => (document.body.innerText.match(/Paper \d+ of \d+/) || [null])[0])); }
await b.close();
