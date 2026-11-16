import { NEXT, PROTO, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
const b = await launch();
for (const [n, u] of [["proto", PROTO + "/prototype/chair/isbm2026/peer-review/manage"], ["next", NEXT + "/chair/isbm2026/peer-review/manage"]]) {
  const ctx = await newContext(b, VIEWPORTS[0], true); const pg = await ctx.newPage();
  await openStable(pg, u); await pg.waitForTimeout(1200);
  await pg.getByRole("button", { name: "Settings", exact: true }).or(pg.getByRole("tab", { name: "Settings", exact: true })).first().click(); await pg.waitForTimeout(1000);
  const r = { url0: pg.url().replace(/^https?:\/\/[^/]+/, "") };
  r.rows = await pg.getByRole("button", { name: /See how email looks/ }).count();
  r.editBtns = await pg.getByText(/Edit template/).count();
  await pg.getByRole("button", { name: /See how email looks/ }).first().click(); await pg.waitForTimeout(1500);
  r.afterSee = { url: pg.url().replace(/^https?:\/\/[^/]+/, "") === r.url0 ? "same" : "navigated", hide: await pg.getByRole("button", { name: /Hide email/ }).count(), subject: await pg.evaluate(() => (document.body.innerText.match(/Subject:\s*[^\n]+/) || [null])[0]), frame: await pg.locator("iframe").count() };
  await pg.getByRole("button", { name: /Hide email/ }).first().click().catch(() => {}); await pg.waitForTimeout(300); r.hidden = await pg.getByRole("button", { name: /Hide email/ }).count() === 0;
  const editEl = pg.getByText(/Edit template/).first(); await editEl.click(); await pg.waitForTimeout(2500);
  r.afterEdit = { url: pg.url().replace(/^https?:\/\/[^/]+/, "").slice(0, 120), dialog: await pg.evaluate(() => { const d = document.querySelector("dialog[open]"); return d ? d.innerText.replace(/\s+/g, " ").slice(0, 120) : (document.body.innerText.match(/Reviewer .*|Review reminder[^\n]*/) || [null])[0]; }), back: await pg.getByText(/Back to/).count() };
  console.log(n, JSON.stringify(r, null, 1)); await ctx.close();
}
await b.close();
