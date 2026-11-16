import { NEXT, PROTO, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
const b = await launch();
for (const [n, u, ids] of [["proto", PROTO + "/prototype/chair/isbm2026/peer-review/manage", ["rv-timeline", "rv-visibility", "rv-instructions"]], ["next", NEXT + "/chair/isbm2026/peer-review/manage", ["rs-timeline", "rs-visibility", "rs-instructions"]]]) {
  const ctx = await newContext(b, VIEWPORTS[0], true); const pg = await ctx.newPage();
  await openStable(pg, u); await pg.waitForTimeout(1200);
  await pg.getByRole("button", { name: "Settings", exact: true }).or(pg.getByRole("tab", { name: "Settings", exact: true })).first().click(); await pg.waitForTimeout(1000);
  const res = [];
  const activeLabel = () => pg.evaluate(() => { const nav = document.querySelector("nav[aria-label='Sections on this page'], aside[aria-label='Sections'] nav"); if (!nav) return null; const hit = [...nav.querySelectorAll("button")].find((x) => { const c = getComputedStyle(x.querySelector("span,div") || x); const bg = getComputedStyle(x).backgroundColor; return /124, 58, 237|243, 232|237, 233|245, 243/.test(getComputedStyle(x).borderTopColor + getComputedStyle(x).backgroundColor); }); return hit ? hit.innerText.split("\n")[0] : null; });
  res.push(["top", await activeLabel()]);
  for (const id of ids) { await pg.evaluate((id) => { const el = document.getElementById(id); window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 100 }); }, id); await pg.waitForTimeout(500); res.push([id, await activeLabel()]); }
  await pg.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight })); await pg.waitForTimeout(500); res.push(["bottom", await activeLabel()]);
  console.log(n, JSON.stringify(res)); await ctx.close();
}
await b.close();
