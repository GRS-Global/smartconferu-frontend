import { VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
const b = await launch(); const ctx = await newContext(b, VIEWPORTS[0], true); const pg = await ctx.newPage();
pg.on("console", (m) => { if (m.type() === "error") console.log("console:", m.text().slice(0, 500)); });
pg.on("pageerror", (e) => console.log("pageerror:", String(e).slice(0, 500)));
await openStable(pg, "http://localhost:3102/author/isbm2026/activity-logs"); await pg.waitForTimeout(3000);
await b.close();
