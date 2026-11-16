import { NEXT_SCREEN, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
const b = await launch(); const ctx = await newContext(b, VIEWPORTS[0], true); const pg = await ctx.newPage();
await openStable(pg, NEXT_SCREEN + "/chair/isbm2026/peer-review"); await pg.waitForSelector("tbody tr");
await pg.getByRole("button", { name: /^Columns/ }).click(); await pg.getByLabel("Plagiarism %").check(); await pg.getByLabel("Avg confidence").check(); await pg.mouse.click(5, 5); await pg.waitForTimeout(500);
console.log(await pg.evaluate(() => [...document.querySelectorAll("tbody tr")].slice(0, 4).map((r) => [...r.children].slice(-3).map((c) => c.innerText.replace(/\s+/g, " ").trim()))));
console.log(await pg.evaluate(() => [...document.querySelectorAll("tbody tr")].slice(0, 2).map((r) => r.children.length)), await pg.evaluate(() => document.querySelectorAll("thead th").length));
await b.close();
