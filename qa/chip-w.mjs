import { PROTO, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
const b = await launch();
for (const [k, url] of [["proto", PROTO + "/prototype/chair/isbm2026/settings"], ["next", (process.env.NEXT_URL || "http://localhost:3102") + "/chair/isbm2026/settings"]]) {
  const ctx = await newContext(b, VIEWPORTS[0], true); const pg = await ctx.newPage();
  await openStable(pg, url); await pg.waitForTimeout(2500);
  await pg.getByRole("tab", { name: "Branding" }).or(pg.getByRole("button", { name: "Branding" })).first().click(); await pg.waitForTimeout(700);
  for (const w of [1440, 1100, 900, 800]) {
    await pg.setViewportSize({ width: w, height: 900 }); await pg.waitForTimeout(300);
    console.log(k, w, JSON.stringify(await pg.evaluate(() => [...document.querySelectorAll("span")].filter((s) => /^(JPEG|Up to|Square|Transparent)/.test(s.textContent.trim()) && s.className.includes("rounded-full")).map((s) => { const r = s.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.top)]; }))));
  }
}
await b.close();
