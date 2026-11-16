import { PROTO, NEXT, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
const b = await launch();
for (const [side, url] of [["proto", PROTO + "/prototype/chair/isbm2026/peer-review"], ["next", NEXT + "/chair/demo-dsai-2027/peer-review"]]) {
  const c = await newContext(b, VIEWPORTS[0], true); const pg = await c.newPage(); await openStable(pg, url);
  await pg.waitForSelector("tbody tr", { timeout: 90000 }).catch(() => console.log("no rows"));
  await pg.waitForTimeout(1500);
  console.log(side, JSON.stringify(await pg.evaluate(() => ({ rows: document.querySelectorAll("tbody tr").length, btns: [...new Set([...document.querySelectorAll("tbody button")].map((x) => x.textContent.trim()))].slice(0, 12), text: [...document.querySelectorAll("tbody td")].map((t) => t.innerText).filter((t) => /Assign|replacement/.test(t)).slice(0, 3) }))));
  await c.close();
}
await b.close();
