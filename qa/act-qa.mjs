import { NEXT, PROTO, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
const b = await launch(); const out = {};
for (const [k, url] of [["proto", PROTO + "/prototype/chair/ictcs2026/settings/activity-logs"], ["next", (process.env.NEXT_URL || NEXT) + "/chair/isbm2026/settings/activity-logs"]]) {
  const ctx = await newContext(b, VIEWPORTS[0], true); const pg = await ctx.newPage();
  await openStable(pg, url); await pg.waitForTimeout(3500);
  out[k] = await pg.evaluate(() => {
    const r = (e) => { const x = e?.getBoundingClientRect(); return x ? [Math.round(x.left), Math.round(x.top), Math.round(x.width), Math.round(x.height)] : null; };
    const rows = [...document.querySelectorAll("table tbody tr")];
    return { title: document.querySelector("h1")?.textContent, intro: r(document.querySelector("p.text-sm.leading-relaxed")), table: r(document.querySelector("table")), rows: rows.length, row0: r(rows[0]), firstRow: rows[0]?.innerText.replace(/\n+/g, " | "), selects: [...document.querySelectorAll("main select, select")].map((s) => s.options[0]?.textContent), footer: document.body.innerText.match(/Showing[^\n]*/)?.[0], pageH: document.documentElement.scrollHeight };
  });
  await pg.screenshot({ path: `out/det/act-${k}.png`, fullPage: true });
}
console.log(JSON.stringify(out, null, 1)); await b.close();
