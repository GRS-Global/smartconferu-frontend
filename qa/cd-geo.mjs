import { PROTO } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
import { VIEWPORTS } from "./pages.mjs";
const b = await launch();
for (const [k, url] of [["proto", PROTO + "/prototype/chair/isbm2026/settings"], ["next", (process.env.NEXT_URL || "http://localhost:3102") + "/chair/isbm2026/settings"]]) {
  const ctx = await newContext(b, VIEWPORTS[0], true); const pg = await ctx.newPage();
  await openStable(pg, url); await pg.waitForTimeout(2500);
  for (const t of ["Basic Details", "Format & Venue", "Branding"]) {
    await pg.getByRole("tab", { name: t }).or(pg.getByRole("button", { name: t })).first().click(); await pg.waitForTimeout(700);
    const r = await pg.evaluate((t) => {
      const el = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === t);
      const bar = el.parentElement.getBoundingClientRect(); const tab = el.getBoundingClientRect();
      const nxt = el.parentElement.nextElementSibling.getBoundingClientRect(); const prev = el.parentElement.previousElementSibling.getBoundingClientRect();
      return { prevBottom: prev.bottom, barTop: bar.top, barBottom: bar.bottom, tabH: tab.height, nextTop: nxt.top };
    }, t);
    console.log(k, t, JSON.stringify(r));
  }
}
await b.close();
