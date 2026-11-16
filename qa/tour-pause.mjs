import { NEXT, PROTO, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
const b = await launch();
for (const [k, url] of [["proto", PROTO + "/prototype/chair/isbm2026/settings"], ["next", (process.env.NEXT_URL || NEXT) + "/chair/isbm2026/settings"]]) {
  const ctx = await newContext(b, VIEWPORTS[0], true); const pg = await ctx.newPage();
  await openStable(pg, url); await pg.waitForTimeout(2500);
  await pg.getByRole("button", { name: /Take a tour/i }).first().click(); await pg.waitForTimeout(1500);
  for (let i = 0; i < 20; i++) {
    const pop = pg.locator("[data-tour-popover]");
    const title = await pop.locator("h4").first().textContent().catch(() => "");
    if (title === "Submissions") break;
    const later = pop.getByRole("button", { name: /I'll do this later/ });
    const open = pop.getByRole("button", { name: /^Open Conference/ });
    const t = (await later.count()) ? later : (await open.count()) ? open : pop.getByRole("button", { name: /^(Next|Finish)$/ });
    await t.first().click(); await pg.waitForTimeout(3000);
  }
  await pg.locator("[data-tour-popover]").getByRole("button", { name: /^Open Submission/ }).click(); await pg.waitForTimeout(3500);
  const pill = pg.getByText(/tour paused/i);
  console.log(k, "url", pg.url().replace(/^https?:\/\/[^/]+/, ""), "paused pill:", await pill.count(), "| continue btn:", await pg.getByRole("button", { name: /Continue tour/i }).count(), "| popover:", await pg.locator("[data-tour-popover]").count());
  await pg.screenshot({ path: `out/det/tour-pause-${k}.png` });
  const cont = pg.getByRole("button", { name: /Continue tour/i });
  if (await cont.count()) { await cont.first().click(); await pg.waitForTimeout(3500); console.log(k, "after continue:", await pg.locator("[data-tour-popover] h4").first().textContent().catch(() => "none")); }
}
await b.close();
