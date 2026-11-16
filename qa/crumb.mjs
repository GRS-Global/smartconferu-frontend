import { PROTO, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
const b = await launch();
for (const p of ["/prototype/author/isbm2026/submissions", "/prototype/chair/isbm2026", "/prototype/chair/isbm2026/peer-review/manage", "/prototype/chair/isbm2026/settings/review", "/prototype/dashboard"]) {
  const ctx = await newContext(b, VIEWPORTS[0], true); const pg = await ctx.newPage();
  await openStable(pg, PROTO + p); await pg.waitForTimeout(1500);
  console.log(p, JSON.stringify(await pg.evaluate(() => { const h = document.querySelector("h1"); if (!h) return null; const box = h.parentElement.getBoundingClientRect(); const els = [...document.querySelectorAll("main span, main button, main a")].filter((e) => { const r = e.getBoundingClientRect(); return r.bottom <= h.getBoundingClientRect().top + 2 && r.top >= box.top - 4 && e.children.length === 0 && e.textContent.trim(); }); return els.map((e) => [e.textContent.trim().slice(0, 20), getComputedStyle(e).fontWeight, getComputedStyle(e).color]); })));
}
await b.close();
