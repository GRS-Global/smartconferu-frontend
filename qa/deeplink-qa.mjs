// Phase 3B task 1: notification deep link into the screening tables. Direct navigation with ?search=, URL clean-up, refresh, a second soft navigation,
// rejection of a bad value, and the prototype's own result for the same filter (ID box typed by hand = what its `initialSearch` sets).
import { PROTO, NEXT_SCREEN, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
const b = await launch();
const ctx = async () => { const c = await newContext(b, VIEWPORTS[0], true); return [c, await c.newPage()]; };
const rows = (pg) => pg.evaluate(() => [...document.querySelectorAll("tbody tr")].map((tr) => (tr.querySelector("td:nth-child(2) button") || tr.querySelector("td:nth-child(2) [class*='text-[13px]']"))?.textContent.trim()).filter(Boolean));
const settle = async (pg) => { await pg.waitForSelector("tbody tr", { timeout: 60000 }); await pg.waitForFunction(() => !location.search, null, { timeout: 8000 }).catch(() => undefined); await pg.waitForTimeout(300); };
const idBox = (pg) => pg.getByPlaceholder("Search ID").inputValue();
const path = (pg) => pg.url().replace(/^https?:\/\/[^/]+/, "");
for (const kind of ["initial-check", "plagiarism"]) {
  // prototype reference: the same filter set by hand
  let [c, pg] = await ctx(); await openStable(pg, `${PROTO}/prototype/chair/isbm2026/${kind}`); await pg.getByPlaceholder("Search ID").fill("ISBM-750");
  const ref = { rows: await rows(pg), id: await idBox(pg) }; await c.close();
  // Next: direct navigation
  [c, pg] = await ctx(); await openStable(pg, `${NEXT_SCREEN}/chair/isbm2026/${kind}?search=ISBM-750`); await settle(pg);
  const direct = { rows: await rows(pg), id: await idBox(pg), url: path(pg) };
  console.log(kind, "reference rows", JSON.stringify(ref.rows), "| direct", JSON.stringify(direct), direct.id === ref.id && JSON.stringify(direct.rows) === JSON.stringify(ref.rows) ? "SAME" : "DIFF");
  // filter can still be changed and cleared
  await pg.getByRole("button", { name: /Clear filters/ }).click(); const cleared = (await rows(pg)).length;
  // refresh: the URL has no ?search= any more, so the whole table is back (the prototype loses the filter on refresh as well)
  await pg.goto(`${NEXT_SCREEN}/chair/isbm2026/${kind}`); await settle(pg);
  console.log(kind, "after Clear filters rows:", cleared, "| after refresh id box:", JSON.stringify(await idBox(pg)), "rows>6:", (await rows(pg)).length > 6, "url", path(pg));
  // refresh straight after a deep link (before anything else): the clean URL means no filter
  await pg.goto(`${NEXT_SCREEN}/chair/isbm2026/${kind}?search=ISBM-750`); await settle(pg); await pg.reload(); await settle(pg);
  console.log(kind, "deep link then reload -> id box", JSON.stringify(await idBox(pg)), "url", path(pg));
  // a bad value is ignored and removed
  await pg.goto(`${NEXT_SCREEN}/chair/isbm2026/${kind}?search=%3Cscript%3E`); await settle(pg);
  console.log(kind, "bad value -> id box", JSON.stringify(await idBox(pg)), "url", path(pg));
  // soft navigation to a second paper while on the page
  await pg.goto(`${NEXT_SCREEN}/chair/isbm2026/${kind}?search=ISBM-753`); await settle(pg);
  console.log(kind, "second paper -> id box", JSON.stringify(await idBox(pg)), JSON.stringify(await rows(pg)));
  await c.close();
}
// the notification's own link (mock data): a new_version notification points at the ported Initial Check, in the app (no prototype redirect)
const [c, pg] = await ctx(); await openStable(pg, "http://localhost:3100/notifications"); await pg.waitForTimeout(1000);
const links = await pg.evaluate(() => [...document.querySelectorAll("a")].filter((a) => /Initial Check/.test(a.textContent)).map((a) => ({ text: a.textContent.trim(), href: a.getAttribute("href"), target: a.getAttribute("target") })));
console.log("notification links:", JSON.stringify(links));
await b.close();
