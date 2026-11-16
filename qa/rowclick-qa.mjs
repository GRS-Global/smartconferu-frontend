import { NEXT, NEXT_SCREEN, PROTO, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
const b = await launch();
const out = {};
// list: row click vs controls (both apps, same data on 3102 / prototype)
for (const [n, u] of [["proto", PROTO + "/prototype/chair/isbm2026/peer-review"], ["next", NEXT_SCREEN + "/chair/isbm2026/peer-review"]]) {
  const ctx = await newContext(b, VIEWPORTS[0], true); const pg = await ctx.newPage();
  await openStable(pg, u); await pg.waitForSelector("tbody tr"); await pg.waitForTimeout(600);
  const start = pg.url(); const r = {};
  await pg.locator("tbody input[type=checkbox]").nth(1).click(); await pg.waitForTimeout(400); r.checkboxStays = pg.url() === start;
  await pg.locator("tbody tr").nth(2).locator("td").nth(2).click({ position: { x: 8, y: 30 } }); await pg.waitForTimeout(1500);
  r.rowClickOpens = /\/submissions\/.+\/chair\/review/.test(pg.url()) || /submissions/.test(await pg.evaluate(() => location.pathname));
  r.url = pg.url().replace(/^https?:\/\/[^/]+/, "");
  r.queueCard = await pg.getByText(/Paper \d+ of \d+/).count() > 0;
  out[n] = r; await ctx.close();
}
console.log(JSON.stringify(out));
// review page controls on the mock (3100, DSAI-5: 1 review in, 3 reviewers)
const ctx = await newContext(b, VIEWPORTS[0], true); const pg = await ctx.newPage();
await openStable(pg, NEXT + "/submissions/DSAI-5/chair/review"); await pg.waitForTimeout(2500);
await pg.getByRole("button", { name: /Add reviewer/ }).first().click(); await pg.waitForTimeout(1500);
console.log("add dialog:", await pg.getByText("Add reviewers", { exact: true }).count(), "tabs", await pg.getByRole("tab").count(), "pool rows", await pg.locator("dialog label:has(input[type=checkbox])").count());
await pg.keyboard.press("Escape"); await pg.waitForTimeout(400);
console.log("buttons:", await pg.evaluate(() => [...document.querySelectorAll("main button, main a")].map((x) => x.textContent.trim()).filter((t) => /Paper details|View submission|Download|Add review|Add reviewer|View & edit|Share|Shared|Record decision/.test(t))));
await b.close();
