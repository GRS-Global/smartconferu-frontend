import { PROTO, NEXT, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
const b = await launch();
for (const [side, url] of [["proto", PROTO + "/prototype/reviewer/isbm2026"], ["next", NEXT + "/reviewer/isbm2026"]]) {
  const c = await newContext(b, VIEWPORTS[0], true); const pg = await c.newPage(); await openStable(pg, url);
  console.log(side, JSON.stringify(await pg.evaluate(() => [...document.querySelectorAll("tbody tr")].slice(0, 6).map((tr) => ({ t: tr.innerText.replace(/\s+/g, " ").slice(0, 70), links: [...tr.querySelectorAll("a,button")].map((a) => (a.textContent || "").trim()).filter(Boolean).slice(0, 4) })))));
  await c.close();
}
await b.close();
