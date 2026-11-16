import { PROTO, VIEWPORTS } from "./pages.mjs";
import { launch, newContext, openStable } from "./lib.mjs";
const b = await launch();
let name = "";
for (const [k, url] of [["next", "http://localhost:3102/chair/isbm2026/settings/email-templates"], ["proto", `${PROTO}/prototype/chair/isbm2026/settings/email-templates`]]) {
  const ctx = await newContext(b, VIEWPORTS[0], true); const pg = await ctx.newPage();
  pg.on("pageerror", (e) => console.log(k, "pageerror", String(e).slice(0, 160)));
  await openStable(pg, url); await pg.waitForTimeout(2500);
  if (k === "next") { const btn = pg.getByRole("button", { name: /^Edit / }).first(); name = ((await btn.getAttribute("aria-label")) || "").replace(/^Edit\s*/, ""); console.log("template:", name); await btn.click(); }
  else await pg.getByText(name, { exact: true }).first().click();
  await pg.waitForTimeout(1500);
  await pg.screenshot({ path: `out/dd/et-${k}.png` });
}
await b.close();
