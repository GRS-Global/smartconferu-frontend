import { NEXT_SCREEN, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
const b = await launch(); const c = await newContext(b, VIEWPORTS[0], true); const pg = await c.newPage();
pg.on("pageerror", (e) => console.log("pageerror:", String(e).slice(0, 300)));
pg.on("console", (m) => { if (m.type() === "error") console.log("console.error:", m.text().slice(0, 300)); });
await openStable(pg, NEXT_SCREEN + "/chair/isbm2026/initial-check"); await pg.waitForTimeout(6000);
console.log(await pg.evaluate(() => ({ rows: document.querySelectorAll("tbody tr").length, text: document.body.innerText.replace(/\s+/g, " ").slice(0, 250) })));
await b.close();
