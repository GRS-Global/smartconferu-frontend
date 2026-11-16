import { NEXT, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
const b = await launch(); const ctx = await newContext(b, VIEWPORTS[0], true); const pg = await ctx.newPage(); const r = {};
await openStable(pg, NEXT + "/chair/isbm2026/peer-review/manage"); await pg.waitForTimeout(2000);
await pg.getByRole("button", { name: /Edit form/ }).first().click(); await pg.waitForTimeout(800);
const labels = () => pg.evaluate(() => [...document.querySelectorAll("section[id^='fb-sec-'] .group\\/f")].map((e) => e.querySelector(".text-sm.font-semibold")?.textContent?.trim()));
const secNames = () => pg.evaluate(() => [...document.querySelectorAll("nav[aria-label='Sections'] li")].map((e) => e.textContent.trim()));
r.fieldsBefore = (await labels()).slice(0, 4);
r.draggable = await pg.locator("section[id^='fb-sec-'] .group\\/f[draggable='true']").count();
r.lockedNotDraggable = await pg.locator("section[id^='fb-sec-'] .group\\/f[draggable='false']").count();
// drag the first field of the first section onto the third
const rows = pg.locator("section[id^='fb-sec-']").first().locator(".group\\/f");
const n = await rows.count();
await rows.nth(0).dragTo(rows.nth(Math.min(2, n - 1)));
await pg.waitForTimeout(400);
r.fieldsAfter = (await labels()).slice(0, 4);
r.saved = await pg.getByText(/All changes saved|Saving/).first().textContent();
// sections
r.secBefore = await secNames();
const items = pg.locator("nav[aria-label='Sections'] li");
if (await items.count() > 1) { await items.nth(0).dragTo(items.nth(1)); await pg.waitForTimeout(400); }
r.secAfter = await secNames();
console.log(JSON.stringify(r, null, 1)); await b.close();
