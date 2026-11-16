import { NEXT, PROTO, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
const b = await launch(); const out = {};
for (const [n, u] of [["proto", PROTO + "/prototype/chair/isbm2026/peer-review/reviewers"], ["next", NEXT + "/chair/isbm2026/peer-review/reviewers"]]) {
  const ctx = await newContext(b, VIEWPORTS[0], true); const pg = await ctx.newPage();
  await openStable(pg, u); await pg.waitForSelector("tbody tr"); await pg.waitForTimeout(800);
  const r = {};
  r.heads = await pg.evaluate(() => [...document.querySelectorAll("thead th")].map((t) => t.innerText.split("\n")[0].trim()));
  r.cells = await pg.evaluate(() => [...document.querySelectorAll("tbody > tr")].slice(0, 4).map((tr) => [...tr.children].slice(-4, -2).map((c) => c.innerText.replace(/\s+/g, " ").trim())));
  r.ontimeOptions = await pg.evaluate(() => { const s = [...document.querySelectorAll("thead select")].find((x) => /90%/.test(x.innerText)); return s ? [...s.options].map((o) => o.textContent.trim()) : null; });
  await pg.getByRole("button", { name: /^Edit /i }).first().click().catch(async () => { await pg.locator("tbody button[aria-label^='Edit']").first().click(); });
  await pg.waitForTimeout(600);
  r.dialog = await pg.evaluate(() => { const d = document.querySelector("dialog[open]") || document.querySelector(".ui-accent-card"); return d ? d.innerText.replace(/\s+/g, " ").trim().slice(0, 420) : null; });
  out[n] = r; await ctx.close();
}
console.log(JSON.stringify(out, null, 1)); await b.close();
