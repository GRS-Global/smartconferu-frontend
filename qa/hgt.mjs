import { PAGES, VIEWPORTS, PROTO, NEXT_SCREEN } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
const id = process.argv[2] || "screen-plag";
const page = PAGES.find((p) => p.id === id);
const b = await launch();
for (const [side, url] of [["proto", PROTO + page.proto], ["next", NEXT_SCREEN + page.next]]) {
  const ctx = await newContext(b, VIEWPORTS[0], true); const pg = await ctx.newPage(); await openStable(pg, url);
  console.log(side, await pg.evaluate(() => { const t = document.querySelector("table"); const fr = t?.parentElement; const r = (e) => e ? Math.round(e.getBoundingClientRect().height) : null; return { doc: document.documentElement.scrollHeight, frame: r(fr), frameMax: fr && getComputedStyle(fr).maxHeight, table: r(t), rows: document.querySelectorAll("tbody tr").length, cards: [...document.querySelectorAll("main *")].filter((e) => e.getBoundingClientRect().height > 5000).map((e) => e.tagName + "." + String(e.className).slice(0, 60)).slice(0, 4) }; }));
  await ctx.close();
}
await b.close();
