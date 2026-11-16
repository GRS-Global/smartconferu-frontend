import { NEXT_SCREEN, PROTO, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
const b = await launch();
for (const [n, u] of [["proto", PROTO + "/prototype/chair/isbm2026/peer-review"], ["next", NEXT_SCREEN + "/chair/isbm2026/peer-review"]]) {
  const ctx = await newContext(b, VIEWPORTS[0], true); const pg = await ctx.newPage();
  await openStable(pg, u); await pg.waitForSelector("tbody tr"); await pg.waitForTimeout(500);
  await pg.getByRole("button", { name: /^Columns/ }).click(); await pg.getByLabel("Plagiarism %").check(); await pg.getByLabel("Avg confidence").check(); await pg.mouse.click(5, 5); await pg.waitForTimeout(400);
  console.log(n, await pg.evaluate(() => [...document.querySelectorAll("tbody tr")].slice(0, 8).map((r) => r.children[1].innerText.trim() + ":" + [...r.children].slice(-2).map((c) => c.innerText.replace(/\s+/g, " ").trim()).join("/"))));
  await ctx.close();
}
await b.close();
