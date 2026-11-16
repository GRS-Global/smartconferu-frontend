import { PROTO, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
const b = await launch();
for (const [k, url] of [["proto", `${PROTO}/prototype/author/isbm2026/feedback`], ["next", "http://localhost:3102/author/isbm2026/feedback"]]) {
  const ctx = await newContext(b, VIEWPORTS[0], true); const pg = await ctx.newPage();
  pg.on("pageerror", (e) => console.log(k, "pageerror", String(e).slice(0, 160)));
  await openStable(pg, url); await pg.waitForTimeout(2500);
  await pg.screenshot({ path: `out/dd/fb-${k}-0.png`, fullPage: true });
  const preview = pg.getByRole("button", { name: "Preview the form" });
  if (await preview.count()) { await preview.click(); await pg.waitForTimeout(500); }
  await pg.getByRole("radio", { name: /Excellent/ }).click(); await pg.waitForTimeout(500);
  await pg.screenshot({ path: `out/dd/fb-${k}-1.png`, fullPage: true });
  console.log(k, "ok");
}
await b.close();
