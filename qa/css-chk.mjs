import { VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
const b = await launch();
const ctx = await newContext(b, VIEWPORTS[0], true); const pg = await ctx.newPage();
await openStable(pg, "http://localhost:3102/chair/isbm2026/settings/review"); await pg.waitForTimeout(2500);
console.log(await pg.evaluate(() => { let found = 0; for (const s of document.styleSheets) { try { for (const r of s.cssRules) if (r.cssText.includes("rich-text-content")) found++; } catch {} } const el = document.querySelector(".rich-text-content"); return { found, cls: el && el.className, fs: el && getComputedStyle(el).fontSize, count: document.querySelectorAll(".rich-text-content").length }; }));
await b.close();
