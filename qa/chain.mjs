import { PAGES, VIEWPORTS, PROTO, NEXT_SCREEN } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
const page = PAGES.find((p) => p.id === "screen-initial");
const vp = VIEWPORTS.find((v) => v.name === "m390");
const b = await launch();
for (const [side, url] of [["proto", PROTO + page.proto], ["next", NEXT_SCREEN + page.next]]) {
  const ctx = await newContext(b, vp, true); const pg = await ctx.newPage(); await openStable(pg, url);
  console.log(side, JSON.stringify(await pg.evaluate(() => { const out = []; let e = document.querySelector("table")?.parentElement; while (e && e !== document.body) { const cs = getComputedStyle(e), r = e.getBoundingClientRect(); out.push(`${e.tagName.toLowerCase()} x${Math.round(r.x)} w${Math.round(r.width)} pl${cs.paddingLeft} pr${cs.paddingRight} ov${cs.overflowX} ${String(e.className).slice(0, 50)}`); e = e.parentElement; } return out; }), null, 1));
  await ctx.close();
}
await b.close();
