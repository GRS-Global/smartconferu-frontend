import { NEXT_SCREEN, PROTO, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
const b = await launch(); const out = {};
for (const [n, u] of [["proto", PROTO + "/prototype/chair/isbm2026/peer-review"], ["next", NEXT_SCREEN + "/chair/isbm2026/peer-review"]]) {
  const ctx = await newContext(b, VIEWPORTS[0], true); const pg = await ctx.newPage();
  await openStable(pg, u); await pg.waitForSelector("tbody tr"); await pg.waitForTimeout(600);
  const r = {};
  await pg.locator("thead select").first().selectOption("waiting"); await pg.waitForTimeout(500);
  r.strip = await pg.evaluate(() => (document.body.innerText.match(/\d+ reviews? (is|are) overdue\.?/) || [null])[0]);
  r.stripButton = await pg.evaluate(() => [...document.querySelectorAll("button")].map((x) => x.textContent.trim()).find((t) => /^Send reminder to \d+ overdue|All reminded/.test(t)) || null);
  r.rowButtons = await pg.getByRole("button", { name: /^Send reminder$/ }).count();
  await pg.getByRole("button", { name: /^Send reminder$/ }).first().click(); await pg.waitForTimeout(700);
  r.toast = await pg.evaluate(() => { const t = document.querySelector("[role=status]"); return t ? t.innerText.replace(/\s+/g, " ").trim() : null; });
  r.reminded = await pg.getByText("Reminded", { exact: true }).count();
  r.rowButtonsAfter = await pg.getByRole("button", { name: /^Send reminder$/ }).count();
  await pg.locator("thead select").first().selectOption("needs"); await pg.waitForTimeout(300);
  await pg.locator("tbody input[type=checkbox]").first().click(); await pg.waitForTimeout(200);
  r.bulkHasRemind = await pg.getByRole("button", { name: /^Send reminder$/ }).count() > 0;
  out[n] = r; await ctx.close();
}
console.log(JSON.stringify(out, null, 1)); await b.close();
