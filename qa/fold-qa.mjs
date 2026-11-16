import { NEXT, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
const b = await launch(); const ctx = await newContext(b, VIEWPORTS[0], true); const pg = await ctx.newPage();
await openStable(pg, NEXT + "/submissions/DSAI-6/chair/review/add"); await pg.waitForTimeout(3000);
const r = await pg.evaluate(() => { const a = document.querySelector("aside[aria-label='Paper preview']").getBoundingClientRect(); const f = document.querySelector("section[aria-label='Paper']").getBoundingClientRect(); return { paper: Math.round(a.width), form: Math.round(f.width), pct: Math.round(a.width / (a.width + f.width) * 100), menuHidden: !!document.querySelector("[aria-label='Show menu']") }; });
console.log(JSON.stringify(r)); await pg.screenshot({ path: "out/det/fold.png" }); await b.close();
